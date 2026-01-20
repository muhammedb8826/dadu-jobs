import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { CandidateProfileCompletionForm } from "@/components/candidate-profile-completion-form";
import { isCandidate } from "@/lib/auth/rbac";
import { getStrapiURL } from "@/lib/strapi/client";

async function getCandidateProfile(userId: string, userJwt?: string) {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return null;
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    
    // Build populate query for candidate profile
    const populateQuery = "populate[skills][fields][0]=id&populate[skills][fields][1]=skillName&populate[skills][fields][2]=level&populate[education]=*&populate[experience]=*&populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=name&populate[profilePicture][fields][2]=url&populate[profilePicture][fields][3]=alternativeText&populate[profilePicture][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=name&populate[resume][fields][2]=url&populate[resume][fields][3]=mime&populate[resume][fields][4]=size&populate[user][fields][0]=username&populate[user][fields][1]=email&populate[user][fields][2]=type";
    
    // Fetch candidate profile directly from Strapi using user's JWT token
    // User's JWT has the correct permissions to filter by user relation
    const userIdNum = Number(userId);
    const response = await fetch(
      `${strapiUrl}/api/candidate-profiles?filters[user][id][$eq]=${userIdNum}&${populateQuery}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          // Use user's JWT if available, fall back to API token
          ...(userJwt ? { Authorization: `Bearer ${userJwt}` } : apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch profile:", response.status, await response.text().catch(() => ''));
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

export default async function EditCandidateProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only candidates can edit candidate profile
  if (!isCandidate(session)) {
    redirect("/dashboard");
  }

  // Fetch existing profile server-side using user's JWT token
  const existingProfile = await getCandidateProfile(session.userId, session.jwt);

  // If no profile exists, redirect to complete page
  if (!existingProfile) {
    redirect("/dashboard/candidate-profile/complete");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Page header */}
      <header className="border-b bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">
          Edit Your Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your profile information
        </p>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        <section className="flex-1">
          <CandidateProfileCompletionForm 
            initialData={existingProfile}
            isEditMode={true}
          />
        </section>
      </div>
    </div>
  );
}
