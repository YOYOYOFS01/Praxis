/**
 * Payment Intent Lifecycle Tracker
 *
 * Tracks the state of a payment attempt from the moment an X-Payment header
 * is received through to settlement or failure.
 *
 * Only created when an X-Payment header is present — never on a raw 402.
 * This prevents DB bloat from bots and crawlers that never intend to pay.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 14.2
 */

import { prisma } from "@/src/db/prisma"
import type { PaymentIntent } from "@prisma/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The four valid states of a PaymentIntent. Requirements: 8.1 */
export type PaymentIntentStatus = "CREATED" | "VERIFYING" | "SETTLED" | "FAILED"

export interface CreatePaymentIntentConfig {
  resource: string
  amountUsdc: string
  payTo: string
  payerAddress?: string
  chainId: number
}

export interface TransitionMeta {
  /** Set on SETTLED transition — links to the PaymentRecord row. Requirements: 8.3 */
  paymentRecordId?: string
  /** Set on FAILED transition — human-readable reason. Requirements: 8.4 */
  failureReason?: string
}

// ---------------------------------------------------------------------------
// Valid state-machine transitions
// ---------------------------------------------------------------------------

/**
 * Allowed transitions map.
 * SETTLED → * and FAILED → * are terminal — any attempt throws. Requirements: 8.5
 */
const VALID_TRANSITIONS: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
  CREATED: ["VERIFYING"],
  VERIFYING: ["SETTLED", "FAILED"],
  SETTLED: [],
  FAILED: [],
}

// ---------------------------------------------------------------------------
// createPaymentIntent
// ---------------------------------------------------------------------------

/**
 * Creates a new PaymentIntent row in the database with `status: "CREATED"`.
 *
 * - Only call this when an `X-Payment` header is present. Requirements: 8.2
 * - Looks up `NonceRecord.expiresAt` and copies it to `PaymentIntent.expiresAt`.
 * - Stores `correlationId` (from `X-Request-Id` or auto-generated). Requirements: 8.7
 * - Stores `idempotencyKey` if provided (unique index enforced by DB). Requirements: 8.6
 * - All amounts remain strings — no parseFloat. Requirements: 14.2
 *
 * @param nonce           The nonce from the payment header — must exist in NonceRecord.
 * @param config          Payment parameters (resource, amountUsdc, payTo, payerAddress?, chainId).
 * @param correlationId   From `X-Request-Id` header (or caller-generated UUID).
 * @param idempotencyKey  Optional deduplication key from `Idempotency-Key` header.
 */
export async function createPaymentIntent(
  nonce: string,
  config: CreatePaymentIntentConfig,
  correlationId: string,
  idempotencyKey?: string
): Promise<PaymentIntent> {
  // Look up the NonceRecord to copy expiresAt — binding the intent lifetime
  // to the nonce that was issued for this payment attempt.
  const nonceRecord = await prisma.nonceRecord.findUnique({
    where: { nonce },
  })

  if (!nonceRecord) {
    throw new Error(`NonceRecord not found for nonce: ${nonce}`)
  }

  const intent = await prisma.paymentIntent.create({
    data: {
      nonce,
      correlationId,
      idempotencyKey: idempotencyKey ?? null,
      resource: config.resource,
      amountUsdc: config.amountUsdc,
      payTo: config.payTo,
      payerAddress: config.payerAddress ?? null,
      chainId: config.chainId,
      status: "CREATED",
      expiresAt: nonceRecord.expiresAt,
    },
  })

  return intent
}

// ---------------------------------------------------------------------------
// transitionIntent
// ---------------------------------------------------------------------------

/**
 * Transitions a PaymentIntent to a new status, enforcing the valid state machine.
 *
 * Valid transitions:
 *   CREATED   → VERIFYING  ✓
 *   VERIFYING → SETTLED    ✓  (sets settledAt + optional paymentRecordId)
 *   VERIFYING → FAILED     ✓  (sets failedAt  + optional failureReason)
 *   SETTLED   → *          ✗  throws
 *   FAILED    → *          ✗  throws
 *
 * Requirements: 8.3, 8.4, 8.5
 *
 * @param nonce   The nonce identifying the PaymentIntent to transition.
 * @param to      The target status.
 * @param meta    Optional metadata (paymentRecordId for SETTLED, failureReason for FAILED).
 */
export async function transitionIntent(
  nonce: string,
  to: PaymentIntentStatus,
  meta?: TransitionMeta
): Promise<void> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { nonce },
  })

  if (!intent) {
    throw new Error(`PaymentIntent not found for nonce: ${nonce}`)
  }

  const currentStatus = intent.status as PaymentIntentStatus
  const allowed = VALID_TRANSITIONS[currentStatus]

  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid PaymentIntent transition: ${currentStatus} → ${to}. ` +
        (allowed.length === 0
          ? `Status "${currentStatus}" is terminal — no further transitions are allowed.`
          : `Allowed transitions from "${currentStatus}": ${allowed.join(", ")}.`)
    )
  }

  const now = new Date()

  // Build the update payload based on target status
  const updateData: Record<string, unknown> = { status: to }

  if (to === "VERIFYING") {
    updateData.verifyingAt = now
  } else if (to === "SETTLED") {
    updateData.settledAt = now
    if (meta?.paymentRecordId !== undefined) {
      updateData.paymentRecordId = meta.paymentRecordId
    }
  } else if (to === "FAILED") {
    updateData.failedAt = now
    if (meta?.failureReason !== undefined) {
      updateData.failureReason = meta.failureReason
    }
  }

  await prisma.paymentIntent.update({
    where: { nonce },
    data: updateData,
  })
}

// ---------------------------------------------------------------------------
// findByIdempotencyKey
// ---------------------------------------------------------------------------

/**
 * Looks up a PaymentIntent by its idempotency key.
 * Returns `null` if no matching record is found.
 *
 * Used to detect and short-circuit duplicate payment submissions. Requirements: 8.6
 *
 * @param key  The idempotency key to look up.
 */
export async function findByIdempotencyKey(key: string): Promise<PaymentIntent | null> {
  return prisma.paymentIntent.findUnique({
    where: { idempotencyKey: key },
  })
}
