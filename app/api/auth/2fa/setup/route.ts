import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/src/lib/auth/session";
import { prisma } from "@/src/db/prisma";
import { generateTotpSecret, generateBackupCodes, verifyTotp } from "@/src/lib/auth/totp";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("praxis_session");
    if (!sessionCookie?.value) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = await resolveSession(sessionCookie.value);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.user.totpEnabled) {
      return NextResponse.json({ error: "2FA already enabled" }, { status: 400 });
    }

    const { secret, qrCodeUrl } = await generateTotpSecret(session.user.email);
    const { plainCodes, hashedCodes } = await generateBackupCodes();

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        totpSecret: secret,
        backupCodes: JSON.stringify(hashedCodes),
      }
    });

    return NextResponse.json({ qrCodeUrl, secret, backupCodes: plainCodes });
  } catch (error) {
    console.error("2fa setup get error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("praxis_session");
    if (!sessionCookie?.value) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = await resolveSession(sessionCookie.value);
    if (!session || !session.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { totpCode } = await req.json();
    if (!session.user.totpSecret) return NextResponse.json({ error: "No secret generated" }, { status: 400 });

    const isValid = verifyTotp(session.user.totpSecret, totpCode);

    if (!isValid) return NextResponse.json({ error: "Invalid TOTP code" }, { status: 400 });

    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpEnabled: true }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("2fa setup post error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
