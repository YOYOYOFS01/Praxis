import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";

// GET    /api/admin/tenants/:tenantId/vendors   — list allowlisted vendors
// POST   /api/admin/tenants/:tenantId/vendors   — add a vendor to allowlist

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const auth = await requireAuth(req, "vendor:read");
  if ("error" in auth) return auth.error;

  const vendors = await prisma.vendorAllowlist.findMany({
    where: { tenantId: params.tenantId },
    orderBy: { vendorName: "asc" },
  });
  return NextResponse.json(vendors);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const auth = await requireAuth(req, "vendor:write");
  if ("error" in auth) return auth.error;

  const ip = getClientIp(req);
  const rl = rateLimit(ip, "vendor-add", { max: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { vendorName, paymentAddress, maxOrderUsdc } = body as {
    vendorName?: string;
    paymentAddress?: string;
    maxOrderUsdc?: number;
  };

  if (!vendorName?.trim()) {
    return NextResponse.json({ error: "vendorName is required" }, { status: 400 });
  }

  // Validate EVM address if provided
  if (paymentAddress && !/^0x[0-9a-fA-F]{40}$/.test(paymentAddress)) {
    return NextResponse.json({ error: "paymentAddress must be a valid EVM address" }, { status: 400 });
  }

  if (maxOrderUsdc !== undefined && (typeof maxOrderUsdc !== "number" || maxOrderUsdc <= 0)) {
    return NextResponse.json({ error: "maxOrderUsdc must be a positive number" }, { status: 400 });
  }

  try {
    const vendor = await prisma.vendorAllowlist.create({
      data: {
        tenantId:       params.tenantId,
        vendorName:     vendorName.trim().toLowerCase(), // stored lowercase
        paymentAddress: paymentAddress ?? null,
        maxOrderUsdc:   maxOrderUsdc   ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId:   params.tenantId,
        action:     "vendor.add",
        actorType:  "api_key",
        resourceId: vendor.id,
        metadata:   JSON.stringify({ vendorName: vendor.vendorName }),
        ipAddress:  ip,
      },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Vendor already in allowlist" }, { status: 409 });
    }
    throw err;
  }
}
