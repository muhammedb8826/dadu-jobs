import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";
import { getPublicJobs, getAppliedJobIds, getSavedJobs } from "@/features/jobs";
import { fetchCategories } from "@/features/jobs/api/job.api";
import { CandidateJobsClient } from "./CandidateJobsClient";
import type { Category } from "@/features/jobs/types/job.types";

export const metadata = {
  title: "Browse Jobs | DADU Jobs",
  description: "Find your dream job",
};

export default async function BrowseJobsPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Role-based access: Only candidates can browse jobs
  if (!isCandidate(session)) {
    redirect("/dashboard");
  }

  const jobs = await getPublicJobs();
  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

  let categories: Category[] = [];
  try {
    const fetchedCategories = await fetchCategories(apiToken);
    categories = fetchedCategories;
  } catch (error) {
    console.error("Error fetching categories:", error);
  }

  const [appliedJobIds, savedJobs] = await Promise.all([
    getAppliedJobIds(Number(session.userId), session.jwt),
    getSavedJobs(Number(session.userId), session.jwt),
  ]);
  const savedJobKeys = new Set<string>();
  for (const saved of savedJobs) {
    if (saved.job?.id != null) savedJobKeys.add(String(saved.job.id));
    if (saved.job?.documentId) savedJobKeys.add(String(saved.job.documentId));
  }

  return (
    <CandidateJobsClient 
      initialJobs={jobs} 
      categories={categories} 
      appliedJobIds={Array.from(appliedJobIds)}
      savedJobIds={Array.from(savedJobKeys)}
    />
  );
}
