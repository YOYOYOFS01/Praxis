import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";

// GET /api/gateway/intents — paginated PaymentIntent list with lifecycle state

const VALID_STATUSES = ["CREATED", "VERIFYING", "SETTLED", "FAILED"] as const;
type IntentStatus = (typeof VALID_STATUSES)[number];

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const { searchParams } = req.nextUrl;

  const pageRaw  = parseInt(searchParams.get("page")  ?? "1",  10);
  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10);
  const statusRaw = searchParams.get("status") ?? undefined;

  const page  = isNaN(pageRaw)  || pageRaw  < 1 ? 1  : pageRaw;
  const limit = isNaN(limitRaw) || limitRaw < 1 ? 20 : Math.min(limitRaw, 100);

  // Validate status filter if provided
  if (statusRaw !== undefined && !VALID_STATUSES.includes(statusRaw as IntentStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const where: { status?: IntentStatus } = {};
  if (statusRaw) {
    where.status = statusRaw as IntentStatus;
  }

  const [data, total] = await Promise.all([
    prisma.paymentIntent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.paymentIntent.count({ where }),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  });
}
