import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { randomBytes, createHash } from "crypto";

// Simple in-memory storage for MVP. In prod, use a DB model.
(global as any).passwordResetTokens = (global as any).passwordResetTokens || new Map<string, { userId: string, expiresAt: number }>();

export async function POST(req: NextRequest) {
  try {
    const { email, captchaToken } = await req.json();

    if (!captchaToken) {
      return NextResponse.json({ error: "CAPTCHA required" }, { status: 400 });
    }

    // Rate limit check placeholder
    
    // Always respond with success to avoid email enumeration
    const successResponse = NextResponse.json({ message: "If that email exists, a reset link has been sent" });

    if (!email) return successResponse;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return successResponse;

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    
    (global as any).passwordResetTokens.set(tokenHash, {
      userId: user.id,
      expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour
    });

    // In a real app, send an email here.
    // For demo, we just log it.
    console.log(`Password reset link: /auth/reset-password/${rawToken}`);

    return successResponse;
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
