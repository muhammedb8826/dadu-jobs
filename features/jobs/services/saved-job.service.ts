import { getStrapiURL } from "@/lib/strapi/client";
import type { SavedJob } from "../types/saved-job.types";

function linkedUserId(user: unknown): string | null {
  if (user == null) return null;
  if (typeof user === "number" || typeof user === "string") return String(user);
  if (
    typeof user === "object" &&
    "id" in user &&
    (user as { id?: unknown }).id != null
  ) {
    return String((user as { id: unknown }).id);
  }
  return null;
}

/**
 * Preferred path: /users/me populate saved_jobs (JWT).
 * Works even when API token is missing/invalid and avoids filters[user].
 */
async function getSavedJobsViaMe(sessionJwt: string): Promise<SavedJob[] | null> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return null;

  const populate =
    "populate[saved_jobs][populate][job][populate][categories][fields][0]=id&populate[saved_jobs][populate][job][populate][categories][fields][1]=name&populate[saved_jobs][populate][job][populate][categories][fields][2]=slug&populate[saved_jobs][populate][job][populate][salary]=*&populate[saved_jobs][populate][job][populate][company]=*&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][0]=id&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][1]=url&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][2]=name&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][3]=alternativeText&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][4]=formats";

  const response = await fetch(`${strapiUrl}/api/users/me?${populate}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionJwt}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error("getSavedJobsViaMe failed:", response.status, errorText);
    return null;
  }

  const me = await response.json().catch(() => ({}));
  const rows = me?.saved_jobs;
  if (!Array.isArray(rows)) return [];
  return rows as SavedJob[];
}

async function fetchSavedJobs(
  url: string,
  tokens: Array<string | undefined>,
  label: string
): Promise<SavedJob[] | null> {
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
      return Array.isArray(result?.data)
        ? result.data
        : result?.data
          ? [result.data]
          : [];
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
 */
export async function getSavedJobs(
  userId: number,
  sessionJwt?: string
): Promise<SavedJob[]> {
  try {
    if (sessionJwt) {
      const viaMe = await getSavedJobsViaMe(sessionJwt);
      if (viaMe != null) return viaMe;
    }

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
      [apiToken, sessionJwt],
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
export async function isJobSaved(
  userId: number,
  jobId: number | string,
  sessionJwt?: string
): Promise<boolean> {
  try {
    const saved = await getSavedJobs(userId, sessionJwt);
    const key = String(jobId);
    return saved.some((item) => {
      const job = item.job;
      if (!job) return false;
      return String(job.id) === key || String(job.documentId) === key;
    });
  } catch (error) {
    console.error("Error checking if job is saved:", error);
    return false;
  }
}
