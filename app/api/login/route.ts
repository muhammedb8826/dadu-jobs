import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { createSession, parseUserType } from "@/lib/auth/session";
import { resolveCandidateProfileDocumentIdFromUser } from "@/lib/strapi/candidate-profile";
import { UserType } from "@/lib/types/user.types";

type StrapiAuthResponse = {
  jwt: string;
  user: {
    id: number;
    documentId?: string; // Strapi v5 document ID
    username: string;
    email: string;
    confirmed?: boolean;
    blocked?: boolean;
    firstName?: string;
    lastName?: string;
    type?: string; // User type: EMPLOYER or CANDIDATE
    [key: string]: unknown;
  };
  error?: {
    message?: string;
  };
};

async function resolveUserTypeAndDocumentId(
  strapiUrl: string,
  jwt: string,
  userId: number,
  authUser?: StrapiAuthResponse["user"]
): Promise<{ userType?: UserType; userDocumentId?: string }> {
  // Prefer type from the auth payload when available
  let userType = parseUserType(authUser?.type);
  let userDocumentId = authUser?.documentId;

  if (userType && userDocumentId) {
    return { userType, userDocumentId };
  }

  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
  const endpoints: Array<{ url: string; token: string }> = [
    { url: `${strapiUrl}/api/users/me`, token: jwt },
    { url: `${strapiUrl}/api/users/${userId}`, token: jwt },
  ];

  if (apiToken) {
    endpoints.push({
      url: `${strapiUrl}/api/users/${userId}`,
      token: apiToken,
    });
  }

  for (const endpoint of endpoints) {
    try {
      const userResponse = await fetch(endpoint.url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${endpoint.token}`,
        },
        cache: "no-store",
      });

      if (!userResponse.ok) {
        continue;
      }

      const userData = await userResponse.json().catch(() => ({}));
      userType = userType || parseUserType(userData?.type);
      userDocumentId =
        userDocumentId || (userData?.documentId as string | undefined);

      if (userType) {
        break;
      }
    } catch (error) {
      console.error(`Error fetching user data from ${endpoint.url}:`, error);
    }
  }

  return { userType, userDocumentId };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const identifier = body?.identifier as string | undefined;
    const password = body?.password as string | undefined;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Username/email and password are required" },
        { status: 400 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    // Call Strapi authentication endpoint
    const response = await fetch(`${strapiUrl}/api/auth/local`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: identifier.trim(), // Strapi uses 'identifier' which can be email or username
        password: password,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Handle Strapi authentication errors
      const errorMessage =
        result?.error?.message ||
        result?.message ||
        "Invalid username/email or password";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 401 }
      );
    }

    const authData = result as StrapiAuthResponse;

    // Check if email is confirmed
    // Strapi may block unconfirmed users from logging in depending on settings
    // But we check anyway to provide a helpful error message
    if (authData.user.confirmed === false) {
      return NextResponse.json(
        { 
          error: "Please confirm your email address before logging in. Check your email for the confirmation link.",
          requiresConfirmation: true,
          email: authData.user.email,
        },
        { status: 403 }
      );
    }

    // Check if user is blocked
    if (authData.user.blocked === true) {
      return NextResponse.json(
        { error: "Your account has been blocked. Please contact support." },
        { status: 403 }
      );
    }

    const { userType, userDocumentId } = await resolveUserTypeAndDocumentId(
      strapiUrl,
      authData.jwt,
      authData.user.id,
      authData.user
    );

    if (!userType) {
      console.warn(
        `Login succeeded for user ${authData.user.id}, but user type could not be resolved from Strapi.`
      );
    }

    // Resolve linked candidate profile documentId from User.candidate_profile when present
    let candidateProfileDocumentId: string | undefined;
    if (userType === UserType.CANDIDATE) {
      candidateProfileDocumentId =
        (await resolveCandidateProfileDocumentIdFromUser({
          authToken: authData.jwt,
          fallbackAuthToken: process.env.NEXT_PUBLIC_API_TOKEN,
        })) || undefined;
    }

    // Create session with user data from Strapi including JWT, documentIds, and role
    await createSession({
      userId: String(authData.user.id),
      userDocumentId: userDocumentId,
      email: authData.user.email,
      firstName: authData.user.firstName || authData.user.username || "",
      userType: userType,
      jwt: authData.jwt,
      candidateProfileDocumentId,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Login successful",
        user: {
          id: authData.user.id,
          firstName: authData.user.firstName || authData.user.username,
          email: authData.user.email,
          type: userType,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An error occurred during login. Please try again." },
      { status: 500 }
    );
  }
}
