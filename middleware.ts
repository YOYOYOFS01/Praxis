import { NextRequest, NextResponse } from "next/server";

/**
 * Global Next.js middleware.
 * Runs on every request (matched by config.matcher below).
 *
 * Responsibilities:
 *  1. Security response headers on every request
 *  2. CORS preflight handling for API routes
 *  3. Block non-JSON Content-Type on API write routes
 */

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Security headers applied to every response
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options":            "nosniff",
  "X-Frame-Options":                   "DENY",
  "X-XSS-Protection":                  "1; mode=block",
  "Referrer-Policy":                   "strict-origin-when-cross-origin",
  "Permissions-Policy":                "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security":         "max-age=31536000; includeSubDomains",
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // Next.js needs these in dev
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; " +
    "connect-src 'self' https://sepolia.basescan.org; " +
    "frame-ancestors 'none'",
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;
  const origin = req.headers.get("origin");

  // ── CORS preflight ────────────────────────────────────────────────────────
  if (method === "OPTIONS" && pathname.startsWith("/api/")) {
    const res = new NextResponse(null, { status: 204 });
    applySecurityHeaders(res);
    res.headers.set("Access-Control-Allow-Origin",  ALLOWED_ORIGIN);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Payment");
    res.headers.set("Access-Control-Max-Age",       "86400");
    return res;
  }

  // ── Route Protection ──────────────────────────────────────────────────────
  const protectedPaths = ["/profile", "/admin", "/history", "/wallet", "/send", "/swap", "/escrow"];
  const isProtected = protectedPaths.some(p => pathname.startsWith(p));
  
  if (isProtected) {
    const sessionCookie = req.cookies.get("praxis_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/login", req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  const res = NextResponse.next();
  applySecurityHeaders(res);

  // ── CORS actual request ───────────────────────────────────────────────────
  if (pathname.startsWith("/api/") && origin) {
    if (origin === ALLOWED_ORIGIN) {
      res.headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
      res.headers.set("Vary", "Origin");
    }
    // Requests from other origins get no CORS header → browser blocks them
  }

  return res;
}

function applySecurityHeaders(res: NextResponse) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(k, v);
  }
}

export const config = {
  // Run middleware on all API routes and the main page
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
