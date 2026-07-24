import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/src/lib/auth/session";
import { prisma } from "@/src/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("praxis_session");
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentSession = await resolveSession(sessionCookie.value);
    if (!currentSession || !currentSession.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await prisma.session.findMany({
      where: { userId: currentSession.user.id },
      orderBy: { createdAt: "desc" },
    });

    // Mark which one is current, hide raw token hash
    const formattedSessions = sessions.map(s => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === currentSession.id
    }));

    return NextResponse.json({ sessions: formattedSessions });
  } catch (error) {
    console.error("Auth sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
