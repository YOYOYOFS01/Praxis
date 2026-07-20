import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { runPolicyGuard } from "@/src/policy/policy-guard";
import { emitActivity, activityResult } from "@/src/mastra/lib/activity-stream";

const intentSchema = z.object({
  runId: z.string(), prompt: z.string(), vendorName: z.string(),
  itemDescription: z.string(), quantity: z.number(), unitPriceUsd: z.number(),
  totalAmountUsd: z.number(), currency: z.enum(["USDC", "USD"]), requestedAt: z.string(),
});

const quoteSchema = z.object({
  vendorName: z.string(), itemDescription: z.string(), quantity: z.number(),
  unitPriceUsd: z.number(), totalAmountUsd: z.number(), quoteId: z.string(),
  validUntil: z.string(), paymentAddress: z.string(),
});

export const runPolicyGuardTool = createTool({
  id: "run_policy_guard",
  description:
    "Runs the deterministic policy guard — vendor allowlist check, quote/intent consistency, " +
    "and sanity rules. Must be called alongside run_budget_guard before any payment. " +
    "Returns approved=true/false with violated policy codes.",

  inputSchema: z.object({
    intent:   intentSchema,
    quote:    quoteSchema,
    tenantId: z.string().nullable().optional(),
  }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: async ({ intent, quote, tenantId }, context: any) => {
    await emitActivity(context, {
      agentLabel: "Guard Agent",
      action:     `Policy check: vendor "${intent.vendorName}"`,
      status:     "running",
    });

    const decision = await runPolicyGuard(intent, quote, tenantId);

    await emitActivity(context, {
      agentLabel: "Guard Agent",
      action:     decision.approved
        ? `Policy guard PASSED: ${decision.reason}`
        : `Policy guard FAILED: ${decision.violatedPolicies.join(", ")}`,
      status: decision.approved ? "complete" : "error",
    });

    return activityResult("Guard Agent", "run_policy_guard", "Policy check", decision);
  },
});
