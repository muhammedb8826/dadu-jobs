import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getStrapiURL } from "@/lib/strapi/client";
import { resolveImageUrl } from "@/lib/strapi/media";
import { 
  Mail, 
  Phone, 
  FileText, 
  GraduationCap, 
  Briefcase,
  Calendar,
  MapPin,
  Edit
} from "lucide-react";

type CandidateProfile = {
  id: number;
  documentId: string;
  fullName: string;
  phone?: string;
  bio?: string;
  profilePicture?: {
    url: string;
    formats?: Record<string, { url: string }>;
    alternativeText?: string | null;
  } | null;
  resume?: {
    url: string;
    name: string;
  } | null;
  user?: {
    email: string;
    username: string;
  };
  skills?: Array<{
    id: number;
    skillName: string;
    level: string;
  }>;
  education?: Array<{
    id: number;
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    description?: string;
  }>;
  experience?: Array<{
    id: number;
    companyName: string;
    jobTitle: string;
    location?: string;
    startDate: string;
    endDate?: string;
    isCurrent?: boolean | null;
    description?: Array<{
      type: string;
      children?: Array<{ text?: string; type?: string }>;
    }>;
  }>;
};

function renderRichText(description?: Array<{ type: string; children?: Array<{ text?: string }> }>) {
  if (!description?.length) return null;
  return description.map((block, idx) => {
    if (block.type === "paragraph" && block.children) {
      const text = block.children.map((c) => c.text || "").join("").trim();
      if (!text) return null;
      return (
        <p key={idx} className="text-sm text-muted-foreground leading-relaxed mb-2">
          {text}
        </p>
      );
    }
    return null;
  });
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateString;
  }
}

async function getCandidateProfile(userId: string): Promise<CandidateProfile | null> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return null;
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    
    // Build populate query for candidate profile
    const populateQuery = "populate[skills][fields][0]=id&populate[skills][fields][1]=skillName&populate[skills][fields][2]=level&populate[education]=*&populate[experience]=*&populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=name&populate[profilePicture][fields][2]=url&populate[profilePicture][fields][3]=alternativeText&populate[profilePicture][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=name&populate[resume][fields][2]=url&populate[resume][fields][3]=mime&populate[resume][fields][4]=size&populate[user][fields][0]=username&populate[user][fields][1]=email&populate[user][fields][2]=type";
    
    // Fetch candidate profile directly from Strapi
    const userIdNum = Number(userId);
    const response = await fetch(
      `${strapiUrl}/api/candidate-profiles?filters[user][id][$eq]=${userIdNum}&${populateQuery}`,
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
    
    // Return the first profile if array, or the profile if single object
    if (result?.data) {
      if (Array.isArray(result.data) && result.data.length > 0) {
        return result.data[0];
      } else if (result.data && !Array.isArray(result.data)) {
        return result.data;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching candidate profile:", error);
    return null;
  }
}

export default async function CandidateProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only candidates can view their own profile
  if (!isCandidate(session)) {
    redirect("/dashboard");
  }

  const candidate = await getCandidateProfile(session.userId);
  const strapiUrl = getStrapiURL();

  if (!candidate) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/20">
        <header className="border-b bg-background px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">My Profile</h1>
        </header>
        <div className="flex flex-1 items-center justify-center px-4 py-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">You haven&apos;t created your candidate profile yet.</p>
              <Button asChild>
                <Link href="/dashboard/candidate-profile/complete">
                  Complete Your Profile
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const profilePictureUrl = candidate.profilePicture && strapiUrl
    ? resolveImageUrl(candidate.profilePicture, strapiUrl)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">My Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage your candidate profile
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/candidate-profile/edit">
              <Edit className="mr-2 h-4 w-4" />
              Edit Profile
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col items-center text-center space-y-4">
                  {profilePictureUrl ? (
                    <div className="relative h-32 w-32 overflow-hidden rounded-full border-2">
                      <Image
                        src={profilePictureUrl}
                        alt={candidate.profilePicture?.alternativeText || candidate.fullName}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center rounded-full bg-muted text-3xl font-semibold">
                      {candidate.fullName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <CardTitle className="text-2xl">{candidate.fullName}</CardTitle>
                    {candidate.user?.email && (
                      <CardDescription className="flex items-center justify-center gap-1 mt-2">
                        <Mail className="h-4 w-4" />
                        {candidate.user.email}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidate.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{candidate.phone}</span>
                  </div>
                )}

                {candidate.resume && (
                  <Button asChild variant="outline" className="w-full">
                    <a
                      href={`${strapiUrl}${candidate.resume.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      View Resume
                    </a>
                  </Button>
                )}

                <Separator />

                {candidate.skills && candidate.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map((skill) => (
                        <Badge key={skill.id} variant="secondary" className="text-xs">
                          {skill.skillName}
                          {skill.level && (
                            <span className="ml-1 text-muted-foreground">({skill.level})</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Bio, Education, Experience */}
          <div className="lg:col-span-2 space-y-6">
            {/* Bio */}
            {candidate.bio && (
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {candidate.bio}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Education */}
            {candidate.education && candidate.education.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Education
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {candidate.education.map((edu) => (
                    <div key={edu.id} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{edu.degree} in {edu.fieldOfStudy}</h4>
                          <p className="text-sm text-muted-foreground">{edu.institution}</p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(edu.startDate)} - {formatDate(edu.endDate)}
                          </div>
                        </div>
                      </div>
                      {edu.description && (
                        <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                          {edu.description}
                        </p>
                      )}
                      {edu.id !== candidate.education![candidate.education!.length - 1].id && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Experience */}
            {candidate.experience && candidate.experience.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Experience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {candidate.experience.map((exp) => (
                    <div key={exp.id} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold">{exp.jobTitle}</h4>
                          <p className="text-sm text-muted-foreground">{exp.companyName}</p>
                          {exp.location && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3" />
                              {exp.location}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(exp.startDate)} - {exp.isCurrent ? "Present" : formatDate(exp.endDate)}
                          </div>
                        </div>
                      </div>
                      {exp.description && (
                        <div className="mt-3">
                          {renderRichText(exp.description)}
                        </div>
                      )}
                      {exp.id !== candidate.experience![candidate.experience!.length - 1].id && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
