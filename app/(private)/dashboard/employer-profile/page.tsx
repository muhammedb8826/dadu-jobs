import { getSession, validateSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { isEmployer } from "@/lib/auth/rbac";
import { getStrapiURL } from "@/lib/strapi/client";
import { resolveImageUrl } from "@/lib/strapi/media";
import { findEmployerProfileForUser } from "@/lib/strapi/employer-profile";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StrapiRichText } from "@/components/StrapiRichText";
import { User, Briefcase, Edit, Building2, Globe, MapPin } from "lucide-react";

export default async function EmployerProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Validate session with Strapi to ensure JWT token is still valid
  const isValid = await validateSession(session);
  if (!isValid) {
    // Session is invalid (user deleted or token expired), redirect to logout route
    // The logout route handler will clear the session cookie
    redirect("/api/auth/logout");
  }

  if (!isEmployer(session)) {
    redirect("/dashboard");
  }

  const employerProfile = await findEmployerProfileForUser({
    userId: session.userId,
    userDocumentId: session.userDocumentId,
    authToken: session.jwt,
    fallbackAuthToken: process.env.NEXT_PUBLIC_API_TOKEN,
  });
  const strapiUrl = getStrapiURL();
  const profilePictureUrl = employerProfile?.profilePicture && strapiUrl
    ? resolveImageUrl(employerProfile.profilePicture, strapiUrl)
    : null;
  const companyLogoUrl = employerProfile?.company?.logo?.[0] && strapiUrl
    ? resolveImageUrl(employerProfile.company.logo[0], strapiUrl)
    : null;

  const hasProfile = !!employerProfile;
  const hasCompany = !!employerProfile?.company;

  if (!hasProfile) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/20">
        <header className="border-b bg-background px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">Employer Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your profile information
          </p>
        </header>

        <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
          <Card>
            <CardHeader>
              <CardTitle>No Profile Found</CardTitle>
              <CardDescription>
                You haven&apos;t created your employer profile yet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create your employer profile to start posting jobs and managing your company information.
                </p>
                <div className="flex gap-2">
                  <Button asChild>
                    <Link href="/dashboard/employer-profile/complete">
                      <User className="mr-2 h-4 w-4" />
                      Create Profile
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Employer Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View your profile and company information
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/employer-profile/edit">
                <Edit className="mr-2 h-4 w-4" />
                Edit Profile
              </Link>
            </Button>
            {hasCompany && (
              <Button asChild variant="outline">
                <Link href="/dashboard/company/edit">
                  <Building2 className="mr-2 h-4 w-4" />
                  Edit Company
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Your personal and professional details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {profilePictureUrl && (
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border">
                  <Image
                    src={profilePictureUrl}
                    alt={employerProfile.fullName || "Profile"}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                    <p className="text-sm">{employerProfile.fullName || "Not provided"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Job Title</p>
                    <p className="text-sm">{employerProfile.jobTitle || "Not provided"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="text-sm">{employerProfile.phone || "Not provided"}</p>
                  </div>
                </div>
                {employerProfile.bio && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Bio</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {employerProfile.bio}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Information */}
        {hasCompany ? (
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Details about your company</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                {companyLogoUrl && (
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded border">
                    <Image
                      src={companyLogoUrl}
                      alt={employerProfile.company.name || "Company Logo"}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{employerProfile.company.name}</h3>
                    {employerProfile.company.tagline && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {employerProfile.company.tagline}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {employerProfile.company.website && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Website
                        </p>
                        <a
                          href={employerProfile.company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {employerProfile.company.website}
                        </a>
                      </div>
                    )}
                    {employerProfile.company.location && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Location
                        </p>
                        <p className="text-sm">{employerProfile.company.location}</p>
                      </div>
                    )}
                    {employerProfile.company.industry && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Industry
                        </p>
                        <p className="text-sm">{employerProfile.company.industry}</p>
                      </div>
                    )}
                    {employerProfile.company.companySize && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Company Size
                        </p>
                        <p className="text-sm">{employerProfile.company.companySize}</p>
                      </div>
                    )}
                  </div>
                  {employerProfile.company.description && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Description</p>
                      <StrapiRichText
                        content={employerProfile.company.description}
                        className="text-sm text-muted-foreground max-w-none"
                      />
                    </div>
                  )}
                  {employerProfile.company.socialLinks && employerProfile.company.socialLinks.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Social Links</p>
                      <div className="flex flex-wrap gap-2">
                        {employerProfile.company.socialLinks.map((link: { id?: number; label: string; url: string }, index: number) => (
                          <a
                            key={link.id || index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border px-3 py-1 text-sm text-primary hover:bg-muted"
                          >
                            <Globe className="h-3 w-3" />
                            {link.label || "Link"}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>No company linked to your profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t linked a company to your profile yet. Add company information to complete your profile.
                </p>
                <Button asChild>
                  <Link href="/dashboard/employer-profile/complete">
                    <Building2 className="mr-2 h-4 w-4" />
                    Create Company
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
