import { NextRequest, NextResponse } from "next/server";
import { runStore } from "@/src/store/run-store";
import { requireAuth, validateRunId } from "@/src/lib/security/api-auth";
import { rateLimit, getClientIp } from "@/src/lib/security/rate-limiter";
import { logger } from "@/src/lib/security/logger";

const RATE_LIMIT = { max: 60, windowMs: 60_000 };

export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
) {
  const auth = await requireAuth(req, "run:read");
  if ("error" in auth) return auth.error;

  const idError = validateRunId(params.runId);
  if (idError) return idError;

  const ip = getClientIp(req);
  const rl = rateLimit(ip, "run-get", RATE_LIMIT);
  if (!rl.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  try {
    const run = await runStore.getById(params.runId);
    if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
    return NextResponse.json(run);
  } catch (err) {
    logger.error("GET /api/runs/:runId", "Fetch error", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
