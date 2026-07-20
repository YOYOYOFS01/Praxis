/**
 * In-memory sliding window rate limiter.
 * For a hackathon, this is sufficient — replace with Redis/Upstash in production.
 *
 * Usage:
 *   const result = rateLimit(req, "purchase", { max: 10, windowMs: 60_000 });
 *   if (!result.ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

// Cleanup stale entries every 5 minutes so memory doesn't grow unbounded
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store.entries()) {
    if (win.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  ip: string,
  bucket: string,
  { max, windowMs }: { max: number; windowMs: number }
): RateLimitResult {
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  let win = store.get(key);
  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + windowMs };
    store.set(key, win);
  }

  win.count++;
  return {
    ok: win.count <= max,
    remaining: Math.max(0, max - win.count),
    resetAt: win.resetAt,
  };
}

/** Extract client IP from Next.js request, with proxy awareness */
export function getClientIp(req: { headers: { get: (key: string) => string | null } }): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
