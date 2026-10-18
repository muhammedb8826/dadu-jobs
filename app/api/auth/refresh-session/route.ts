import { NextResponse } from "next/server";
import {
  createSession,
  ensureSessionUserType,
  getRawSession,
} from "@/lib/auth/session";

export async function POST() {
  try {
    const session = await getRawSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const refreshed = await ensureSessionUserType(session);
    if (!refreshed) {
      return NextResponse.json({ error: "Unable to refresh session" }, { status: 400 });
    }

    // Persist healed session cookie (allowed in Route Handlers)
    await createSession(refreshed);

    return NextResponse.json({
      success: true,
      userType: refreshed.userType || null,
    });
  } catch (error) {
    console.error("Refresh session error:", error);
    return NextResponse.json(
      { error: "Failed to refresh session" },
      { status: 500 }
    );
  }
}
