import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";
import { revokeApiKey } from "@/src/lib/security/api-keys";
import { getClientIp } from "@/src/lib/security/rate-limiter";
import { logger } from "@/src/lib/security/logger";

// GET    /api/admin/tenants/:tenantId/keys/:keyId   — get key details (no hash)
// DELETE /api/admin/tenants/:tenantId/keys/:keyId   — revoke key

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string; keyId: string } }
) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const key = await prisma.apiKey.findFirst({
    where: { id: params.keyId, tenantId: params.tenantId },
  });
  if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  const { keyHash: _h, ...safe } = key;
  return NextResponse.json(safe);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { tenantId: string; keyId: string } }
) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const key = await prisma.apiKey.findFirst({
    where: { id: params.keyId, tenantId: params.tenantId },
  });
  if (!key) return NextResponse.json({ error: "Key not found" }, { status: 404 });
  if (!key.isActive || key.revokedAt) {
    return NextResponse.json({ error: "Key already revoked" }, { status: 409 });
  }

  await revokeApiKey(params.keyId);

  const ip = getClientIp(req);
  await prisma.auditLog.create({
    data: {
      tenantId:   params.tenantId,
      apiKeyId:   params.keyId,
      action:     "key.revoke",
      actorType:  "api_key",
      resourceId: params.keyId,
      metadata:   JSON.stringify({ prefix: key.keyPrefix }),
      ipAddress:  ip,
    },
  });

  logger.info("key.revoke", `API key revoked`, { keyId: params.keyId, prefix: key.keyPrefix });

  return NextResponse.json({ status: "revoked", keyId: params.keyId });
}
