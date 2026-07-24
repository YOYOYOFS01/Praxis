import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/db/prisma";
import { createHash } from "crypto";
import { hashPassword } from "@/src/lib/auth/password";
import { deleteAllUserSessions } from "@/src/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Missing token or password" }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const resetData = (global as any).passwordResetTokens?.get(tokenHash);

    if (!resetData || resetData.expiresAt < Date.now()) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: resetData.userId },
      data: { passwordHash: newPasswordHash }
    });

    // Invalidate all sessions
    await deleteAllUserSessions(resetData.userId);

    // Mark token used
    (global as any).passwordResetTokens.delete(tokenHash);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
