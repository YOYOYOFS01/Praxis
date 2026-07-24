/**
 * Payment Executor
 *
 * Single entry point for payment execution.
 * Enforces firewall-before-x402: runPaymentFirewall() is called for ALL modes
 * before any payment is attempted.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

import type { PaymentIntent, PaymentReceipt } from "@/src/types/payment";
import type { ProofOfReasoning } from "@/src/types/proof";
import { executeX402Payment } from "./x402-client";
import { buildMockReceipt } from "./mock-payment";
import { runPaymentFirewall } from "./payment-firewall";
import { runStore } from "@/src/store/run-store";
import { prisma } from "@/src/db/prisma";

/**
 * Execute a payment for the given intent.
 *
 * @param intent        - The payment intent describing what to pay and to whom.
 * @param proof         - The proof of reasoning that guards this payment.
 * @param correlationId - Optional request correlation ID for audit tracing.
 *
 * Firewall is always run first. If it rejects the intent, the run is marked
 * failed and an error is thrown — no payment is attempted.
 */
export async function executePayment(
  intent: PaymentIntent,
  proof: ProofOfReasoning,
  correlationId?: string
): Promise<PaymentReceipt> {
  // 1. Run firewall FIRST — before any payment mode
  const firewallResult = runPaymentFirewall(intent, proof);
  if (!firewallResult.approved) {
    await runStore.setStatus(intent.runId, "failed");
    await runStore.addEvent(intent.runId, {
      type: "guard",
      label: `Firewall rejected: ${firewallResult.reason}`,
      status: "failed",
      payload: { reason: firewallResult.reason },
    });
    throw new Error(`Payment firewall rejected: ${firewallResult.reason}`);
  }

  // 2. Route to the appropriate payment mode
  const mode = process.env.PAYMENT_MODE ?? "mock";

  switch (mode) {
    case "x402": {
      // Execute x402 payment — falls back to hybrid internally on transient failure
      const receipt = await executeX402Payment(intent);

      // Link PaymentRecord.runId after a successful x402 payment.
      // The PaymentRecord was written by the Facilitator — match it by recency
      // and update its runId so it is traceable back to this run.
      if (receipt.mode === "x402") {
        try {
          await prisma.paymentRecord.updateMany({
            where: {
              runId: null,
              payerAddress: { not: "" },
              // Match records written within the last 30 seconds
              verifiedAt: { gte: new Date(Date.now() - 30_000) },
            },
            data: { runId: intent.runId },
          });
        } catch {
          // Non-fatal — log but don't fail the payment
          console.warn(
            "[payment-executor] Could not link PaymentRecord.runId:",
            intent.runId
          );
        }

        // Write audit log with correlationId if provided
        if (correlationId) {
          await prisma.auditLog.create({
            data: {
              action: "x402.payment_executed",
              actorType: "system",
              resourceId: intent.runId,
              metadata: JSON.stringify({
                correlationId,
                runId: intent.runId,
                amountUsdc: intent.amountUsdc,
                mode: receipt.mode,
                txHash: receipt.txHash,
              }),
            },
          });
        }
      }

      return receipt;
    }

    case "hybrid":
      return buildMockReceipt(intent, { mode: "hybrid" });

    case "mock":
    default:
      return buildMockReceipt(intent);
  }
}
