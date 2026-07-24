import { NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { verifyPassword } from "@/src/lib/auth/password";
import { createSession } from "@/src/lib/auth/session";

export async function POST(req: Request) {
  try {
    const { email, password, rememberMe = true } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    
    if (!user.isActive) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    if (user.totpEnabled) {
      const { randomBytes } = await import("crypto");
      const tempToken = randomBytes(32).toString("hex");
      // Store temp token globally or in DB (simple in-memory for MVP)
      (global as any).totpTempTokens = (global as any).totpTempTokens || new Map();
      (global as any).totpTempTokens.set(tempToken, { userId: user.id, expiresAt: Date.now() + 10 * 60 * 1000 });
      return NextResponse.json({ requiresTOTP: true, tempToken });
    }

    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    const userAgent = req.headers.get("user-agent");
    
    const rawToken = await createSession(user.id, ipAddress, userAgent, rememberMe);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });

    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;

    res.cookies.set("praxis_session", rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge
    });

    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
