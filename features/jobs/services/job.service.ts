import { getStrapiURL } from "@/lib/strapi/client";
import type { Job } from "../types/job.types";

/**
 * Get jobs for public listing (approved jobs only)
 */
export async function getPublicJobs(): Promise<Job[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    // Populate categories and company with only needed fields (not * to avoid invalid relations)
    const populateQuery = "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company][fields][0]=id&populate[company][fields][1]=name&populate[company][fields][2]=slug";
    const url = `${strapiUrl}/api/jobs?filters[approvalStatus][$eq]=Approved&${populateQuery}`;

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
    console.error("Error fetching public jobs:", error);
    return [];
  }
}

/**
 * Get jobs for employer dashboard (filtered by user)
 */
export async function getJobs(userId: number): Promise<Job[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      console.error("getJobs: Strapi URL is not configured");
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    // Populate categories and company with only needed fields (not * to avoid invalid relations)
    const populateQuery = "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company][fields][0]=id&populate[company][fields][1]=name&populate[company][fields][2]=slug";
    const url = `${strapiUrl}/api/jobs?filters[user][id][$eq]=${userId}&${populateQuery}`;

    console.log("getJobs: Fetching from URL:", url);
    console.log("getJobs: User ID:", userId);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("getJobs: Response not OK. Status:", response.status, "Error:", errorText);
      return [];
    }

    const result = await response.json();
    console.log("getJobs: Response data:", result);
    console.log("getJobs: Jobs array:", result?.data);
    console.log("getJobs: Jobs count:", result?.data?.length || 0);
    
    return result?.data || [];
  } catch (error) {
    console.error("getJobs: Error fetching jobs:", error);
    return [];
  }
}
