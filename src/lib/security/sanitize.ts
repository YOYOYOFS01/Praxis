/**
 * Input sanitisation helpers.
 * All user-supplied strings must pass through these before use.
 */

const MAX_PROMPT_LEN  = 500;
const MAX_ITEM_LEN    = 200;
const MAX_QTY         = 10_000;

/**
 * Sanitise and validate a procurement prompt.
 * Returns { ok, value, error }.
 */
export function sanitizePrompt(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "prompt must be a string" };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: "prompt is required" };
  if (trimmed.length > MAX_PROMPT_LEN) {
    return { ok: false, error: `prompt must be ${MAX_PROMPT_LEN} characters or fewer` };
  }
  // Strip control characters (potential injection)
  const clean = trimmed.replace(/[\x00-\x1F\x7F]/g, " ").trim();
  return { ok: true, value: clean };
}

/**
 * Sanitise a vendor quote item description from query params.
 */
export function sanitizeItem(raw: string | null): string {
  if (!raw) return "Generic Item";
  return raw
    .trim()
    .slice(0, MAX_ITEM_LEN)
    .replace(/[\x00-\x1F\x7F<>"']/g, "") // strip control chars and basic HTML
    .trim() || "Generic Item";
}

/**
 * Sanitise a quantity from query params.
 */
export function sanitizeQty(raw: string | null): number {
  const n = parseInt(raw ?? "1", 10);
  if (isNaN(n) || n < 1) return 1;
  if (n > MAX_QTY) return MAX_QTY;
  return n;
}

/**
 * Validate the `approved` field in the HITL approve body.
 * Coerces truthy strings to booleans rather than trusting TypeScript type assertion.
 */
export function parseApprovedField(body: unknown): { ok: true; value: boolean } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const raw = (body as Record<string, unknown>).approved;
  if (raw === true || raw === false) return { ok: true, value: raw };
  // Reject strings, numbers, etc. — must be an explicit boolean
  return { ok: false, error: "approved must be a boolean (true or false)" };
}
