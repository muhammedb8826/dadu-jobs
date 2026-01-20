import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "dadu_jobs_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

import { UserType } from "@/lib/types/user.types";

export type SessionData = {
  userId: string;
  userDocumentId?: string; // Strapi v5 documentId for stable filtering
  email: string;
  firstName: string;
  userType?: UserType; // User type: EMPLOYER or CANDIDATE
  jwt?: string; // Store JWT token for authenticated Strapi requests
};

export async function createSession(data: SessionData) {
  const cookieStore = await cookies();
  
  // In a production app, you'd want to sign/encrypt this token
  // For now, we'll use a simple JSON-encoded session
  const sessionValue = JSON.stringify(data);
  
  cookieStore.set(SESSION_COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const sessionData = JSON.parse(sessionCookie.value) as SessionData;
    return sessionData;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Validate session by checking if the JWT token is still valid with Strapi
 * Returns true if valid, false if invalid
 */
export async function validateSession(session: SessionData | null): Promise<boolean> {
  if (!session || !session.jwt) {
    return false;
  }

  try {
    const strapiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!strapiUrl) {
      return false;
    }

    // Try to fetch user info using the JWT token
    // This will fail if the token is invalid or user is deleted
    const response = await fetch(`${strapiUrl}/api/users/me`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.jwt}`,
      },
      cache: "no-store",
    });

    // If we get a 401 or 403, the token is invalid
    if (response.status === 401 || response.status === 403) {
      return false;
    }

    // If we get a 200, the token is valid
    return response.ok;
  } catch (error) {
    console.error("Session validation error:", error);
    return false;
  }
}

