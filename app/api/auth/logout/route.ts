import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    await deleteSession();

    return NextResponse.json(
      { success: true, message: "Logged out successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}

// GET handler for redirects (e.g., when session expires)
export async function GET(request: NextRequest) {
  try {
    await deleteSession();
    
    // Redirect to login with error message
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "session_expired");
    
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Logout error:", error);
    // Even if deletion fails, redirect to login
    return NextResponse.redirect(new URL("/login?error=session_expired", request.url));
  }
}

