import { getPublicJobs } from "@/features/jobs";
import { fetchCategories } from "@/features/jobs/api/job.api";
import { JobsClient } from "./JobsClient";
import type { Category } from "@/features/jobs/types/job.types";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Job Opportunities | DADU Jobs",
  description: "Browse available job opportunities and find your next career move",
};

export default async function JobsPage() {
  const jobs = await getPublicJobs();
  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
  
  // Fetch categories for filtering
  let categories: Category[] = [];
  try {
    const fetchedCategories = await fetchCategories(apiToken);
    categories = fetchedCategories;
  } catch (error) {
    console.error("Error fetching categories:", error);
  }

  return <JobsClient initialJobs={jobs} categories={categories} />;
}
