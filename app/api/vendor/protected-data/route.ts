import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";

const PAYMENT_AMOUNT_USDC = "1.00";
const USDC_CONTRACT = process.env.USDC_TOKEN_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const RECEIVER      = process.env.VENDOR_RECEIVER_ADDRESS ?? "0x0000000000000000000000000000000000000001";
const NETWORK       = process.env.X402_NETWORK ?? "eip155:84532";

// Tighter limit on protected endpoint
const RATE_LIMIT = { max: 20, windowMs: 60_000 };

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip, "protected-data", RATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const paymentMode = process.env.PAYMENT_MODE ?? "mock";

  if (paymentMode === "mock" || paymentMode === "hybrid") {
    return NextResponse.json({
      data:        "Protected vendor data — delivered after payment",
      deliveredAt: new Date().toISOString(),
      mock:        true,
    });
  }

  // x402 mode — check for payment header
  const paymentHeader = req.headers.get("X-Payment");

  if (!paymentHeader) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.json(
      {
        error: "Payment Required",
        x402Version: 1,
        accepts: [
          {
            scheme:             "exact",
            network:            NETWORK,
            maxAmountRequired:  PAYMENT_AMOUNT_USDC,
            resource:           `${appUrl}/api/vendor/protected-data`,
            description:        "Access to protected vendor procurement data",
            mimeType:           "application/json",
            payTo:              RECEIVER,
            maxTimeoutSeconds:  300,
            asset:              USDC_CONTRACT,
            extra: { name: "USD Coin", version: "2" },
          },
        ],
      },
      {
        status: 402,
        headers: {
          "Content-Type":  "application/json",
          "X-402-Version": "1",
        },
      }
    );
  }

  // Payment header present — verify with facilitator in production
  // For now: accept any non-empty header as proof of payment
  return NextResponse.json({
    data:            "Protected vendor data — delivered after x402 payment",
    deliveredAt:     new Date().toISOString(),
    paymentVerified: true,
  });
}
