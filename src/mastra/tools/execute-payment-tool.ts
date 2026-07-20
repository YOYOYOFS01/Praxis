import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { executePayment } from "@/src/payment/payment-executor";
import { emitActivity, activityResult } from "@/src/mastra/lib/activity-stream";
import type { PaymentIntent } from "@/src/types/payment";

export const executePaymentTool = createTool({
  id: "execute_payment",
  description:
    "Executes a validated payment intent. Routes to mock, hybrid, or real x402 settlement " +
    "based on PAYMENT_MODE environment variable. " +
    "Only call this AFTER the payment firewall has explicitly approved the intent.",

  inputSchema: z.object({
    runId:        z.string(),
    proofHash:    z.string().describe("0x-prefixed SHA-256 proof hash"),
    payerAddress: z.string().describe("Agent wallet address"),
    payeeAddress: z.string().describe("Vendor payment address"),
    tokenAddress: z.string().describe("ERC-20 token contract address"),
    amountUsdc:   z.number().positive().describe("Amount in USD"),
    network:      z.string().describe("CAIP-2 network, e.g. eip155:84532"),
    createdAt:    z.string().describe("ISO 8601 timestamp"),
  }),

  execute: async (intentInput, context) => {
    const mode = process.env.PAYMENT_MODE ?? "mock";

    await emitActivity(context, {
      agentLabel: "Payment Layer",
      action:     `Executing ${mode} payment: $${intentInput.amountUsdc.toLocaleString()} USDC`,
      status:     "running",
    });

    const receipt = await executePayment(intentInput as PaymentIntent);

    await emitActivity(context, {
      agentLabel: "Payment Layer",
      action:     `Payment settled (${receipt.mode}): ${receipt.txHash?.slice(0, 14) ?? "mock"}…`,
      status:     "complete",
    });

    return activityResult("Payment Layer", "execute_payment", "Payment settled", receipt);
  },
});
