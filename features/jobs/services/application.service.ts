import { getStrapiURL } from "@/lib/strapi/client";
import type { Application } from "../types/application.types";

function linkedUserId(user: unknown): string | null {
  if (user == null) return null;
  if (typeof user === "number" || typeof user === "string") return String(user);
  if (typeof user === "object" && "id" in user && (user as { id?: unknown }).id != null) {
    return String((user as { id: unknown }).id);
  }
  return null;
}

async function fetchApplications(
  url: string,
  tokens: Array<string | undefined>,
  label: string
): Promise<Application[] | null> {
  // Prefer JWT, then API token, then no auth (Public find is enabled locally).
  // Sending an invalid Bearer token causes 401 even when Public find would succeed.
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

    // Retry on auth failures (invalid JWT/API token, or role Forbidden)
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
 * Get applications for a candidate user.
 * Avoids filters[user] (often Forbidden / Invalid key) — matches linked user in app code.
 */
export async function getApplications(
  userId: number,
  sessionJwt?: string
): Promise<Application[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    const populateQuery =
      "populate[job][populate][categories][fields][0]=id&populate[job][populate][categories][fields][1]=name&populate[job][populate][categories][fields][2]=slug&populate[job][populate][salary]=*&populate[job][populate][company]=*&populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name&populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&populate[user][fields][3]=type";

    const url = `${strapiUrl}/api/applications?${populateQuery}&sort[0]=createdAt:desc&pagination[pageSize]=100`;

    const applications = await fetchApplications(
      url,
      [sessionJwt, apiToken],
      "getApplications"
    );
    if (!applications) return [];

    const wanted = String(userId);
    return applications.filter((app) => linkedUserId(app.user) === wanted);
  } catch (error) {
    console.error("Error fetching applications:", error);
    return [];
  }
}

/**
 * Get applications for an employer's jobs
 */
export async function getEmployerApplications(
  employerUserId: number,
  sessionJwt?: string
): Promise<Application[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const populateQuery =
      "populate[job][fields][0]=id&populate[job][fields][1]=title&populate[job][fields][2]=slug&" +
      "populate[job][populate][user][fields][0]=id&" +
      "populate[job][populate][company][fields][0]=id&populate[job][populate][company][fields][1]=name&" +
      "populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats&" +
      "populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&" +
      "populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name";

    // Avoid filters[job][user] — match employer via populated job.user in app code.
    const url = `${strapiUrl}/api/applications?${populateQuery}&sort[0]=createdAt:desc&pagination[pageSize]=100`;

    const applications = await fetchApplications(
      url,
      [sessionJwt, apiToken],
      "getEmployerApplications"
    );
    if (!applications) return [];

    const wanted = String(employerUserId);
    return applications.filter((app) => {
      const jobUser = (app.job as { user?: unknown } | undefined)?.user;
      return linkedUserId(jobUser) === wanted;
    });
  } catch (error) {
    console.error("Error fetching employer applications:", error);
    return [];
  }
}

/**
 * Get job IDs that a user has applied to
 */
export async function getAppliedJobIds(
  userId: number,
  sessionJwt?: string
): Promise<Set<number>> {
  try {
    const applications = await getApplications(userId, sessionJwt);
    const jobIds = new Set<number>();
    applications.forEach((app) => {
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
