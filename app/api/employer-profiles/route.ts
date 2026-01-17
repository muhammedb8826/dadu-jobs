import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";

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
    // Avoid populate=* to prevent media `related` validation errors in Strapi.
    // Explicitly populate needed relations and limit media fields.
    // First populate company, then its nested fields (logo, socialLinks)
    const populateQuery =
      "populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=url&populate[profilePicture][fields][2]=name&populate[profilePicture][fields][3]=alternativeText&populate[profilePicture][fields][4]=formats&" +
      "populate[company][fields][0]=id&populate[company][fields][1]=documentId&populate[company][fields][2]=name&populate[company][fields][3]=website&populate[company][fields][4]=industry&populate[company][fields][5]=companySize&populate[company][fields][6]=location&populate[company][fields][7]=description&populate[company][fields][8]=tagline&populate[company][fields][9]=slug&" +
      "populate[company][populate][logo][fields][0]=id&populate[company][populate][logo][fields][1]=url&populate[company][populate][logo][fields][2]=name&populate[company][populate][logo][fields][3]=alternativeText&populate[company][populate][logo][fields][4]=formats&" +
      "populate[company][populate][socialLinks]=*&" +
      "populate[user][fields][0]=username&populate[user][fields][1]=email&populate[user][fields][2]=type";

    let url: string;
    
    // If employer wants to view their own profile
    if (myProfile && isEmployer(session)) {
      const userId = Number(session.userId);
      url = `${strapiUrl}/api/employer-profiles?filters[user][id][$eq]=${userId}&${populateQuery}`;
    } else if (employerId) {
      // View specific employer profile
      url = `${strapiUrl}/api/employer-profiles/${employerId}?${populateQuery}`;
    } else {
      // List all employer profiles (only for employers or public)
      url = `${strapiUrl}/api/employer-profiles?${populateQuery}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
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

    // If employer is fetching their own profile, return single object instead of array
    if (myProfile && isEmployer(session) && Array.isArray(result?.data) && result.data.length > 0) {
      return NextResponse.json({ data: result.data[0], meta: result.meta }, { status: 200 });
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

    // Check if profile already exists for this user
    const userProfileUrl = `${strapiUrl}/api/employer-profiles?filters[user][id][$eq]=${userId}&populate=user`;
    
    const verifyResponse = await fetch(userProfileUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
    });

    let existingProfileId: number | null = null;
    
    if (verifyResponse.ok) {
      const verifyResult = await verifyResponse.json().catch(() => ({}));
      if (verifyResult?.data && Array.isArray(verifyResult.data) && verifyResult.data.length > 0) {
        existingProfileId = verifyResult.data[0].id;
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

    // Prepare profile data
    const profileData: Record<string, unknown> = {
      fullName,
      phone: phone || null,
      bio: bio || null,
      user: userId,
    };

    if (jobTitle) profileData.jobTitle = jobTitle;
    if (profilePicture) profileData.profilePicture = profilePicture;
    // Set company relation - Strapi will handle both id and documentId
    if (companyIdentifier) {
      profileData.company = companyIdentifier;
    }

    let response: Response;
    let result: Record<string, unknown> = {};

    if (existingProfileId) {
      // Update existing profile
      const updateUrl = `${strapiUrl}/api/employer-profiles/${existingProfileId}`;
      response = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
          ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
        body: JSON.stringify({ data: profileData }),
      });
    } else {
      // Create new profile
      response = await fetch(`${strapiUrl}/api/employer-profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
          ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
        body: JSON.stringify({ data: profileData }),
      });
    }

    const responseText = await response.text();
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
        "Failed to save employer profile";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: existingProfileId ? 200 : 201 });
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

    // Verify the profile belongs to the logged-in user
    const verifyResponse = await fetch(
      `${strapiUrl}/api/employer-profiles?filters[user][id][$eq]=${userId}&populate=user`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
      }
    );

    if (verifyResponse.ok) {
      const verifyResult = await verifyResponse.json().catch(() => ({}));
      const userProfiles = Array.isArray(verifyResult?.data) ? verifyResult.data : (verifyResult?.data ? [verifyResult.data] : []);
      
      if (userProfiles.length > 0) {
        const userProfile = userProfiles[0];
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
