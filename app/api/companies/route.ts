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

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Prepare company data
    const companyData: Record<string, unknown> = {
      name,
      slug,
    };

    if (website) companyData.website = website;
    if (industry) companyData.industry = industry;
    if (companySize) companyData.companySize = companySize;
    if (location) companyData.location = location;
    if (description) companyData.description = description;
    if (tagline) companyData.tagline = tagline;

    // Handle logo - if it's an array with one ID, use it
    if (logo !== undefined) {
      if (Array.isArray(logo) && logo.length > 0) {
        companyData.logo = logo;
      } else if (typeof logo === "number") {
        companyData.logo = [logo];
      } else {
        companyData.logo = [];
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

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only employers can update companies
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can update companies." },
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
    const targetIdentifier = body.data.documentId || body.data.id;

    if (!targetIdentifier) {
      return NextResponse.json(
        { error: "Missing company identifier" },
        { status: 400 }
      );
    }

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

    // Prepare update payload
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      updateData.name = name;
      // Regenerate slug if name changed
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      updateData.slug = slug;
    }

    if (website !== undefined) updateData.website = website;
    if (industry !== undefined) updateData.industry = industry;
    if (companySize !== undefined) updateData.companySize = companySize;
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (tagline !== undefined) updateData.tagline = tagline;

    // Handle logo
    if (logo !== undefined) {
      if (Array.isArray(logo) && logo.length > 0) {
        updateData.logo = logo;
      } else if (typeof logo === "number") {
        updateData.logo = [logo];
      } else {
        updateData.logo = [];
      }
    }

    // Handle social links - always include array (even if empty) to sync with server
    if (socialLinks !== undefined) {
      updateData.socialLinks = Array.isArray(socialLinks)
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

    // Update the company
    const response = await fetch(`${strapiUrl}/api/companies/${targetIdentifier}?populate=*`, {
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
        "Failed to update company";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Company update error:", error);
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    );
  }
}
