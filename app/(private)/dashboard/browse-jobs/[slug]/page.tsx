import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";
import { getJobBySlug } from "@/features/jobs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MapPin, Calendar, Building2, DollarSign, Clock, Briefcase } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { resolveImageUrl } from "@/lib/strapi/media";
import { getStrapiURL } from "@/lib/strapi/client";
import { ApplyButton } from "./ApplyButton";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatSalary(salary?: { min?: number; max?: number; currency: string; isNegotiable: boolean }): string {
  if (!salary) return "Not specified";
  
  if (salary.isNegotiable) {
    return "Negotiable";
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

function resolveLogoUrl(company: { logo?: { url: string; formats?: Record<string, { url: string }> } } | undefined): string | null {
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

export default async function DashboardJobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only candidates can view job details in dashboard
  if (!isCandidate(session)) {
    redirect("/dashboard");
  }

  const { slug } = await params;
  const job = await getJobBySlug(slug);

  if (!job) {
    notFound();
  }

  // Get candidate profile to check for resume
  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
  const strapiUrl = getStrapiURL();
  let candidateResumeId: number | null = null;
  
  if (strapiUrl) {
    try {
      const populateQuery = "populate[resume][fields][0]=id";
      const profileResponse = await fetch(
        `${strapiUrl}/api/candidate-profiles?filters[user][id][$eq]=${session.userId}&${populateQuery}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          },
          cache: "no-store",
        }
      );

      if (profileResponse.ok) {
        const profileResult = await profileResponse.json();
        const profile = Array.isArray(profileResult?.data) ? profileResult.data[0] : profileResult?.data;
        if (profile?.resume?.id) {
          candidateResumeId = profile.resume.id;
        }
      }
    } catch (error) {
      console.error("Error fetching candidate resume:", error);
    }
  }

  const isDeadlinePassed = new Date(job.deadline) < new Date();
  const companyLogoUrl = job.company ? resolveLogoUrl(job.company) : null;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/dashboard/browse-jobs">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Job Details</h1>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      {job.isFeatured && (
                        <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20">
                          Featured
                        </Badge>
                      )}
                      {job.categories && job.categories.length > 0 && (
                        <Badge variant="outline">
                          {job.categories[0].name}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-3xl mb-2">{job.title}</CardTitle>
                    {job.company && (
                      <p className="text-lg text-muted-foreground">
                        {job.company.name}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Job Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {job.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Location</p>
                        <p className="font-medium">{job.location}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Deadline</p>
                      <p className={`font-medium ${isDeadlinePassed ? "text-red-600 dark:text-red-400" : ""}`}>
                        {formatDate(job.deadline)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Workplace</p>
                      <p className="font-medium">{job.workplaceType}</p>
                    </div>
                  </div>
                  {job.jobType && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Job Type</p>
                        <p className="font-medium">{job.jobType}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Experience</p>
                      <p className="font-medium">{job.experience} Level</p>
                    </div>
                  </div>
                  {job.salary && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Salary</p>
                        <p className="font-medium">{formatSalary(job.salary)}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Job Description */}
                {job.description && (
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Job Description</h3>
                    <div 
                      className="prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: job.description }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Apply for this Job</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ApplyButton 
                  jobId={job.id} 
                  isDeadlinePassed={isDeadlinePassed}
                  candidateResumeId={candidateResumeId}
                />
                
                <Button variant="outline" className="w-full">
                  Save Job
                </Button>
              </CardContent>
            </Card>

            {job.company && (
              <Card>
                <CardHeader>
                  <CardTitle>Company</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {companyLogoUrl ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <Image
                          src={companyLogoUrl}
                          alt={job.company.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-8 w-8 text-primary" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{job.company.name}</p>
                      <Button variant="link" className="p-0 h-auto" asChild>
                        <Link href={`/companies/${job.company.slug}`}>
                          View Company Profile
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Job Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {job.jobCode && (
                  <div>
                    <p className="text-muted-foreground">Job Code</p>
                    <p className="font-medium">{job.jobCode}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Posted</p>
                  <p className="font-medium">
                    {job.publishedAt ? formatDate(job.publishedAt) : "Recently"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    {job.approvalStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
