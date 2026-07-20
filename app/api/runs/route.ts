import { NextRequest, NextResponse } from "next/server";
import { runStore } from "@/src/store/run-store";
import { requireAuth } from "@/src/lib/security/api-auth";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";
import { logger } from "@/src/lib/security/logger";

const RATE_LIMIT = { max: 30, windowMs: 60_000 };

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "run:read");
  if ("error" in auth) return auth.error;

  const ip = getClientIp(req);
  const rl = rateLimit(ip, "runs-list", RATE_LIMIT);
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  try {
    const runs = await runStore.listAll();
    return NextResponse.json(runs);
  } catch (err) {
    logger.error("GET /api/runs", "List error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
