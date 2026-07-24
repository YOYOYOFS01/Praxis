/**
 * Chain Configuration Registry
 *
 * Single source of truth for all chain-specific values.
 * Every other gateway file imports from here — no other file hardcodes
 * a chain ID, contract address, or explorer URL.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

export interface ChainConfig {
  /** Numeric EVM chain ID */
  chainId: number
  /** CAIP-2 network identifier, e.g. "eip155:84532" */
  caip2: string
  /** Human-readable network name, e.g. "Base Sepolia" */
  name: string
  /** RPC endpoint — always resolved from an environment variable, never hardcoded */
  rpcUrl: string
  /** USDC contract address on this chain */
  usdcAddress: `0x${string}`
  /** Block explorer base URL */
  explorerUrl: string
  /** PraxisPaymentRegistry contract address, if deployed on this chain */
  registryAddress?: `0x${string}`
  /** Approximate block time in milliseconds — used for settlement wait estimation */
  blockTimeMs: number
}

// ---------------------------------------------------------------------------
// Supported chains
// ---------------------------------------------------------------------------

/**
 * Map of all supported chain IDs to their configuration.
 *
 * rpcUrl is resolved lazily from environment variables so that the module
 * can be imported in any context without throwing if a variable is missing
 * at module load time. The actual value is read when the config is accessed.
 */
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  /** Base Sepolia testnet — default chain */
  84532: {
    chainId: 84532,
    caip2: "eip155:84532",
    name: "Base Sepolia",
    // rpcUrl resolved at access time via getter — see buildSupportedChains()
    get rpcUrl(): string {
      const url = process.env.BASE_SEPOLIA_RPC_URL
      if (!url) {
        throw new Error(
          "Missing required environment variable BASE_SEPOLIA_RPC_URL for Base Sepolia (chainId 84532). " +
            "Set it in your .env file or deployment environment."
        )
      }
      return url
    },
    // USDC on Base Sepolia (well-known public address)
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    explorerUrl: "https://sepolia.basescan.org",
    blockTimeMs: 2000,
  },

  /** Base Mainnet — opt-in production chain */
  8453: {
    chainId: 8453,
    caip2: "eip155:8453",
    name: "Base Mainnet",
    get rpcUrl(): string {
      const url = process.env.BASE_MAINNET_RPC_URL
      if (!url) {
        throw new Error(
          "Missing required environment variable BASE_MAINNET_RPC_URL for Base Mainnet (chainId 8453). " +
            "Set it in your .env file or deployment environment."
        )
      }
      return url
    },
    // USDC on Base Mainnet (well-known public address)
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorerUrl: "https://basescan.org",
    blockTimeMs: 2000,
  },
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the ChainConfig for the given chainId.
 *
 * @param chainId - The numeric EVM chain ID to look up.
 *   If omitted, falls back to the default chain (same as getDefaultChain()).
 * @throws {Error} If the requested chainId is not in SUPPORTED_CHAINS.
 */
export function getChainConfig(chainId?: number): ChainConfig {
  if (chainId === undefined) {
    return getDefaultChain()
  }

  const config = SUPPORTED_CHAINS[chainId]
  if (!config) {
    const supported = Object.keys(SUPPORTED_CHAINS).join(", ")
    throw new Error(
      `Unsupported chainId: ${chainId}. ` +
        `The gateway only supports the following chain IDs: ${supported}. ` +
        `To add support for a new chain, add an entry to SUPPORTED_CHAINS in src/gateway/chain-config.ts.`
    )
  }

  return config
}

/**
 * Returns the ChainConfig for the default chain.
 *
 * Reads the DEFAULT_CHAIN_ID environment variable. If unset or empty,
 * falls back to Base Sepolia (chainId 84532).
 *
 * @throws {Error} If DEFAULT_CHAIN_ID is set to an unsupported chain ID.
 */
export function getDefaultChain(): ChainConfig {
  const envChainId = process.env.DEFAULT_CHAIN_ID

  if (envChainId) {
    const parsed = parseInt(envChainId, 10)
    if (isNaN(parsed)) {
      throw new Error(
        `Invalid DEFAULT_CHAIN_ID environment variable: "${envChainId}" is not a valid integer. ` +
          `Expected a numeric chain ID such as 84532 (Base Sepolia) or 8453 (Base Mainnet).`
      )
    }
    return getChainConfig(parsed)
  }

  // Default: Base Sepolia
  return SUPPORTED_CHAINS[84532]
}
