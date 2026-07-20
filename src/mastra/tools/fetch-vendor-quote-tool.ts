import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { emitActivity, activityResult } from "@/src/mastra/lib/activity-stream";

export const fetchVendorQuoteTool = createTool({
  id: "fetch_vendor_quote",
  description:
    "Fetches a confirmed price quote from a vendor for a described item and quantity. " +
    "Returns vendor name, item description, unit price, total amount, quote ID, " +
    "validity period, and the vendor payment address. Always call this after parsing intent.",

  inputSchema: z.object({
    vendorName:       z.string().describe("Name of the vendor to request a quote from"),
    itemDescription:  z.string().describe("Full description of the item or service"),
    quantity:         z.number().int().positive().describe("Number of units required"),
    unitPriceUsd:     z.number().positive().describe("Expected unit price in USD"),
  }),

  execute: async ({ vendorName, itemDescription, quantity, unitPriceUsd }, context) => {
    // Auth: runId flows via requestContext — not required for this tool but pattern applies
    const runId = context?.requestContext?.get("runId") as string | undefined;

    await emitActivity(context, {
      agentLabel: "Procurement Agent",
      action: `Fetching quote from ${vendorName}`,
      status: "running",
    });

    // Mock vendor quote — replace body with real HTTP call when ready:
    // const res = await fetch(`${VENDOR_API_URL}/quote`, { method: "POST", body: JSON.stringify({...}) });
    const quote = {
      vendorName,
      itemDescription,
      quantity,
      unitPriceUsd,
      totalAmountUsd: unitPriceUsd * quantity,
      quoteId:        `QT-${Date.now()}`,
      validUntil:     new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      paymentAddress: process.env.VENDOR_RECEIVER_ADDRESS ?? "0x0000000000000000000000000000000000000001",
    };

    await emitActivity(context, {
      agentLabel: "Procurement Agent",
      action:     `Quote received from ${vendorName}: $${quote.totalAmountUsd.toLocaleString()} USDC`,
      status:     "complete",
    });

    return activityResult(
      "Procurement Agent",
      "fetch_vendor_quote",
      `Quote from ${vendorName} for ${quantity}x ${itemDescription}`,
      quote
    );
  },
});
