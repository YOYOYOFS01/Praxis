import { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "@/src/lib/auth/session";
import { prisma } from "@/src/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("praxis_session");
    
    if (!sessionCookie?.value) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const session = await resolveSession(sessionCookie.value);
    if (!session || !session.user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        tenantId: session.user.tenantId,
        createdAt: session.user.createdAt,
        lastLoginAt: session.user.lastLoginAt,
        totpEnabled: session.user.totpEnabled,
        hasWalletPin: !!session.user.walletPin,
      }
    });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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

    const { name } = await req.json();

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { name }
    });

    return NextResponse.json({ user: { id: updatedUser.id, name: updatedUser.name } });
  } catch (error) {
    console.error("Auth me patch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("praxis_session");
    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = await resolveSession(sessionCookie.value);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete the user and all associated sessions (cascade delete on sessions)
    await prisma.user.delete({
      where: { id: session.user.id }
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set("praxis_session", "", { maxAge: 0 });
    return res;
  } catch (error) {
    console.error("Auth me delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
