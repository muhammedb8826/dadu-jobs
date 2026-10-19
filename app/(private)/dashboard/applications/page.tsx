import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isCandidate, isEmployer } from "@/lib/auth/rbac";
import { getApplications, getEmployerApplications } from "@/features/jobs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Building2, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { resolveImageUrl } from "@/lib/strapi/media";
import { getStrapiURL } from "@/lib/strapi/client";
import { findCandidateProfilesForUsers } from "@/lib/strapi/candidate-profile";
import type { Application } from "@/features/jobs/types/application.types";

type CandidateProfile = {
  id: number;
  documentId: string;
  fullName: string;
  profilePicture?: {
    url: string;
    formats?: Record<string, { url: string }>;
    alternativeText?: string | null;
  } | null;
  user?: {
    id: number;
    email?: string;
    username?: string;
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

function resolveLogoUrl(company: Application["job"]["company"]): string | null {
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

export default async function ApplicationsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const isCandidateUser = isCandidate(session);
  const isEmployerUser = isEmployer(session);

  if (!isCandidateUser && !isEmployerUser) {
    redirect("/dashboard");
  }

  const applications = isEmployerUser
    ? await getEmployerApplications(Number(session.userId), session.jwt)
    : await getApplications(Number(session.userId), session.jwt);

  const strapiUrl = getStrapiURL();

  let candidateProfileByUserId = new Map<number, CandidateProfile>();
  if (isEmployerUser && strapiUrl) {
    try {
      const userIds = Array.from(
        new Set(applications.map((app) => app.user?.id).filter(Boolean))
      ) as number[];
      if (userIds.length > 0) {
        const profiles = (await findCandidateProfilesForUsers({
          userIds,
          authToken: session.jwt,
          fallbackAuthToken: process.env.NEXT_PUBLIC_API_TOKEN,
          populateQuery:
            "populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=url&populate[profilePicture][fields][2]=formats&populate[profilePicture][fields][3]=alternativeText&populate[user][fields][0]=id&populate[user][fields][1]=email&populate[user][fields][2]=username",
        })) as CandidateProfile[];

        candidateProfileByUserId = new Map(
          profiles
            .filter((profile) => profile.user?.id)
            .map((profile) => [profile.user!.id, profile])
        );
      }
    } catch (error) {
      console.error("Error fetching candidate profiles:", error);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">
          {isEmployerUser ? "Applications" : "My Applications"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEmployerUser
            ? "Review applications from candidates"
            : "Track your job applications and their status"}
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        {applications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                {isEmployerUser
                  ? "No applications found for your job postings."
                  : "You haven&apos;t applied to any jobs yet."}
              </p>
              {!isEmployerUser && (
                <Button asChild>
                  <Link href="/dashboard/browse-jobs">
                    Browse Jobs
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => {
              const companyLogoUrl = application.job.company
                ? resolveLogoUrl(application.job.company)
                : null;
              const candidateProfile = isEmployerUser ? candidateProfileByUserId.get(application.user?.id) : null;
              const candidateAvatar = candidateProfile?.profilePicture && strapiUrl
                ? resolveImageUrl(candidateProfile.profilePicture, strapiUrl)
                : null;

              return (
                <Card key={application.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Company Logo */}
                      <div className="shrink-0">
                        {companyLogoUrl ? (
                          <div className="relative h-16 w-16 rounded-lg overflow-hidden bg-muted">
                            <Image
                              src={companyLogoUrl}
                              alt={application.job.company?.name || "Company"}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-8 w-8 text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Application Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold text-foreground">
                                {application.job.title}
                              </h3>
                              <Badge variant={getStatusBadgeVariant(application.applicationStatus)}>
                                {application.applicationStatus}
                              </Badge>
                              {application.decision && (
                                <Badge variant={getDecisionBadgeVariant(application.decision)}>
                                  {application.decision}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {application.job.company?.name}
                            </p>
                            {isEmployerUser && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                                {candidateAvatar ? (
                                  <div className="relative h-8 w-8 overflow-hidden rounded-full border">
                                    <Image
                                      src={candidateAvatar}
                                      alt={candidateProfile?.fullName || application.user?.username || "Candidate"}
                                      fill
                                      className="object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                                    {(candidateProfile?.fullName || application.user?.username || "CA").substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <span>
                                  {candidateProfile?.fullName || application.user?.username || "Candidate"}
                                </span>
                                {application.user?.email && (
                                  <span className="text-xs text-muted-foreground">({application.user.email})</span>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
                              {application.job.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-4 w-4" />
                                  <span>{application.job.location}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>Applied {formatDate(application.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/browse-jobs/${application.job.slug}`}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Job
                              </Link>
                            </Button>
                            {isEmployerUser && candidateProfile && (
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/dashboard/candidates/${candidateProfile.documentId || candidateProfile.id}`}>
                                  View Candidate
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Cover Letter */}
                        {application.coverLetter && (
                          <div className="mt-4 p-3 bg-muted/50 rounded-md">
                            <p className="text-sm font-medium mb-1">Cover Letter:</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {application.coverLetter}
                            </p>
                          </div>
                        )}

                        {/* Resume */}
                        {application.resume && strapiUrl && (
                          <div className="mt-3">
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={`${strapiUrl}${application.resume.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                View Resume
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
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
