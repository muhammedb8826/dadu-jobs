
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
  GraduationCap,
  Award,
  Mail,
  Phone
} from "lucide-react"

import { getSession } from "@/lib/auth/session"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getStrapiURL } from "@/lib/strapi/client"
import { UserType } from "@/lib/types/user.types"
import { isCandidate } from "@/lib/auth/rbac"
import { resolveImageUrl } from "@/lib/strapi/media"

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

async function getCandidateProfile(userId: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/candidate-profiles?myProfile=true`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result?.data || null;
  } catch (error) {
    console.error("Error fetching candidate profile:", error);
    return null;
  }
}

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

  // Role-based access: Dashboard content varies by user type
  // Candidates see candidate profile/job application dashboard
  // Employers see job posting/management dashboard

  const user = {
    name: session.firstName || "User",
    email: session.email,
    avatar: "",
    initials: getInitials(session.firstName, session.email),
  }

  // If user is a candidate, show candidate dashboard
  if (isCandidate(session)) {
    const candidateProfile = await getCandidateProfile(session.userId);
    const strapiUrl = getStrapiURL();
    const profilePictureUrl = candidateProfile?.profilePicture && strapiUrl
      ? resolveImageUrl(candidateProfile.profilePicture, strapiUrl)
      : null;

    const hasProfile = !!candidateProfile;
    const hasResume = !!candidateProfile?.resume;
    const skillsCount = candidateProfile?.skills?.length || 0;
    const educationCount = candidateProfile?.education?.length || 0;
    const experienceCount = candidateProfile?.experience?.length || 0;

    return (
      <div className="flex min-h-screen flex-col bg-muted/20">
        {/* Profile header */}
        <header className="flex items-center gap-4 border-b bg-background px-6 py-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-semibold text-primary/80">
            {profilePictureUrl ? (
              <Image
                src={profilePictureUrl}
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
              Welcome back, {candidateProfile?.fullName || user.name}!
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
          {/* Profile Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Candidate Profile</CardTitle>
                  <CardDescription>
                    {hasProfile 
                      ? "Your professional profile for job applications"
                      : "Complete your candidate profile to start applying for jobs"}
                  </CardDescription>
                </div>
                {hasProfile && (
                  <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Profile Created
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {hasProfile ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Full Name</p>
                      <p className="text-sm font-medium">
                        {candidateProfile.fullName || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium">
                        {candidateProfile.phone || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Resume</p>
                      <p className="text-sm font-medium">
                        {hasResume ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                            <FileText className="mr-1 h-3 w-3" />
                            Uploaded
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not uploaded</Badge>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Profile Picture</p>
                      <p className="text-sm font-medium">
                        {profilePictureUrl ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Added
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not added</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4 border-t">
                    <Button asChild>
                      <Link href="/dashboard/candidate-profile/complete">
                        <FileText className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/profile">
                        <User className="mr-2 h-4 w-4" />
                        View Profile
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You haven&apos;t created your candidate profile yet. Complete your profile to make yourself visible to employers and start applying for jobs.
                  </p>
                  <Button asChild>
                    <Link href="/dashboard/candidate-profile/complete">
                      Complete Candidate Profile
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Profile</CardTitle>
                <CardDescription>Manage your candidate profile</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild variant="outline" className="w-full">
                  <Link href={hasProfile ? "/dashboard/candidate-profile/complete" : "/dashboard/candidate-profile/complete"}>
                    <User className="mr-2 h-4 w-4" />
                    {hasProfile ? "Edit Profile" : "Complete Profile"}
                  </Link>
                </Button>
                {hasProfile && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/dashboard/profile">
                      <FileText className="mr-2 h-4 w-4" />
                      View Profile
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Applications</CardTitle>
                <CardDescription>View your job applications</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard/application">
                    <Briefcase className="mr-2 h-4 w-4" />
                    My Applications
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saved Jobs</CardTitle>
                <CardDescription>View your saved job postings</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full" disabled>
                  <Link href="#">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Coming Soon
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Profile Statistics */}
          {hasProfile && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" />
                    Skills
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{skillsCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {skillsCount === 0 ? "No skills added yet" : skillsCount === 1 ? "skill added" : "skills added"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Education
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{educationCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {educationCount === 0 ? "No education entries" : educationCount === 1 ? "education entry" : "education entries"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Experience
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{experienceCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {experienceCount === 0 ? "No experience entries" : experienceCount === 1 ? "experience entry" : "experience entries"}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Profile Details (if exists) */}
          {hasProfile && candidateProfile.bio && (
            <Card>
              <CardHeader>
                <CardTitle>About Me</CardTitle>
                <CardDescription>Your professional bio</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {candidateProfile.bio}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Important Information */}
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Tips for a complete profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-md border bg-muted/50">
                  <CheckCircle2 className={`h-5 w-5 mt-0.5 ${hasProfile ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Complete Your Profile</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add your full name, bio, skills, education, and work experience to make your profile stand out.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-md border bg-muted/50">
                  <CheckCircle2 className={`h-5 w-5 mt-0.5 ${hasResume ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Upload Your Resume</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload an up-to-date resume to help employers learn more about your qualifications.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-md border bg-muted/50">
                  <Briefcase className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Start Applying</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Browse available job postings and apply to positions that match your skills and interests.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // For non-candidates (students/employers), show the original student dashboard
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
                        <Link href="/dashboard/profile/complete">
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
                        <Link href="/dashboard/profile/complete">
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
                    <Link href="/dashboard/profile">
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </Link>
                  </Button>
                  {session.userType === UserType.CANDIDATE && (
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/dashboard/candidate-profile/complete">
                        <FileText className="mr-2 h-4 w-4" />
                        Complete Candidate Profile
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
