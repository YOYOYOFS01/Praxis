/**
 * Nonce Registry
 *
 * Provides replay-attack prevention for the x402 Payment Gateway.
 * Every nonce is a server-generated UUID v4 — client-provided nonces
 * are never accepted. Nonce TTL is hard-capped at 300 seconds regardless
 * of what any caller passes.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.6, 4.8
 */

import { prisma } from "@/src/db/prisma"
import type { NonceRecord } from "@prisma/client"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateNonceConfig {
  resource: string
  amountUsdc: string
  payTo: string
  network: string
  /** Desired TTL in seconds. Defaults to 300. Hard-capped at 300. */
  nonceTtlSeconds?: number
  /** Optional IP address of the caller that triggered the 402 response. */
  ipAddress?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed nonce TTL in seconds — enforced server-side, never overridden by config. */
const MAX_NONCE_TTL_SECONDS = 300

// ---------------------------------------------------------------------------
// createNonce
// ---------------------------------------------------------------------------

/**
 * Creates a new nonce record in the database.
 *
 * - Generates a UUID v4 nonce server-side via `crypto.randomUUID()`.
 * - Hard-caps `expiresAt = min(now + nonceTtlSeconds, now + 300)`.
 * - Persists a `NonceRecord` with `status: "pending"`.
 *
 * Requirements: 4.1, 4.2
 */
export async function createNonce(config: CreateNonceConfig): Promise<NonceRecord> {
  const nonce = crypto.randomUUID()

  const now = Date.now()

  // Hard-cap: never allow a nonce TTL greater than MAX_NONCE_TTL_SECONDS
  const requestedTtlMs = (config.nonceTtlSeconds ?? MAX_NONCE_TTL_SECONDS) * 1_000
  const maxTtlMs = MAX_NONCE_TTL_SECONDS * 1_000
  const ttlMs = Math.min(requestedTtlMs, maxTtlMs)

  const expiresAt = new Date(now + ttlMs)

  const record = await prisma.nonceRecord.create({
    data: {
      nonce,
      resource: config.resource,
      amountUsdc: config.amountUsdc,
      payTo: config.payTo,
      network: config.network,
      status: "pending",
      expiresAt,
      ipAddress: config.ipAddress ?? null,
    },
  })

  return record
}

// ---------------------------------------------------------------------------
// consumeNonce
// ---------------------------------------------------------------------------

/**
 * Atomically transitions a nonce from `pending → used` inside a single
 * Prisma transaction. This ensures concurrent calls cannot both return `true`.
 *
 * Returns `true` only if this call is the one that performed the transition.
 * Returns `false` if:
 *   - The nonce does not exist
 *   - The nonce is already `used`
 *   - The nonce is `expired`
 *
 * Requirements: 4.3, 4.6
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  try {
    await prisma.$transaction(async (tx) => {
      // Lock the row by fetching it inside the transaction
      const record = await tx.nonceRecord.findUnique({
        where: { nonce },
      })

      // Reject if not found, already used, expired by status, or past expiresAt
      if (!record) {
        throw new Error("NONCE_NOT_FOUND")
      }

      if (record.status === "used") {
        throw new Error("NONCE_ALREADY_USED")
      }

      if (record.status === "expired") {
        throw new Error("NONCE_EXPIRED")
      }

      if (record.expiresAt <= new Date()) {
        throw new Error("NONCE_EXPIRED")
      }

      // Perform the atomic pending → used transition
      await tx.nonceRecord.update({
        where: { nonce },
        data: {
          status: "used",
          usedAt: new Date(),
        },
      })
    })

    // Transaction succeeded — this call performed the transition
    return true
  } catch {
    // Any error means we did NOT successfully consume the nonce
    return false
  }
}

// ---------------------------------------------------------------------------
// getNonce
// ---------------------------------------------------------------------------

/**
 * Looks up a nonce record by its nonce string.
 * Returns `null` if the nonce is not found.
 *
 * Requirements: 4.8 (binding validation support)
 */
export async function getNonce(nonce: string): Promise<NonceRecord | null> {
  return prisma.nonceRecord.findUnique({
    where: { nonce },
  })
}

// ---------------------------------------------------------------------------
// validateNonceBinding
// ---------------------------------------------------------------------------

/**
 * Validates that the nonce was issued for the exact combination of
 * `resource`, `amountUsdc`, and `payTo`.
 *
 * Returns `false` if:
 *   - The nonce does not exist
 *   - Any of the binding fields differ from the stored values
 *
 * All comparisons use string equality — no float conversion.
 *
 * Requirements: 4.8
 */
export async function validateNonceBinding(
  nonce: string,
  resource: string,
  amountUsdc: string,
  payTo: string
): Promise<boolean> {
  const record = await getNonce(nonce)

  if (!record) {
    return false
  }

  if (record.resource !== resource) {
    return false
  }

  if (record.amountUsdc !== amountUsdc) {
    return false
  }

  if (record.payTo !== payTo) {
    return false
  }

  return true
}
