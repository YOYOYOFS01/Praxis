import { NextRequest, NextResponse } from "next/server";
import { resolveSession, deleteAllUserSessions, createSession } from "@/src/lib/auth/session";
import { verifyPassword, hashPassword } from "@/src/lib/auth/password";
import { prisma } from "@/src/db/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("praxis_session");
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await resolveSession(sessionCookie.value);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    const isValid = await verifyPassword(currentPassword, session.user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid current password" }, { status: 400 });
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newPasswordHash }
    });

    // Invalidate all other sessions
    await deleteAllUserSessions(session.user.id);
    
    // Create new session for the current request
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    const userAgent = req.headers.get("user-agent");
    const rawToken = await createSession(session.user.id, ipAddress, userAgent);

    const res = NextResponse.json({ success: true });
    res.cookies.set("praxis_session", rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 24 * 60 * 60
    });

    return res;
  } catch (error) {
    console.error("Password update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
