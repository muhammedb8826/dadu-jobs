import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";
import { getStrapiURL } from "@/lib/strapi/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download } from "lucide-react";

type ApplicationReport = {
  fullName: string;
  education: string;
  cgpa: number;
  experience: number;
  writtenExam: number | null;
  interview: number | null;
  practical: number | null;
  total: number;
  status: string;
  rank: number | null;
  decision: string;
};

async function getJobDetails(jobIdOrDocumentId: string | number, sessionJwt?: string): Promise<{ id: number; documentId: string; title: string } | null> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return null;
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    
    // Determine if we have a documentId (string) or numeric ID (number)
    const isNumericId = typeof jobIdOrDocumentId === 'number' || !isNaN(Number(jobIdOrDocumentId));
    const filterKey = isNumericId ? 'id' : 'documentId';
    const filterValue = isNumericId ? Number(jobIdOrDocumentId) : jobIdOrDocumentId;
    
    const url = `${strapiUrl}/api/jobs?filters[${filterKey}][$eq]=${filterValue}`;
    
    console.log("[getJobDetails] Fetching URL:", url);
    console.log("[getJobDetails] Filter:", { filterKey, filterValue });
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (sessionJwt) {
      headers.Authorization = `Bearer ${sessionJwt}`;
    } else if (apiToken) {
      headers.Authorization = `Bearer ${apiToken}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[getJobDetails] Failed to fetch job details:", response.status);
      return null;
    }

    const result = await response.json();
    console.log("[getJobDetails] API Response:", JSON.stringify(result, null, 2));
    
    if (result?.data?.[0]) {
      return {
        id: result.data[0].id,
        documentId: result.data[0].documentId,
        title: result.data[0].title || "Job"
      };
    }
    console.warn("[getJobDetails] No job found in response");
    return null;
  } catch (error) {
    console.error("[getJobDetails] Error fetching job details:", error);
    return null;
  }
}

async function getApplicationReport(jobDocumentId: string, sessionJwt?: string): Promise<ApplicationReport[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    
    // Use Strapi's report endpoint directly (with documentId)
    const url = `${strapiUrl}/api/applications/report/${jobDocumentId}`;
    
    console.log("[getApplicationReport] Fetching URL:", url);
    console.log("[getApplicationReport] Using documentId:", jobDocumentId);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (sessionJwt) {
      headers.Authorization = `Bearer ${sessionJwt}`;
    } else if (apiToken) {
      headers.Authorization = `Bearer ${apiToken}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[getApplicationReport] Failed to fetch report:", response.status);
      return [];
    }

    // Backend returns the data already formatted
    const result = await response.json();
    console.log("[getApplicationReport] API Response:", JSON.stringify(result, null, 2));
    
    // Return data as-is from backend (no transformation needed)
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("[getApplicationReport] Error fetching application report:", error);
    return [];
  }
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Shortlisted":
      return "default";
    case "Rejected":
      return "destructive";
    default:
      return "secondary";
  }
}

function getDecisionBadgeVariant(decision: string): "default" | "secondary" | "destructive" | "outline" {
  switch (decision) {
    case "Selected":
      return "default";
    case "Reserve":
      return "secondary";
    case "Not Selected":
      return "destructive";
    default:
      return "outline";
  }
}

export default async function JobReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isEmployer(session)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  
  console.log("[Report Page] Received ID from URL:", id);
  console.log("[Report Page] ID type:", typeof id);
  
  // Get job details (accepts both documentId and numeric ID)
  const jobDetails = await getJobDetails(id, session.jwt);
  console.log("[Report Page] Job details:", jobDetails);
  
  // Redirect if job not found
  if (!jobDetails) {
    console.error("[Report Page] Job not found - redirecting");
    redirect("/dashboard/jobs");
  }

  // Use the documentId from job details for the report
  const applications = await getApplicationReport(jobDetails.documentId, session.jwt);
  console.log("[Report Page] Applications count:", applications.length);

  const jobDocumentId = jobDetails.documentId; // Use documentId for backend export
  const jobTitle = jobDetails.title;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <Button asChild variant="ghost">
            <Link href="/dashboard/jobs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Job Postings
            </Link>
          </Button>
          {jobDocumentId && applications.length > 0 && (
            <Button asChild variant="outline">
              <a href={`${getStrapiURL()}/api/applications/report-excel/${jobDocumentId}`} download>
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </a>
            </Button>
          )}
        </div>
        <h1 className="text-xl font-semibold text-foreground">Application Report: {jobTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Comprehensive report of all applications
          {applications.length > 0 && ` (${applications.length} ${applications.length === 1 ? 'application' : 'applications'})`}
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No applications found for this job.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Applications Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Rank</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Education</TableHead>
                      <TableHead className="text-center">CGPA</TableHead>
                      <TableHead className="text-center">Experience (Yrs)</TableHead>
                      <TableHead className="text-center">Written Exam</TableHead>
                      <TableHead className="text-center">Interview</TableHead>
                      <TableHead className="text-center">Practical</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium text-center">{app.rank ?? '—'}</TableCell>
                        <TableCell className="font-medium">{app.fullName}</TableCell>
                        <TableCell>{app.education}</TableCell>
                        <TableCell className="text-center">{app.cgpa.toFixed(2)}</TableCell>
                        <TableCell className="text-center">{app.experience.toFixed(1)}</TableCell>
                        <TableCell className="text-center">{app.writtenExam ?? '—'}</TableCell>
                        <TableCell className="text-center">{app.interview ?? '—'}</TableCell>
                        <TableCell className="text-center">{app.practical ?? '—'}</TableCell>
                        <TableCell className="text-center font-semibold">{app.total}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getStatusBadgeVariant(app.status)}>
                            {app.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={getDecisionBadgeVariant(app.decision)}>
                            {app.decision}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
