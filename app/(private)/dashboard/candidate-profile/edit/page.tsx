import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CandidateProfileCompletionForm } from "@/components/candidate-profile-completion-form";
import { isCandidate } from "@/lib/auth/rbac";
import { findCandidateProfileForUser } from "@/lib/strapi/candidate-profile";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function EditCandidateProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isCandidate(session)) {
    redirect("/dashboard");
  }

  const existingProfile = await findCandidateProfileForUser({
    userId: session.userId,
    userDocumentId: session.userDocumentId,
    profileDocumentId: session.candidateProfileDocumentId,
    authToken: session.jwt,
    fallbackAuthToken: process.env.NEXT_PUBLIC_API_TOKEN,
  });

  const isEdit = Boolean(existingProfile);

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="-ml-2">
                <Link href="/dashboard/candidate-profile">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Profile
                </Link>
              </Button>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {isEdit ? "Edit your profile" : "Complete your profile"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? "Update your details so employers see the latest information."
                : "Add your name, contact details, and a short bio to get started."}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <CandidateProfileCompletionForm
          initialData={existingProfile ?? undefined}
          isEditMode={isEdit}
        />
      </div>
    </div>
  );
}
