import type { PaymentIntent, PaymentReceipt } from "@/src/types/payment";

export function buildMockReceipt(
  intent: PaymentIntent,
  meta?: { mode?: "mock" | "hybrid"; fallbackReason?: string }
): PaymentReceipt {
  return {
    runId: intent.runId,
    proofHash: intent.proofHash,
    mode: meta?.mode ?? "mock",
    txHash: `0xmock_${Date.now().toString(16)}_${intent.proofHash.slice(2, 8)}`,
    settledAt: new Date().toISOString(),
    amountUsdc: intent.amountUsdc,
    payeeAddress: intent.payeeAddress,
  };
}
