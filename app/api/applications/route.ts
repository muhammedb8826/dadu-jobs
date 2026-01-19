import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";
import { APPLICATION_STATUSES } from "@/features/jobs";

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
    const userId = searchParams.get("userId");
    const jobId = searchParams.get("jobId");

    // Build populate query
    const populateQuery = "populate[job][populate][categories][fields][0]=id&populate[job][populate][categories][fields][1]=name&populate[job][populate][categories][fields][2]=slug&populate[job][populate][salary]=*&populate[job][populate][company]=*&populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name&populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&populate[user][fields][3]=type";

    let url = `${strapiUrl}/api/applications?${populateQuery}`;

    if (userId) {
      url = `${strapiUrl}/api/applications?filters[user][id][$eq]=${userId}&${populateQuery}&sort[0]=createdAt:desc`;
    } else if (jobId) {
      url = `${strapiUrl}/api/applications?filters[job][id][$eq]=${jobId}&${populateQuery}&sort[0]=createdAt:desc`;
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
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("getApplications: Response not OK. Status:", response.status, "Error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch applications" },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Applications fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch applications";
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

    // Role-based access: Only candidates can create applications
    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can submit job applications." },
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

    if (!body || !body.data) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { jobId, coverLetter, resumeId } = body.data;
    const userId = Number(session.userId);
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userJwt = session.jwt;

    // Validate required fields
    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    // Fetch job to get its documentId (required for Strapi v5 relations)
    // Use filter query instead of direct ID lookup since Strapi v5 URLs expect documentId
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
          console.log("✅ Fetched job documentId:", jobDocumentId, "for numeric ID:", jobId);
        } else {
          console.error("❌ No job found with ID:", jobId);
        }
      } else {
        console.error("❌ Failed to fetch job. Status:", jobResponse.status);
      }
    } catch (error) {
      console.error("❌ Error fetching job:", error);
    }

    if (!jobDocumentId) {
      return NextResponse.json(
        { error: "Failed to fetch job information" },
        { status: 400 }
      );
    }

    console.log("Creating application with:", { 
      userId, 
      jobId,
      jobDocumentId,
      resumeId 
    });

    // Check if application already exists
    const existingApplicationUrl = `${strapiUrl}/api/applications?filters[user][id][$eq]=${userId}&filters[job][id][$eq]=${jobId}`;
    const existingResponse = await fetch(existingApplicationUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(userJwt ? { Authorization: `Bearer ${userJwt}` } : apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      cache: "no-store",
    });

    if (existingResponse.ok) {
      const existingResult = await existingResponse.json();
      if (existingResult?.data && existingResult.data.length > 0) {
        return NextResponse.json(
          { error: "You have already applied for this job" },
          { status: 400 }
        );
      }
    }

    // Prepare application data
    // Strapi v5 requires documentId strings for relations
    const applicationData: Record<string, unknown> = {
      user: userId, // User relation still uses numeric ID (users-permissions)
      job: jobDocumentId, // Use documentId string for custom content type
      applicationStatus: APPLICATION_STATUSES[0], // "Applied"
    };

    if (coverLetter) {
      applicationData.coverLetter = coverLetter;
    }

    if (resumeId) {
      // Media fields need numeric ID directly
      applicationData.resume = Number(resumeId);
    }

    console.log("Application data to send:", JSON.stringify(applicationData, null, 2));

    // Create the application
    // Use API token instead of user JWT for relation creation
    const response = await fetch(`${strapiUrl}/api/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : userJwt ? { Authorization: `Bearer ${userJwt}` } : {}),
      },
      body: JSON.stringify({ data: applicationData }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        result?.error?.message ||
        result?.error ||
        result?.message ||
        "Failed to submit application";
      console.error("Application creation error:", errorMessage);
      console.error("Full error response:", JSON.stringify(result, null, 2));
      console.error("Application data sent:", JSON.stringify(applicationData, null, 2));
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    // Log what Strapi actually returned
    console.log("✅ Application created successfully!");
    console.log("Returned data:", JSON.stringify(result.data, null, 2));
    
    // Check if job relation was actually set
    if (result.data?.job) {
      console.log("✅ Job relation SET:", result.data.job);
    } else {
      console.warn("⚠️ Job relation NOT SET - Attempting to update...");
      
      // Try updating using documentId (Strapi v5 requirement)
      const updateResponse = await fetch(`${strapiUrl}/api/applications/${result.data.documentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify({
          data: {
            job: jobDocumentId, // Use documentId string
          },
        }),
      });

      if (updateResponse.ok) {
        const updateResult = await updateResponse.json();
        console.log("✅ Job relation updated successfully!");
        console.log("Update result:", JSON.stringify(updateResult.data, null, 2));
        return NextResponse.json({ data: updateResult.data }, { status: 201 });
      } else {
        const updateError = await updateResponse.json().catch(() => ({}));
        console.error("❌ Failed to update job relation. Status:", updateResponse.status);
        console.error("Update error:", JSON.stringify(updateError, null, 2));
      }
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    console.error("Application submission error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
