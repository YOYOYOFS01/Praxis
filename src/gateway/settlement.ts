/**
 * Settlement Engine
 *
 * Handles two settlement modes:
 *   - "pre-signed"  — verify a USDC Transfer that the agent executed on-chain before retrying
 *   - "facilitator" — server-side wallet calls transferFrom(payer, payTo, amount)
 *
 * All chain values (RPC URL, USDC address, chain ID) come from getChainConfig().
 * Amount comparisons always use parseUnits(amount, 6) — never parseFloat.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 9.4
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hash,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia, base } from "viem/chains"
import { getChainConfig } from "./chain-config"
import type { PaymentAuthorization } from "./eip712-signer"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SettlementMode = "pre-signed" | "facilitator"

export interface SettlementResult {
  /** Transaction hash of the USDC transfer, or null if not yet mined */
  txHash: string | null
  /** ISO datetime string of when settlement was confirmed */
  confirmedAt: string
  /** Which settlement mode was used */
  mode: SettlementMode
  /** Block number where the transfer was confirmed, or null */
  blockNumber: bigint | null
}

// ---------------------------------------------------------------------------
// ABIs
// ---------------------------------------------------------------------------

/** Minimal Transfer event ABI — used with publicClient.getLogs */
const usdcTransferAbi = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
])

/** Minimal transferFrom function ABI — used with walletClient.writeContract */
const usdcTransferFromAbi = parseAbi([
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
])

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Timeout in milliseconds to wait for transaction receipt.
 * Reads GATEWAY_SETTLEMENT_TIMEOUT_MS from env, defaults to 30000.
 */
function getSettlementTimeoutMs(): number {
  const raw = process.env.GATEWAY_SETTLEMENT_TIMEOUT_MS
  if (raw) {
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return 30_000
}

// ---------------------------------------------------------------------------
// Chain helpers
// ---------------------------------------------------------------------------

/**
 * Returns the viem chain object that matches the given numeric chainId.
 * Extend this mapping if more chains are added to chain-config.ts.
 */
function viemChainById(chainId: number) {
  switch (chainId) {
    case 84532:
      return baseSepolia
    case 8453:
      return base
    default:
      throw new Error(
        `[settlement] No viem chain object found for chainId ${chainId}. ` +
          `Add it to the viemChainById switch in src/gateway/settlement.ts.`
      )
  }
}

/**
 * Parse a numeric chainId from a CAIP-2 network string, e.g. "eip155:84532" → 84532.
 */
function parseChainId(network: string): number {
  const parts = network.split(":")
  if (parts.length !== 2) {
    throw new Error(
      `[settlement] Invalid CAIP-2 network string "${network}". Expected format "eip155:<chainId>".`
    )
  }
  const chainId = parseInt(parts[1], 10)
  if (isNaN(chainId)) {
    throw new Error(
      `[settlement] Cannot parse chainId from network string "${network}".`
    )
  }
  return chainId
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Settle a USDC payment for the given authorization.
 *
 * @param authorization  - EIP-712 PaymentAuthorization signed by the payer
 * @param mode           - "pre-signed" | "facilitator"
 * @param confirmations  - 0 = accept on submission; ≥1 = wait for N blocks
 * @param correlationId  - Threaded through every log line for end-to-end tracing
 */
export async function settlePayment(
  authorization: PaymentAuthorization,
  mode: SettlementMode,
  confirmations: number,
  correlationId: string
): Promise<SettlementResult> {
  const tag = `[${correlationId}]`

  // -- Resolve chain --------------------------------------------------------
  const chainId = parseChainId(authorization.network)
  const chainConfig = getChainConfig(chainId)
  const chain = viemChainById(chainId)

  console.log(
    `${tag} settlePayment start`,
    JSON.stringify({
      mode,
      confirmations,
      payer: authorization.payer,
      payTo: authorization.payTo,
      amount: authorization.amount,
      network: authorization.network,
    })
  )

  if (mode === "pre-signed") {
    return settlePreSigned(
      authorization,
      chainConfig,
      chain,
      confirmations,
      correlationId
    )
  }

  if (mode === "facilitator") {
    return settleFacilitator(
      authorization,
      chainConfig,
      chain,
      confirmations,
      correlationId
    )
  }

  // TypeScript exhaustiveness guard — should never reach here
  throw new Error(`${tag} Unknown settlement mode: ${mode as string}`)
}

// ---------------------------------------------------------------------------
// pre-signed mode
// ---------------------------------------------------------------------------

async function settlePreSigned(
  authorization: PaymentAuthorization,
  chainConfig: ReturnType<typeof getChainConfig>,
  chain: ReturnType<typeof viemChainById>,
  confirmations: number,
  correlationId: string
): Promise<SettlementResult> {
  const tag = `[${correlationId}]`

  const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl),
  })

  const expectedAmount = parseUnits(authorization.amount, 6)

  console.log(
    `${tag} [pre-signed] querying Transfer logs`,
    JSON.stringify({
      usdcAddress: chainConfig.usdcAddress,
      from: authorization.payer,
      to: authorization.payTo,
      expectedAmount: expectedAmount.toString(),
    })
  )

  // Fetch Transfer(from, to, value) logs for this payer → payTo pair
  const logs = await publicClient.getLogs({
    address: chainConfig.usdcAddress as Address,
    event: usdcTransferAbi[0],
    args: {
      from: authorization.payer as Address,
      to: authorization.payTo as Address,
    },
  })

  // Find the first log whose value matches the expected amount exactly
  const matchingLog = logs.find(
    (log) =>
      log.args.value !== undefined && log.args.value === expectedAmount
  )

  if (!matchingLog) {
    console.log(
      `${tag} [pre-signed] no matching Transfer log found`,
      JSON.stringify({
        logsFound: logs.length,
        expectedAmount: expectedAmount.toString(),
      })
    )
    throw new Error(
      `[${correlationId}] settlement pre-signed: transfer_not_found. ` +
        `No USDC Transfer(${authorization.payer} → ${authorization.payTo}) ` +
        `for amount ${authorization.amount} USDC found on chain ${chainConfig.name}.`
    )
  }

  const txHash = matchingLog.transactionHash as Hash
  let blockNumber = matchingLog.blockNumber ?? null

  console.log(
    `${tag} [pre-signed] Transfer log found txHash=${txHash} blockNumber=${blockNumber}`
  )

  if (confirmations >= 1) {
    console.log(
      `${tag} [pre-signed] waiting for ${confirmations} confirmations, timeout=${getSettlementTimeoutMs()}ms`
    )
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations,
      timeout: getSettlementTimeoutMs(),
    })
    blockNumber = receipt.blockNumber

    console.log(
      `${tag} [pre-signed] receipt confirmed blockNumber=${receipt.blockNumber} status=${receipt.status}`
    )
  }

  const result: SettlementResult = {
    txHash,
    confirmedAt: new Date().toISOString(),
    mode: "pre-signed",
    blockNumber,
  }

  console.log(`${tag} [pre-signed] settlement complete`, JSON.stringify(result))
  return result
}

// ---------------------------------------------------------------------------
// facilitator mode
// ---------------------------------------------------------------------------

async function settleFacilitator(
  authorization: PaymentAuthorization,
  chainConfig: ReturnType<typeof getChainConfig>,
  chain: ReturnType<typeof viemChainById>,
  confirmations: number,
  correlationId: string
): Promise<SettlementResult> {
  const tag = `[${correlationId}]`

  const gatewayPrivateKey = process.env.GATEWAY_PRIVATE_KEY
  if (!gatewayPrivateKey) {
    throw new Error(
      `${tag} [facilitator] Missing required environment variable GATEWAY_PRIVATE_KEY. ` +
        `Set GATEWAY_PRIVATE_KEY to a 0x-prefixed hex private key for the facilitator wallet.`
    )
  }

  const account = privateKeyToAccount(gatewayPrivateKey as `0x${string}`)

  const publicClient = createPublicClient({
    chain,
    transport: http(chainConfig.rpcUrl),
  })

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chainConfig.rpcUrl),
  })

  const amountAtomic = parseUnits(authorization.amount, 6)

  console.log(
    `${tag} [facilitator] calling transferFrom`,
    JSON.stringify({
      usdcAddress: chainConfig.usdcAddress,
      from: authorization.payer,
      to: authorization.payTo,
      amount: amountAtomic.toString(),
    })
  )

  let txHash: Hash
  try {
    txHash = await walletClient.writeContract({
      account,
      address: chainConfig.usdcAddress as Address,
      abi: usdcTransferFromAbi,
      functionName: "transferFrom",
      args: [
        authorization.payer as Address,
        authorization.payTo as Address,
        amountAtomic,
      ],
      chain,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.log(
      `${tag} [facilitator] transferFrom reverted: ${message}`
    )
    throw new Error(
      `[${correlationId}] settlement facilitator: reason: "settlement_failed". ` +
        `USDC.transferFrom(${authorization.payer} → ${authorization.payTo}, ${authorization.amount}) reverted. ` +
        `Underlying error: ${message}`
    )
  }

  console.log(`${tag} [facilitator] transferFrom submitted txHash=${txHash}`)

  // Always wait for receipt in facilitator mode (we need a block number)
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: Math.max(confirmations, 1),
    timeout: getSettlementTimeoutMs(),
  })

  console.log(
    `${tag} [facilitator] receipt confirmed blockNumber=${receipt.blockNumber} status=${receipt.status}`
  )

  if (receipt.status === "reverted") {
    throw new Error(
      `[${correlationId}] settlement facilitator: reason: "settlement_failed". ` +
        `Transaction ${txHash} was reverted on-chain (blockNumber=${receipt.blockNumber}).`
    )
  }

  const result: SettlementResult = {
    txHash,
    confirmedAt: new Date().toISOString(),
    mode: "facilitator",
    blockNumber: receipt.blockNumber,
  }

  console.log(`${tag} [facilitator] settlement complete`, JSON.stringify(result))
  return result
}
