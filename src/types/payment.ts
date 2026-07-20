import type { ProofHash } from "./proof";

export interface PaymentIntent {
  runId: string;
  proofHash: ProofHash;
  payerAddress: string;
  payeeAddress: string;
  tokenAddress: string; // ERC-20 contract address
  amountUsdc: number;
  network: string;      // CAIP-2, e.g. "eip155:84532"
  createdAt: string;    // ISO 8601
}

export interface PaymentReceipt {
  runId: string;
  proofHash: ProofHash;
  mode: "mock" | "hybrid" | "x402";
  txHash: string | null;
  settledAt: string;
  amountUsdc: number;
  payeeAddress: string;
  x402PaymentHeader?: string; // raw header if real x402
}

export interface ChainAnchor {
  registryAddress: string;
  anchorTxHash: string;
  chainId: number;
  network: string;
  proofHash: ProofHash;
  eventName: "PraxisPaymentRecorded";
  anchoredAt: string;
}
