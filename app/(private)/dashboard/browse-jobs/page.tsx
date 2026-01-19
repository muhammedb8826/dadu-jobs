import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";
import { getPublicJobs } from "@/features/jobs";
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

  return <CandidateJobsClient initialJobs={jobs} categories={categories} />;
}
