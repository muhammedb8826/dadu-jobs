import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { CandidateProfileCompletionForm } from "@/components/candidate-profile-completion-form";
import { isCandidate } from "@/lib/auth/rbac";

export default async function CompleteCandidateProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only candidates can complete candidate profile
  if (!isCandidate(session)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Page header */}
      <header className="border-b bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">
          Complete Your Candidate Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in your profile information to help employers find you
        </p>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col gap-6 px-4 py-6 lg:px-8">
        <section className="flex-1">
          <CandidateProfileCompletionForm />
        </section>
      </div>
    </div>
  );
}
