import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import * as nodeCrypto from "crypto";

// POST /api/gateway/nonces/cleanup
// Marks expired pending nonces (with no corresponding PaymentIntent) as "expired".
// Protected by CRON_SECRET via X-Cron-Secret header using timing-safe comparison.

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (!secret || !provided) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Timing-safe comparison to prevent timing attacks
  const secretBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (
    secretBuf.length !== providedBuf.length ||
    !nodeCrypto.timingSafeEqual(secretBuf, providedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Step 1: Get all nonces that have a corresponding PaymentIntent
  const withIntents = await prisma.paymentIntent.findMany({
    select: { nonce: true },
  });
  const noncesWithIntents = new Set(withIntents.map((i) => i.nonce));

  // Step 2: Find expired pending nonces without intents
  const expired = await prisma.nonceRecord.findMany({
    where: {
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    select: { nonce: true },
  });
  const toExpire = expired
    .filter((r) => !noncesWithIntents.has(r.nonce))
    .map((r) => r.nonce);

  // Step 3: Update them to "expired"
  const result = await prisma.nonceRecord.updateMany({
    where: { nonce: { in: toExpire } },
    data: { status: "expired" },
  });

  return NextResponse.json({ updated: result.count });
}
