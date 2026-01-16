import { redirect } from "next/navigation";
import { getSession, createSession } from "@/lib/auth/session";
import { UserType } from "@/lib/types/user.types";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getStrapiURL } from "@/lib/strapi/client";
import { resolveImageUrl } from "@/lib/strapi/media";
import { User, Mail, Phone, FileText } from "lucide-react";

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
};

async function getCandidates(): Promise<CandidateProfile[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const response = await fetch(`${strapiUrl}/api/candidate-profiles?populate[skills]=*&populate[profilePicture]=*&populate[resume]=*&populate[user][fields][0]=email&populate[user][fields][1]=username`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NEXT_PUBLIC_API_TOKEN && { Authorization: `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();
    
    if (result?.data) {
      return Array.isArray(result.data) ? result.data : [result.data];
    }
    
    return [];
  } catch (error) {
    console.error("Error fetching candidates:", error);
    return [];
  }
}

async function refreshUserType(session: { userId: string; jwt?: string }): Promise<UserType | undefined> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl || !session.jwt) {
      console.log("Cannot refresh userType - missing strapiUrl or jwt");
      return undefined;
    }

    // Try using the API token if JWT doesn't work
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const authHeader = session.jwt 
      ? `Bearer ${session.jwt}`
      : apiToken 
        ? `Bearer ${apiToken}`
        : undefined;

    if (!authHeader) {
      console.log("No auth token available for fetching user type");
      return undefined;
    }

    const userResponse = await fetch(`${strapiUrl}/api/users/${session.userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      cache: "no-store",
    });

    if (userResponse.ok) {
      const userData = await userResponse.json().catch(() => ({}));
      const type = userData?.type as string | undefined;
      console.log("Fetched user type from Strapi:", type);
      if (type === UserType.EMPLOYER || type === UserType.CANDIDATE) {
        return type as UserType;
      }
    } else {
      console.error("Failed to fetch user type, status:", userResponse.status);
    }
  } catch (error) {
    console.error("Error refreshing user type:", error);
  }
  return undefined;
}

export default async function CandidatesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // If userType is missing from session, try to refresh it and update session
  let userType: UserType | undefined = session.userType;
  
  console.log("Candidates page - Initial session:", {
    userId: session.userId,
    email: session.email,
    userType: session.userType,
    hasJwt: !!session.jwt,
  });

  if (!userType && session.jwt) {
    console.log("UserType missing, attempting to refresh...");
    const refreshedType = await refreshUserType(session);
    if (refreshedType === UserType.EMPLOYER || refreshedType === UserType.CANDIDATE) {
      userType = refreshedType;
      console.log("Refreshed userType:", userType);
      // Update session with the refreshed userType
      await createSession({
        ...session,
        userType: userType,
      });
      console.log("Session updated with userType");
    } else {
      console.log("Failed to refresh userType or invalid type:", refreshedType);
    }
  }

  console.log("Final userType check:", {
    userType,
    isEmployer: userType === UserType.EMPLOYER,
    UserType_EMPLOYER: UserType.EMPLOYER,
  });

  // Role-based access: Only employers can view candidates
  if (userType !== UserType.EMPLOYER) {
    console.log("Access denied - redirecting to dashboard. userType:", userType);
    redirect("/dashboard");
  }

  console.log("Access granted - loading candidates page");

  const candidates = await getCandidates();
  const strapiUrl = getStrapiURL();

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Candidates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and view candidate profiles
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        {candidates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No candidates found.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {candidates.map((candidate) => {
              const profilePictureUrl = candidate.profilePicture && strapiUrl
                ? resolveImageUrl(candidate.profilePicture, strapiUrl)
                : null;

              return (
                <Card key={candidate.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      {profilePictureUrl ? (
                        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border">
                          <Image
                            src={profilePictureUrl}
                            alt={candidate.profilePicture?.alternativeText || candidate.fullName}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold">
                          {candidate.fullName.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg">{candidate.fullName}</CardTitle>
                        {candidate.user?.email && (
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{candidate.user.email}</span>
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {candidate.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{candidate.phone}</span>
                      </div>
                    )}
                    
                    {candidate.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {candidate.bio}
                      </p>
                    )}

                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {candidate.skills.slice(0, 3).map((skill) => (
                          <Badge key={skill.id} variant="secondary">
                            {skill.skillName}
                          </Badge>
                        ))}
                        {candidate.skills.length > 3 && (
                          <Badge variant="outline">
                            +{candidate.skills.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button asChild variant="outline" className="flex-1">
                        <Link href={`/dashboard/candidates/${candidate.documentId || candidate.id}`}>
                          <User className="mr-2 h-4 w-4" />
                          View Profile
                        </Link>
                      </Button>
                      {candidate.resume && (
                        <Button asChild variant="ghost" size="icon">
                          <a
                            href={`${strapiUrl}${candidate.resume.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="sr-only">View Resume</span>
                          </a>
                        </Button>
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
