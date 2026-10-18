import { fetchWithAuthFallback, getStrapiURL } from "@/lib/strapi/client";
import { fetchJobBySlug, getEmployerCompanyId } from "../api/job.api";
import type { Job } from "../types/job.types";

function linkedUserId(user: unknown): string | null {
  if (user == null) return null;
  if (typeof user === "number" || typeof user === "string") return String(user);
  if (typeof user === "object" && "id" in user && (user as { id?: unknown }).id != null) {
    return String((user as { id: unknown }).id);
  }
  return null;
}

function companyMatches(
  company: unknown,
  wanted: string | number | null | undefined
): boolean {
  if (wanted == null || company == null) return false;
  const w = String(wanted);
  if (typeof company === "number" || typeof company === "string") {
    return String(company) === w;
  }
  if (typeof company === "object") {
    const c = company as { id?: unknown; documentId?: unknown };
    return (
      (c.documentId != null && String(c.documentId) === w) ||
      (c.id != null && String(c.id) === w)
    );
  }
  return false;
}

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
    const populateQuery =
      "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company]=*&populate[company][populate][logo][fields][0]=id&populate[company][populate][logo][fields][1]=url&populate[company][populate][logo][fields][2]=name&populate[company][populate][logo][fields][3]=alternativeText&populate[company][populate][logo][fields][4]=formats&populate[company][populate][socialLinks]=*";
    const url = `${strapiUrl}/api/jobs?filters[$and][0][approvalStatus][$eq]=Approved&filters[$and][1][isActive][$eq]=true&pagination[limit]=1000&${populateQuery}`;

    const response = await fetchWithAuthFallback(url, [apiToken], {
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(
        "getPublicJobs: Response not OK. Status:",
        response.status,
        "Error:",
        errorText
      );
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
 * Get jobs for employer dashboard (by linked user, or by employer company).
 * Company fallback covers jobs created before user-linking was reliable.
 */
export async function getJobs(userId: number, sessionJwt?: string): Promise<Job[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      console.error("getJobs: Strapi URL is not configured");
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery =
      "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company]=*&populate[company][populate][logo][fields][0]=id&populate[company][populate][logo][fields][1]=url&populate[company][populate][logo][fields][2]=name&populate[company][populate][logo][fields][3]=alternativeText&populate[company][populate][logo][fields][4]=formats&populate[company][populate][socialLinks]=*&populate[user][fields][0]=id";
    // Avoid filters[user] — list and match in app code
    const url = `${strapiUrl}/api/jobs?${populateQuery}&pagination[pageSize]=100&sort[0]=updatedAt:desc`;

    const [response, companyId] = await Promise.all([
      fetchWithAuthFallback(url, [sessionJwt, apiToken], { cache: "no-store" }),
      getEmployerCompanyId(userId, apiToken, sessionJwt).catch(() => null),
    ]);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(
        "getJobs: Response not OK. Status:",
        response.status,
        "Error:",
        errorText
      );
      return [];
    }

    const result = await response.json();
    const jobs: Job[] = Array.isArray(result?.data)
      ? result.data
      : result?.data
        ? [result.data]
        : [];
    const wantedUser = String(userId);
    return jobs.filter((job) => {
      if (linkedUserId((job as { user?: unknown }).user) === wantedUser) {
        return true;
      }
      return companyMatches(
        (job as { company?: unknown }).company,
        companyId
      );
    });
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
    const populateQuery =
      "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company]=*&populate[company][populate][logo][fields][0]=id&populate[company][populate][logo][fields][1]=url&populate[company][populate][logo][fields][2]=name&populate[company][populate][logo][fields][3]=alternativeText&populate[company][populate][logo][fields][4]=formats&populate[company][populate][socialLinks]=*";
    const url = `${strapiUrl}/api/jobs?filters[$and][0][approvalStatus][$eq]=Approved&filters[$and][1][isActive][$eq]=true&filters[$and][2][company][id][$eq]=${companyId}&${populateQuery}&pagination[limit]=1000`;

    const response = await fetchWithAuthFallback(url, [apiToken], {
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
