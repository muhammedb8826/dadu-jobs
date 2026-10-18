import { cache } from "react";
import { cookies } from "next/headers";
import { UserType } from "@/lib/types/user.types";

const SESSION_COOKIE_NAME = "dadu_jobs_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionData = {
  userId: string;
  userDocumentId?: string; // Strapi v5 documentId for stable filtering
  email: string;
  firstName: string;
  userType?: UserType; // User type: EMPLOYER or CANDIDATE
  jwt?: string; // Store JWT token for authenticated Strapi requests
  /** Candidate profile documentId — used when Strapi cannot filter by user relation */
  candidateProfileDocumentId?: string;
  candidateProfileId?: number;
};

export function parseUserType(value: unknown): UserType | undefined {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === UserType.EMPLOYER || normalized === UserType.CANDIDATE) {
    return normalized as UserType;
  }
  return undefined;
}

export async function createSession(data: SessionData) {
  const cookieStore = await cookies();
  
  // In a production app, you'd want to sign/encrypt this token
  // For now, we'll use a simple JSON-encoded session
  const sessionValue = JSON.stringify({
    ...data,
    userType: parseUserType(data.userType) || data.userType,
  });
  
  cookieStore.set(SESSION_COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

/** Merge fields into the existing session cookie (e.g. after profile save). */
export async function updateSession(
  patch: Partial<SessionData>
): Promise<SessionData | null> {
  const current = await readSessionCookie();
  if (!current) return null;

  const next: SessionData = {
    ...current,
    ...patch,
    userType: parseUserType(patch.userType ?? current.userType) || current.userType,
  };
  await createSession(next);
  return next;
}

async function readSessionCookie(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  
  if (!sessionCookie?.value) {
    return null;
  }
  
  try {
    const sessionData = JSON.parse(sessionCookie.value) as SessionData;
    if (sessionData.userType) {
      sessionData.userType = parseUserType(sessionData.userType);
    }
    return sessionData;
  } catch {
    return null;
  }
}

async function fetchUserTypeFromStrapi(
  jwt: string,
  userId?: string
): Promise<{
  userType?: UserType;
  userDocumentId?: string;
  firstName?: string;
}> {
  const strapiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!strapiUrl) {
    return {};
  }

  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
  const endpoints: Array<{ url: string; token: string }> = [
    { url: `${strapiUrl}/api/users/me`, token: jwt },
  ];

  if (userId) {
    endpoints.push({ url: `${strapiUrl}/api/users/${userId}`, token: jwt });
    if (apiToken) {
      endpoints.push({
        url: `${strapiUrl}/api/users/${userId}`,
        token: apiToken,
      });
    }
  }

  let userDocumentId: string | undefined;
  let firstName: string | undefined;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${endpoint.token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        continue;
      }

      const userData = await response.json().catch(() => ({}));
      const userType = parseUserType(userData?.type);
      userDocumentId =
        userDocumentId || (userData?.documentId as string | undefined);
      firstName =
        firstName ||
        (userData?.firstName as string | undefined) ||
        (userData?.username as string | undefined);

      if (userType) {
        return { userType, userDocumentId, firstName };
      }
    } catch (error) {
      console.error(`Error fetching user type from ${endpoint.url}:`, error);
    }
  }

  return { userDocumentId, firstName };
}

/**
 * Ensure the session includes a valid userType by refreshing from Strapi when missing.
 * Does not write cookies in RSC (not allowed). Use /api/auth/refresh-session to persist.
 */
export async function ensureSessionUserType(
  session: SessionData | null
): Promise<SessionData | null> {
  if (!session?.jwt) {
    return session;
  }

  const existingType = parseUserType(session.userType);
  if (existingType) {
    return {
      ...session,
      userType: existingType,
    };
  }

  try {
    const refreshed = await fetchUserTypeFromStrapi(session.jwt, session.userId);
    if (!refreshed.userType && !refreshed.userDocumentId && !refreshed.firstName) {
      return session;
    }

    return {
      ...session,
      userType: refreshed.userType || session.userType,
      userDocumentId: refreshed.userDocumentId || session.userDocumentId,
      firstName: refreshed.firstName || session.firstName,
    };
  } catch (error) {
    console.error("Error refreshing session user type:", error);
    return session;
  }
}

/**
 * Cached per-request session reader that auto-heals missing userType from Strapi.
 */
export const getSession = cache(async (): Promise<SessionData | null> => {
  const session = await readSessionCookie();
  if (!session) {
    return null;
  }

  if (parseUserType(session.userType)) {
    return {
      ...session,
      userType: parseUserType(session.userType),
    };
  }

  return ensureSessionUserType(session);
});

/** Raw cookie read without Strapi healing (used by refresh route). */
export async function getRawSession(): Promise<SessionData | null> {
  return readSessionCookie();
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
