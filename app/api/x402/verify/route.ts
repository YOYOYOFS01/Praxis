/**
 * x402 Facilitator/Verifier Endpoint
 *
 * POST /api/x402/verify
 *
 * Validates an EIP-712 signed PaymentAuthorization, settles the USDC transfer,
 * and records the payment atomically. Called by the x402 middleware/gateway after
 * it receives an X-Payment header from the agent.
 *
 * Requirements: 3.1–3.10, 4.4, 4.5, 10.1–10.3, 15.8, 17.1, 17.2
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import * as nodeCrypto from "crypto"
import { recoverTypedDataAddress, parseUnits } from "viem"
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter"
import { logger } from "@/src/lib/security/logger"
import { prisma } from "@/src/db/prisma"
import { buildDomain, type PaymentAuthorization } from "@/src/gateway/eip712-signer"
import { getNonce, consumeNonce, validateNonceBinding } from "@/src/gateway/nonce-registry"
import { settlePayment, type SettlementMode } from "@/src/gateway/settlement"
import { transitionIntent } from "@/src/gateway/payment-intent"
import { enqueueWebhook } from "@/src/gateway/webhook-queue"

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const VerifyRequestSchema = z.object({
  paymentHeader:  z.string().min(1),
  resource:       z.string().url(),
  amountUsdc:     z.string().regex(/^\d+\.\d{2}$/),
  payTo:          z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  nonce:          z.string().uuid(),
  network:        z.string().min(1),
  correlationId:  z.string().uuid(),
  confirmations:  z.number().int().min(0),
  idempotencyKey: z.string().optional(),
})

type VerifyRequest = z.infer<typeof VerifyRequestSchema>

// ---------------------------------------------------------------------------
// EIP-712 type definitions (must match eip712-signer.ts exactly)
// ---------------------------------------------------------------------------

const PaymentAuthorizationTypes = {
  PaymentAuthorization: [
    { name: "payer",            type: "address" },
    { name: "payTo",            type: "address" },
    { name: "asset",            type: "address" },
    { name: "network",          type: "string"  },
    { name: "amount",           type: "string"  },
    { name: "amountAtomicUnits", type: "uint256" },
    { name: "resource",         type: "string"  },
    { name: "nonce",            type: "string"  },
    { name: "expiry",           type: "uint256" },
  ],
} as const

// ---------------------------------------------------------------------------
// HMAC validation helper
// ---------------------------------------------------------------------------

/**
 * Validate the `X-Gateway-Token` request header.
 *
 * Expected value: HMAC-SHA256(GATEWAY_INTERNAL_SECRET, nonce) as hex.
 * Uses `timingSafeEqual` to prevent timing attacks.
 *
 * Returns `false` if:
 *   - The header is absent
 *   - GATEWAY_INTERNAL_SECRET env var is missing
 *   - The computed HMAC doesn't match
 */
async function validateGatewayToken(req: NextRequest, nonce: string): Promise<boolean> {
  const header = req.headers.get("x-gateway-token")
  if (!header) return false

  const secret = process.env.GATEWAY_INTERNAL_SECRET
  if (!secret) return false

  const expected = nodeCrypto
    .createHmac("sha256", secret)
    .update(nonce)
    .digest("hex")

  // Use timingSafeEqual to compare — both buffers must be the same length
  const expectedBuf = Buffer.from(expected, "utf8")
  const receivedBuf = Buffer.from(header,   "utf8")

  if (expectedBuf.length !== receivedBuf.length) return false

  return nodeCrypto.timingSafeEqual(expectedBuf, receivedBuf)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse numeric chainId from a CAIP-2 string e.g. "eip155:84532" → 84532 */
function parseChainId(network: string): number {
  const parts = network.split(":")
  if (parts.length !== 2) {
    throw new Error(`Invalid CAIP-2 network string "${network}". Expected format "eip155:<chainId>".`)
  }
  const chainId = parseInt(parts[1], 10)
  if (isNaN(chainId)) {
    throw new Error(`Cannot parse chainId from network string "${network}".`)
  }
  return chainId
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // ── a) Rate limit — 60 req/min per IP ──────────────────────────────────
  const rl = rateLimit(ip, "x402-verify", { max: 60, windowMs: 60_000 })
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // ── b) Validate X-Gateway-Token early (we need a nonce first — parse body) ─
  // We must parse the body to extract the nonce for HMAC validation, so we
  // do a raw JSON parse here before full Zod validation.
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Extract nonce for HMAC validation — it may be missing/invalid at this point
  // but validateGatewayToken only uses it for HMAC so any string is safe here.
  const rawNonce =
    rawBody != null && typeof rawBody === "object" && "nonce" in rawBody
      ? String((rawBody as Record<string, unknown>).nonce)
      : ""

  const tokenValid = await validateGatewayToken(req, rawNonce)
  if (!tokenValid) {
    logger.warn("POST /api/x402/verify", "Invalid or missing X-Gateway-Token", { ip })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── c) Parse + validate body with Zod ──────────────────────────────────
  const parsed = VerifyRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const body: VerifyRequest = parsed.data

  try {
    // ── d) Decode paymentHeader ─────────────────────────────────────────
    let decoded: { signature: string; authorization: PaymentAuthorization }
    try {
      decoded = JSON.parse(Buffer.from(body.paymentHeader, "base64url").toString("utf8"))
    } catch {
      return NextResponse.json({ error: "Invalid paymentHeader encoding" }, { status: 400 })
    }

    const { signature, authorization } = decoded

    // ── e) Nonce lookup ─────────────────────────────────────────────────
    const nonceRecord = await getNonce(body.nonce)

    if (!nonceRecord) {
      await prisma.auditLog.create({
        data: {
          tenantId:  null,
          action:    "x402.payment_failed",
          actorType: "system",
          metadata:  JSON.stringify({ correlationId: body.correlationId, nonce: body.nonce, reason: "nonce_not_found" }),
          ipAddress: ip,
        },
      })
      return NextResponse.json({ verified: false, reason: "nonce_not_found" })
    }

    if (nonceRecord.status === "used") {
      await prisma.auditLog.create({
        data: {
          tenantId:  null,
          action:    "x402.replay_blocked",
          actorType: "system",
          metadata:  JSON.stringify({ correlationId: body.correlationId, nonce: body.nonce }),
          ipAddress: ip,
        },
      })
      return NextResponse.json({ verified: false, reason: "nonce_used" })
    }

    if (nonceRecord.status === "expired" || nonceRecord.expiresAt <= new Date()) {
      await prisma.auditLog.create({
        data: {
          tenantId:  null,
          action:    "x402.payment_failed",
          actorType: "system",
          metadata:  JSON.stringify({ correlationId: body.correlationId, nonce: body.nonce, reason: "nonce_expired" }),
          ipAddress: ip,
        },
      })
      return NextResponse.json({ verified: false, reason: "nonce_expired" })
    }

    // ── f) Signature verification ───────────────────────────────────────
    const chainId = parseChainId(body.network)
    const domain  = buildDomain(chainId)

    const amountAtomicUnits = parseUnits(authorization.amount, 6)

    let recoveredAddress: string
    try {
      recoveredAddress = await recoverTypedDataAddress({
        domain,
        types:       PaymentAuthorizationTypes,
        primaryType: "PaymentAuthorization",
        message: {
          payer:             authorization.payer  as `0x${string}`,
          payTo:             authorization.payTo  as `0x${string}`,
          asset:             authorization.asset  as `0x${string}`,
          network:           authorization.network,
          amount:            authorization.amount,
          amountAtomicUnits: amountAtomicUnits,
          resource:          authorization.resource,
          nonce:             authorization.nonce,
          expiry:            BigInt(authorization.expiry),
        },
        signature: signature as `0x${string}`,
      })
    } catch {
      await prisma.auditLog.create({
        data: {
          tenantId:  null,
          action:    "x402.payment_failed",
          actorType: "system",
          metadata:  JSON.stringify({ correlationId: body.correlationId, nonce: body.nonce, reason: "invalid_signature" }),
          ipAddress: ip,
        },
      })
      return NextResponse.json({ verified: false, reason: "invalid_signature" })
    }

    if (recoveredAddress.toLowerCase() !== authorization.payer.toLowerCase()) {
      await prisma.auditLog.create({
        data: {
          tenantId:  null,
          action:    "x402.payment_failed",
          actorType: "system",
          metadata:  JSON.stringify({ correlationId: body.correlationId, nonce: body.nonce, reason: "invalid_signature" }),
          ipAddress: ip,
        },
      })
      return NextResponse.json({ verified: false, reason: "invalid_signature" })
    }

    // ── g) Amount check ─────────────────────────────────────────────────
    if (authorization.amount !== body.amountUsdc) {
      return NextResponse.json({ verified: false, reason: "amount_mismatch" })
    }

    // ── h) Resource check ───────────────────────────────────────────────
    if (authorization.resource !== body.resource) {
      return NextResponse.json({ verified: false, reason: "resource_mismatch" })
    }

    // ── i) PayTo check ──────────────────────────────────────────────────
    if (authorization.payTo.toLowerCase() !== body.payTo.toLowerCase()) {
      return NextResponse.json({ verified: false, reason: "payto_mismatch" })
    }

    // ── j) Nonce binding ────────────────────────────────────────────────
    const bindingOk = await validateNonceBinding(
      body.nonce,
      body.resource,
      body.amountUsdc,
      body.payTo
    )
    if (!bindingOk) {
      return NextResponse.json({ verified: false, reason: "nonce_binding_mismatch" })
    }

    // ── k) Settlement ───────────────────────────────────────────────────
    const mode = (process.env.SETTLEMENT_MODE ?? "pre-signed") as SettlementMode

    let settlementResult: Awaited<ReturnType<typeof settlePayment>>
    try {
      settlementResult = await settlePayment(
        authorization,
        mode,
        body.confirmations,
        body.correlationId
      )
    } catch (err) {
      logger.error("POST /api/x402/verify", "Settlement failed", err)
      await prisma.auditLog.create({
        data: {
          tenantId:  null,
          action:    "x402.settlement_failed",
          actorType: "system",
          metadata:  JSON.stringify({ correlationId: body.correlationId, nonce: body.nonce }),
          ipAddress: ip,
        },
      })
      return NextResponse.json({ verified: false, reason: "settlement_failed" })
    }

    // ── l) Atomic DB transaction ────────────────────────────────────────
    let newRecord: { id: string }
    try {
      newRecord = await prisma.$transaction(async (tx) => {
        // 1. consumeNonce — must succeed atomically
        const consumed = await consumeNonce(body.nonce)
        if (!consumed) {
          throw new Error("NONCE_USED")
        }

        // 2. Create PaymentRecord
        const record = await tx.paymentRecord.create({
          data: {
            nonce:             body.nonce,
            paymentIntentId:   body.correlationId,   // correlationId maps to the intent
            resource:          body.resource,
            payerAddress:      authorization.payer,
            payTo:             authorization.payTo,
            amountUsdc:        body.amountUsdc,
            amountAtomicUnits: amountAtomicUnits.toString(),
            asset:             authorization.asset,
            network:           body.network,
            chainId,
            signature,
            txHash:            settlementResult.txHash,
            settlementMode:    mode,
            tenantId:          null,
          },
        })

        // 3. Transition intent to SETTLED
        await transitionIntent(body.nonce, "SETTLED", { paymentRecordId: record.id })

        return record
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message === "NONCE_USED") {
        return NextResponse.json({ verified: false, reason: "nonce_used" })
      }
      logger.error("POST /api/x402/verify", "DB transaction failed", err)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    // ── m) Webhook (fire-and-forget) ────────────────────────────────────
    void enqueueWebhook(
      "x402.payment.settled",
      {
        nonce:         body.nonce,
        correlationId: body.correlationId,
        resource:      body.resource,
        payerAddress:  authorization.payer,
        payTo:         authorization.payTo,
        amountUsdc:    body.amountUsdc,
        txHash:        settlementResult.txHash,
        settledAt:     settlementResult.confirmedAt,
        paymentRecordId: newRecord.id,
      },
      undefined  // tenantId — resolved in full webhook implementation (task 13.1)
    )

    // ── n) AuditLog — exactly one per successful call ───────────────────
    await prisma.auditLog.create({
      data: {
        tenantId:  null,
        action:    "x402.payment_verified",
        actorType: "system",
        metadata:  JSON.stringify({
          correlationId:   body.correlationId,
          nonce:           body.nonce,
          resource:        body.resource,
          payerAddress:    authorization.payer,
          amountUsdc:      body.amountUsdc,
          txHash:          settlementResult.txHash,
          paymentRecordId: newRecord.id,
        }),
        ipAddress: ip,
      },
    })

    logger.info("POST /api/x402/verify", "Payment verified", {
      correlationId: body.correlationId,
      nonce:         body.nonce,
      txHash:        settlementResult.txHash,
    })

    // ── o) Success response ─────────────────────────────────────────────
    return NextResponse.json(
      {
        verified:      true,
        txHash:        settlementResult.txHash,
        settledAt:     settlementResult.confirmedAt,
        payerAddress:  authorization.payer,
        correlationId: body.correlationId,
      },
      {
        headers: { "X-Correlation-Id": body.correlationId },
      }
    )
  } catch (err) {
    logger.error("POST /api/x402/verify", "Unhandled error", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
