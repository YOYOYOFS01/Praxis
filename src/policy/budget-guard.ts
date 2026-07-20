import { prisma } from "@/src/db/prisma";
import type { PurchaseIntent } from "@/src/types/purchase";
import type { BudgetDecision } from "@/src/types/proof";

// Global env-var fallbacks (used in demo / no-tenant mode)
const DEFAULT_MAX_SINGLE  = parseFloat(process.env.AGENT_MAX_PAYMENT_USDC ?? "50000");
const DEFAULT_DAILY       = parseFloat(process.env.TENANT_DAILY_BUDGET_USD ?? "500000");

/**
 * Deterministic budget guard — no LLM, no network calls.
 *
 * When tenantId is provided, reads limits from the DB PolicyConfig.
 * Falls back to env-var defaults for local/demo mode.
 */
export async function runBudgetGuard(
  intent: PurchaseIntent,
  tenantId?: string | null
): Promise<BudgetDecision> {
  let maxSingle = DEFAULT_MAX_SINGLE;
  let daily     = DEFAULT_DAILY;

  if (tenantId) {
    const policy = await prisma.policyConfig.findUnique({ where: { tenantId } });
    if (policy) {
      maxSingle = policy.maxSinglePaymentUsdc;
      daily     = policy.dailyBudgetUsd;
    }
  }

  if (intent.totalAmountUsd > daily) {
    return {
      approved: false,
      remainingBudgetUsd: daily,
      reason: `Amount $${intent.totalAmountUsd.toLocaleString()} exceeds daily budget of $${daily.toLocaleString()}.`,
    };
  }

  if (intent.totalAmountUsd > maxSingle) {
    return {
      approved: false,
      remainingBudgetUsd: daily - intent.totalAmountUsd,
      reason: `Amount $${intent.totalAmountUsd.toLocaleString()} exceeds single-payment limit of $${maxSingle.toLocaleString()}.`,
    };
  }

  return {
    approved: true,
    remainingBudgetUsd: daily - intent.totalAmountUsd,
    reason: "Within daily budget and single-payment limit.",
  };
}
