import { fetchWithAuthFallback, getStrapiURL } from "@/lib/strapi/client";

type LinkedUser =
  | {
      id?: number | string;
      documentId?: string;
    }
  | number
  | string
  | null
  | undefined;

export type CandidateProfileRecord = {
  id?: number;
  documentId?: string;
  ownerUserId?: number | string | null;
  user?: LinkedUser;
  [key: string]: unknown;
};

const DEFAULT_POPULATE =
  "populate[skills][fields][0]=id&populate[skills][fields][1]=skillName&populate[skills][fields][2]=level&populate[education]=*&populate[experience]=*&populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=name&populate[profilePicture][fields][2]=url&populate[profilePicture][fields][3]=alternativeText&populate[profilePicture][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=name&populate[resume][fields][2]=url&populate[resume][fields][3]=mime&populate[resume][fields][4]=size&populate[user][fields][0]=id&populate[user][fields][1]=documentId&populate[user][fields][2]=username&populate[user][fields][3]=email&populate[user][fields][4]=type";

function authTokens(options: {
  authToken?: string | null;
  fallbackAuthToken?: string | null;
}) {
  return [options.authToken, options.fallbackAuthToken];
}

export function matchesCandidateUser(
  profile: CandidateProfileRecord,
  userId?: string | number | null,
  userDocumentId?: string | null
) {
  if (
    userId != null &&
    profile.ownerUserId != null &&
    String(profile.ownerUserId) === String(userId)
  ) {
    return true;
  }

  const linkedUser = profile.user;
  if (linkedUser == null) return false;

  if (typeof linkedUser === "number" || typeof linkedUser === "string") {
    return (
      String(linkedUser) === String(userId) ||
      (userDocumentId != null && String(linkedUser) === String(userDocumentId))
    );
  }

  return (
    (userId != null && String(linkedUser.id) === String(userId)) ||
    (userDocumentId != null &&
      linkedUser.documentId != null &&
      String(linkedUser.documentId) === String(userDocumentId))
  );
}

async function fetchProfileByDocumentId(
  documentId: string,
  populateQuery: string,
  tokens: Array<string | undefined | null>
): Promise<CandidateProfileRecord | null> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return null;

  const response = await fetchWithAuthFallback(
    `${strapiUrl}/api/candidate-profiles/${documentId}?${populateQuery}`,
    tokens,
    { cache: "no-store" }
  );

  if (!response.ok) return null;
  const result = await response.json().catch(() => ({}));
  return (result?.data as CandidateProfileRecord) || null;
}

async function listCandidateProfiles(
  populateQuery: string,
  tokens: Array<string | undefined | null>,
  extraQuery = ""
): Promise<CandidateProfileRecord[]> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return [];

  const response = await fetchWithAuthFallback(
    `${strapiUrl}/api/candidate-profiles?${populateQuery}&pagination[pageSize]=100&sort[0]=updatedAt:desc${extraQuery ? `&${extraQuery}` : ""}`,
    tokens,
    { cache: "no-store" }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(
      "Failed to list candidate profiles:",
      response.status,
      errorText
    );
    return [];
  }

  const result = await response.json().catch(() => ({}));
  return Array.isArray(result?.data)
    ? result.data
    : result?.data
      ? [result.data]
      : [];
}

/**
 * Fetch a candidate profile for a user.
 * Prefer documentId (from session), then ownerUserId filter, then relation match.
 * Avoids filters[user], which Strapi rejects as "Invalid key user".
 */
export async function findCandidateProfileForUser(options: {
  userId?: string | number | null;
  userDocumentId?: string | null;
  profileDocumentId?: string | null;
  authToken?: string | null;
  fallbackAuthToken?: string | null;
  populateQuery?: string;
}): Promise<CandidateProfileRecord | null> {
  const populateQuery = options.populateQuery || DEFAULT_POPULATE;
  const tokens = authTokens(options);

  if (options.profileDocumentId) {
    const byId = await fetchProfileByDocumentId(
      options.profileDocumentId,
      populateQuery,
      tokens
    );
    if (byId) return byId;
  }

  const profiles = await listCandidateProfiles(populateQuery, tokens);
  return (
    profiles.find((profile) =>
      matchesCandidateUser(profile, options.userId, options.userDocumentId)
    ) || null
  );
}

/**
 * List candidate profiles and keep those linked to any of the given user IDs.
 */
export async function findCandidateProfilesForUsers(options: {
  userIds: Array<string | number>;
  authToken?: string | null;
  fallbackAuthToken?: string | null;
  populateQuery?: string;
}): Promise<CandidateProfileRecord[]> {
  const wanted = new Set(options.userIds.map(String));
  if (wanted.size === 0) return [];

  const populateQuery = options.populateQuery || DEFAULT_POPULATE;
  const tokens = authTokens(options);

  const profiles = await listCandidateProfiles(populateQuery, tokens);
  return profiles.filter((profile) => {
    for (const userId of wanted) {
      if (matchesCandidateUser(profile, userId, null)) return true;
    }
    return false;
  });
}
