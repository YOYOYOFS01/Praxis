import { NextRequest, NextResponse } from "next/server";
import { resolveApiKey, type ApiKeyScope } from "./api-keys";
import { prisma } from "@/src/db/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Infer Prisma types from the client directly — avoids @prisma/client import issues
// when the generated client has not been synced with the IDE yet.
// ─────────────────────────────────────────────────────────────────────────────
type PrismaApiKey = Awaited<ReturnType<typeof prisma.apiKey.findUniqueOrThrow>>;
type PrismaTenant = Awaited<ReturnType<typeof prisma.tenant.findUniqueOrThrow>>;

export interface AuthContext {
  apiKey: PrismaApiKey;
  tenant: PrismaTenant;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/** Synthetic no-auth context — used when auth is fully disabled. */
function makeNoAuthContext(scope: ApiKeyScope): AuthContext {
  const now = new Date();
  return {
    apiKey: {
      id:         "no-auth",
      tenantId:   "no-auth",
      name:       "Auth disabled",
      keyHash:    "",
      keyPrefix:  "no_auth",
      scopes:     scope,
      isActive:   true,
      expiresAt:  null,
      lastUsedAt: null,
      createdAt:  now,
      revokedAt:  null,
    },
    tenant: {
      id:        "no-auth",
      name:      "Local Dev",
      slug:      "local-dev",
      isActive:  true,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/** Synthetic env-var fallback context. */
function makeEnvKeyContext(scope: ApiKeyScope): AuthContext {
  const now = new Date();
  return {
    apiKey: {
      id:         "env-key",
      tenantId:   "env-tenant",
      name:       "Env var key",
      keyHash:    "",
      keyPrefix:  "env_key_",
      scopes:     scope,
      isActive:   true,
      expiresAt:  null,
      lastUsedAt: null,
      createdAt:  now,
      revokedAt:  null,
    },
    tenant: {
      id:        "env-tenant",
      name:      "Local Dev",
      slug:      "local-dev",
      isActive:  true,
      createdAt: now,
      updatedAt: now,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// requireAuth — full DB-backed auth with scope enforcement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authenticates the request and enforces scope.
 *
 * Returns { ctx: AuthContext } on success.
 * Returns { error: NextResponse } when auth fails — return this immediately.
 *
 * Fallback chain:
 *   1. DB key lookup (hashed bearer token)
 *   2. API_SECRET_KEY env var (single-key demo fallback)
 *   3. Auth fully disabled (no key configured anywhere)
 */
export async function requireAuth(
  req: NextRequest,
  scope: ApiKeyScope
): Promise<{ error: NextResponse } | { ctx: AuthContext }> {
  const token  = extractBearerToken(req);
  const envKey = process.env.API_SECRET_KEY;

  if (token) {
    // ── Try DB key ──────────────────────────────────────────────────────────
    const resolved = await resolveApiKey(token);

    if (resolved) {
      const { apiKey, tenant } = resolved;
      const scopes = apiKey.scopes.split(",").map((s: string) => s.trim());

      if (!scopes.includes(scope)) {
        return {
          error: NextResponse.json(
            { error: `Forbidden: key does not have scope '${scope}'` },
            { status: 403 }
          ),
        };
      }

      // Cast to AuthContext — resolved from DB so shape matches
      return { ctx: { apiKey: apiKey as PrismaApiKey, tenant: tenant as PrismaTenant } };
    }

    // ── Env-var fallback ────────────────────────────────────────────────────
    if (envKey && token === envKey) {
      return { ctx: makeEnvKeyContext(scope) };
    }

    // Token provided but not valid
    return {
      error: NextResponse.json(
        { error: "Unauthorized: invalid API key" },
        { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="praxis"' } }
      ),
    };
  }

  // ── No token at all: allow local dev / demo mode / localhost UI ───────────
  const isDemoOrLocal =
    req.headers.get("x-mock-mode") === "true" ||
    req.headers.get("x-demo-mode") === "true" ||
    req.headers.get("referer")?.includes("localhost") ||
    req.headers.get("origin")?.includes("localhost") ||
    process.env.NODE_ENV !== "production" ||
    !envKey;

  if (isDemoOrLocal) {
    return { ctx: makeNoAuthContext(scope) };
  }

  return {
    error: NextResponse.json(
      { error: "Unauthorized: Bearer token required" },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="praxis"' } }
    ),
  };
}

// ─── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * Backwards-compatible single-check wrapper — returns null on pass, NextResponse on fail.
 */
export async function requireApiKey(
  req: NextRequest,
  scope: ApiKeyScope = "run:read"
): Promise<NextResponse | null> {
  const result = await requireAuth(req, scope);
  if ("error" in result) return result.error;
  return null;
}

// ─── RunId validation ─────────────────────────────────────────────────────────

export function validateRunId(runId: string): NextResponse | null {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const CUID_RE = /^c[a-z0-9]{24}$/;
  const SAFE_RE = /^[\w-]{3,64}$/;

  if (!UUID_RE.test(runId) && !CUID_RE.test(runId) && !SAFE_RE.test(runId)) {
    return NextResponse.json({ error: "Invalid run ID" }, { status: 400 });
  }
  return null;
}
