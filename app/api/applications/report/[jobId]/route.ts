import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Only employers can access application reports
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can view application reports." },
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

    const { jobId } = await params;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    // Fetch applications with all necessary data for report
    const populateQuery = "populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name&populate[job][fields][0]=id&populate[job][fields][1]=title";
    
    const url = `${strapiUrl}/api/applications?filters[job][id][$eq]=${jobId}&${populateQuery}&sort[0]=createdAt:desc`;

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
      console.error("Report fetch error. Status:", response.status, "Error:", errorText);
      return NextResponse.json(
        { error: "Failed to fetch application report" },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    // Transform data for report
    const reportData = result.data.map((app: any) => ({
      id: app.id,
      applicantName: app.user?.username || "N/A",
      applicantEmail: app.user?.email || "N/A",
      selectedDegree: app.selectedDegree || "N/A",
      selectedFieldOfStudy: app.selectedFieldOfStudy || "N/A",
      selectedCgpa: app.selectedCgpa || "N/A",
      totalExperienceYears: app.totalExperienceYears || 0,
      applicationStatus: app.applicationStatus || "Applied",
      decision: app.decision || "Not Selected",
      appliedAt: app.createdAt,
      resumeUrl: app.resume?.url || null,
      resumeName: app.resume?.name || null,
    }));

    return NextResponse.json(
      { 
        data: reportData,
        meta: result.meta,
        jobTitle: result.data[0]?.job?.title || "Unknown Job"
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error("Report API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch report";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
