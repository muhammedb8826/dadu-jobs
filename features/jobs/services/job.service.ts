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
    // Populate categories and company with only needed fields (not * to avoid invalid relations)
    const populateQuery = "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company][fields][0]=id&populate[company][fields][1]=name&populate[company][fields][2]=slug";
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
    // Populate categories and company with only needed fields
    const populateQuery = "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company][fields][0]=id&populate[company][fields][1]=name&populate[company][fields][2]=slug";
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
