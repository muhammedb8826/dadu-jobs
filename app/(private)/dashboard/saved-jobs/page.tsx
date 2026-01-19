import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";
import { getSavedJobs } from "@/features/jobs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Building2, Briefcase, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { resolveImageUrl } from "@/lib/strapi/media";
import { getStrapiURL } from "@/lib/strapi/client";
import type { SavedJob } from "@/features/jobs";
import { SaveButton } from "../browse-jobs/SaveButton";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function resolveLogoUrl(company: SavedJob["job"]["company"]): string | null {
  if (!company?.logo) return null;

  const strapiBaseUrl = getStrapiURL();
  if (!strapiBaseUrl) return null;

  const logo = Array.isArray(company.logo) ? company.logo[0] : company.logo;
  if (!logo || !logo.url) return null;

  if (logo.url.startsWith("http://") || logo.url.startsWith("https://")) {
    return logo.url;
  }

  return resolveImageUrl(logo, strapiBaseUrl) || null;
}

function isDeadlinePassed(deadline: string): boolean {
  const deadlineDate = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadlineDate < today;
}

export default async function SavedJobsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only candidates can view saved jobs
  if (!isCandidate(session)) {
    redirect("/dashboard");
  }

  const savedJobs = await getSavedJobs(Number(session.userId), session.jwt);

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Saved Jobs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jobs you&apos;ve bookmarked for later
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        {savedJobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">You haven&apos;t saved any jobs yet.</p>
              <Button asChild>
                <Link href="/dashboard/browse-jobs">
                  Browse Jobs
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedJobs.map((savedJob) => {
              const { job } = savedJob;
              const companyLogoUrl = job.company
                ? resolveLogoUrl(job.company)
                : null;
              const deadlinePassed = isDeadlinePassed(job.deadline);

              return (
                <Card key={savedJob.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    {/* Header with Logo and Save Button */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        {companyLogoUrl ? (
                          <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <Image
                              src={companyLogoUrl}
                              alt={job.company?.name || "Company"}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-6 w-6 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground line-clamp-2">
                            {job.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {job.company?.name}
                          </p>
                        </div>
                      </div>
                      <SaveButton jobId={job.id} initialSaved={true} />
                    </div>

                    {/* Job Details */}
                    <div className="space-y-2 mb-4">
                      {job.location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{job.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="h-4 w-4 flex-shrink-0" />
                        <span>{job.jobType}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>
                          Deadline: {formatDate(job.deadline)}
                          {deadlinePassed && (
                            <Badge variant="destructive" className="ml-2">
                              Expired
                            </Badge>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Categories */}
                    {job.categories && job.categories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {job.categories.slice(0, 2).map((category) => (
                          <Badge key={category.id} variant="secondary">
                            {category.name}
                          </Badge>
                        ))}
                        {job.categories.length > 2 && (
                          <Badge variant="secondary">
                            +{job.categories.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Saved Date */}
                    <p className="text-xs text-muted-foreground mb-4">
                      Saved {formatDate(savedJob.createdAt)}
                    </p>

                    {/* Action Button */}
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/dashboard/browse-jobs/${job.slug}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View Job
                      </Link>
                    </Button>
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
