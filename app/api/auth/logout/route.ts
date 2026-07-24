import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/src/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("praxis_session");
    
    if (sessionCookie?.value) {
      await deleteSession(sessionCookie.value);
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set("praxis_session", "", {
      maxAge: 0,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
