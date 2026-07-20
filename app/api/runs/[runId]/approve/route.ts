import { NextRequest, NextResponse } from "next/server";
import { runStore } from "@/src/store/run-store";
import { resumePurchaseWorkflow } from "@/src/mastra/workflows/purchase-workflow";
import { requireAuth, validateRunId } from "@/src/lib/security/api-auth";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";
import { parseApprovedField } from "@/src/lib/security/sanitize";
import { logger } from "@/src/lib/security/logger";
import { prisma } from "@/src/db/prisma";

const RATE_LIMIT = { max: 5, windowMs: 60_000 };

export async function POST(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  // 1. Auth — requires run:approve scope
  const auth = await requireAuth(req, "run:approve");
  if ("error" in auth) return auth.error;

  // 2. Validate runId format
  const idError = validateRunId(params.runId);
  if (idError) return idError;

  // 3. Rate limit
  const ip = getClientIp(req);
  const rl = rateLimit(ip, "approve", RATE_LIMIT);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // 4. Parse body — strict boolean only
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const approvedResult = parseApprovedField(body);
  if (!approvedResult.ok) {
    return NextResponse.json({ error: approvedResult.error }, { status: 400 });
  }

  const { value: approved } = approvedResult;

  // 5. Business logic
  try {
    const run = await runStore.getById(params.runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    if (run.status !== "awaiting_approval") {
      return NextResponse.json(
        { error: `Run is not awaiting approval (status: ${run.status})` },
        { status: 400 }
      );
    }

    const { tenant, apiKey } = auth.ctx;
    const tenantId = tenant.id === "env-tenant" || tenant.id === "no-auth" ? null : tenant.id;

    if (!approved) {
      await runStore.setStatus(params.runId, "rejected_by_human");
      await runStore.addEvent(params.runId, {
        type: "hitl", label: "Payment rejected by human", status: "rejected", payload: {},
      });

      if (tenantId) {
        await prisma.auditLog.create({
          data: {
            tenantId,
            apiKeyId:   apiKey.id === "env-key" || apiKey.id === "no-auth" ? null : apiKey.id,
            action:     "run.reject",
            actorType:  "api_key",
            resourceId: params.runId,
            metadata:   JSON.stringify({ decision: "rejected" }),
            ipAddress:  ip,
          },
        });
      }

      logger.info("run.reject", `Run ${params.runId} rejected by human`);
      return NextResponse.json({ status: "rejected", runId: params.runId });
    }

    await runStore.addEvent(params.runId, {
      type: "hitl", label: "Payment approved by human", status: "success", payload: {},
    });

    if (tenantId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          apiKeyId:   apiKey.id === "env-key" || apiKey.id === "no-auth" ? null : apiKey.id,
          action:     "run.approve",
          actorType:  "api_key",
          resourceId: params.runId,
          metadata:   JSON.stringify({ decision: "approved" }),
          ipAddress:  ip,
        },
      });
    }

    logger.info("run.approve", `Run ${params.runId} approved by human`);
    const result = await resumePurchaseWorkflow(params.runId);
    return NextResponse.json(result);
  } catch (err) {
    logger.error("POST /api/runs/:runId/approve", "Approval error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
