import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuthFallback, getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";

type SavedJobRow = {
  id?: number;
  documentId?: string;
  job?: {
    id?: number | string;
    documentId?: string;
  } | null;
  user?: { id?: number | string } | number | string | null;
};

function linkedUserId(user: unknown): string | null {
  if (user == null) return null;
  if (typeof user === "number" || typeof user === "string") return String(user);
  if (typeof user === "object" && "id" in user && (user as { id?: unknown }).id != null) {
    return String((user as { id: unknown }).id);
  }
  return null;
}

function jobMatches(job: unknown, jobKey: string): boolean {
  if (job == null) return false;
  if (typeof job === "number" || typeof job === "string") {
    return String(job) === jobKey;
  }
  if (typeof job === "object") {
    const j = job as { id?: unknown; documentId?: unknown };
    return (
      (j.documentId != null && String(j.documentId) === jobKey) ||
      (j.id != null && String(j.id) === jobKey)
    );
  }
  return false;
}

async function resolveJobDocumentId(
  jobKey: string | number,
  tokens: Array<string | undefined>
): Promise<string | null> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return null;

  const key = String(jobKey);

  const byDocument = await fetchWithAuthFallback(
    `${strapiUrl}/api/jobs/${encodeURIComponent(key)}?fields[0]=documentId&fields[1]=id`,
    tokens,
    { cache: "no-store" }
  );
  if (byDocument.ok) {
    const result = await byDocument.json().catch(() => ({}));
    if (result?.data?.documentId) return String(result.data.documentId);
  }

  if (/^\d+$/.test(key)) {
    const byId = await fetchWithAuthFallback(
      `${strapiUrl}/api/jobs?filters[id][$eq]=${key}&fields[0]=documentId&fields[1]=id&pagination[limit]=1`,
      tokens,
      { cache: "no-store" }
    );
    if (byId.ok) {
      const result = await byId.json().catch(() => ({}));
      const row = Array.isArray(result?.data) ? result.data[0] : result?.data;
      if (row?.documentId) return String(row.documentId);
    }
  }

  return null;
}

/**
 * Load the candidate's saved jobs via /users/me (JWT).
 * Avoids filters[user] and does not require a working API token.
 */
/** Returns null when /users/me failed; [] when the user has no saved jobs. */
async function listSavedJobsViaMe(
  userJwt: string,
  populateJobDetails = false
): Promise<SavedJobRow[] | null> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl || !userJwt) return null;

  const populate = populateJobDetails
    ? "populate[saved_jobs][populate][job][populate][categories][fields][0]=id&populate[saved_jobs][populate][job][populate][categories][fields][1]=name&populate[saved_jobs][populate][job][populate][categories][fields][2]=slug&populate[saved_jobs][populate][job][populate][salary]=*&populate[saved_jobs][populate][job][populate][company]=*&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][0]=id&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][1]=url&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][2]=name&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][3]=alternativeText&populate[saved_jobs][populate][job][populate][company][populate][logo][fields][4]=formats"
    : "populate[saved_jobs][fields][0]=documentId&populate[saved_jobs][fields][1]=id&populate[saved_jobs][populate][job][fields][0]=id&populate[saved_jobs][populate][job][fields][1]=documentId";

  const response = await fetch(`${strapiUrl}/api/users/me?${populate}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userJwt}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("listSavedJobsViaMe failed:", response.status, text);
    return null;
  }

  const me = await response.json().catch(() => ({}));
  const rows = me?.saved_jobs;
  if (!Array.isArray(rows)) return [];
  return rows as SavedJobRow[];
}

/**
 * Fallback list when /users/me populate is unavailable.
 * Matches by populated user when present.
 */
async function listSavedJobsFallback(
  userId: number,
  tokens: Array<string | undefined>,
  populateJob = false
): Promise<SavedJobRow[]> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return [];

  const populate = populateJob
    ? "populate[job][populate][categories][fields][0]=id&populate[job][populate][categories][fields][1]=name&populate[job][populate][categories][fields][2]=slug&populate[job][populate][salary]=*&populate[job][populate][company]=*&populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats&populate[user][fields][0]=id"
    : "populate[job][fields][0]=id&populate[job][fields][1]=documentId&populate[user][fields][0]=id";

  const response = await fetchWithAuthFallback(
    `${strapiUrl}/api/saved-jobs?${populate}&sort[0]=createdAt:desc&pagination[pageSize]=100`,
    tokens,
    { cache: "no-store" }
  );

  if (!response.ok) return [];

  const result = await response.json().catch(() => ({}));
  const rows: SavedJobRow[] = Array.isArray(result?.data)
    ? result.data
    : result?.data
      ? [result.data]
      : [];
  const wanted = String(userId);
  const withUser = rows.filter((row) => linkedUserId(row.user) === wanted);
  // If user relation is hidden, keep rows (JWT may already be scoped / best-effort)
  if (withUser.length > 0) return withUser;
  if (rows.every((row) => linkedUserId(row.user) == null)) return rows;
  return withUser;
}

async function listMine(
  userId: number,
  userJwt: string | undefined,
  apiToken: string | undefined,
  populateJobDetails = false
): Promise<SavedJobRow[]> {
  if (userJwt) {
    const viaMe = await listSavedJobsViaMe(userJwt, populateJobDetails);
    if (viaMe != null) return viaMe;
  }
  return listSavedJobsFallback(userId, [apiToken, userJwt], populateJobDetails);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can save jobs." },
        { status: 403 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userId = Number(session.userId);
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (jobId) {
      const mine = await listMine(userId, session.jwt, apiToken, false);
      const isSaved = mine.some((row) => jobMatches(row.job, jobId));
      return NextResponse.json({ saved: isSaved }, { status: 200 });
    }

    const mine = await listMine(userId, session.jwt, apiToken, true);
    // Shape for clients expecting { data: SavedJob[] }
    return NextResponse.json(
      {
        data: mine.map((row) => ({
          ...row,
          user: { id: userId },
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Saved jobs fetch error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch saved jobs";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can save jobs." },
        { status: 403 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const jobId = body.jobId || body.data?.jobId;
    const userId = Number(session.userId);
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userJwt = session.jwt;
    const tokens = [userJwt, apiToken];

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    if (!userJwt) {
      return NextResponse.json(
        { error: "Session JWT is required to save jobs" },
        { status: 401 }
      );
    }

    const jobDocumentId = await resolveJobDocumentId(jobId, tokens);
    if (!jobDocumentId) {
      return NextResponse.json(
        { error: "Failed to fetch job information" },
        { status: 400 }
      );
    }

    const existing = await listMine(userId, userJwt, apiToken, false);
    const already = existing.find(
      (row) =>
        jobMatches(row.job, String(jobId)) ||
        jobMatches(row.job, jobDocumentId)
    );
    // Idempotent: UI may show unsaved while Strapi already has the row
    if (already) {
      return NextResponse.json(
        { data: already, alreadySaved: true },
        { status: 200 }
      );
    }

    // Omit user — lifecycle/middleware sets it from JWT
    const createUrl = `${strapiUrl}/api/saved-jobs`;
    const response = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({ data: { job: jobDocumentId } }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      const errorMessage =
        result?.error?.message ||
        result?.error ||
        result?.message ||
        "Failed to save job";
      console.error("Save job error:", errorMessage, result);
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    const result = await response.json().catch(() => ({}));
    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    console.error("Save job error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to save job";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can unsave jobs." },
        { status: 403 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const userId = Number(session.userId);
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userJwt = session.jwt;

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    if (!userJwt) {
      return NextResponse.json(
        { error: "Session JWT is required to unsave jobs" },
        { status: 401 }
      );
    }

    const jobDocumentId = await resolveJobDocumentId(jobId, [userJwt, apiToken]);
    const mine = await listMine(userId, userJwt, apiToken, false);
    let match = mine.find(
      (row) =>
        jobMatches(row.job, jobId) ||
        (jobDocumentId != null && jobMatches(row.job, jobDocumentId))
    );

    // Last resort: find by job relation filter (works when /users/me populate is empty)
    if (!match?.documentId && jobDocumentId) {
      const byJob = await fetch(
        `${strapiUrl}/api/saved-jobs?filters[job][documentId][$eq]=${encodeURIComponent(jobDocumentId)}&populate[job][fields][0]=documentId&populate[user][fields][0]=id&pagination[pageSize]=20`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userJwt}`,
          },
          cache: "no-store",
        }
      );
      if (byJob.ok) {
        const result = await byJob.json().catch(() => ({}));
        const rows: SavedJobRow[] = Array.isArray(result?.data)
          ? result.data
          : [];
        match =
          rows.find((row) => linkedUserId(row.user) === String(userId)) ||
          rows[0];
      }
    }

    if (!match?.documentId) {
      console.error("Unsave: no match", {
        jobId,
        jobDocumentId,
        mineCount: mine.length,
        mineJobs: mine.map((r) => r.job),
      });
      return NextResponse.json(
        { error: "Saved job not found" },
        { status: 404 }
      );
    }

    // Delete with JWT first (owner), then API token if available
    let deleteResponse = await fetch(
      `${strapiUrl}/api/saved-jobs/${match.documentId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userJwt}`,
        },
      }
    );

    if (
      !deleteResponse.ok &&
      apiToken &&
      (deleteResponse.status === 401 ||
        deleteResponse.status === 403 ||
        deleteResponse.status === 404)
    ) {
      await deleteResponse.text().catch(() => "");
      deleteResponse = await fetch(
        `${strapiUrl}/api/saved-jobs/${match.documentId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );
    }

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text().catch(() => "Unknown error");
      console.error("Delete saved job error:", errorText);
      return NextResponse.json(
        { error: "Failed to delete saved job" },
        { status: deleteResponse.status }
      );
    }

    return NextResponse.json(
      { message: "Job unsaved successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unsave job error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to unsave job";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
