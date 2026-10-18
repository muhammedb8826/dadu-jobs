import { getStrapiURL } from "@/lib/strapi/client";
import type { SavedJob } from "../types/saved-job.types";

function linkedUserId(user: unknown): string | null {
  if (user == null) return null;
  if (typeof user === "number" || typeof user === "string") return String(user);
  if (typeof user === "object" && "id" in user && (user as { id?: unknown }).id != null) {
    return String((user as { id: unknown }).id);
  }
  return null;
}

async function fetchSavedJobs(
  url: string,
  tokens: Array<string | undefined>,
  label: string
): Promise<SavedJob[] | null> {
  // Prefer JWT, then API token, then no auth (Public find is enabled locally).
  // An invalid Bearer token returns 401 even when unauthenticated find works.
  const uniqueTokens = [...new Set(tokens.filter(Boolean))] as string[];
  const attempts: Array<string | undefined> = [...uniqueTokens, undefined];

  let lastStatus = 0;
  let lastError = "";

  for (let i = 0; i < attempts.length; i++) {
    const token = attempts[i];
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    if (response.ok) {
      const result = await response.json().catch(() => ({}));
      return Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : [];
    }

    lastStatus = response.status;
    lastError = await response.text().catch(() => "Unknown error");

    if (response.status === 401 || response.status === 403) {
      continue;
    }
    break;
  }

  console.error(
    `${label}: Response not OK. Status:`,
    lastStatus,
    "Error:",
    lastError
  );
  return null;
}

/**
 * Get saved jobs for a candidate user.
 * Avoids filters[user] — matches linked user in app code.
 */
export async function getSavedJobs(
  userId: number,
  sessionJwt?: string
): Promise<SavedJob[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    const populateQuery =
      "populate[job][populate][categories][fields][0]=id&populate[job][populate][categories][fields][1]=name&populate[job][populate][categories][fields][2]=slug&populate[job][populate][salary]=*&populate[job][populate][company]=*&populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats&populate[user][fields][0]=id";

    const url = `${strapiUrl}/api/saved-jobs?${populateQuery}&sort[0]=createdAt:desc&pagination[pageSize]=100`;

    const savedJobs = await fetchSavedJobs(
      url,
      [sessionJwt, apiToken],
      "getSavedJobs"
    );
    if (!savedJobs) return [];

    const wanted = String(userId);
    return savedJobs.filter((item) => linkedUserId(item.user) === wanted);
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
    const saved = await getSavedJobs(userId);
    return saved.some((item) => item.job?.id === jobId);
  } catch (error) {
    console.error("Error checking if job is saved:", error);
    return false;
  }
}
