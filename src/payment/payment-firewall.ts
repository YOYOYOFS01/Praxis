import type { PaymentIntent } from "@/src/types/payment";
import type { ProofOfReasoning } from "@/src/types/proof";

export interface FirewallResult {
  approved: boolean;
  reason: string;
}

/**
 * Final deterministic gate before any payment is executed.
 * LLM output never reaches here directly — only validated structured data does.
 */
export function runPaymentFirewall(
  intent: PaymentIntent,
  proof: ProofOfReasoning
): FirewallResult {
  // Guard: proof must match intent
  if (proof.runId !== intent.runId) {
    return { approved: false, reason: "Proof runId does not match payment intent runId." };
  }

  // Guard: both guards must have approved
  if (!proof.budgetDecision.approved) {
    return { approved: false, reason: `Budget guard failed: ${proof.budgetDecision.reason}` };
  }

  if (!proof.policyDecision.approved) {
    return {
      approved: false,
      reason: `Policy guard failed: ${proof.policyDecision.violatedPolicies.join(", ")}`,
    };
  }

  // Guard: payment amount must match proof
  if (Math.abs(intent.amountUsdc - proof.quote.totalAmountUsd) > 0.01) {
    return {
      approved: false,
      reason: `Payment amount $${intent.amountUsdc} does not match quoted amount $${proof.quote.totalAmountUsd}.`,
    };
  }

  // Guard: payee address must match vendor quote payment address
  if (
    intent.payeeAddress.toLowerCase() !== proof.quote.paymentAddress.toLowerCase()
  ) {
    return {
      approved: false,
      reason: "Payee address does not match vendor quote payment address.",
    };
  }

  return { approved: true, reason: "All firewall checks passed." };
}
