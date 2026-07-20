import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";

// GET /api/admin/audit?tenantId=&action=&limit=50&cursor=

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId") ?? undefined;
  const action   = searchParams.get("action")   ?? undefined;
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const cursor   = searchParams.get("cursor")   ?? undefined;

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(tenantId && { tenantId }),
      ...(action   && { action }),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });

  const hasMore = logs.length > limit;
  const items   = hasMore ? logs.slice(0, limit) : logs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ items, nextCursor, hasMore });
}
