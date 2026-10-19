import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuthFallback, getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isCandidate } from "@/lib/auth/rbac";
import { APPLICATION_STATUSES } from "@/features/jobs";

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

  // Prefer direct documentId lookup (UI often sends documentId)
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

type AppRow = {
  documentId?: string;
  job?: { id?: number; documentId?: string } | null;
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

async function listMyApplicationsViaMe(userJwt: string): Promise<AppRow[]> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return [];

  const response = await fetch(
    `${strapiUrl}/api/users/me?populate[applications][fields][0]=documentId&populate[applications][populate][job][fields][0]=id&populate[applications][populate][job][fields][1]=documentId`,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userJwt}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) return [];
  const me = await response.json().catch(() => ({}));
  return Array.isArray(me?.applications) ? me.applications : [];
}

/** Find existing application for this user+job (doesn't rely on /users/me alone). */
async function findExistingApplication(options: {
  userId: number;
  userJwt: string;
  apiToken?: string;
  jobId: string;
  jobDocumentId: string;
}): Promise<AppRow | undefined> {
  const { userId, userJwt, apiToken, jobId, jobDocumentId } = options;

  const viaMe = await listMyApplicationsViaMe(userJwt);
  const fromMe = viaMe.find(
    (app) =>
      jobMatches(app.job, jobId) || jobMatches(app.job, jobDocumentId)
  );
  if (fromMe) return fromMe;

  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return undefined;

  // Filter by job (allowed); match user in app code
  const url = `${strapiUrl}/api/applications?filters[job][documentId][$eq]=${encodeURIComponent(jobDocumentId)}&populate[job][fields][0]=id&populate[job][fields][1]=documentId&populate[user][fields][0]=id&pagination[pageSize]=50`;
  const response = await fetchWithAuthFallback(url, [apiToken, userJwt], {
    cache: "no-store",
  });
  if (!response.ok) return undefined;

  const result = await response.json().catch(() => ({}));
  const rows: AppRow[] = Array.isArray(result?.data) ? result.data : [];
  const wanted = String(userId);
  return (
    rows.find((row) => linkedUserId(row.user) === wanted) ||
    // If user is hidden on JWT responses, any row for this job is a conflict for this session
    (rows.length === 1 ? rows[0] : undefined)
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const jobId = searchParams.get("jobId");
    const jobDocumentId = searchParams.get("jobDocumentId");

    // Build populate query
    const populateQuery = "populate[job][populate][categories][fields][0]=id&populate[job][populate][categories][fields][1]=name&populate[job][populate][categories][fields][2]=slug&populate[job][populate][salary]=*&populate[job][populate][company]=*&populate[job][populate][company][populate][logo][fields][0]=id&populate[job][populate][company][populate][logo][fields][1]=url&populate[job][populate][company][populate][logo][fields][2]=name&populate[job][populate][company][populate][logo][fields][3]=alternativeText&populate[job][populate][company][populate][logo][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=url&populate[resume][fields][2]=name&populate[user][fields][0]=id&populate[user][fields][1]=username&populate[user][fields][2]=email&populate[user][fields][3]=type";

    // Prefer job filters (allowed). Avoid filters[user] — match in app code below.
    let url = `${strapiUrl}/api/applications?${populateQuery}&sort[0]=createdAt:desc&pagination[pageSize]=100`;
    if (jobDocumentId) {
      url = `${strapiUrl}/api/applications?filters[job][documentId][$eq]=${jobDocumentId}&${populateQuery}&sort[0]=createdAt:desc`;
    } else if (jobId) {
      url = `${strapiUrl}/api/applications?filters[job][id][$eq]=${jobId}&${populateQuery}&sort[0]=createdAt:desc`;
    }

    const tokens = [session.jwt, apiToken].filter(Boolean) as string[];
    let response: Response | null = null;
    let lastError = "";
    for (let i = 0; i < (tokens.length || 1); i++) {
      const token = tokens[i];
      response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });
      if (response.ok) break;
      lastError = await response.text().catch(() => "Unknown error");
      if (
        (response.status === 401 || response.status === 403) &&
        i < tokens.length - 1
      ) {
        continue;
      }
      console.error(
        "getApplications: Response not OK. Status:",
        response.status,
        "Error:",
        lastError
      );
      return NextResponse.json(
        { error: "Failed to fetch applications" },
        { status: response.status }
      );
    }

    const result = await response!.json();
    let data = Array.isArray(result?.data)
      ? result.data
      : result?.data
        ? [result.data]
        : [];

    if (userId) {
      data = data.filter((app: { user?: { id?: number | string } | number | string }) => {
        const linked = app.user;
        if (linked == null) return false;
        if (typeof linked === "number" || typeof linked === "string") {
          return String(linked) === String(userId);
        }
        return String(linked.id) === String(userId);
      });
    }

    return NextResponse.json({ ...result, data }, { status: 200 });
  } catch (error) {
    console.error("Applications fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch applications";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only candidates can create applications
    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can submit job applications." },
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

    if (!body || !body.data) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const {
      jobId,
      coverLetter,
      resumeId,
      selectedDegree,
      selectedFieldOfStudy,
      selectedCgpa,
      totalExperienceYears,
    } = body.data;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userJwt = session.jwt;

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 }
      );
    }

    if (!userJwt) {
      return NextResponse.json(
        { error: "Session JWT is required to apply" },
        { status: 401 }
      );
    }

    const tokens = [userJwt, apiToken];
    const jobDocumentId = await resolveJobDocumentId(jobId, tokens);
    if (!jobDocumentId) {
      return NextResponse.json(
        { error: "Failed to fetch job information" },
        { status: 400 }
      );
    }

    const already = await findExistingApplication({
      userId: Number(session.userId),
      userJwt,
      apiToken,
      jobId: String(jobId),
      jobDocumentId,
    });
    if (already) {
      return NextResponse.json(
        { data: already, alreadyApplied: true },
        { status: 200 }
      );
    }

    // Omit user — Document middleware / lifecycle sets it from JWT
    const applicationData: Record<string, unknown> = {
      job: jobDocumentId,
      applicationStatus: APPLICATION_STATUSES[0], // "Applied"
    };

    if (coverLetter) {
      applicationData.coverLetter = coverLetter;
    }

    if (resumeId) {
      applicationData.resume = Number(resumeId);
    }

    if (selectedDegree) {
      applicationData.selectedDegree = selectedDegree;
    }

    if (selectedFieldOfStudy) {
      applicationData.selectedFieldOfStudy = selectedFieldOfStudy;
    }

    if (selectedCgpa !== null && selectedCgpa !== undefined) {
      applicationData.selectedCgpa = Number(selectedCgpa);
    }

    if (totalExperienceYears !== null && totalExperienceYears !== undefined) {
      applicationData.totalExperienceYears = Number(totalExperienceYears);
    }

    let response = await fetch(`${strapiUrl}/api/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({ data: applicationData }),
    });

    // API-token fallback with explicit user if JWT create is forbidden
    if (
      !response.ok &&
      apiToken &&
      (response.status === 401 || response.status === 403)
    ) {
      await response.text().catch(() => "");
      response = await fetch(`${strapiUrl}/api/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          data: {
            ...applicationData,
            user: Number(session.userId),
          },
        }),
      });
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        result?.error?.message ||
        result?.error ||
        result?.message ||
        "Failed to submit application";
      console.error("Application creation error:", errorMessage, result);
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    console.error("Application submission error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to submit application";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
