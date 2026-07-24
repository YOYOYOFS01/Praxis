import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { verifyTotp } from "@/src/lib/auth/totp";
import { createSession } from "@/src/lib/auth/session";
import { verifyPassword } from "@/src/lib/auth/password";

export async function POST(req: NextRequest) {
  try {
    const { tempToken, totpCode, backupCode, rememberMe = true } = await req.json();

    if (!tempToken) {
      return NextResponse.json({ error: "Missing temp token" }, { status: 400 });
    }

    const tempSession = (global as any).totpTempTokens?.get(tempToken);
    if (!tempSession || tempSession.expiresAt < Date.now()) {
      return NextResponse.json({ error: "Token expired or invalid" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: tempSession.userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return NextResponse.json({ error: "2FA not properly configured" }, { status: 400 });
    }

    let isValid = false;

    if (totpCode) {
      isValid = verifyTotp(user.totpSecret, totpCode);
    } else if (backupCode && user.backupCodes) {
      const hashedCodes = JSON.parse(user.backupCodes) as string[];
      for (let i = 0; i < hashedCodes.length; i++) {
        if (await verifyPassword(backupCode, hashedCodes[i])) {
          isValid = true;
          hashedCodes.splice(i, 1);
          await prisma.user.update({
            where: { id: user.id },
            data: { backupCodes: JSON.stringify(hashedCodes) }
          });
          break;
        }
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }

    (global as any).totpTempTokens.delete(tempToken);

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
    console.error("2FA verify error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
