import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { CandidateProfileCompletionForm } from "@/components/candidate-profile-completion-form";
import { isCandidate } from "@/lib/auth/rbac";
import { getStrapiURL } from "@/lib/strapi/client";

export default async function CompleteCandidateProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only candidates can complete candidate profile
  if (!isCandidate(session)) {
    redirect("/dashboard");
  }

  // Check if profile already exists - if so, redirect to edit page
  const strapiUrl = getStrapiURL();
  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

  if (strapiUrl) {
    try {
      const response = await fetch(
        `${strapiUrl}/api/candidate-profiles?filters[user][id][$eq]=${session.userId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const result = await response.json();
        const profile = Array.isArray(result?.data) ? result.data[0] : result?.data;
        
        // If profile exists, redirect to edit page
        if (profile) {
          redirect("/dashboard/candidate-profile/edit");
        }
      }
    } catch (error) {
      console.error("Error fetching candidate profile:", error);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Page header */}
      <header className="border-b bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">
          Complete Your Candidate Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your profile to start applying for jobs
        </p>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        <section className="flex-1">
          <CandidateProfileCompletionForm isEditMode={false} />
        </section>
      </div>
    </div>
  );
}
