import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";
import { findEmployerProfileForUser } from "@/lib/strapi/employer-profile";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const { searchParams } = new URL(request.url);
    const employerId = searchParams.get("id");
    const myProfile = searchParams.get("myProfile") === "true";

    // Build populate query
    // Use field selection for media to avoid 'related' field validation errors
    // Populate company and its nested relations without field restrictions on main entity
    const populateQuery =
      "populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=url&populate[profilePicture][fields][2]=name&populate[profilePicture][fields][3]=alternativeText&populate[profilePicture][fields][4]=formats&" +
      "populate[company]=*&" +
      "populate[company][populate][logo][fields][0]=id&populate[company][populate][logo][fields][1]=url&populate[company][populate][logo][fields][2]=name&populate[company][populate][logo][fields][3]=alternativeText&populate[company][populate][logo][fields][4]=formats&" +
      "populate[company][populate][socialLinks]=*&" +
      "populate[user][fields][0]=username&populate[user][fields][1]=email&populate[user][fields][2]=type";

    // Own profile: resolve without filters[user] (Invalid key user on this Strapi)
    if (myProfile && isEmployer(session)) {
      const mine = await findEmployerProfileForUser({
        userId: session.userId,
        userDocumentId: session.userDocumentId,
        authToken: session.jwt,
        fallbackAuthToken: apiToken,
        populateQuery,
      });
      return NextResponse.json({ data: mine, meta: {} }, { status: 200 });
    }

    let url: string;
    if (employerId) {
      url = `${strapiUrl}/api/employer-profiles/${employerId}?${populateQuery}`;
    } else {
      url = `${strapiUrl}/api/employer-profiles?${populateQuery}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (session.jwt) {
      headers.Authorization = `Bearer ${session.jwt}`;
    } else if (apiToken) {
      headers.Authorization = `Bearer ${apiToken}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Strapi fetch error:", { status: response.status, error: result });
      const errorMessage =
        result?.error?.message ||
        result?.message ||
        "Failed to fetch employer profiles";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Employer profile fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch employer profiles";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST handler for creating employer profiles
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only employers can create/update their own employer profiles
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can manage employer profiles." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || !body.data) {
      return NextResponse.json(
        { error: "Invalid request body" },
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

    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userId = Number(session.userId);

    // Check if profile already exists (no filters[user])
    const existingProfile = await findEmployerProfileForUser({
      userId: session.userId,
      userDocumentId: session.userDocumentId,
      authToken: userJwt,
      fallbackAuthToken: apiToken,
      populateQuery: "populate[user][fields][0]=id&populate[user][fields][1]=documentId",
    });

    let existingProfileId: number | string | null = existingProfile?.id ?? null;
    const existingProfileDocumentId: string | null =
      existingProfile?.documentId ?? null;

    // Extract and prepare profile data
    const {
      fullName,
      jobTitle,
      phone,
      bio,
      profilePicture,
      company, // This should now be a company ID (number), not an object
    } = body.data;

    // Validate required fields
    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required" },
        { status: 400 }
      );
    }

    // Company should be provided as an ID (number) or documentId (string) from the frontend
    // The company is saved separately via /api/companies endpoint
    // Strapi 5 supports both id (number) and documentId (string) for relations
    const companyIdentifier = company !== null && company !== undefined 
      ? (typeof company === "number" ? company : typeof company === "string" ? company : null)
      : null;

    // Do not put `user` in the REST body — Authenticated gets "Invalid key user".
    // Strapi lifecycle links user from ctx.state.user when saving with the JWT.
    const profileData: Record<string, unknown> = {
      fullName,
      phone: phone || null,
      bio: bio || null,
    };

    if (jobTitle) profileData.jobTitle = jobTitle;
    if (profilePicture) profileData.profilePicture = profilePicture;
    if (companyIdentifier) {
      profileData.company = companyIdentifier;
    }

    if (!userJwt && !apiToken) {
      return NextResponse.json(
        { error: "No authentication token available" },
        { status: 500 }
      );
    }

    const saveWithToken = async (
      token: string,
      data: Record<string, unknown>
    ) => {
      const target = existingProfileDocumentId || existingProfileId;
      const url = target
        ? `${strapiUrl}/api/employer-profiles/${target}`
        : `${strapiUrl}/api/employer-profiles`;
      return fetch(url, {
        method: target ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ data }),
      });
    };

    const parseResult = async (res: Response) => {
      const responseText = await res.text();
      if (!responseText) return {};
      try {
        return JSON.parse(responseText) as Record<string, unknown>;
      } catch {
        return { error: responseText };
      }
    };

    // Prefer JWT so the lifecycle can attach the user relation
    let response = await saveWithToken(userJwt || apiToken!, profileData);
    let result = await parseResult(response);

    if (
      !response.ok &&
      userJwt &&
      apiToken &&
      (response.status === 401 || response.status === 403)
    ) {
      // API token has no ctx.state.user — include user id in the body
      response = await saveWithToken(apiToken, { ...profileData, user: userId });
      result = await parseResult(response);
    }

    if (!response.ok) {
      const errorMessage =
        (result?.error as { message?: string })?.message ||
        (result?.error as string) ||
        result?.message ||
        "Failed to save employer profile";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, {
      status: existingProfileId ? 200 : 201,
    });
  } catch (error) {
    console.error("Employer profile save error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save employer profile";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT handler for updating employer profiles
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only employers can update their own employer profiles
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can manage employer profiles." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || !body.data) {
      return NextResponse.json(
        { error: "Invalid request body" },
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

    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userId = Number(session.userId);
    const targetIdentifier = body.data.documentId || body.data.id;

    if (!targetIdentifier) {
      return NextResponse.json(
        { error: "Missing profile identifier" },
        { status: 400 }
      );
    }

    // Verify the profile belongs to the logged-in user (no filters[user])
    const userProfile = await findEmployerProfileForUser({
      userId: session.userId,
      userDocumentId: session.userDocumentId,
      authToken: userJwt,
      fallbackAuthToken: apiToken,
      populateQuery: "populate[user][fields][0]=id&populate[user][fields][1]=documentId",
    });

    if (userProfile) {
      const profileId = body.data.id ? Number(body.data.id) : null;
      const profileDocumentId = body.data.documentId || null;
      if (
        (profileId && userProfile.id !== profileId) ||
        (profileDocumentId && userProfile.documentId !== profileDocumentId)
      ) {
        return NextResponse.json(
          { error: "Access denied. You can only update your own profile." },
          { status: 403 }
        );
      }
    }

    // Extract and prepare profile data
    const {
      fullName,
      jobTitle,
      phone,
      bio,
      profilePicture,
      company, // This should now be a company ID (number), not an object
    } = body.data;

    // Prepare update payload
    const updateData: Record<string, unknown> = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (jobTitle !== undefined) updateData.jobTitle = jobTitle;
    if (phone !== undefined) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;
    if (profilePicture !== undefined) updateData.profilePicture = profilePicture;

    // Company should be provided as an ID (number) or documentId (string) from the frontend
    // The company is saved separately via /api/companies endpoint
    // Strapi 5 supports both id (number) and documentId (string) for relations
    // Always set company if provided, even if null (to clear the relation)
    if (company !== undefined) {
      if (company !== null) {
        const companyIdentifier = typeof company === "number" 
          ? company 
          : typeof company === "string" 
          ? company 
          : null;
        if (companyIdentifier) {
          updateData.company = companyIdentifier;
        }
      } else {
        // Explicitly set to null to clear the relation
        updateData.company = null;
      }
    }

    // Update the profile
    const response = await fetch(`${strapiUrl}/api/employer-profiles/${targetIdentifier}?populate=*`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
        ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      body: JSON.stringify({ data: updateData }),
    });

    const responseText = await response.text();
    let result: Record<string, unknown> = {};
    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { error: responseText };
      }
    }

    if (!response.ok) {
      const errorMessage =
        (result?.error as { message?: string })?.message ||
        (result?.error as string) ||
        result?.message ||
        "Failed to update employer profile";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("PUT Route Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
