import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";
import { getClientIp } from "@/src/lib/security/rate-limiter";
import { logger } from "@/src/lib/security/logger";

// GET   /api/admin/tenants/:tenantId/policy   — get policy config
// PATCH /api/admin/tenants/:tenantId/policy   — update policy config

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const auth = await requireAuth(req, "policy:read");
  if ("error" in auth) return auth.error;

  const policy = await prisma.policyConfig.findUnique({
    where: { tenantId: params.tenantId },
  });
  if (!policy) return NextResponse.json({ error: "Policy not found" }, { status: 404 });

  return NextResponse.json(policy);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const auth = await requireAuth(req, "policy:write");
  if ("error" in auth) return auth.error;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    maxSinglePaymentUsdc,
    dailyBudgetUsd,
    hitlThresholdUsdc,
    requireProofForAll,
    allowMockPayments,
  } = body as Partial<{
    maxSinglePaymentUsdc: number;
    dailyBudgetUsd: number;
    hitlThresholdUsdc: number;
    requireProofForAll: boolean;
    allowMockPayments: boolean;
  }>;

  // Validate numeric fields
  if (maxSinglePaymentUsdc !== undefined && (typeof maxSinglePaymentUsdc !== "number" || maxSinglePaymentUsdc <= 0)) {
    return NextResponse.json({ error: "maxSinglePaymentUsdc must be a positive number" }, { status: 400 });
  }
  if (dailyBudgetUsd !== undefined && (typeof dailyBudgetUsd !== "number" || dailyBudgetUsd <= 0)) {
    return NextResponse.json({ error: "dailyBudgetUsd must be a positive number" }, { status: 400 });
  }
  if (hitlThresholdUsdc !== undefined && (typeof hitlThresholdUsdc !== "number" || hitlThresholdUsdc < 0)) {
    return NextResponse.json({ error: "hitlThresholdUsdc must be >= 0" }, { status: 400 });
  }

  const updated = await prisma.policyConfig.upsert({
    where: { tenantId: params.tenantId },
    update: {
      ...(maxSinglePaymentUsdc !== undefined && { maxSinglePaymentUsdc }),
      ...(dailyBudgetUsd       !== undefined && { dailyBudgetUsd }),
      ...(hitlThresholdUsdc    !== undefined && { hitlThresholdUsdc }),
      ...(requireProofForAll   !== undefined && { requireProofForAll }),
      ...(allowMockPayments    !== undefined && { allowMockPayments }),
    },
    create: {
      tenantId: params.tenantId,
      maxSinglePaymentUsdc: maxSinglePaymentUsdc ?? 50_000,
      dailyBudgetUsd:       dailyBudgetUsd       ?? 500_000,
      hitlThresholdUsdc:    hitlThresholdUsdc     ?? 0,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId:  params.tenantId,
      action:    "policy.update",
      actorType: "api_key",
      resourceId: params.tenantId,
      metadata:  JSON.stringify({ maxSinglePaymentUsdc, dailyBudgetUsd, hitlThresholdUsdc }),
      ipAddress: getClientIp(req),
    },
  });

  logger.info("policy.update", `Policy updated for tenant ${params.tenantId}`);
  return NextResponse.json(updated);
}
