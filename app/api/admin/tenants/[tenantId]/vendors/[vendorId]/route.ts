import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";
import { getClientIp } from "@/src/lib/security/rate-limiter";

// DELETE /api/admin/tenants/:tenantId/vendors/:vendorId — remove vendor from allowlist
// PATCH  /api/admin/tenants/:tenantId/vendors/:vendorId — update vendor (address, cap)

export async function PATCH(
  req: NextRequest,
  { params }: { params: { tenantId: string; vendorId: string } }
) {
  const auth = await requireAuth(req, "vendor:write");
  if ("error" in auth) return auth.error;

  const vendor = await prisma.vendorAllowlist.findFirst({
    where: { id: params.vendorId, tenantId: params.tenantId },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { paymentAddress, maxOrderUsdc, isActive } = body as {
    paymentAddress?: string;
    maxOrderUsdc?: number;
    isActive?: boolean;
  };

  if (paymentAddress && !/^0x[0-9a-fA-F]{40}$/.test(paymentAddress)) {
    return NextResponse.json({ error: "paymentAddress must be a valid EVM address" }, { status: 400 });
  }

  const updated = await prisma.vendorAllowlist.update({
    where: { id: params.vendorId },
    data: {
      ...(paymentAddress !== undefined && { paymentAddress }),
      ...(maxOrderUsdc   !== undefined && { maxOrderUsdc }),
      ...(isActive       !== undefined && { isActive }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { tenantId: string; vendorId: string } }
) {
  const auth = await requireAuth(req, "vendor:write");
  if ("error" in auth) return auth.error;

  const vendor = await prisma.vendorAllowlist.findFirst({
    where: { id: params.vendorId, tenantId: params.tenantId },
  });
  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  await prisma.vendorAllowlist.delete({ where: { id: params.vendorId } });

  await prisma.auditLog.create({
    data: {
      tenantId:   params.tenantId,
      action:     "vendor.remove",
      actorType:  "api_key",
      resourceId: params.vendorId,
      metadata:   JSON.stringify({ vendorName: vendor.vendorName }),
      ipAddress:  getClientIp(req),
    },
  });

  return NextResponse.json({ status: "removed", vendorId: params.vendorId });
}
