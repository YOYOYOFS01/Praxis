import type { PaymentIntent, PaymentReceipt } from "@/src/types/payment";
import { buildMockReceipt } from "./mock-payment";

const FACILITATOR_TIMEOUT_MS = 6000;

export async function executeX402Payment(intent: PaymentIntent): Promise<PaymentReceipt> {
  try {
    const receipt = await Promise.race([
      _callFacilitator(intent),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("FACILITATOR_TIMEOUT")), FACILITATOR_TIMEOUT_MS)
      ),
    ]);
    return receipt;
  } catch (err) {
    // Facilitator down or timed out — degrade to hybrid (real proof/anchor, mock settlement)
    console.warn("[x402-client] Facilitator failed, degrading to hybrid:", err);
    return buildMockReceipt(intent, { mode: "hybrid" });
  }
}

async function _callFacilitator(intent: PaymentIntent): Promise<PaymentReceipt> {
  const facilitatorUrl = process.env.FACILITATOR_URL;
  if (!facilitatorUrl) throw new Error("FACILITATOR_URL not set");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Step 1: Hit protected endpoint, expect HTTP 402
  const res402 = await fetch(`${appUrl}/api/vendor/protected-data`, { method: "GET" });
  if (res402.status !== 402) throw new Error(`Expected 402, got ${res402.status}`);

  // Step 2: In a real implementation, use the coinbase x402 SDK here:
  // const { signPayment } = await import("x402/client");
  // const paymentHeader = await signPayment(await res402.json(), wallet);
  // const paidRes = await fetch(url, { headers: { "X-Payment": paymentHeader } });

  // For now: return a shaped receipt — replace this with real SDK call
  return {
    runId: intent.runId,
    proofHash: intent.proofHash,
    mode: "x402",
    txHash: `0x_x402_${Date.now().toString(16)}`,
    settledAt: new Date().toISOString(),
    amountUsdc: intent.amountUsdc,
    payeeAddress: intent.payeeAddress,
  };
}
