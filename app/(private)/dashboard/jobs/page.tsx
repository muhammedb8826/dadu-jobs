import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Briefcase, Calendar, MapPin, DollarSign } from "lucide-react";
import { isEmployer } from "@/lib/auth/rbac";
import { getStrapiURL } from "@/lib/strapi/client";

type Job = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  location?: string;
  jobType?: string;
  deadline: string;
  workplaceType: string;
  isFeatured: boolean;
  experience: string;
  approvalStatus: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    isNegotiable: boolean;
  };
  categories?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
};

async function getJobs(userId: number): Promise<Job[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery = "populate[categories]=*&populate[salary]=*";
    const url = `${strapiUrl}/api/jobs?filters[user][id][$eq]=${userId}&${populateQuery}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();
    return result?.data || [];
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }
}

function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "approved":
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
          Rejected
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
          Pending
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {status || "Unknown"}
        </Badge>
      );
  }
}

function formatSalary(salary?: Job["salary"]): string {
  if (!salary) return "Not specified";
  
  if (salary.isNegotiable) {
    return `Negotiable (${salary.currency})`;
  }

  if (salary.min && salary.max) {
    return `${salary.min.toLocaleString()} - ${salary.max.toLocaleString()} ${salary.currency}`;
  }

  if (salary.min) {
    return `From ${salary.min.toLocaleString()} ${salary.currency}`;
  }

  if (salary.max) {
    return `Up to ${salary.max.toLocaleString()} ${salary.currency}`;
  }

  return "Not specified";
}

export default async function JobsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only employers can view job postings
  if (!isEmployer(session)) {
    redirect("/dashboard");
  }

  const jobs = await getJobs(Number(session.userId));

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Page header */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Job Postings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your job postings and applications
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/jobs/new">
            <Plus className="mr-2 h-4 w-4" />
            New Job Posting
          </Link>
        </Button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No job postings yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by creating your first job posting
              </p>
              <Button asChild>
                <Link href="/dashboard/jobs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Job Posting
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">
                        {job.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {job.categories?.[0]?.name || "Uncategorized"}
                      </CardDescription>
                    </div>
                    {job.isFeatured && (
                      <Badge variant="outline" className="ml-2">
                        Featured
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {job.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span className="line-clamp-1">{job.location}</span>
                      </div>
                    )}
                    {job.workplaceType && (
                      <div className="flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        <span>{job.workplaceType}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {formatSalary(job.salary)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Deadline: {new Date(job.deadline).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    {getStatusBadge(job.approvalStatus)}
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/jobs/${job.id}/edit`}>
                          Edit
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
