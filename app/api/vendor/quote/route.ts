import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";
import { sanitizeItem, sanitizeQty } from "@/src/lib/security/sanitize";

// 30 requests per IP per minute
const RATE_LIMIT = { max: 30, windowMs: 60_000 };

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip, "vendor-quote", RATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);

  // Sanitize inputs — no raw user data returned without cleaning
  const item = sanitizeItem(searchParams.get("item"));
  const qty  = sanitizeQty(searchParams.get("qty"));

  const unitPrice = 299.99;

  return NextResponse.json({
    vendorName:      "Mock Vendor",
    itemDescription: item,
    quantity:        qty,
    unitPriceUsd:    unitPrice,
    totalAmountUsd:  unitPrice * qty,
    quoteId:         `QT-MOCK-${Date.now()}`,
    validUntil:      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    paymentAddress:  process.env.VENDOR_RECEIVER_ADDRESS ?? "0x0000000000000000000000000000000000000001",
  });
}
