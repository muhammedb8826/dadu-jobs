import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("id");

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    // If requesting a specific company
    if (companyId) {
      const populateQuery = "populate[logo]=*&populate[socialLinks]=*";
      const response = await fetch(
        `${strapiUrl}/api/companies/${companyId}?${populateQuery}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return NextResponse.json(
          { error: "Failed to fetch company" },
          { status: response.status }
        );
      }

      const result = await response.json();
      return NextResponse.json(result, { status: 200 });
    }

    // List all companies (public endpoint)
    const populateQuery = "populate[logo]=*&populate[socialLinks]=*";
    const response = await fetch(`${strapiUrl}/api/companies?${populateQuery}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch companies" },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Companies fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    );
  }
}

// POST handler for creating companies
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only employers can create companies
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can create companies." },
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

    // Extract company data
    const {
      name,
      website,
      industry,
      companySize,
      location,
      description,
      tagline,
      logo,
      socialLinks,
    } = body.data;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    // Check if company with same name already exists (Upsert logic)
    // This allows employers to use existing companies or create new ones
    const existingCompanyCheck = await fetch(
      `${strapiUrl}/api/companies?filters[name][$eq]=${encodeURIComponent(name)}&pagination[limit]=1`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
      }
    );

    if (existingCompanyCheck.ok) {
      const existingResult = await existingCompanyCheck.json().catch(() => ({}));
      if (existingResult?.data && Array.isArray(existingResult.data) && existingResult.data.length > 0) {
        // Company already exists - return it (upsert behavior)
        // This allows the employer to link to an existing company
        const existingCompany = existingResult.data[0];
        return NextResponse.json(
          { 
            data: existingCompany,
            message: "Using existing company"
          },
          { status: 200 }
        );
      }
    }

    // Generate base slug from name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Check if slug already exists and make it unique if needed
    let slug = baseSlug;
    let slugCheckAttempts = 0;
    const maxAttempts = 10;

    while (slugCheckAttempts < maxAttempts) {
      const slugCheck = await fetch(
        `${strapiUrl}/api/companies?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[limit]=1`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          },
        }
      );

      if (slugCheck.ok) {
        const slugResult = await slugCheck.json().catch(() => ({}));
        if (slugResult?.data && Array.isArray(slugResult.data) && slugResult.data.length > 0) {
          // Slug exists, generate a new one with timestamp suffix
          slug = `${baseSlug}-${Date.now()}`;
          slugCheckAttempts++;
        } else {
          // Slug is available
          break;
        }
      } else {
        // If check fails, use the base slug
        break;
      }
    }

    // Prepare company data
    const companyData: Record<string, unknown> = {
      name,
      slug,
    };

    // Link owner if userId is available
    const userId = Number(session.userId);
    if (userId) {
      companyData.owner = userId;
    }

    if (website) companyData.website = website;
    if (industry) companyData.industry = industry;
    if (companySize) companyData.companySize = companySize;
    if (location) companyData.location = location;
    if (description) companyData.description = description;
    if (tagline) companyData.tagline = tagline;

    // Handle logo - Strapi single media field expects a single ID or null, not an array
    if (logo !== undefined) {
      if (Array.isArray(logo)) {
        // If it's an array, take the first ID (single media field)
        companyData.logo = logo.length > 0 ? logo[0] : null;
      } else if (typeof logo === "number") {
        // Single ID
        companyData.logo = logo;
      } else {
        // null or undefined
        companyData.logo = null;
      }
    }

    // Handle social links - always include array (even if empty) to sync with server
    if (socialLinks !== undefined) {
      companyData.socialLinks = Array.isArray(socialLinks)
        ? socialLinks.map((link: { id?: number; label: string; url: string }) => {
            const linkData: Record<string, unknown> = {
              label: link.label,
              url: link.url,
            };
            // Include ID if present (for updates)
            if (link.id) {
              linkData.id = link.id;
            }
            return linkData;
          })
        : [];
    }

    // Create the company
    const response = await fetch(`${strapiUrl}/api/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
        ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      body: JSON.stringify({ data: companyData }),
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
        "Failed to create company";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Company creation error:", error);
    return NextResponse.json(
      { error: "Failed to create company" },
      { status: 500 }
    );
  }
}

// PUT handler for updating companies
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!isEmployer(session)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userJwt = session.jwt;

    const body = await request.json().catch(() => null);
    if (!body || !body.data) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const targetIdentifier = body.data.documentId || body.data.id;
    if (!targetIdentifier) return NextResponse.json({ error: "Missing identifier" }, { status: 400 });

    // --- 1. FIND THE EMPLOYER PROFILE ---
    // We need the documentId of the employer profile to link it
    const userId = Number(session.userId);
    const profileRes = await fetch(
      `${strapiUrl}/api/employer-profiles?filters[user][id][$eq]=${userId}&pagination[limit]=1`,
      {
        headers: {
          "Content-Type": "application/json",
          ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          ...(!apiToken && userJwt && { Authorization: `Bearer ${userJwt}` }),
        },
      }
    );
    const profileData = await profileRes.json().catch(() => ({}));
    const employerProfileId = profileData?.data?.[0]?.documentId || profileData?.data?.[0]?.id;

    // --- 2. BUILD CLEAN PAYLOAD ---
    const updateData: Record<string, unknown> = {};
    
    // Whitelist simple fields
    const fields = ['name', 'website', 'industry', 'companySize', 'location', 'description', 'tagline'];
    fields.forEach(f => { 
      if (body.data[f] !== undefined) {
        updateData[f] = body.data[f];
      }
    });

    // Handle Logo (Single ID)
    if (body.data.logo !== undefined) {
      updateData.logo = Array.isArray(body.data.logo) 
        ? (body.data.logo.length > 0 ? body.data.logo[0] : null)
        : (body.data.logo || null);
    }

    // Handle Social Links (CLEANING OUT THE 'ICON' OBJECT)
    if (body.data.socialLinks !== undefined) {
      updateData.socialLinks = Array.isArray(body.data.socialLinks)
        ? body.data.socialLinks.map((link: { id?: number; label: string; url: string; icon?: unknown }) => ({
            ...(link.id && { id: link.id }), // Include ID for existing components
            label: link.label || "",
            url: link.url || "",
            // Notice we DO NOT include link.icon here. This prevents the 400 error.
          }))
        : [];
    }

    // --- 3. ESTABLISH RELATIONSHIP ---
    // Link to the Employer Profile (Many-to-Many relation)
    // The Company has an 'employers' field (plural) that is a relation to Employer Profiles
    if (employerProfileId) {
      // For many-to-many or one-to-many relations, we might need to use connect/disconnect
      // But first, let's try setting it directly - Strapi 5 should handle it
      // If the field is 'employers' (plural), we might need to set it as an array
      // Check if employer is already linked, if not, add it
      updateData.employers = [employerProfileId];
    }

    // --- 4. SLUG: Update slug if name changed ---
    if (updateData.name) {
      const baseSlug = String(updateData.name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // Check if slug already exists (excluding current company)
      const slugCheck = await fetch(
        `${strapiUrl}/api/companies?filters[slug][$eq]=${encodeURIComponent(baseSlug)}&filters[id][$ne]=${targetIdentifier}&pagination[limit]=1`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          },
        }
      );

      let finalSlug = baseSlug;
      if (slugCheck.ok) {
        const slugResult = await slugCheck.json().catch(() => ({}));
        if (slugResult?.data && Array.isArray(slugResult.data) && slugResult.data.length > 0) {
          // Slug exists for another company, make it unique
          finalSlug = `${baseSlug}-${Date.now()}`;
        }
      }

      updateData.slug = finalSlug;
    }

    // --- 5. EXECUTE ---
    const response = await fetch(`${strapiUrl}/api/companies/${targetIdentifier}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(userJwt ? { Authorization: `Bearer ${userJwt}` } : (apiToken && { Authorization: `Bearer ${apiToken}` })),
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
        "Update failed";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("PUT Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
