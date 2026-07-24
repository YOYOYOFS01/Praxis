import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";

// GET /api/gateway/payments — paginated PaymentRecord list

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const { searchParams } = req.nextUrl;

  const pageRaw  = parseInt(searchParams.get("page")  ?? "1",  10);
  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);

  const page  = isNaN(pageRaw)  || pageRaw  < 1   ? 1   : pageRaw;
  const limit = isNaN(limitRaw) || limitRaw < 1   ? 20  : Math.min(limitRaw, 100);

  const resource     = searchParams.get("resource")     ?? undefined;
  const payerAddress = searchParams.get("payerAddress") ?? undefined;
  const from         = searchParams.get("from")         ?? undefined;
  const to           = searchParams.get("to")           ?? undefined;

  // Build optional where filter
  const where: {
    resource?:     string;
    payerAddress?: string;
    verifiedAt?:   { gte?: Date; lte?: Date };
  } = {};

  if (resource)     where.resource     = resource;
  if (payerAddress) where.payerAddress = payerAddress;

  if (from || to) {
    where.verifiedAt = {};
    if (from) where.verifiedAt.gte = new Date(from);
    if (to)   where.verifiedAt.lte = new Date(to);
  }

  const [data, total] = await Promise.all([
    prisma.paymentRecord.findMany({
      where,
      orderBy: { verifiedAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.paymentRecord.count({ where }),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
