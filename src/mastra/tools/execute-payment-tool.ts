import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { executePayment } from "@/src/payment/payment-executor";
import { emitActivity, activityResult } from "@/src/mastra/lib/activity-stream";
import type { PaymentIntent } from "@/src/types/payment";
import type { ProofOfReasoning } from "@/src/types/proof";

export const executePaymentTool = createTool({
  id: "execute_payment",
  description:
    "Executes a validated payment intent. Routes to mock, hybrid, or real x402 settlement " +
    "based on PAYMENT_MODE environment variable. " +
    "Requires the serialised proof of reasoning so the payment firewall can gate execution. " +
    "Only call this AFTER the proof has been generated and verified.",

  inputSchema: z.object({
    runId:        z.string(),
    proofHash:    z.string().describe("0x-prefixed SHA-256 proof hash"),
    payerAddress: z.string().describe("Agent wallet address"),
    payeeAddress: z.string().describe("Vendor payment address"),
    tokenAddress: z.string().describe("ERC-20 token contract address"),
    amountUsdc:   z.number().positive().describe("Amount in USD"),
    network:      z.string().describe("CAIP-2 network, e.g. eip155:84532"),
    createdAt:    z.string().describe("ISO 8601 timestamp"),
    proofJson:    z.string().describe("JSON-serialised ProofOfReasoning — required by the payment firewall"),
    correlationId: z.string().optional().describe("Request correlation ID for audit tracing"),
  }),

  execute: async (intentInput, context) => {
    const mode = process.env.PAYMENT_MODE ?? "mock";

    await emitActivity(context, {
      agentLabel: "Payment Layer",
      action:     `Executing ${mode} payment: $${intentInput.amountUsdc.toLocaleString()} USDC`,
      status:     "running",
    });

    // Deserialise proof — required by the payment firewall
    const proof = JSON.parse(intentInput.proofJson) as ProofOfReasoning;

    const paymentIntent: PaymentIntent = {
      runId:        intentInput.runId,
      proofHash:    intentInput.proofHash,
      payerAddress: intentInput.payerAddress,
      payeeAddress: intentInput.payeeAddress,
      tokenAddress: intentInput.tokenAddress,
      amountUsdc:   intentInput.amountUsdc,
      network:      intentInput.network,
      createdAt:    intentInput.createdAt,
    };

    const receipt = await executePayment(paymentIntent, proof, intentInput.correlationId);

    await emitActivity(context, {
      agentLabel: "Payment Layer",
      action:     `Payment settled (${receipt.mode}): ${receipt.txHash?.slice(0, 14) ?? "mock"}…`,
      status:     "complete",
    });

    return activityResult("Payment Layer", "execute_payment", "Payment settled", receipt);
  },
});
