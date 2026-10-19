
import Image from "next/image"
import Link from "next/link"
import { redirect } from "next/navigation"
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ArrowRight,
  User,
  Calendar,
  BookOpen,
  Briefcase,
  Plus
} from "lucide-react"

import { getSession, validateSession } from "@/lib/auth/session"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getStrapiURL } from "@/lib/strapi/client"
import { UserType } from "@/lib/types/user.types"
import { isCandidate, isEmployer } from "@/lib/auth/rbac"
import { resolveImageUrl } from "@/lib/strapi/media"
import { findCandidateProfileForUser } from "@/lib/strapi/candidate-profile"
import { findEmployerProfileForUser } from "@/lib/strapi/employer-profile"
import { getApplications, getEmployerApplications, getJobs, getSavedJobs } from "@/features/jobs"

function getInitials(firstName: string, email: string): string {
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase()
  }
  return email.substring(0, 2).toUpperCase()
}

async function getStudentProfile(email: string, userId: string) {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return null;
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    
    // Fetch all profiles and filter server-side by logged-in user
    // This ensures security - we only return data for the authenticated user
    const response = await fetch(
      `${strapiUrl}/api/student-profiles?populate=*`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    
    // Filter server-side to only return the logged-in user's profile
    type ProfileData = {
      email?: string;
      userId?: string;
      user?: {
        email?: string;
        id?: number;
      };
      [key: string]: unknown;
    };
    
    if (result?.data) {
      if (Array.isArray(result.data)) {
        // Find profile matching the logged-in user
        const userProfile = result.data.find((profile: ProfileData) => {
          if (profile.email === email) return true;
          if (profile.user?.email === email) return true;
          if (profile.userId === userId) return true;
          if (profile.user?.id === Number(userId)) return true;
          return false;
        });
        return userProfile || null;
      } else if (result.data) {
        // Single object - check if it belongs to the user
        const profile = result.data as ProfileData;
        if (
          profile.email === email ||
          profile.user?.email === email ||
          profile.userId === userId ||
          profile.user?.id === Number(userId)
        ) {
          return profile;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching student profile:", error);
    return null;
  }
}

// Removed getCandidateProfile function - candidates now redirect to browse-jobs page
// If needed in future, can be restored from git history

function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "approved":
    case "accepted":
      return (
        <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Approved
        </Badge>
      );
    case "rejected":
    case "denied":
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
          <AlertCircle className="mr-1 h-3 w-3" />
          Rejected
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
          <Clock className="mr-1 h-3 w-3" />
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

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  // Validate session with Strapi to ensure JWT token is still valid
  const isValid = await validateSession(session)
  if (!isValid) {
    // Session is invalid (user deleted or token expired), redirect to logout route
    // The logout route handler will clear the session cookie
    redirect("/api/auth/logout")
  }

  // Role-based access: Dashboard content varies by user type
  // Candidates see candidate profile/job application dashboard
  // Employers see job posting/management dashboard

  const user = {
    name: session.firstName || "User",
    email: session.email,
    avatar: "",
    initials: getInitials(session.firstName, session.email),
  }

  // If user is an employer, show employer dashboard
  if (isEmployer(session)) {
    const strapiUrl = getStrapiURL();
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    let employerProfile = null;
    let hasProfile = false;
    let hasCompany = false;

    if (strapiUrl) {
      try {
        employerProfile = await findEmployerProfileForUser({
          userId: session.userId,
          userDocumentId: session.userDocumentId,
          authToken: session.jwt,
          fallbackAuthToken: apiToken,
        });
        if (employerProfile) {
          hasProfile = true;
          hasCompany = !!employerProfile.company;
        }
      } catch (error) {
        console.error("Error fetching employer profile:", error);
      }
    }

    const [jobs, applications] = await Promise.all([
      getJobs(Number(session.userId), session.jwt),
      getEmployerApplications(Number(session.userId), session.jwt),
    ]);

    const activeJobs = jobs.filter((job) => job.isActive !== false);
    const pendingApproval = jobs.filter(
      (job) => job.approvalStatus === "Pending" || job.approvalStatus === "Needs Modification"
    );
    const newApplications = applications.filter(
      (app) =>
        app.applicationStatus === "Applied" ||
        app.applicationStatus === "Pending" ||
        app.applicationStatus === "Under Review"
    );
    const recentApplications = applications.slice(0, 5);
    const recentJobs = jobs.slice(0, 4);

    const profilePictureUrl = employerProfile?.profilePicture && strapiUrl
      ? resolveImageUrl(employerProfile.profilePicture, strapiUrl)
      : null;
    const companyName =
      employerProfile?.company && typeof employerProfile.company === "object"
        ? (employerProfile.company as { name?: string }).name
        : undefined;
    const displayName =
      typeof employerProfile?.fullName === "string" && employerProfile.fullName
        ? employerProfile.fullName
        : user.name;
    const employerJobTitle =
      typeof employerProfile?.jobTitle === "string" ? employerProfile.jobTitle : "";
    const setupComplete = hasProfile && hasCompany;

    return (
      <div className="flex min-h-screen flex-col bg-muted/20">
        <header className="border-b bg-background px-6 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-primary/80">
                {profilePictureUrl ? (
                  <Image
                    src={profilePictureUrl}
                    alt={displayName}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{user.initials}</span>
                )}
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  {displayName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {[employerJobTitle, companyName || (hasCompany ? "Company linked" : null)]
                    .filter(Boolean)
                    .join(" · ") || user.email}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/dashboard/jobs/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Post a job
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/applications">
                  <FileText className="mr-2 h-4 w-4" />
                  Review applications
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
          {!setupComplete && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Finish setting up your hiring account
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {!hasProfile
                      ? "Create your employer profile to post jobs and review candidates."
                      : "Link a company so candidates can see who is hiring."}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/dashboard/employer-profile/complete">
                    {!hasProfile ? "Create profile" : "Add company"}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active jobs</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{activeJobs.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href="/dashboard/jobs"
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  Manage postings
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total applications</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{applications.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href="/dashboard/applications"
                  className="inline-flex items-center text-sm text-primary hover:underline"
                >
                  View inbox
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Needs review</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{newApplications.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Applied or under review
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending approval</CardDescription>
                <CardTitle className="text-3xl tabular-nums">{pendingApproval.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Job posts awaiting admin review
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Recent applications</CardTitle>
                  <CardDescription>
                    Latest candidates who applied to your jobs
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/applications">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentApplications.length === 0 ? (
                  <div className="rounded-md border border-dashed px-4 py-10 text-center">
                    <p className="text-sm font-medium text-foreground">No applications yet</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Post a job to start receiving candidates.
                    </p>
                    <Button asChild className="mt-4" size="sm">
                      <Link href="/dashboard/jobs/new">Post a job</Link>
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {recentApplications.map((app) => (
                      <li
                        key={app.documentId || app.id}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {app.user?.username || app.user?.email || "Candidate"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {app.job?.title || "Untitled role"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(app.applicationStatus || app.decision || "Applied")}
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/dashboard/applications/${app.documentId || app.id}/evaluation`}>
                              Review
                            </Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Your jobs</CardTitle>
                  <CardDescription>Recent postings</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/dashboard/jobs">Manage</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentJobs.length === 0 ? (
                  <div className="rounded-md border border-dashed px-4 py-10 text-center">
                    <p className="text-sm font-medium text-foreground">No jobs posted</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create your first listing to attract talent.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {recentJobs.map((job) => (
                      <li key={job.documentId || job.id}>
                        <Link
                          href={`/dashboard/jobs/${job.documentId || job.id}/applications`}
                          className="block rounded-md border px-3 py-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {job.title}
                            </p>
                            {getStatusBadge(job.approvalStatus || (job.isActive ? "Approved" : "Pending"))}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {[job.location, job.jobType].filter(Boolean).join(" · ") || "Open role"}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button asChild variant="outline" className="h-auto justify-start px-4 py-3">
              <Link href={hasProfile ? "/dashboard/employer-profile" : "/dashboard/employer-profile/complete"}>
                <User className="mr-3 h-4 w-4 shrink-0" />
                <span className="text-left">
                  <span className="block text-sm font-medium">Employer profile</span>
                  <span className="block text-xs text-muted-foreground">
                    {hasProfile ? "View and edit" : "Set up now"}
                  </span>
                </span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto justify-start px-4 py-3">
              <Link href={hasCompany ? "/dashboard/company/edit" : "/dashboard/employer-profile/complete"}>
                <Briefcase className="mr-3 h-4 w-4 shrink-0" />
                <span className="text-left">
                  <span className="block text-sm font-medium">Company</span>
                  <span className="block text-xs text-muted-foreground">
                    {hasCompany ? companyName || "Edit details" : "Add company"}
                  </span>
                </span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto justify-start px-4 py-3">
              <Link href="/dashboard/candidates">
                <BookOpen className="mr-3 h-4 w-4 shrink-0" />
                <span className="text-left">
                  <span className="block text-sm font-medium">Candidates</span>
                  <span className="block text-xs text-muted-foreground">Browse talent</span>
                </span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto justify-start px-4 py-3">
              <Link href="/dashboard/jobs">
                <Calendar className="mr-3 h-4 w-4 shrink-0" />
                <span className="text-left">
                  <span className="block text-sm font-medium">All job posts</span>
                  <span className="block text-xs text-muted-foreground">
                    {jobs.length} total
                  </span>
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Candidate dashboard
  if (isCandidate(session)) {
    const strapiUrl = getStrapiURL();
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    type CandidateDashProfile = {
      fullName?: string;
      phone?: string;
      bio?: string;
      profilePicture?: {
        url: string;
        formats?: Record<string, { url: string }>;
        alternativeText?: string | null;
      } | null;
      resume?: { url: string; name: string } | null;
      skills?: Array<{ id: number }>;
      education?: Array<{ id: number }>;
      experience?: Array<{ id: number }>;
    };
    let candidateProfile: CandidateDashProfile | null = null;

    if (strapiUrl) {
      try {
        const populateQuery =
          "populate[skills][fields][0]=id&populate[education][fields][0]=id&populate[experience][fields][0]=id&populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=url&populate[profilePicture][fields][2]=formats&populate[profilePicture][fields][3]=alternativeText&populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name&populate[user][fields][0]=id&populate[user][fields][1]=documentId";
        candidateProfile = (await findCandidateProfileForUser({
          userId: session.userId,
          userDocumentId: session.userDocumentId,
          profileDocumentId: session.candidateProfileDocumentId,
          authToken: session.jwt,
          fallbackAuthToken: apiToken,
          populateQuery,
        })) as CandidateDashProfile | null;
      } catch (error) {
        console.error("Error fetching candidate profile:", error);
      }
    }

    const [applications, savedJobs] = await Promise.all([
      getApplications(Number(session.userId), session.jwt),
      getSavedJobs(Number(session.userId), session.jwt),
    ]);

    const hasProfile = !!candidateProfile;
    const profileCompleteness = [
      Boolean(candidateProfile?.fullName),
      Boolean(candidateProfile?.phone),
      Boolean(candidateProfile?.bio),
      Boolean(candidateProfile?.profilePicture),
      Boolean(candidateProfile?.resume),
      Boolean(candidateProfile?.skills?.length),
      Boolean(candidateProfile?.education?.length),
      Boolean(candidateProfile?.experience?.length),
    ];
    const completedSteps = profileCompleteness.filter(Boolean).length;
    const completionPercent = Math.round((completedSteps / profileCompleteness.length) * 100);
    const profilePictureUrl =
      candidateProfile?.profilePicture && strapiUrl
        ? resolveImageUrl(candidateProfile.profilePicture, strapiUrl)
        : null;
    const recentApplications = applications.slice(0, 3);
    const pendingApplications = applications.filter(
      (app) => app.applicationStatus === "Pending" || app.applicationStatus === "Under Review"
    ).length;

    return (
      <div className="flex min-h-screen flex-col bg-muted/20">
        <header className="border-b bg-background px-6 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-primary/80">
                {profilePictureUrl ? (
                  <Image
                    src={profilePictureUrl}
                    alt={candidateProfile?.fullName || user.name}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{user.initials}</span>
                )}
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold text-foreground">
                  Welcome back, {candidateProfile?.fullName || user.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Track applications, refine your profile, and discover new roles.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/dashboard/browse-jobs">
                  <Briefcase className="mr-2 h-4 w-4" />
                  Browse Jobs
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={hasProfile ? "/dashboard/candidate-profile" : "/dashboard/candidate-profile/complete"}>
                  <User className="mr-2 h-4 w-4" />
                  {hasProfile ? "View Profile" : "Complete Profile"}
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Applications</CardDescription>
                <CardTitle className="text-3xl">{applications.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Total jobs you have applied to
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>In Progress</CardDescription>
                <CardTitle className="text-3xl">{pendingApplications}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Applications awaiting review
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Saved Jobs</CardDescription>
                <CardTitle className="text-3xl">{savedJobs.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Roles bookmarked for later
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Profile Strength</CardDescription>
                <CardTitle className="text-3xl">{completionPercent}%</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {hasProfile ? "Keep your profile up to date" : "Complete your profile to apply faster"}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Applications</CardTitle>
                  <CardDescription>Your latest application activity</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard/applications">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentApplications.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                      You haven&apos;t applied to any jobs yet.
                    </p>
                    <Button asChild>
                      <Link href="/dashboard/browse-jobs">
                        Find jobs to apply
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentApplications.map((application) => (
                      <div
                        key={application.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1">
                          <p className="font-medium">{application.job?.title || "Untitled role"}</p>
                          <p className="text-sm text-muted-foreground">
                            {application.job?.company?.name || "Company"}
                            {application.createdAt
                              ? ` · Applied ${new Date(application.createdAt).toLocaleDateString()}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(application.applicationStatus)}
                          {application.job?.slug && (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/dashboard/browse-jobs/${application.job.slug}`}>
                                Open
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile Checklist</CardTitle>
                <CardDescription>
                  {hasProfile
                    ? "Strengthen your candidacy with a complete profile"
                    : "Create your candidate profile to start applying"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Completion</span>
                    <span className="font-medium">{completionPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {candidateProfile?.resume ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Resume uploaded</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {candidateProfile?.skills?.length ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Skills added</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {candidateProfile?.experience?.length ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Work experience</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {candidateProfile?.education?.length ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>Education history</span>
                  </div>
                </div>

                <Button asChild className="w-full">
                  <Link
                    href={
                      hasProfile
                        ? "/dashboard/candidate-profile/edit"
                        : "/dashboard/candidate-profile/complete"
                    }
                  >
                    {hasProfile ? "Update Profile" : "Complete Profile"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Browse Opportunities</CardTitle>
                <CardDescription>Discover roles that match your skills</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard/browse-jobs">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Browse Jobs
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saved Jobs</CardTitle>
                <CardDescription>Revisit roles you bookmarked</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard/saved-jobs">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Open Saved Jobs
                  </Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">My Applications</CardTitle>
                <CardDescription>Follow up on application status</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard/applications">
                    <FileText className="mr-2 h-4 w-4" />
                    Track Applications
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for unexpected roles
  const studentProfile = await getStudentProfile(session.email, session.userId);

  const hasApplication = !!studentProfile;
  const applicationStatus = studentProfile?.applicationStatus || "not_started";
  const isProfileComplete = studentProfile?.isProfileComplete === true;

  return (
        <div className="flex min-h-screen flex-col bg-muted/20">
          {/* Profile header */}
          <header className="flex items-center gap-4 border-b bg-background px-6 py-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-primary/80">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{user.initials}</span>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold text-foreground">
                Welcome back, {user.name}!
              </h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </header>

          {/* Main content */}
          <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
            {/* Application Status Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Application Status</CardTitle>
                    <CardDescription>
                      {hasApplication 
                        ? "Track your admission application progress"
                        : "Start your admission application process"}
                    </CardDescription>
                  </div>
                  {hasApplication && getStatusBadge(applicationStatus)}
                </div>
              </CardHeader>
              <CardContent>
                {hasApplication ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Program Level</p>
                        <p className="text-sm font-medium">
                          {studentProfile.programLevel || "Not specified"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Program Type</p>
                        <p className="text-sm font-medium">
                          {studentProfile.programType || "Not specified"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Semester</p>
                        <p className="text-sm font-medium">
                          {studentProfile.semester || "Not specified"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Submitted Date</p>
                        <p className="text-sm font-medium">
                          {studentProfile.createdAt 
                            ? new Date(studentProfile.createdAt).toLocaleDateString()
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4 border-t">
                      <Button asChild>
                        <Link href="/dashboard/application">
                          <FileText className="mr-2 h-4 w-4" />
                          View Application
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      You haven&apos;t started your application yet. Click the button below to begin the admission process.
                    </p>
                    {!isProfileComplete ? (
                      <Button asChild>
                        <Link href="/dashboard/candidate-profile/complete">
                          Complete Profile First
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild>
                        <Link href="/dashboard/application">
                          Start Application
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Application</CardTitle>
                  <CardDescription>Manage your application</CardDescription>
                </CardHeader>
                <CardContent>
                  {!isProfileComplete ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground mb-2">
                        Complete your profile first to access the application
                      </p>
                      <Button asChild variant="outline" className="w-full">
                        <Link href="/dashboard/candidate-profile/complete">
                          <FileText className="mr-2 h-4 w-4" />
                          Complete Profile
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/dashboard/application">
                        <FileText className="mr-2 h-4 w-4" />
                        {hasApplication ? "View Application" : "Start Application"}
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Profile</CardTitle>
                  <CardDescription>View your profile</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/dashboard/candidate-profile">
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </Link>
                  </Button>
                  {session.userType === UserType.CANDIDATE && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/dashboard/candidate-profile/complete">
                        <FileText className="mr-2 h-4 w-4" />
                        Edit Candidate Profile
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Calendar</CardTitle>
                  <CardDescription>Important dates</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/dashboard/calendar">
                      <Calendar className="mr-2 h-4 w-4" />
                      View Calendar
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Application Details (if exists) */}
            {hasApplication && (
              <Card>
                <CardHeader>
                  <CardTitle>Application Details</CardTitle>
                  <CardDescription>Your submitted application information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="text-sm font-medium">
                        {studentProfile.firstNameEn || "Not provided"}
                        {studentProfile.fatherNameEn && ` ${studentProfile.fatherNameEn}`}
                        {studentProfile.grandFatherNameEn && ` ${studentProfile.grandFatherNameEn}`}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Phone Number</p>
                      <p className="text-sm font-medium">
                        {studentProfile.phoneNumber || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Date of Birth</p>
                      <p className="text-sm font-medium">
                        {studentProfile.dateOfBirth 
                          ? new Date(studentProfile.dateOfBirth).toLocaleDateString()
                          : "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">National ID</p>
                      <p className="text-sm font-medium">
                        {studentProfile.natioanalId || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Gender</p>
                      <p className="text-sm font-medium">
                        {studentProfile.gender || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Student Type</p>
                      <p className="text-sm font-medium">
                        {studentProfile.studentType || "Not specified"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Important Information */}
            <Card>
              <CardHeader>
                <CardTitle>Important Information</CardTitle>
                <CardDescription>Stay updated with admission news</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-md border bg-muted/50">
                    <BookOpen className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Application Deadline</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Make sure to submit your application before the deadline. Check the calendar for important dates.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-md border bg-muted/50">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Required Documents</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Ensure all required documents are uploaded and verified before submission.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
  )
}
