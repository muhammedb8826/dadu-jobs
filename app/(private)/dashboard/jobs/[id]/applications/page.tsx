import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";
import { getStrapiURL } from "@/lib/strapi/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, ArrowLeft, FileText, User } from "lucide-react";
import type { Application } from "@/features/jobs/types/application.types";

type Evaluation = {
  id: number;
  documentId: string;
  writtenExam?: number | null;
  interview?: number | null;
  practical?: number | null;
  totalScore?: number | null;
  rank?: number | null;
  notes?: string | null;
  application?: {
    id: number;
    documentId: string;
  };
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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

function getDecisionBadgeVariant(decision: string | null | undefined): "default" | "secondary" | "destructive" | "outline" {
  if (!decision) return "outline";
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

async function getApplicationsForJob(jobDocumentId: string, sessionJwt?: string): Promise<Application[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery =
      "populate[job][fields][0]=id&populate[job][fields][1]=title&populate[job][fields][2]=slug&" +
      "populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&" +
      "populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name";

    const url = `${strapiUrl}/api/applications?filters[job][documentId][$eq]=${jobDocumentId}&${populateQuery}&sort[0]=createdAt:desc`;
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
      return [];
    }

    const result = await response.json();
    return result?.data || [];
  } catch (error) {
    console.error("Error fetching job applications:", error);
    return [];
  }
}

async function getEvaluationsForJob(jobDocumentId: string, sessionJwt?: string): Promise<Evaluation[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery = "populate[application][fields][0]=id&populate[application][fields][1]=documentId";
    const url = `${strapiUrl}/api/evaluations?filters[application][job][documentId][$eq]=${jobDocumentId}&${populateQuery}&sort[0]=createdAt:desc`;

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
      return [];
    }

    const result = await response.json();
    return result?.data || [];
  } catch (error) {
    console.error("Error fetching evaluations:", error);
    return [];
  }
}

export default async function JobApplicationsPage({
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
  const applications = await getApplicationsForJob(id, session.jwt);
  const evaluations = await getEvaluationsForJob(id, session.jwt);

  const evaluationByApplicationId = new Map<number, Evaluation>();
  evaluations.forEach((evaluation) => {
    if (evaluation.application?.id) {
      evaluationByApplicationId.set(evaluation.application.id, evaluation);
    }
  });

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/dashboard/jobs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Job Postings
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Applications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review applications and evaluations for this job
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
          <div className="space-y-4">
            {applications.map((application) => {
              const evaluation = evaluationByApplicationId.get(application.id);
              return (
                <Card key={application.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-base flex flex-wrap items-center gap-2">
                      <User className="h-4 w-4" />
                      {application.user?.username || "Candidate"}
                      {application.user?.email && (
                        <span className="text-sm font-normal text-muted-foreground">
                          ({application.user.email})
                        </span>
                      )}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant={getStatusBadgeVariant(application.applicationStatus)}>
                        {application.applicationStatus}
                      </Badge>
                      {application.decision && (
                        <Badge variant={getDecisionBadgeVariant(application.decision)}>
                          {application.decision}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Applied {formatDate(application.createdAt)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {application.coverLetter && (
                      <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                        {application.coverLetter}
                      </div>
                    )}

                    {application.resume && (
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`${getStrapiURL()}${application.resume.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          View Resume
                        </a>
                      </Button>
                    )}

                    <div className="rounded-md border bg-background p-4">
                      <h3 className="text-sm font-semibold mb-3">Evaluation</h3>
                      {evaluation ? (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Written Exam</span>
                            <p className="font-medium">{evaluation.writtenExam ?? "—"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Interview</span>
                            <p className="font-medium">{evaluation.interview ?? "—"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Practical</span>
                            <p className="font-medium">{evaluation.practical ?? "—"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total Score</span>
                            <p className="font-medium">{evaluation.totalScore ?? "—"}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Rank</span>
                            <p className="font-medium">{evaluation.rank ?? "—"}</p>
                          </div>
                          {evaluation.notes && (
                            <div className="sm:col-span-2 lg:col-span-3">
                              <span className="text-muted-foreground">Notes</span>
                              <p className="font-medium">{evaluation.notes}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No evaluation submitted yet.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
