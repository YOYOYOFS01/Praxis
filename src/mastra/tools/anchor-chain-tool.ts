import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { anchorPayment } from "@/src/blockchain/registry-client";
import { emitActivity, activityResult } from "@/src/mastra/lib/activity-stream";
import type { PaymentIntent } from "@/src/types/payment";
import type { ProofOfReasoning } from "@/src/types/proof";

export const anchorChainTool = createTool({
  id: "anchor_payment_on_chain",
  description:
    "Anchors the Proof-of-Reasoning hash on Base Sepolia via PraxisPaymentRegistry.recordPayment(). " +
    "Falls back to a mock anchor if the RPC is unavailable — the demo never crashes. " +
    "Always call this as the final step after payment is settled.",

  inputSchema: z.object({
    intent: z.object({
      runId: z.string(), proofHash: z.string(), payerAddress: z.string(),
      payeeAddress: z.string(), tokenAddress: z.string(), amountUsdc: z.number(),
      network: z.string(), createdAt: z.string(),
    }),
    proof: z.any().describe("Full ProofOfReasoning object"),
  }),

  execute: async ({ intent, proof }, context) => {
    const chainMode = process.env.CHAIN_MODE ?? "mock";

    await emitActivity(context, {
      agentLabel: "Payment Layer",
      action:     `Anchoring proof on Base Sepolia (${chainMode})`,
      status:     "running",
    });

    const anchor = await anchorPayment(intent as PaymentIntent, proof as ProofOfReasoning);

    await emitActivity(context, {
      agentLabel: "Payment Layer",
      action:     `Proof anchored: ${anchor.anchorTxHash.slice(0, 14)}…`,
      status:     "complete",
    });

    return activityResult("Payment Layer", "anchor_payment_on_chain", "Chain anchor stored", anchor);
  },
});
