/**
 * withX402 — Higher-Order Function for x402 Payment Enforcement
 *
 * Wraps any Next.js App Router handler with x402 payment gating.
 *
 * Flow:
 *   1. Mock/hybrid mode → short-circuit, call handler, inject mock:true
 *   2. No X-Payment header → issue 402 with a fresh nonce (no DB PaymentIntent)
 *   3. X-Payment present → create PaymentIntent, verify, settle or fail
 *
 * Requirements: 1.1–1.10, 2.1, 2.2, 8.2, 14.1, 17.4
 */

import { NextRequest, NextResponse } from "next/server"
import * as nodeCrypto from "crypto"
import { createNonce } from "@/src/gateway/nonce-registry"
import {
  createPaymentIntent,
  transitionIntent,
  findByIdempotencyKey,
} from "@/src/gateway/payment-intent"
import { getDefaultChain } from "@/src/gateway/chain-config"
import { getClientIp } from "@/src/lib/security/rate-limiter"

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface X402Config {
  /** e.g. "1.00" — always a string, never a number */
  amountUsdc: string
  /** Human-readable description of what the payment is for */
  description: string
  /** Override resource URL (defaults to req.url) */
  resource?: string
  /** USDC contract address (defaults to getDefaultChain().usdcAddress) */
  asset?: string
  /** Receiver wallet address (defaults to process.env.GATEWAY_PAY_TO) */
  payTo?: string
  /** CAIP-2 network identifier (defaults to getDefaultChain().caip2) */
  network?: string
  /** Nonce validity window in seconds. Default 300. Hard-capped at 300 by createNonce. */
  nonceTtlSeconds?: number
  /** If true (default), skip payment enforcement in mock/hybrid mode */
  skipInMockMode?: boolean
  /** Number of block confirmations to wait before settling (default 1) */
  confirmations?: number
}

// ---------------------------------------------------------------------------
// withX402
// ---------------------------------------------------------------------------

/**
 * Wraps a Next.js App Router handler with x402 payment enforcement.
 *
 * @param config   Payment configuration
 * @param handler  The route handler to protect
 * @returns        A new handler that enforces payment before calling the original
 */
export function withX402(
  config: X402Config,
  handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    // ── Resolve derived values ────────────────────────────────────────────

    const resource = config.resource ?? req.url

    const defaultChain = getDefaultChain()
    const asset = config.asset ?? defaultChain.usdcAddress
    const network = config.network ?? defaultChain.caip2

    const payTo = config.payTo ?? process.env.GATEWAY_PAY_TO
    if (!payTo) {
      throw new Error(
        "withX402: payTo address is required. " +
          "Set config.payTo or the GATEWAY_PAY_TO environment variable."
      )
    }

    // ── Step 1 — Mock mode short-circuit ──────────────────────────────────

    const paymentMode = process.env.PAYMENT_MODE ?? "mock"
    const skipInMock = config.skipInMockMode !== false // default true

    if ((paymentMode === "mock" || paymentMode === "hybrid") && skipInMock) {
      const response = await handler(req)

      // Inject mock:true into the JSON response body (best-effort)
      try {
        const responseBody = await response.json()
        return NextResponse.json(
          { ...responseBody, mock: true },
          { status: response.status }
        )
      } catch {
        // Non-JSON response — return as-is
        return response
      }
    }

    // ── Step 2 — No X-Payment header → issue 402 with nonce ──────────────

    const paymentHeader = req.headers.get("X-Payment")

    if (!paymentHeader) {
      const nonceRecord = await createNonce({
        resource,
        amountUsdc: config.amountUsdc,
        payTo,
        network,
        nonceTtlSeconds: config.nonceTtlSeconds,
        ipAddress: getClientIp(req),
      })

      return NextResponse.json(
        {
          amount: config.amountUsdc,
          payTo,
          nonce: nonceRecord.nonce,
          expiry: nonceRecord.expiresAt.toISOString(),
          asset,
          network,
        },
        {
          status: 402,
          headers: { "WWW-Authenticate": "x402" },
        }
      )
    }

    // ── Step 3 — X-Payment present → verify and settle ───────────────────

    // a) Correlation ID + idempotency key
    const correlationId =
      req.headers.get("X-Request-Id") ?? nodeCrypto.randomUUID()
    const idempotencyKey = req.headers.get("Idempotency-Key") ?? undefined

    // b) Idempotency check
    if (idempotencyKey) {
      const existingIntent = await findByIdempotencyKey(idempotencyKey)

      if (existingIntent) {
        if (existingIntent.status === "SETTLED") {
          return NextResponse.json(
            { settled: true, correlationId: existingIntent.correlationId },
            { status: 200 }
          )
        }
        if (existingIntent.status === "VERIFYING") {
          return NextResponse.json(
            { error: "Payment verification already in progress" },
            { status: 409 }
          )
        }
        // FAILED → allow retry (fall through)
      }
    }

    // c) Parse nonce from X-Payment header (base64url decode → JSON)
    let nonce: string
    try {
      const decoded = JSON.parse(
        Buffer.from(paymentHeader, "base64url").toString("utf8")
      ) as { authorization?: { nonce?: string } }
      const extractedNonce = decoded?.authorization?.nonce
      if (!extractedNonce) {
        return NextResponse.json(
          { error: "Missing nonce in payment header" },
          { status: 400 }
        )
      }
      nonce = extractedNonce
    } catch {
      return NextResponse.json(
        { error: "Invalid X-Payment header encoding" },
        { status: 400 }
      )
    }

    // d) Create PaymentIntent (CREATED state)
    await createPaymentIntent(
      nonce,
      {
        resource,
        amountUsdc: config.amountUsdc,
        payTo,
        chainId: defaultChain.chainId,
      },
      correlationId,
      idempotencyKey
    )

    // e) Transition CREATED → VERIFYING
    await transitionIntent(nonce, "VERIFYING")

    // f) Build X-Gateway-Token: HMAC-SHA256(secret, nonce) as hex
    const gatewaySecret = process.env.GATEWAY_INTERNAL_SECRET ?? ""
    const gatewayToken = nodeCrypto
      .createHmac("sha256", gatewaySecret)
      .update(nonce)
      .digest("hex")

    // g) Call /api/x402/verify
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const verifyUrl = `${appUrl}/api/x402/verify`

    let verifyResponse: {
      verified: boolean
      reason?: string
      paymentRecordId?: string
      [key: string]: unknown
    }

    try {
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Token": gatewayToken,
        },
        body: JSON.stringify({
          paymentHeader,
          resource,
          amountUsdc: config.amountUsdc,
          payTo,
          nonce,
          network,
          correlationId,
          confirmations: config.confirmations ?? 1,
          idempotencyKey,
        }),
      })

      verifyResponse = (await verifyRes.json()) as typeof verifyResponse
    } catch (err) {
      await transitionIntent(nonce, "FAILED", {
        failureReason: err instanceof Error ? err.message : "verify_fetch_failed",
      })
      return NextResponse.json(
        { error: "Payment verification service unavailable" },
        { status: 402 }
      )
    }

    // h) Handle verification result

    if (verifyResponse.verified) {
      // Success — call the wrapped handler
      const handlerResponse = await handler(req)

      // Transition to SETTLED
      await transitionIntent(nonce, "SETTLED", {
        paymentRecordId: verifyResponse.paymentRecordId,
      })

      // Attach payment response headers
      const headers = new Headers(handlerResponse.headers)
      headers.set("X-Payment-Response", JSON.stringify({ verified: true, nonce }))
      headers.set("X-Correlation-Id", correlationId)

      return new NextResponse(handlerResponse.body, {
        status: handlerResponse.status,
        headers,
      })
    } else {
      // Failure — transition to FAILED
      await transitionIntent(nonce, "FAILED", {
        failureReason: verifyResponse.reason ?? "verification_failed",
      })

      return NextResponse.json(
        {
          error: "Payment verification failed",
          reason: verifyResponse.reason ?? "verification_failed",
        },
        { status: 402 }
      )
    }
  }
}
