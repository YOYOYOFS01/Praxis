/**
 * Structured server logger — never logs secrets or raw env values.
 * In production, replaces full error objects with sanitised messages.
 */

const isProd = process.env.NODE_ENV === "production";

// Keys that must never appear in logs
const SECRET_KEYS = [
  "OPENAI_API_KEY", "AGENT_PRIVATE_KEY", "CDP_API_KEY_SECRET",
  "CDP_WALLET_SECRET", "API_SECRET_KEY", "DATABASE_URL",
];

function sanitizeError(err: unknown): string {
  if (!isProd) return String(err); // full detail in dev
  if (err instanceof Error) return err.message; // message only in prod
  return "Internal error";
}

function redactSecrets(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) return obj;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SECRET_KEYS.includes(k) ? "[REDACTED]" : v;
  }
  return result;
}

export const logger = {
  info:  (tag: string, msg: string, data?: unknown) =>
    console.log(`[INFO][${tag}] ${msg}`, data ? redactSecrets(data) : ""),

  warn:  (tag: string, msg: string, data?: unknown) =>
    console.warn(`[WARN][${tag}] ${msg}`, data ? redactSecrets(data) : ""),

  error: (tag: string, msg: string, err?: unknown) =>
    console.error(`[ERROR][${tag}] ${msg}`, sanitizeError(err)),
};
