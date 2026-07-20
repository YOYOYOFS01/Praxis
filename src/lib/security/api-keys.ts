import { createHash, randomBytes } from "crypto";
import { prisma } from "@/src/db/prisma";

// ── Re-export Prisma types so callers don't import from @prisma/client directly ──
export type { ApiKey, Tenant } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Key format:  prx_live_<32 random hex chars>
//              prx_test_<32 random hex chars>
// ─────────────────────────────────────────────────────────────────────────────

export type KeyEnvironment = "live" | "test";

export type ApiKeyScope =
  | "run:create"
  | "run:read"
  | "run:approve"
  | "key:manage"
  | "policy:read"
  | "policy:write"
  | "vendor:read"
  | "vendor:write";

export const ALL_SCOPES: ApiKeyScope[] = [
  "run:create", "run:read", "run:approve",
  "key:manage", "policy:read", "policy:write",
  "vendor:read", "vendor:write",
];

export const DEFAULT_SCOPES: ApiKeyScope[] = [
  "run:create", "run:read", "run:approve",
];

// ─── Hashing ─────────────────────────────────────────────────────────────────

/** SHA-256 of the raw key — the only value stored in the DB. */
export function hashKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/** Generate a new raw key. Shown once — caller must store it immediately. */
export function generateRawKey(env: KeyEnvironment = "live"): string {
  const secret = randomBytes(32).toString("hex");
  return `prx_${env}_${secret}`;
}

// ─── Scope helpers ───────────────────────────────────────────────────────────

export function parseScopes(scopeStr: string): ApiKeyScope[] {
  return scopeStr.split(",").map(s => s.trim()).filter(Boolean) as ApiKeyScope[];
}

// ─── Create ──────────────────────────────────────────────────────────────────

export interface CreateKeyInput {
  tenantId:  string;
  name:      string;
  scopes?:   ApiKeyScope[];
  expiresAt?: Date;
  env?:      KeyEnvironment;
}

export interface CreateKeyResult {
  /** Full ApiKey row from DB (no raw key here). */
  apiKey: Awaited<ReturnType<typeof prisma.apiKey.create>>;
  /** Raw key shown ONCE — never stored, never logged. */
  rawKey: string;
}

export async function createApiKey(input: CreateKeyInput): Promise<CreateKeyResult> {
  const env    = input.env ?? "live";
  const rawKey = generateRawKey(env);

  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId:  input.tenantId,
      name:      input.name,
      keyHash:   hashKey(rawKey),
      keyPrefix: rawKey.slice(0, 12),           // "prx_live_xxxx"
      scopes:    (input.scopes ?? DEFAULT_SCOPES).join(","),
      expiresAt: input.expiresAt ?? null,
    },
  });

  return { apiKey, rawKey };
}

// ─── Revoke ───────────────────────────────────────────────────────────────────

export async function revokeApiKey(keyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: keyId },
    data:  { isActive: false, revokedAt: new Date() },
  });
}

// ─── List (never returns keyHash) ─────────────────────────────────────────────

export async function listApiKeys(tenantId: string) {
  const keys = await prisma.apiKey.findMany({
    where:   { tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id:          true,
      tenantId:    true,
      name:        true,
      keyPrefix:   true,
      scopes:      true,
      isActive:    true,
      expiresAt:   true,
      lastUsedAt:  true,
      revokedAt:   true,
      createdAt:   true,
      // keyHash intentionally omitted
    },
  });
  return keys;
}

// ─── Resolve (lookup by raw bearer token) ─────────────────────────────────────

export interface ResolvedKey {
  apiKey: Awaited<ReturnType<typeof prisma.apiKey.findUniqueOrThrow>>;
  tenant: Awaited<ReturnType<typeof prisma.tenant.findUniqueOrThrow>>;
}

/**
 * Resolves a raw bearer token to a (ApiKey, Tenant) pair.
 * Returns null if the key is invalid, inactive, revoked, or expired.
 * Updates lastUsedAt on success (fire-and-forget).
 */
export async function resolveApiKey(rawKey: string): Promise<ResolvedKey | null> {
  if (!rawKey || rawKey.length < 20) return null;

  const keyHash = hashKey(rawKey);

  const apiKey = await prisma.apiKey.findUnique({
    where:   { keyHash },
    include: { tenant: true },
  });

  if (!apiKey)                                              return null;
  if (!apiKey.isActive)                                     return null;
  if (apiKey.revokedAt)                                     return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date())    return null;
  if (!apiKey.tenant.isActive)                              return null;

  // Update lastUsedAt — fire and forget, never block on this
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data:  { lastUsedAt: new Date() },
  }).catch(() => { /* non-critical */ });

  return { apiKey, tenant: apiKey.tenant };
}
