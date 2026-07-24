import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";
import { logger } from "@/src/lib/security/logger";

// GET  /api/gateway/endpoints  — list all EndpointConfig records
// POST /api/gateway/endpoints  — create a new EndpointConfig

const AMOUNT_REGEX = /^\d+\.\d{2}$/;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const endpoints = await prisma.endpointConfig.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(endpoints);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const ip = getClientIp(req);
  const rl = rateLimit(ip, "gateway-endpoint-create", { max: 20, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    resource,
    amountUsdc,
    description,
    payTo,
    asset,
    network,
    chainId,
    nonceTtlSeconds,
    tenantId,
  } = body as {
    resource?: unknown;
    amountUsdc?: unknown;
    description?: unknown;
    payTo?: unknown;
    asset?: unknown;
    network?: unknown;
    chainId?: unknown;
    nonceTtlSeconds?: unknown;
    tenantId?: unknown;
  };

  // Required field validation
  if (!resource || typeof resource !== "string" || !resource.trim()) {
    return NextResponse.json({ error: "resource is required" }, { status: 400 });
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  if (!payTo || typeof payTo !== "string" || !payTo.trim()) {
    return NextResponse.json({ error: "payTo is required" }, { status: 400 });
  }
  if (!asset || typeof asset !== "string" || !asset.trim()) {
    return NextResponse.json({ error: "asset is required" }, { status: 400 });
  }
  if (!network || typeof network !== "string" || !network.trim()) {
    return NextResponse.json({ error: "network is required" }, { status: 400 });
  }
  if (chainId === undefined || chainId === null || typeof chainId !== "number") {
    return NextResponse.json({ error: "chainId is required and must be a number" }, { status: 400 });
  }

  // amountUsdc must be a string in decimal format — reject numbers
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

  // nonceTtlSeconds: optional, must be a positive integer if provided
  let ttl = 300;
  if (nonceTtlSeconds !== undefined && nonceTtlSeconds !== null) {
    if (typeof nonceTtlSeconds !== "number" || !Number.isInteger(nonceTtlSeconds) || nonceTtlSeconds <= 0) {
      return NextResponse.json({ error: "nonceTtlSeconds must be a positive integer" }, { status: 400 });
    }
    ttl = nonceTtlSeconds;
  }

  try {
    const endpoint = await prisma.endpointConfig.create({
      data: {
        resource:        resource.trim(),
        amountUsdc,
        description:     description.trim(),
        payTo:           payTo.trim(),
        asset:           asset.trim(),
        network:         network.trim(),
        chainId,
        nonceTtlSeconds: ttl,
        tenantId:        typeof tenantId === "string" ? tenantId.trim() || null : null,
      },
    });

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        action:     "x402.endpoint_registered",
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

    logger.info("gateway/endpoints", "Endpoint registered", { resource: endpoint.resource });

    return NextResponse.json(endpoint, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "resource already exists" }, { status: 409 });
    }
    logger.error("gateway/endpoints", "Failed to create endpoint", err);
    throw err;
  }
}
