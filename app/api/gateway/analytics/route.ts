import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";

// GET /api/gateway/analytics — payment KPIs for rolling 24-hour window

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Total revenue: sum of amountUsdc for all SETTLED PaymentRecords (all time)
  const settled = await prisma.paymentRecord.findMany({ select: { amountUsdc: true } });
  const totalRevenueUsdc = settled
    .reduce((sum, r) => {
      const val = parseFloat(r.amountUsdc);
      return sum + (isNaN(val) ? 0 : val);
    }, 0)
    .toFixed(2);

  // Success rate: SETTLED / CREATED * 100 for rolling 24h window
  const created24h = await prisma.paymentIntent.count({
    where: { createdAt: { gte: since } },
  });
  const settled24h = await prisma.paymentIntent.count({
    where: { status: "SETTLED", createdAt: { gte: since } },
  });
  const successRate =
    created24h > 0 ? ((settled24h / created24h) * 100).toFixed(2) : "0.00";

  // Average settlement time in ms for SETTLED intents in 24h
  const settledIntents = await prisma.paymentIntent.findMany({
    where: { status: "SETTLED", createdAt: { gte: since }, settledAt: { not: null } },
    select: { createdAt: true, settledAt: true },
  });
  const avgSettlementTimeMs =
    settledIntents.length > 0
      ? Math.round(
          settledIntents.reduce((sum, intent) => {
            const ms =
              new Date(intent.settledAt!).getTime() -
              new Date(intent.createdAt).getTime();
            return sum + ms;
          }, 0) / settledIntents.length
        )
      : 0;

  // Replays blocked in 24h window
  const replaysBlocked = await prisma.auditLog.count({
    where: { action: "x402.replay_blocked", createdAt: { gte: since } },
  });

  // Pending intent count (CREATED or VERIFYING, all time)
  const pendingIntentCount = await prisma.paymentIntent.count({
    where: { status: { in: ["CREATED", "VERIFYING"] } },
  });

  return NextResponse.json({
    totalRevenueUsdc,
    successRate,
    avgSettlementTimeMs,
    replaysBlocked,
    pendingIntentCount,
  });
}
