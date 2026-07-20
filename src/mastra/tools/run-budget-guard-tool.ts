import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runBudgetGuard } from "@/src/policy/budget-guard";
import { emitActivity, activityResult } from "@/src/mastra/lib/activity-stream";

const intentSchema = z.object({
  runId:           z.string(),
  prompt:          z.string(),
  vendorName:      z.string(),
  itemDescription: z.string(),
  quantity:        z.number().int().positive(),
  unitPriceUsd:    z.number().positive(),
  totalAmountUsd:  z.number().positive(),
  currency:        z.enum(["USDC", "USD"]),
  requestedAt:     z.string(),
});

export const runBudgetGuardTool = createTool({
  id: "run_budget_guard",
  description:
    "Runs the deterministic budget guard against a purchase intent. " +
    "Checks both the single-payment limit and daily budget. " +
    "Returns approved=true/false with reason. NEVER skips this check before a payment.",

  inputSchema: z.object({
    intent:   intentSchema,
    tenantId: z.string().nullable().optional(),
  }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ intent, tenantId }, context: any) => {
    await emitActivity(context, {
      agentLabel: "Guard Agent",
      action:     `Budget check: $${intent.totalAmountUsd.toLocaleString()} USDC`,
      status:     "running",
    });

    const decision = await runBudgetGuard(intent, tenantId);

    await emitActivity(context, {
      agentLabel: "Guard Agent",
      action:     `Budget guard ${decision.approved ? "PASSED" : "FAILED"}: ${decision.reason}`,
      status:     decision.approved ? "complete" : "error",
    });

    return activityResult("Guard Agent", "run_budget_guard", "Budget check", decision);
  },
});
