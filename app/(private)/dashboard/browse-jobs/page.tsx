import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";
import { getPublicJobs, getAppliedJobIds } from "@/features/jobs";
import { fetchCategories } from "@/features/jobs/api/job.api";
import { CandidateJobsClient } from "./CandidateJobsClient";
import type { Category } from "@/features/jobs/types/job.types";
import { getStrapiURL } from "@/lib/strapi/client";

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

  // Fetch applied job IDs for the current user
  const appliedJobIds = await getAppliedJobIds(Number(session.userId));

  // Fetch saved job IDs for the current user
  const savedJobIds = new Set<number>();
  const strapiUrl = getStrapiURL();
  if (strapiUrl) {
    try {
      const savedJobsResponse = await fetch(
        `${strapiUrl}/api/saved-jobs?filters[user][id][$eq]=${session.userId}&populate[job][fields][0]=id`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          },
          cache: "no-store",
        }
      );

      if (savedJobsResponse.ok) {
        const savedJobsResult = await savedJobsResponse.json();
        savedJobsResult?.data?.forEach((savedJob: { job?: { id: number } }) => {
          if (savedJob.job?.id) {
            savedJobIds.add(savedJob.job.id);
          }
        });
      }
    } catch (error) {
      console.error("Error fetching saved jobs:", error);
    }
  }

  return (
    <CandidateJobsClient 
      initialJobs={jobs} 
      categories={categories} 
      appliedJobIds={Array.from(appliedJobIds)}
      savedJobIds={Array.from(savedJobIds)}
    />
  );
}
