import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only candidates can save jobs
    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can save jobs." },
        { status: 403 }
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
    const userId = Number(session.userId);
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    // If jobId is provided, check if that specific job is saved
    if (jobId) {
      const checkUrl = `${strapiUrl}/api/saved-jobs?filters[user][id][$eq]=${userId}&filters[job][id][$eq]=${jobId}`;
      const response = await fetch(checkUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: "Failed to check saved status" },
          { status: response.status }
        );
      }

      const result = await response.json();
      const isSaved = result?.data && result.data.length > 0;
      return NextResponse.json({ saved: isSaved }, { status: 200 });
    }

    // Otherwise, return all saved jobs
    // Build populate query to get full job details
    const populateQuery = "populate[job][populate][categories][fields][0]=id&populate[job][populate][categories][fields][1]=name&populate[job][populate][categories][fields][2]=slug&populate[job][populate][salary]=*&populate[job][populate][company]=*&populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats";
    
    const url = `${strapiUrl}/api/saved-jobs?filters[user][id][$eq]=${userId}&${populateQuery}&sort[0]=createdAt:desc`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("getSavedJobs: Response not OK. Status:", response.status, "Error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch saved jobs" },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Saved jobs fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch saved jobs";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only candidates can save jobs
    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can save jobs." },
        { status: 403 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // Support both { jobId } and { data: { jobId } } formats
    const jobId = body.jobId || body.data?.jobId;
    const userId = Number(session.userId);
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    // Validate required fields
    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Fetch job to get its documentId (required for Strapi v5 relations)
    let jobDocumentId: string | null = null;
    try {
      const jobResponse = await fetch(`${strapiUrl}/api/jobs?filters[id][$eq]=${jobId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        cache: "no-store",
      });
      
      if (jobResponse.ok) {
        const jobResult = await jobResponse.json();
        if (jobResult?.data?.length > 0) {
          jobDocumentId = jobResult.data[0].documentId;
        }
      }
    } catch (error) {
      console.error("Error fetching job:", error);
    }

    if (!jobDocumentId) {
      return NextResponse.json(
        { error: "Failed to fetch job information" },
        { status: 400 }
      );
    }

    // Check if job is already saved
    const existingSavedJobUrl = `${strapiUrl}/api/saved-jobs?filters[user][id][$eq]=${userId}&filters[job][id][$eq]=${jobId}`;
    const existingResponse = await fetch(existingSavedJobUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      cache: "no-store",
    });

    if (existingResponse.ok) {
      const existingResult = await existingResponse.json();
      if (existingResult?.data && existingResult.data.length > 0) {
        return NextResponse.json(
          { error: "You have already saved this job" },
          { status: 400 }
        );
      }
    }

    // Prepare saved job data
    // Strapi v5 requires documentId strings for relations
    const savedJobData = {
      user: userId, // User relation uses numeric ID (users-permissions)
      job: jobDocumentId, // Use documentId string for custom content type
    };

    console.log("Saving job with data:", JSON.stringify(savedJobData, null, 2));

    // Create the saved job
    const response = await fetch(`${strapiUrl}/api/saved-jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify({ data: savedJobData }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      const errorMessage =
        result?.error?.message ||
        result?.error ||
        result?.message ||
        "Failed to save job";
      console.error("Save job error:", errorMessage);
      console.error("Full error response:", JSON.stringify(result, null, 2));
      console.error("Save job data sent:", JSON.stringify(savedJobData, null, 2));
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    const result = await response.json().catch(() => ({}));
    console.log("✅ Job saved successfully!");
    console.log("Returned data:", JSON.stringify(result.data, null, 2));
    
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    console.error("Save job error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save job";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only candidates can unsave jobs
    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can unsave jobs." },
        { status: 403 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const userId = Number(session.userId);
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Find the saved job entry
    const findUrl = `${strapiUrl}/api/saved-jobs?filters[user][id][$eq]=${userId}&filters[job][id][$eq]=${jobId}`;
    const findResponse = await fetch(findUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      cache: "no-store",
    });

    if (!findResponse.ok) {
      return NextResponse.json(
        { error: "Failed to find saved job" },
        { status: findResponse.status }
      );
    }

    const findResult = await findResponse.json();
    
    if (!findResult?.data || findResult.data.length === 0) {
      return NextResponse.json(
        { error: "Saved job not found" },
        { status: 404 }
      );
    }

    const savedJobDocumentId = findResult.data[0].documentId;

    // Delete the saved job using documentId
    const deleteResponse = await fetch(`${strapiUrl}/api/saved-jobs/${savedJobDocumentId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text().catch(() => "Unknown error");
      console.error("Delete saved job error:", errorText);
      return NextResponse.json(
        { error: "Failed to delete saved job" },
        { status: deleteResponse.status }
      );
    }

    return NextResponse.json({ message: "Job unsaved successfully" }, { status: 200 });
  } catch (error) {
    console.error("Unsave job error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to unsave job";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
