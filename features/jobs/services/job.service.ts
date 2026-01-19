import { getStrapiURL } from "@/lib/strapi/client";
import { fetchJobBySlug } from "../api/job.api";
import type { Job } from "../types/job.types";

/**
 * Get jobs for public listing (approved and active jobs only)
 */
export async function getPublicJobs(): Promise<Job[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    // Use same populate query as job.api.ts - populate[company]=* with explicit nested relations
    const populateQuery = "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company]=*&populate[company][populate][logo][fields][0]=id&populate[company][populate][logo][fields][1]=url&populate[company][populate][logo][fields][2]=name&populate[company][populate][logo][fields][3]=alternativeText&populate[company][populate][logo][fields][4]=formats&populate[company][populate][socialLinks]=*";
    // Filter for approved and active jobs only using $and to combine filters
    // Set a high limit to fetch all jobs (adjust if you have more than 1000 jobs)
    const url = `${strapiUrl}/api/jobs?filters[$and][0][approvalStatus][$eq]=Approved&filters[$and][1][isActive][$eq]=true&pagination[limit]=1000&${populateQuery}`;

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
      console.error("getPublicJobs: Response not OK. Status:", response.status, "Error:", errorText);
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
export async function getJobs(userId: number, sessionJwt?: string): Promise<Job[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      console.error("getJobs: Strapi URL is not configured");
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    // Use same populate query as job.api.ts - populate[company]=* with explicit nested relations
    const populateQuery = "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company]=*&populate[company][populate][logo][fields][0]=id&populate[company][populate][logo][fields][1]=url&populate[company][populate][logo][fields][2]=name&populate[company][populate][logo][fields][3]=alternativeText&populate[company][populate][logo][fields][4]=formats&populate[company][populate][socialLinks]=*&populate[user][fields][0]=id";
    const url = `${strapiUrl}/api/jobs?filters[user][id][$eq]=${userId}&${populateQuery}`;

    // Use user's JWT if available, fallback to API token (same as employer profiles)
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
      console.error("getJobs: Response not OK. Status:", response.status, "Error:", errorText);
      return [];
    }

    const result = await response.json();
    return result?.data || [];
  } catch (error) {
    console.error("getJobs: Error fetching jobs:", error);
    return [];
  }
}

/**
 * Get a single job by slug for public viewing
 */
export async function getJobBySlug(slug: string): Promise<Job | null> {
  try {
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    return await fetchJobBySlug(slug, apiToken);
  } catch (error) {
    console.error("Error fetching job by slug:", error);
    return null;
  }
}

/**
 * Get jobs by company ID (for company detail page)
 */
export async function getJobsByCompany(companyId: number | string): Promise<Job[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    // Use same populate query as job.api.ts - populate[company]=* with explicit nested relations
    const populateQuery = "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company]=*&populate[company][populate][logo][fields][0]=id&populate[company][populate][logo][fields][1]=url&populate[company][populate][logo][fields][2]=name&populate[company][populate][logo][fields][3]=alternativeText&populate[company][populate][logo][fields][4]=formats&populate[company][populate][socialLinks]=*";
    // Filter for approved and active jobs by company
    const url = `${strapiUrl}/api/jobs?filters[$and][0][approvalStatus][$eq]=Approved&filters[$and][1][isActive][$eq]=true&filters[$and][2][company][id][$eq]=${companyId}&${populateQuery}&pagination[limit]=1000`;

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
    console.error("Error fetching jobs by company:", error);
    return [];
  }
}
