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

    // Only employers can export application reports
    if (!isEmployer(session)) {
      return NextResponse.json(
        { error: "Access denied. Only employers can export reports." },
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

    // Fetch applications
    const populateQuery = "populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&populate[resume][fields][0]=name&populate[job][fields][0]=title";
    
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
      return NextResponse.json(
        { error: "Failed to fetch applications" },
        { status: response.status }
      );
    }

    type ApplicationData = {
      id: number;
      user?: { username?: string; email?: string };
      selectedDegree?: string;
      selectedFieldOfStudy?: string;
      selectedCgpa?: number;
      totalExperienceYears?: number;
      applicationStatus?: string;
      decision?: string;
      createdAt: string;
      resume?: { name?: string };
      job?: { title?: string };
    };

    type StrapiResponse = {
      data: ApplicationData[];
      meta?: unknown;
    };

    const result: StrapiResponse = await response.json();
    
    // Create CSV content
    const csvHeaders = [
      "Application ID",
      "Applicant Name",
      "Email",
      "Degree",
      "Field of Study",
      "CGPA",
      "Experience (Years)",
      "Status",
      "Decision",
      "Applied Date",
      "Resume"
    ];

    type CsvRow = Array<string | number>;
    
    const csvRows: CsvRow[] = result.data.map((app) => [
      app.id,
      app.user?.username || "N/A",
      app.user?.email || "N/A",
      app.selectedDegree || "N/A",
      app.selectedFieldOfStudy || "N/A",
      app.selectedCgpa || "N/A",
      app.totalExperienceYears || 0,
      app.applicationStatus || "Applied",
      app.decision || "Not Selected",
      new Date(app.createdAt).toLocaleDateString(),
      app.resume?.name || "No Resume"
    ]);

    // Convert to CSV format
    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row: CsvRow) => 
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
    ].join("\n");

    const jobTitle = result.data[0]?.job?.title || "job-applications";
    const filename = `${jobTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-report-${new Date().toISOString().split('T')[0]}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json(
      { error: "Failed to export report" },
      { status: 500 }
    );
  }
}
