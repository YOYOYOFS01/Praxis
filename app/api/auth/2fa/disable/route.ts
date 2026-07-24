import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { verifyTotp } from "@/src/lib/auth/totp";
import { resolveSession } from "@/src/lib/auth/session";
import { verifyPassword } from "@/src/lib/auth/password";

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("praxis_session");
    if (!sessionCookie?.value) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = await resolveSession(sessionCookie.value);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { password, totpCode } = await req.json();

    if (!password || !totpCode) {
      return NextResponse.json({ error: "Missing password or TOTP code" }, { status: 400 });
    }

    const isValidPassword = await verifyPassword(password, session.user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    if (!session.user.totpSecret || !session.user.totpEnabled) {
      return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
    }

    const isValidTotp = verifyTotp(session.user.totpSecret, totpCode);
    if (!isValidTotp) {
      return NextResponse.json({ error: "Invalid TOTP code" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpEnabled: false, totpSecret: null, backupCodes: null }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("2FA disable error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
