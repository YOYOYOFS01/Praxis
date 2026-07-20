import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";
import { createApiKey, listApiKeys, type ApiKeyScope, type KeyEnvironment } from "@/src/lib/security/api-keys";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";
import { logger } from "@/src/lib/security/logger";

// GET  /api/admin/tenants/:tenantId/keys   — list keys (no hashes returned)
// POST /api/admin/tenants/:tenantId/keys   — create a new key (raw key shown ONCE)

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const keys = await listApiKeys(params.tenantId);
  return NextResponse.json(keys);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const ip = getClientIp(req);
  const rl = rateLimit(ip, "key-create", { max: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  // Verify tenant exists
  const tenant = await prisma.tenant.findUnique({ where: { id: params.tenantId } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (!tenant.isActive) return NextResponse.json({ error: "Tenant is inactive" }, { status: 403 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    name,
    scopes,
    expiresAt,
    env = "live",
  } = body as {
    name?: string;
    scopes?: ApiKeyScope[];
    expiresAt?: string;
    env?: KeyEnvironment;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { apiKey, rawKey } = await createApiKey({
    tenantId: params.tenantId,
    name:     name.trim(),
    scopes:   scopes,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    env,
  });

  // Write audit log
  await prisma.auditLog.create({
    data: {
      tenantId:   params.tenantId,
      apiKeyId:   apiKey.id,
      action:     "key.create",
      actorType:  "api_key",
      resourceId: apiKey.id,
      metadata:   JSON.stringify({ name: apiKey.name, scopes: apiKey.scopes, prefix: apiKey.keyPrefix }),
      ipAddress:  ip,
    },
  });

  logger.info("key.create", `New API key created for tenant ${tenant.slug}`, {
    keyId: apiKey.id,
    prefix: apiKey.keyPrefix,
  });

  // rawKey is returned ONCE here and never stored anywhere
  return NextResponse.json(
    {
      id:        apiKey.id,
      name:      apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes:    apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      // ↓ shown ONCE — client must copy and store this immediately
      key:       rawKey,
      warning:   "This is the only time the raw key will be shown. Store it securely.",
    },
    { status: 201 }
  );
}
