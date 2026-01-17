import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("id");
    const categoriesOnly = searchParams.get("categories") === "true";

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    // If requesting categories only
    if (categoriesOnly) {
      const response = await fetch(
        `${strapiUrl}/api/categories?populate=*`,
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
          { error: "Failed to fetch categories" },
          { status: response.status }
        );
      }

      const result = await response.json();
      return NextResponse.json({ data: result.data || [] }, { status: 200 });
    }

    // If requesting a specific job
    if (jobId) {
      // Only employers can view individual jobs for editing
      if (!session || !isEmployer(session)) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      const populateQuery = "populate[categories]=*&populate[salary]=*";
      const response = await fetch(
        `${strapiUrl}/api/jobs/${jobId}?${populateQuery}`,
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
          { error: "Failed to fetch job" },
          { status: response.status }
        );
      }

      const result = await response.json();
      return NextResponse.json(result, { status: 200 });
    }

    // List all jobs (public endpoint, but can be filtered by employer)
    const populateQuery = "populate[categories]=*&populate[salary]=*";
    let url = `${strapiUrl}/api/jobs?${populateQuery}`;

    // If user is an employer, they can filter by their own jobs
    if (session && isEmployer(session)) {
      const userId = Number(session.userId);
      url = `${strapiUrl}/api/jobs?filters[user][id][$eq]=${userId}&${populateQuery}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch jobs" },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Jobs fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

// POST handler for creating jobs
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only employers can create jobs
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can create job postings." },
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

    // Extract and prepare job data
    const {
      title,
      description,
      location,
      jobType,
      deadline,
      workplaceType,
      isFeatured,
      experience,
      salary,
      categories,
    } = body.data;

    // Validate required fields
    if (!title || !description || !deadline) {
      return NextResponse.json(
        { error: "Title, description, and deadline are required" },
        { status: 400 }
      );
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Prepare job payload
    const jobData: Record<string, unknown> = {
      title,
      slug,
      description,
      deadline,
      workplaceType: workplaceType || "On Site",
      isFeatured: isFeatured || false,
      experience: experience || "Entry",
      user: userId,
      approvalStatus: "Pending", // New jobs start as pending
    };

    if (location) {
      jobData.location = location;
    }

    if (jobType) {
      jobData.jobType = jobType;
    }

    // Handle salary - create or find existing salary entry
    if (salary) {
      let salaryId: number | null = null;

      // Check if a similar salary exists
      if (salary.min !== undefined || salary.max !== undefined) {
        const salaryCheckUrl = `${strapiUrl}/api/salaries?filters[min][$eq]=${salary.min || null}&filters[max][$eq]=${salary.max || null}&filters[currency][$eq]=${salary.currency || "ETB"}&filters[isNegotiable][$eq]=${salary.isNegotiable || false}`;
        
        const salaryCheckResponse = await fetch(salaryCheckUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          },
        });

        if (salaryCheckResponse.ok) {
          const salaryResult = await salaryCheckResponse.json().catch(() => ({}));
          if (salaryResult?.data && salaryResult.data.length > 0) {
            salaryId = salaryResult.data[0].id;
          }
        }

        // Create new salary if it doesn't exist
        if (!salaryId) {
          const createSalaryResponse = await fetch(`${strapiUrl}/api/salaries`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
              ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
            },
            body: JSON.stringify({
              data: {
                min: salary.min || null,
                max: salary.max || null,
                currency: salary.currency || "ETB",
                isNegotiable: salary.isNegotiable || false,
              },
            }),
          });

          if (createSalaryResponse.ok) {
            const salaryResult = await createSalaryResponse.json().catch(() => ({}));
            if (salaryResult?.data) {
              salaryId = salaryResult.data.id || salaryResult.data.documentId;
            }
          }
        }
      }

      if (salaryId) {
        jobData.salary = salaryId;
      }
    }

    // Handle categories - should be array of category IDs
    if (categories && Array.isArray(categories) && categories.length > 0) {
      jobData.categories = categories;
    }

    // Create the job
    const response = await fetch(`${strapiUrl}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
        ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      body: JSON.stringify({ data: jobData }),
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
        "Failed to create job posting";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Job creation error:", error);
    return NextResponse.json(
      { error: "Failed to create job posting" },
      { status: 500 }
    );
  }
}

// PUT handler for updating jobs
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only employers can update jobs
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can update job postings." },
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
    const jobId = body.data.id;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required for updates" },
        { status: 400 }
      );
    }

    // Verify the job belongs to the logged-in user
    const verifyResponse = await fetch(
      `${strapiUrl}/api/jobs/${jobId}?populate=user`,
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
      const job = verifyResult?.data;
      
      if (job?.user?.id !== userId) {
        return NextResponse.json(
          { error: "Access denied. You can only update your own job postings." },
          { status: 403 }
        );
      }
    }

    // Extract and prepare job data
    const {
      title,
      description,
      location,
      jobType,
      deadline,
      workplaceType,
      isFeatured,
      experience,
      salary,
      categories,
    } = body.data;

    // Prepare update payload
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      updateData.title = title;
      // Regenerate slug if title changed
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      updateData.slug = slug;
    }

    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location;
    if (jobType !== undefined) updateData.jobType = jobType;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (workplaceType !== undefined) updateData.workplaceType = workplaceType;
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (experience !== undefined) updateData.experience = experience;

    // Handle salary update
    if (salary) {
      let salaryId: number | null = null;

      // Check if a similar salary exists
      if (salary.min !== undefined || salary.max !== undefined) {
        const salaryCheckUrl = `${strapiUrl}/api/salaries?filters[min][$eq]=${salary.min || null}&filters[max][$eq]=${salary.max || null}&filters[currency][$eq]=${salary.currency || "ETB"}&filters[isNegotiable][$eq]=${salary.isNegotiable || false}`;
        
        const salaryCheckResponse = await fetch(salaryCheckUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          },
        });

        if (salaryCheckResponse.ok) {
          const salaryResult = await salaryCheckResponse.json().catch(() => ({}));
          if (salaryResult?.data && salaryResult.data.length > 0) {
            salaryId = salaryResult.data[0].id;
          }
        }

        // Create new salary if it doesn't exist
        if (!salaryId) {
          const createSalaryResponse = await fetch(`${strapiUrl}/api/salaries`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
              ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
            },
            body: JSON.stringify({
              data: {
                min: salary.min || null,
                max: salary.max || null,
                currency: salary.currency || "ETB",
                isNegotiable: salary.isNegotiable || false,
              },
            }),
          });

          if (createSalaryResponse.ok) {
            const salaryResult = await createSalaryResponse.json().catch(() => ({}));
            if (salaryResult?.data) {
              salaryId = salaryResult.data.id || salaryResult.data.documentId;
            }
          }
        }
      }

      if (salaryId) {
        updateData.salary = salaryId;
      }
    }

    // Handle categories
    if (categories !== undefined && Array.isArray(categories)) {
      updateData.categories = categories;
    }

    // Update the job
    const response = await fetch(`${strapiUrl}/api/jobs/${jobId}`, {
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
        "Failed to update job posting";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Job update error:", error);
    return NextResponse.json(
      { error: "Failed to update job posting" },
      { status: 500 }
    );
  }
}
