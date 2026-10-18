import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { isCandidate } from "@/lib/auth/rbac";
import { findCandidateProfileForUser } from "@/lib/strapi/candidate-profile";

/**
 * Legacy route — always send candidates to the unified edit form.
 * If a profile already exists, edit loads it; otherwise it shows a blank form.
 */
export default async function CompleteCandidateProfilePage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (!isCandidate(session)) {
    redirect("/dashboard");
  }

  // Warm session ownership when possible (side effect via API is elsewhere);
  // always use the edit page as the single form surface.
  await findCandidateProfileForUser({
    userId: session.userId,
    userDocumentId: session.userDocumentId,
    profileDocumentId: session.candidateProfileDocumentId,
    authToken: session.jwt,
    fallbackAuthToken: process.env.NEXT_PUBLIC_API_TOKEN,
  });

  redirect("/dashboard/candidate-profile/edit");
}
