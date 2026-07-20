import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { hashProof } from "@/src/proof/hash-proof";
import { emitActivity, activityResult } from "@/src/mastra/lib/activity-stream";
import type { ProofOfReasoning } from "@/src/types/proof";

export const buildProofTool = createTool({
  id: "build_proof_of_reasoning",
  description:
    "Assembles the Proof-of-Reasoning object from all upstream decisions and computes " +
    "the deterministic SHA-256 proof hash. Call this only after both guards have passed. " +
    "The agentSummary must be a single factual sentence — never invented.",

  inputSchema: z.object({
    runId:        z.string(),
    agentSummary: z.string().max(500).describe("One factual sentence summarising the procurement decision"),
    intent: z.object({
      runId: z.string(), prompt: z.string(), vendorName: z.string(),
      itemDescription: z.string(), quantity: z.number(), unitPriceUsd: z.number(),
      totalAmountUsd: z.number(), currency: z.enum(["USDC", "USD"]), requestedAt: z.string(),
    }),
    quote: z.object({
      vendorName: z.string(), itemDescription: z.string(), quantity: z.number(),
      unitPriceUsd: z.number(), totalAmountUsd: z.number(), quoteId: z.string(),
      validUntil: z.string(), paymentAddress: z.string(),
    }),
    budgetDecision: z.object({
      approved: z.boolean(), remainingBudgetUsd: z.number(), reason: z.string(),
    }),
    policyDecision: z.object({
      approved: z.boolean(), violatedPolicies: z.array(z.string()), reason: z.string(),
    }),
  }),

  execute: async (input, context) => {
    await emitActivity(context, {
      agentLabel: "Proof Agent",
      action:     "Building Proof of Reasoning",
      status:     "running",
    });

    const proof: ProofOfReasoning = {
      runId:          input.runId,
      intent:         input.intent,
      quote:          input.quote,
      budgetDecision: input.budgetDecision,
      policyDecision: input.policyDecision,
      agentSummary:   input.agentSummary,
      generatedAt:    new Date().toISOString(),
    };

    // Always compute hash server-side — never accept a hash from the LLM
    const proofHash = hashProof(proof);

    await emitActivity(context, {
      agentLabel: "Proof Agent",
      action:     `Proof hash: ${proofHash.slice(0, 14)}…`,
      status:     "complete",
    });

    return activityResult("Proof Agent", "build_proof_of_reasoning", "Proof assembled", {
      proof,
      proofHash,
    });
  },
});
