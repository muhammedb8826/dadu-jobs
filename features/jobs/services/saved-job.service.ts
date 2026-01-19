import { getStrapiURL } from "@/lib/strapi/client";
import type { SavedJob } from "../types/saved-job.types";

/**
 * Get saved jobs for a candidate user
 */
export async function getSavedJobs(userId: number, sessionJwt?: string): Promise<SavedJob[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    
    // Populate job with all necessary fields including company and logo
    const populateQuery = "populate[job][populate][categories][fields][0]=id&populate[job][populate][categories][fields][1]=name&populate[job][populate][categories][fields][2]=slug&populate[job][populate][salary]=*&populate[job][populate][company]=*&populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats";
    
    const url = `${strapiUrl}/api/saved-jobs?filters[user][id][$eq]=${userId}&${populateQuery}&sort[0]=createdAt:desc`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (sessionJwt) {
      headers.Authorization = `Bearer ${sessionJwt}`;
    } else if (apiToken) {
      headers.Authorization = `Bearer ${apiToken}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("getSavedJobs: Response not OK. Status:", response.status, "Error:", errorText);
      return [];
    }

    const result = await response.json();
    return result?.data || [];
  } catch (error) {
    console.error("Error fetching saved jobs:", error);
    return [];
  }
}

/**
 * Check if a job is saved by a user
 */
export async function isJobSaved(userId: number, jobId: number): Promise<boolean> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return false;
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const url = `${strapiUrl}/api/saved-jobs?filters[user][id][$eq]=${userId}&filters[job][id][$eq]=${jobId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result?.data && result.data.length > 0;
  } catch (error) {
    console.error("Error checking if job is saved:", error);
    return false;
  }
}
