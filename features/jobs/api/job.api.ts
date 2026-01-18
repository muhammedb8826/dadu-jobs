import { getStrapiURL } from "@/lib/strapi/client";
import type { Job, Category } from "../types/job.types";

// Populate categories and company with only needed fields (not * to avoid invalid relations)
// Note: Regular fields like title, description, location, etc. are returned by default
const POPULATE_QUERY = "populate[categories][fields][0]=id&populate[categories][fields][1]=name&populate[categories][fields][2]=slug&populate[salary]=*&populate[company][fields][0]=id&populate[company][fields][1]=name&populate[company][fields][2]=slug&populate[user][fields][0]=id";

/**
 * Get authentication headers for Strapi API calls
 */
function getAuthHeaders(apiToken?: string, userJwt?: string): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiToken) {
    headers["Authorization"] = `Bearer ${apiToken}`;
  } else if (userJwt) {
    headers["Authorization"] = `Bearer ${userJwt}`;
  }

  return headers;
}

/**
 * Fetch categories from Strapi
 */
export async function fetchCategories(apiToken?: string): Promise<Category[]> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    throw new Error("Strapi API is not configured");
  }

  const response = await fetch(`${strapiUrl}/api/categories?populate=*`, {
    method: "GET",
    headers: getAuthHeaders(apiToken),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }

  const result = await response.json();
  return result.data || [];
}

/**
 * Fetch a single job by ID (supports both numeric ID and documentId for Strapi 5)
 * In Strapi 5, the API prefers Document IDs (strings) over numeric IDs.
 * If a numeric ID is provided and returns 404, we fallback to filtering by the id field.
 */
export async function fetchJobById(
  jobId: string | number,
  apiToken?: string,
  userJwt?: string
): Promise<Job> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    throw new Error("Strapi API is not configured");
  }

  // Try the standard REST endpoint first
  const url = `${strapiUrl}/api/jobs/${jobId}?${POPULATE_QUERY}`;
  console.log("fetchJobById: Fetching from URL:", url);

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(apiToken, userJwt),
    cache: "no-store",
  });

  if (!response.ok) {
    // If 404, specifically try searching by the numeric ID field
    // This handles the case where Strapi 5 interprets numeric IDs as documentIds
    if (response.status === 404) {
      console.log("fetchJobById: 404 received, trying filter by id field...");
      const filterUrl = `${strapiUrl}/api/jobs?filters[id][$eq]=${jobId}&${POPULATE_QUERY}&pagination[limit]=1`;
      console.log("fetchJobById: Trying filter URL:", filterUrl);
      
      const filterRes = await fetch(filterUrl, {
        method: "GET",
        headers: getAuthHeaders(apiToken, userJwt),
        cache: "no-store",
      });

      if (filterRes.ok) {
        const filterData = await filterRes.json();
        if (filterData?.data && filterData.data.length > 0) {
          console.log("fetchJobById: Found job via filter:", filterData.data[0]?.title);
          return filterData.data[0]; // Return the first match
        }
      }
    }

    // If all attempts fail, return a clear error message
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("fetchJobById: Response not OK. Status:", response.status);
    console.error("fetchJobById: Error response:", errorText);
    
    throw new Error(`Job ${jobId} not found.`);
  }

  const result = await response.json();
  console.log("fetchJobById: Successfully fetched job:", result?.data?.title);
  return result.data;
}

/**
 * Fetch jobs list (optionally filtered by user ID)
 */
export async function fetchJobs(
  userId?: number,
  apiToken?: string,
  userJwt?: string
): Promise<{ data: Job[]; meta?: unknown }> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    throw new Error("Strapi API is not configured");
  }

  let url = `${strapiUrl}/api/jobs?${POPULATE_QUERY}`;
  if (userId) {
    url = `${strapiUrl}/api/jobs?filters[user][id][$eq]=${userId}&${POPULATE_QUERY}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(apiToken, userJwt),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch jobs");
  }

  return await response.json();
}

/**
 * Get employer's company ID from their profile
 */
export async function getEmployerCompanyId(
  userId: number,
  apiToken?: string,
  userJwt?: string
): Promise<string | number | null> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    throw new Error("Strapi API is not configured");
  }

  const profileRes = await fetch(
    `${strapiUrl}/api/employer-profiles?filters[user][id][$eq]=${userId}&populate[company][fields][0]=id&populate[company][fields][1]=documentId&pagination[limit]=1`,
    {
      headers: getAuthHeaders(apiToken, userJwt),
    }
  );

  const profileData = await profileRes.json().catch(() => ({}));
  if (profileData?.data?.[0]?.company) {
    // Prefer documentId for Strapi 5, fallback to id
    return profileData.data[0].company.documentId || profileData.data[0].company.id;
  }

  return null;
}

/**
 * Check if a job code already exists
 */
export async function checkJobCodeExists(
  jobCode: string,
  excludeJobId?: string | number,
  apiToken?: string
): Promise<boolean> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    throw new Error("Strapi API is not configured");
  }

  const response = await fetch(
    `${strapiUrl}/api/jobs?filters[jobCode][$eq]=${encodeURIComponent(jobCode)}&pagination[limit]=10`,
    {
      method: "GET",
      headers: getAuthHeaders(apiToken),
    }
  );

  if (!response.ok) {
    return false;
  }

  const result = await response.json().catch(() => ({}));
  if (result?.data && Array.isArray(result.data)) {
    // If excludeJobId is provided, check if any job with this code is NOT the excluded job
    if (excludeJobId) {
      const conflictingJob = result.data.find(
        (job: { id?: number; documentId?: string }) =>
          job.id?.toString() !== excludeJobId?.toString() &&
          job.documentId !== excludeJobId
      );
      return !!conflictingJob;
    }
    // Otherwise, just check if any job exists with this code
    return result.data.length > 0;
  }

  return false;
}

/**
 * Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Verify job ownership
 */
export async function verifyJobOwnership(
  jobId: string | number,
  userId: number,
  apiToken?: string
): Promise<boolean> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    throw new Error("Strapi API is not configured");
  }

  const response = await fetch(
    `${strapiUrl}/api/jobs/${jobId}?populate[user][fields][0]=id`,
    {
      method: "GET",
      headers: getAuthHeaders(apiToken),
    }
  );

  if (!response.ok) {
    return false;
  }

  const result = await response.json().catch(() => ({}));
  const job = result?.data;

  return job?.user?.id === userId;
}

/**
 * Create a new job
 */
export async function createJob(
  jobData: Record<string, unknown>,
  userJwt?: string,
  apiToken?: string
): Promise<Job> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    throw new Error("Strapi API is not configured");
  }

  const response = await fetch(`${strapiUrl}/api/jobs`, {
    method: "POST",
    headers: getAuthHeaders(apiToken, userJwt),
    body: JSON.stringify({ data: jobData }),
  });

  const responseText = await response.text();
  let result: Record<string, unknown> = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { error: responseText };
    }
  }

  if (!response.ok) {
    const errorMessage: string =
      (result?.error as { message?: string })?.message ||
      (result?.error as string) ||
      (result?.message as string) ||
      "Failed to create job posting";
    throw new Error(errorMessage);
  }

  return result.data as Job;
}

/**
 * Update an existing job
 */
export async function updateJob(
  jobId: string | number,
  updateData: Record<string, unknown>,
  userJwt?: string,
  apiToken?: string
): Promise<Job> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    throw new Error("Strapi API is not configured");
  }

  const response = await fetch(`${strapiUrl}/api/jobs/${jobId}`, {
    method: "PUT",
    headers: getAuthHeaders(apiToken, userJwt),
    body: JSON.stringify({ data: updateData }),
  });

  const responseText = await response.text();
  let result: Record<string, unknown> = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { error: responseText };
    }
  }

  if (!response.ok) {
    const errorMessage: string =
      (result?.error as { message?: string })?.message ||
      (result?.error as string) ||
      (result?.message as string) ||
      "Failed to update job posting";
    throw new Error(errorMessage);
  }

  return result.data as Job;
}

/**
 * Delete a job by ID
 */
export async function deleteJob(
  jobId: string | number,
  userJwt?: string,
  apiToken?: string
): Promise<void> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) {
    throw new Error("Strapi API is not configured");
  }

  const response = await fetch(`${strapiUrl}/api/jobs/${jobId}`, {
    method: "DELETE",
    headers: getAuthHeaders(apiToken, userJwt),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    let errorMessage = `Failed to delete job (Status: ${response.status})`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson?.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      if (errorText && errorText !== "Unknown error") {
        errorMessage = errorText;
      }
    }
    
    throw new Error(errorMessage);
  }
}
