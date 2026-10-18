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

export type EmployerProfileRecord = {
  id?: number;
  documentId?: string;
  user?: LinkedUser;
  [key: string]: unknown;
};

const DEFAULT_POPULATE =
  "populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=url&populate[profilePicture][fields][2]=name&populate[profilePicture][fields][3]=alternativeText&populate[profilePicture][fields][4]=formats&" +
  "populate[company]=*&" +
  "populate[company][populate][logo][fields][0]=id&populate[company][populate][logo][fields][1]=url&populate[company][populate][logo][fields][2]=name&populate[company][populate][logo][fields][3]=alternativeText&populate[company][populate][logo][fields][4]=formats&" +
  "populate[company][populate][socialLinks]=*&" +
  "populate[user][fields][0]=id&populate[user][fields][1]=documentId&populate[user][fields][2]=username&populate[user][fields][3]=email&populate[user][fields][4]=type";

function authTokens(options: {
  authToken?: string | null;
  fallbackAuthToken?: string | null;
}) {
  return [options.authToken, options.fallbackAuthToken];
}

export function matchesEmployerUser(
  profile: EmployerProfileRecord,
  userId?: string | number | null,
  userDocumentId?: string | null
) {
  const linkedUser = profile.user;
  if (linkedUser == null) return false;

  if (typeof linkedUser === "number" || typeof linkedUser === "string") {
    return (
      String(linkedUser) === String(userId) ||
      (userDocumentId != null && String(linkedUser) === String(userDocumentId))
    );
  }

  return (
    (userDocumentId != null &&
      linkedUser.documentId != null &&
      String(linkedUser.documentId) === String(userDocumentId)) ||
    (userId != null && String(linkedUser.id) === String(userId))
  );
}

async function fetchProfileByDocumentId(
  documentId: string,
  populateQuery: string,
  tokens: Array<string | undefined | null>
): Promise<EmployerProfileRecord | null> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return null;

  const urls = [
    `${strapiUrl}/api/employer-profiles/${documentId}?${populateQuery}`,
    `${strapiUrl}/api/employer-profiles/${documentId}?status=draft&${populateQuery}`,
    `${strapiUrl}/api/employer-profiles?filters[documentId][$eq]=${encodeURIComponent(documentId)}&${populateQuery}&pagination[limit]=1`,
  ];

  for (const url of urls) {
    const response = await fetchWithAuthFallback(url, tokens, {
      cache: "no-store",
    });
    if (!response.ok) {
      await response.text().catch(() => "");
      continue;
    }
    const result = await response.json().catch(() => ({}));
    const rows = Array.isArray(result?.data)
      ? result.data
      : result?.data
        ? [result.data]
        : [];
    if (rows[0]) return rows[0] as EmployerProfileRecord;
  }

  return null;
}

async function resolveEmployerProfileDocumentIdFromUser(options: {
  authToken?: string | null;
  fallbackAuthToken?: string | null;
}): Promise<string | null> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return null;

  const response = await fetchWithAuthFallback(
    `${strapiUrl}/api/users/me?populate[employer_profile][fields][0]=documentId&populate[employer_profile][fields][1]=id`,
    authTokens(options),
    { cache: "no-store" }
  );

  if (!response.ok) {
    await response.text().catch(() => "");
    return null;
  }

  const me = await response.json().catch(() => ({}));
  const profile = me?.employer_profile;
  if (!profile) return null;
  if (typeof profile === "string") return profile;
  if (typeof profile === "object" && profile.documentId) {
    return String(profile.documentId);
  }
  return null;
}

/**
 * Resolve employer profile without filters[user] (Invalid key user on this Strapi).
 * 1) users/me → employer_profile
 * 2) optional session documentId
 * 3) list + match populated user
 */
export async function findEmployerProfileForUser(options: {
  userId?: string | number | null;
  userDocumentId?: string | null;
  profileDocumentId?: string | null;
  authToken?: string | null;
  fallbackAuthToken?: string | null;
  populateQuery?: string;
}): Promise<EmployerProfileRecord | null> {
  const populateQuery = options.populateQuery || DEFAULT_POPULATE;
  const tokens = authTokens(options);

  const fromUser = await resolveEmployerProfileDocumentIdFromUser({
    authToken: options.authToken,
    fallbackAuthToken: options.fallbackAuthToken,
  });
  if (fromUser) {
    const byUser = await fetchProfileByDocumentId(
      fromUser,
      populateQuery,
      tokens
    );
    if (byUser) return byUser;
  }

  if (options.profileDocumentId) {
    const byId = await fetchProfileByDocumentId(
      options.profileDocumentId,
      populateQuery,
      tokens
    );
    if (
      byId &&
      (!byId.user ||
        matchesEmployerUser(byId, options.userId, options.userDocumentId))
    ) {
      return byId;
    }
  }

  if (options.userId == null && options.userDocumentId == null) {
    return null;
  }

  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return null;

  const response = await fetchWithAuthFallback(
    `${strapiUrl}/api/employer-profiles?${populateQuery}&pagination[pageSize]=100&sort[0]=updatedAt:desc`,
    tokens,
    { cache: "no-store" }
  );

  if (!response.ok) {
    await response.text().catch(() => "");
    return null;
  }

  const result = await response.json().catch(() => ({}));
  const profiles: EmployerProfileRecord[] = Array.isArray(result?.data)
    ? result.data
    : result?.data
      ? [result.data]
      : [];

  return (
    profiles.find((profile) =>
      matchesEmployerUser(profile, options.userId, options.userDocumentId)
    ) || null
  );
}
