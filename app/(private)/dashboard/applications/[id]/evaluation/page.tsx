import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { isEmployer } from "@/lib/auth/rbac";
import { getStrapiURL } from "@/lib/strapi/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar, FileText, User } from "lucide-react";
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

async function getApplication(applicationDocumentId: string, sessionJwt?: string): Promise<Application | null> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return null;
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery =
      "populate[job][fields][0]=id&populate[job][fields][1]=title&populate[job][fields][2]=slug&" +
      "populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&" +
      "populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name";

    const response = await fetch(`${strapiUrl}/api/applications/${applicationDocumentId}?${populateQuery}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(sessionJwt
          ? { Authorization: `Bearer ${sessionJwt}` }
          : apiToken
            ? { Authorization: `Bearer ${apiToken}` }
            : {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result?.data || null;
  } catch (error) {
    console.error("Error fetching application:", error);
    return null;
  }
}

async function getEvaluation(applicationDocumentId: string, sessionJwt?: string): Promise<Evaluation | null> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return null;
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery = "populate[application][fields][0]=id&populate[application][fields][1]=documentId";
    const response = await fetch(
      `${strapiUrl}/api/evaluations?filters[application][documentId][$eq]=${applicationDocumentId}&${populateQuery}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(sessionJwt
            ? { Authorization: `Bearer ${sessionJwt}` }
            : apiToken
              ? { Authorization: `Bearer ${apiToken}` }
              : {}),
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result?.data?.[0] || null;
  } catch (error) {
    console.error("Error fetching evaluation:", error);
    return null;
  }
}

export default async function EvaluationPage({
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
  const application = await getApplication(id, session.jwt);
  const evaluation = await getEvaluation(id, session.jwt);

  if (!application) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/20">
        <header className="border-b bg-background px-6 py-4">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/dashboard/applications">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Applications
            </Link>
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Application Not Found</h1>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">The application you're looking for doesn't exist.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/dashboard/applications">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Applications
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Evaluation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View evaluation details for {application.job?.title || "this job"}
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              {application.user?.username || "Candidate"}
              {application.user?.email && (
                <span className="text-sm font-normal text-muted-foreground">({application.user.email})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {application.createdAt && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Applied {formatDate(application.createdAt)}
              </div>
            )}
            {application.resume && (
              <Button asChild variant="outline" size="sm">
                <a href={`${getStrapiURL()}${application.resume.url}`} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  View Resume
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <h2 className="text-sm font-semibold">Evaluation</h2>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
