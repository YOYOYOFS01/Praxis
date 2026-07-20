import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { runStore } from "@/src/store/run-store";
import { runPurchaseWorkflow } from "@/src/mastra/workflows/purchase-workflow";
import { requireAuth } from "@/src/lib/security/api-auth";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";
import { sanitizePrompt } from "@/src/lib/security/sanitize";
import { logger } from "@/src/lib/security/logger";
import { prisma } from "@/src/db/prisma";

const RATE_LIMIT = { max: 10, windowMs: 60_000 };

export async function POST(req: NextRequest) {
  // 1. Auth — requires run:create scope
  const auth = await requireAuth(req, "run:create");
  if ("error" in auth) return auth.error;

  const { tenant, apiKey } = auth.ctx;

  // 2. Rate limit
  const ip = getClientIp(req);
  const rl = rateLimit(ip, "purchase", RATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After":           String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // 3. Parse + sanitise body
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const promptResult = sanitizePrompt((body as Record<string, unknown>)?.prompt);
  if (!promptResult.ok) {
    return NextResponse.json({ error: promptResult.error }, { status: 400 });
  }

  // 4. Create run and execute workflow
  try {
    const runId    = randomUUID();
    const tenantId = tenant.id === "env-tenant" || tenant.id === "no-auth" ? null : tenant.id;

    await runStore.create(runId, promptResult.value, tenantId);

    // Write audit log
    if (tenantId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          apiKeyId:   apiKey.id === "env-key" || apiKey.id === "no-auth" ? null : apiKey.id,
          action:     "run.create",
          actorType:  "api_key",
          resourceId: runId,
          metadata:   JSON.stringify({ promptLength: promptResult.value.length }),
          ipAddress:  ip,
        },
      });
    }

    const result = await runPurchaseWorkflow(runId, promptResult.value, tenantId);
    return NextResponse.json(result);
  } catch (err) {
    logger.error("POST /api/purchase", "Workflow error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
