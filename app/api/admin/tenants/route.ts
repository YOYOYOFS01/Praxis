import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { requireAuth } from "@/src/lib/security/api-auth";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";

// GET  /api/admin/tenants     — list all tenants
// POST /api/admin/tenants     — create a tenant

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { apiKeys: true, runs: true } },
      policyConfig: true,
    },
  });

  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "key:manage");
  if ("error" in auth) return auth.error;

  const ip = getClientIp(req);
  const rl = rateLimit(ip, "admin-tenant-create", { max: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name, slug } = body as { name?: string; slug?: string };
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  // Slug: lowercase, alphanumeric + hyphens only
  if (!/^[a-z0-9-]{2,40}$/.test(slug.trim())) {
    return NextResponse.json(
      { error: "slug must be 2-40 chars, lowercase alphanumeric and hyphens only" },
      { status: 400 }
    );
  }

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name:        name.trim(),
        slug:        slug.trim(),
        policyConfig: {
          create: {
            // default policy — tenant can update later
            maxSinglePaymentUsdc: 50_000,
            dailyBudgetUsd:       500_000,
            hitlThresholdUsdc:    0,
          },
        },
      },
      include: { policyConfig: true },
    });

    return NextResponse.json(tenant, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "slug already exists" }, { status: 409 });
    }
    throw err;
  }
}
