import type { PaymentIntent, PaymentReceipt } from "@/src/types/payment";
import { executeX402Payment } from "./x402-client";
import { buildMockReceipt } from "./mock-payment";

/**
 * Single entry point for payment execution.
 * Reads PAYMENT_MODE env var — never branches on it elsewhere.
 */
export async function executePayment(intent: PaymentIntent): Promise<PaymentReceipt> {
  const mode = process.env.PAYMENT_MODE ?? "mock";

  switch (mode) {
    case "x402":
      return executeX402Payment(intent); // falls back to hybrid internally on failure
    case "hybrid":
      return buildMockReceipt(intent, { mode: "hybrid" });
    case "mock":
    default:
      return buildMockReceipt(intent);
  }
}
