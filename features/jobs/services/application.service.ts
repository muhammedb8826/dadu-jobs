import { getStrapiURL } from "@/lib/strapi/client";
import type { Application } from "../types/application.types";

/**
 * Get applications for a candidate user
 */
export async function getApplications(userId: number, sessionJwt?: string): Promise<Application[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    
    // Populate job with all necessary fields including company and logo
    const populateQuery = "populate[job][populate][categories][fields][0]=id&populate[job][populate][categories][fields][1]=name&populate[job][populate][categories][fields][2]=slug&populate[job][populate][salary]=*&populate[job][populate][company]=*&populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name&populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&populate[user][fields][3]=type";
    
    const url = `${strapiUrl}/api/applications?filters[user][id][$eq]=${userId}&${populateQuery}&sort[0]=createdAt:desc`;

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
      console.error("getApplications: Response not OK. Status:", response.status, "Error:", errorText);
      return [];
    }

    const result = await response.json();
    return result?.data || [];
  } catch (error) {
    console.error("Error fetching applications:", error);
    return [];
  }
}

/**
 * Get applications for an employer's jobs
 */
export async function getEmployerApplications(employerUserId: number, sessionJwt?: string): Promise<Application[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery =
      "populate[job][fields][0]=id&populate[job][fields][1]=title&populate[job][fields][2]=slug&" +
      "populate[job][populate][company][fields][0]=id&populate[job][populate][company][fields][1]=name&" +
      "populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats&" +
      "populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&" +
      "populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name";

    const url = `${strapiUrl}/api/applications?filters[job][user][id][$eq]=${employerUserId}&${populateQuery}&sort[0]=createdAt:desc`;

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
      console.error("getEmployerApplications: Response not OK. Status:", response.status, "Error:", errorText);
      return [];
    }

    const result = await response.json();
    return result?.data || [];
  } catch (error) {
    console.error("Error fetching employer applications:", error);
    return [];
  }
}

/**
 * Get job IDs that a user has applied to
 */
export async function getAppliedJobIds(userId: number): Promise<Set<number>> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return new Set();
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    
    // Only populate the job id field for performance
    const url = `${strapiUrl}/api/applications?filters[user][id][$eq]=${userId}&populate[job][fields][0]=id`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return new Set();
    }

    const result = await response.json();
    const applications = result?.data || [];
    
    // Extract job IDs into a Set for fast lookup
    const jobIds = new Set<number>();
    applications.forEach((app: Application) => {
      if (app.job?.id) {
        jobIds.add(app.job.id);
      }
    });
    
    return jobIds;
  } catch (error) {
    console.error("Error fetching applied job IDs:", error);
    return new Set();
  }
}
