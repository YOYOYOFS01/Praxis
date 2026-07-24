/**
 * EIP-712 Payment Authorization Signer
 *
 * Constructs and signs typed EIP-712 PaymentAuthorization payloads.
 * Chain config is read from the centralized registry — no hardcoded chain IDs.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 9.2
 */

import { parseUnits, type TypedDataDomain } from "viem"
import { signTypedData } from "viem/accounts"
import { getChainConfig } from "./chain-config"

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * PaymentAuthorization struct — all 9 fields required for EIP-712 signing
 */
export interface PaymentAuthorization {
  /** Agent wallet address (checksummed) */
  payer: string
  /** Vendor receiver address */
  payTo: string
  /** USDC contract address (from ChainConfig) */
  asset: string
  /** CAIP-2 network identifier (from ChainConfig) */
  network: string
  /** Human-readable USDC string e.g. "1.00" — never Float */
  amount: string
  /** amount * 10^6 as string — for on-chain BigInt comparison */
  amountAtomicUnits: string
  /** URL of the protected resource */
  resource: string
  /** Nonce from the 402 response */
  nonce: string
  /** Unix timestamp — nonce expiry */
  expiry: number
}

// ---------------------------------------------------------------------------
// EIP-712 Type Definitions
// ---------------------------------------------------------------------------

/**
 * EIP-712 type definitions for PaymentAuthorization (viem TypedData format)
 */
const PaymentAuthorizationTypes = {
  PaymentAuthorization: [
    { name: "payer", type: "address" },
    { name: "payTo", type: "address" },
    { name: "asset", type: "address" },
    { name: "network", type: "string" },
    { name: "amount", type: "string" },
    { name: "amountAtomicUnits", type: "uint256" },
    { name: "resource", type: "string" },
    { name: "nonce", type: "string" },
    { name: "expiry", type: "uint256" },
  ],
} as const

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build EIP-712 domain for PraxisX402 protocol
 *
 * Reads chain from getChainConfig(chainId) — never hardcodes any chain ID.
 *
 * @param chainId - The numeric EVM chain ID
 * @returns EIP-712 domain object
 */
export function buildDomain(chainId: number): TypedDataDomain {
  // Validate chainId is supported by reading from ChainConfig
  // This will throw if chainId is not in SUPPORTED_CHAINS
  getChainConfig(chainId)

  return {
    name: "PraxisX402",
    version: "1",
    chainId,
  }
}

/**
 * Sign a PaymentAuthorization using EIP-712 typed data signing
 *
 * IMPORTANT: AGENT_PRIVATE_KEY must stay server-side only — this file must never
 * be imported from any app/ client path.
 *
 * @param authorization - The payment authorization data (without amountAtomicUnits)
 * @param privateKey - The agent's private key (0x-prefixed hex string)
 * @param chainId - The numeric chain ID from ChainConfig
 * @returns base64url-encoded JSON string containing {signature, authorization}
 */
export async function signPaymentAuthorization(
  authorization: Omit<PaymentAuthorization, "amountAtomicUnits">,
  privateKey: `0x${string}`,
  chainId: number
): Promise<string> {
  // Derive amountAtomicUnits using parseUnits — no parseFloat, no * 1_000_000
  // parseUnits does pure string/BigInt math with no floating-point arithmetic
  const amountAtomicUnits = parseUnits(authorization.amount, 6).toString()

  // Build complete authorization with derived atomic units
  const completeAuthorization: PaymentAuthorization = {
    ...authorization,
    amountAtomicUnits,
  }

  // Build domain from chain config
  const domain = buildDomain(chainId)

  // Sign using viem's signTypedData
  // Cast address fields to `0x${string}` as required by viem's type system.
  // These are always checksummed 0x-prefixed addresses at runtime.
  const signature = await signTypedData({
    privateKey,
    domain,
    types: PaymentAuthorizationTypes,
    primaryType: "PaymentAuthorization",
    message: {
      ...completeAuthorization,
      payer: completeAuthorization.payer as `0x${string}`,
      payTo: completeAuthorization.payTo as `0x${string}`,
      asset: completeAuthorization.asset as `0x${string}`,
      amountAtomicUnits: BigInt(amountAtomicUnits),
      expiry: BigInt(completeAuthorization.expiry),
    },
  })

  // Encode as base64url JSON
  const payload = {
    signature,
    authorization: completeAuthorization,
  }

  // Use Node.js Buffer with base64url encoding — no external library needed
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}
