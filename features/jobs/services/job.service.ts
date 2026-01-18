import { getStrapiURL } from "@/lib/strapi/client";
import type { Job } from "../types/job.types";

export async function getJobs(userId: number): Promise<Job[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery = "populate[categories]=*&populate[salary]=*&populate[company]=*";
    const url = `${strapiUrl}/api/jobs?filters[user][id][$eq]=${userId}&${populateQuery}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const result = await response.json();
    return result?.data || [];
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return [];
  }
}
