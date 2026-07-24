import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/src/lib/auth/session";
import { prisma } from "@/src/db/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionCookie = req.cookies.get("praxis_session");
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentSession = await resolveSession(sessionCookie.value);
    if (!currentSession || !currentSession.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = params.id;
    
    // Prevent deleting the current session via this endpoint
    if (sessionId === currentSession.id) {
      return NextResponse.json({ error: "Cannot revoke current session" }, { status: 400 });
    }

    // Ensure the session belongs to the current user
    const sessionToDelete = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!sessionToDelete || sessionToDelete.userId !== currentSession.user.id) {
      return NextResponse.json({ error: "Session not found or unauthorized" }, { status: 404 });
    }

    await prisma.session.delete({
      where: { id: sessionId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Auth session revoke error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
