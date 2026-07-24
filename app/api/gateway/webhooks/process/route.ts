import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { createHmac, timingSafeEqual } from "crypto";

// POST /api/gateway/webhooks/process
// Webhook delivery worker — processes queued WebhookDelivery rows.
// Triggered by a cron job (every 30s). Protected by X-Cron-Secret header.

const BACKOFF_MS = [
  1 * 60 * 1000,   // attempt 1 → retry in 1 min
  5 * 60 * 1000,   // attempt 2 → retry in 5 min
  30 * 60 * 1000,  // attempt 3 → retry in 30 min
];

export async function POST(req: NextRequest) {
  // ── Auth: validate X-Cron-Secret ─────────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (!secret || !provided) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (
    secretBuf.length !== providedBuf.length ||
    !timingSafeEqual(secretBuf, providedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Fetch queued deliveries ───────────────────────────────────────────────
  const now = new Date();
  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      status: "queued",
      nextRetryAt: { lte: now },
    },
    orderBy: { createdAt: "asc" },
    take: 50, // process up to 50 per run to avoid timeouts
  });

  let processed = 0;

  for (const delivery of deliveries) {
    // Look up the endpoint
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: delivery.endpointId },
    });

    if (!endpoint || !endpoint.isActive) {
      // Endpoint gone or disabled — mark dead
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "dead", attemptCount: delivery.attemptCount + 1 },
      });
      processed++;
      continue;
    }

    // Compute HMAC-SHA256 signature
    const sig = createHmac("sha256", endpoint.secret)
      .update(delivery.payload)
      .digest("hex");

    let success = false;
    let responseStatus: number | null = null;

    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Praxis-Signature": `sha256=${sig}`,
        },
        body: delivery.payload,
        signal: AbortSignal.timeout(10_000), // 10s timeout
      });

      responseStatus = res.status;
      success = res.status >= 200 && res.status < 300;
    } catch {
      // Network error or timeout — treat as failure
      success = false;
    }

    const newAttemptCount = delivery.attemptCount + 1;

    if (success) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "delivered",
          deliveredAt: new Date(),
          attemptCount: newAttemptCount,
          responseStatus,
        },
      });
    } else {
      // Determine next status
      const isDead = newAttemptCount >= 4;
      const backoffMs = BACKOFF_MS[newAttemptCount - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
      const nextRetryAt = isDead ? null : new Date(Date.now() + backoffMs);

      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: isDead ? "dead" : "queued",
          attemptCount: newAttemptCount,
          responseStatus,
          nextRetryAt,
        },
      });
    }

    processed++;
  }

  return NextResponse.json({ processed });
}
