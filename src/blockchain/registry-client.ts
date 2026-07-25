import type { PaymentIntent, ChainAnchor } from "@/src/types/payment";
import type { ProofOfReasoning } from "@/src/types/proof";

const RPC_TIMEOUT_MS = 8000;

/**
 * Single entry point for on-chain anchoring.
 * Always falls back to a mock anchor so RPC failures never crash the demo.
 */
export async function anchorPayment(
  intent: PaymentIntent,
  _proof: ProofOfReasoning
): Promise<ChainAnchor> {
  if (process.env.CHAIN_MODE === "mock") {
    return buildMockAnchor(intent);
  }

  try {
    const result = await Promise.race([
      _callRegistry(intent),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RPC_TIMEOUT")), RPC_TIMEOUT_MS)
      ),
    ]);
    return result;
  } catch (err) {
    console.warn("[registry-client] On-chain anchor failed, falling back to mock anchor:", err);
    return buildMockAnchor(intent, { fallback: true, reason: String(err) });
  }
}

async function _callRegistry(intent: PaymentIntent): Promise<ChainAnchor> {
  // Dynamic import so viem is not bundled in mock mode
  const { createWalletClient, http, parseAbi } = await import("viem");
  const { baseSepolia } = await import("viem/chains");
  const { privateKeyToAccount } = await import("viem/accounts");

  const REGISTRY_ABI = parseAbi([
    "function recordPayment(string runId, bytes32 proofHash, address payer, address payee, address token, uint256 amount) external",
  ]);

  const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL),
  });

  const hash = await walletClient.writeContract({
    address: process.env.PRAXIS_REGISTRY_ADDRESS as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "recordPayment",
    args: [
      intent.runId,
      intent.proofHash as `0x${string}`,
      intent.payerAddress as `0x${string}`,
      intent.payeeAddress as `0x${string}`,
      intent.tokenAddress as `0x${string}`,
      BigInt(Math.round(intent.amountUsdc * 1_000_000)), // USDC = 6 decimals
    ],
  });

  return {
    registryAddress: process.env.PRAXIS_REGISTRY_ADDRESS!,
    anchorTxHash: hash,
    chainId: 84532,
    network: "base-sepolia",
    proofHash: intent.proofHash,
    eventName: "PraxisPaymentRecorded",
    anchoredAt: new Date().toISOString(),
  };
}

function buildMockAnchor(intent: PaymentIntent, meta?: object): ChainAnchor {
  return {
    registryAddress: process.env.PRAXIS_REGISTRY_ADDRESS ?? "0xMOCK_REGISTRY",
    anchorTxHash: `0xmock_anchor_${intent.proofHash ? intent.proofHash.slice(2, 10) : "unknown"}_${Date.now().toString(16)}`,
    chainId: 84532,
    network: "base-sepolia",
    proofHash: intent.proofHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
    eventName: "PraxisPaymentRecorded",
    anchoredAt: new Date().toISOString(),
    ...(meta ?? {}),
  } as ChainAnchor;
}
