import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";
import { getClientIp } from "@/src/lib/security/rate-limiter";
import { logger } from "@/src/lib/security/logger";

// PATCH  /api/gateway/endpoints/[id] — update an EndpointConfig
// DELETE /api/gateway/endpoints/[id] — soft-delete (set isActive: false)

const AMOUNT_REGEX = /^\d+\.\d{2}$/;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const ip = getClientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { amountUsdc, payTo, description, isActive } = body as {
    amountUsdc?: unknown;
    payTo?: unknown;
    description?: unknown;
    isActive?: unknown;
  };

  // Validate amountUsdc if provided — must be a string matching the decimal format
  if (amountUsdc !== undefined) {
    if (typeof amountUsdc !== "string") {
      return NextResponse.json(
        { error: "amountUsdc must be a string in decimal format (e.g. \"1.00\")" },
        { status: 400 }
      );
    }
    if (!AMOUNT_REGEX.test(amountUsdc)) {
      return NextResponse.json(
        { error: "amountUsdc must match format /^\\d+\\.\\d{2}$/ (e.g. \"1.00\")" },
        { status: 400 }
      );
    }
  }

  // Build the update payload — only include fields that were provided
  const updateData: {
    amountUsdc?: string;
    payTo?: string;
    description?: string;
    isActive?: boolean;
  } = {};

  if (amountUsdc !== undefined)                         updateData.amountUsdc  = amountUsdc as string;
  if (payTo      !== undefined && typeof payTo === "string") updateData.payTo  = (payTo as string).trim();
  if (description !== undefined && typeof description === "string") updateData.description = (description as string).trim();
  if (isActive   !== undefined && typeof isActive === "boolean")    updateData.isActive    = isActive;

  try {
    const endpoint = await prisma.endpointConfig.update({
      where: { id: params.id },
      data:  updateData,
    });

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        action:     "x402.endpoint_updated",
        actorType:  "api_key",
        apiKeyId:   auth.ctx.apiKey.id !== "no-auth" && auth.ctx.apiKey.id !== "env-key"
                      ? auth.ctx.apiKey.id
                      : null,
        tenantId:   auth.ctx.tenant.id !== "no-auth" && auth.ctx.tenant.id !== "env-tenant"
                      ? auth.ctx.tenant.id
                      : null,
        resourceId: endpoint.id,
        metadata:   JSON.stringify({ resource: endpoint.resource, amountUsdc: endpoint.amountUsdc }),
        ipAddress:  ip,
      },
    });

    logger.info("gateway/endpoints/[id]", "Endpoint updated", { id: endpoint.id, resource: endpoint.resource });

    return NextResponse.json(endpoint);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    logger.error("gateway/endpoints/[id]", "Failed to update endpoint", err);
    throw err;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  try {
    await prisma.endpointConfig.update({
      where: { id: params.id },
      data:  { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    logger.error("gateway/endpoints/[id]", "Failed to delete endpoint", err);
    throw err;
  }
}
