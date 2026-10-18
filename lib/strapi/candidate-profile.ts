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
  user?: LinkedUser;
  [key: string]: unknown;
};

const DEFAULT_POPULATE =
  "populate[skills][fields][0]=id&populate[skills][fields][1]=documentId&populate[skills][fields][2]=skillName&populate[skills][fields][3]=level&populate[education]=*&populate[experience]=*&populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=name&populate[profilePicture][fields][2]=url&populate[profilePicture][fields][3]=alternativeText&populate[profilePicture][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=name&populate[resume][fields][2]=url&populate[resume][fields][3]=mime&populate[resume][fields][4]=size&populate[user][fields][0]=id&populate[user][fields][1]=documentId&populate[user][fields][2]=username&populate[user][fields][3]=email&populate[user][fields][4]=type";

function authTokens(options: {
  authToken?: string | null;
  fallbackAuthToken?: string | null;
}) {
  return [options.authToken, options.fallbackAuthToken];
}

/** Match a profile to a user via the populated `user` relation (documentId preferred). */
export function matchesCandidateUser(
  profile: CandidateProfileRecord,
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
): Promise<CandidateProfileRecord | null> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return null;

  const urls = [
    `${strapiUrl}/api/candidate-profiles/${documentId}?${populateQuery}`,
    // Strapi 5 draftAndPublish: drafts are hidden from the default published view
    `${strapiUrl}/api/candidate-profiles/${documentId}?status=draft&${populateQuery}`,
    `${strapiUrl}/api/candidate-profiles?filters[documentId][$eq]=${encodeURIComponent(documentId)}&${populateQuery}&pagination[limit]=1`,
    `${strapiUrl}/api/candidate-profiles?status=draft&filters[documentId][$eq]=${encodeURIComponent(documentId)}&${populateQuery}&pagination[limit]=1`,
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
    if (rows[0]) return rows[0] as CandidateProfileRecord;
  }

  return null;
}

async function listCandidateProfiles(
  populateQuery: string,
  tokens: Array<string | undefined | null>
): Promise<CandidateProfileRecord[]> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return [];

  const response = await fetchWithAuthFallback(
    `${strapiUrl}/api/candidate-profiles?${populateQuery}&pagination[pageSize]=100&sort[0]=updatedAt:desc`,
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
 * Resolve the candidate profile documentId from the authenticated user
 * (`/api/users/me?populate=candidate_profile`) — preferred after login.
 */
export async function resolveCandidateProfileDocumentIdFromUser(options: {
  authToken?: string | null;
  fallbackAuthToken?: string | null;
}): Promise<string | null> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return null;

  const response = await fetchWithAuthFallback(
    `${strapiUrl}/api/users/me?populate[candidate_profile][fields][0]=documentId&populate[candidate_profile][fields][1]=id`,
    authTokens(options),
    { cache: "no-store" }
  );

  if (!response.ok) {
    await response.text().catch(() => "");
    return null;
  }

  const me = await response.json().catch(() => ({}));
  const profile = me?.candidate_profile;
  if (!profile) return null;
  if (typeof profile === "string") return profile;
  if (typeof profile === "object" && profile.documentId) {
    return String(profile.documentId);
  }
  return null;
}

/**
 * Session documentId is safe: it lives in the httpOnly cookie with userId.
 * Allow unowned profiles via that hint (attach may lag), but never another user's.
 */
function isProfileAccessibleToUser(
  profile: CandidateProfileRecord,
  userId?: string | number | null,
  userDocumentId?: string | null
): boolean {
  // Missing `user` key usually means populate was stripped — allow via session hint only
  if (!Object.prototype.hasOwnProperty.call(profile, "user")) return true;
  if (profile.user == null) return true;
  return matchesCandidateUser(profile, userId, userDocumentId);
}

/**
 * Fetch a candidate profile for an authenticated user only.
 * Never returns a profile linked to a different user.
 *
 * Resolution order:
 * 1) session documentId — set on save in httpOnly cookie (works even if attach lags)
 * 2) users/me → candidate_profile
 * 3) list + match populated `user` relation
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
  const hasUserIdentity =
    options.userId != null || options.userDocumentId != null;

  // 1) Session documentId first — authoritative for the current browser session
  if (options.profileDocumentId && hasUserIdentity) {
    const byId = await fetchProfileByDocumentId(
      options.profileDocumentId,
      populateQuery,
      tokens
    );
    if (
      byId &&
      isProfileAccessibleToUser(byId, options.userId, options.userDocumentId)
    ) {
      return byId;
    }
  }

  // 2) Profile linked on the authenticated User (survives logout/login when attach works)
  const fromUser = await resolveCandidateProfileDocumentIdFromUser({
    authToken: options.authToken,
    fallbackAuthToken: options.fallbackAuthToken,
  });
  if (fromUser && fromUser !== options.profileDocumentId) {
    const byUserRelation = await fetchProfileByDocumentId(
      fromUser,
      populateQuery,
      tokens
    );
    if (
      byUserRelation &&
      isProfileAccessibleToUser(
        byUserRelation,
        options.userId,
        options.userDocumentId
      )
    ) {
      return byUserRelation;
    }
  }

  // 3) Fallback: list and match populated user relation
  if (!hasUserIdentity) {
    return null;
  }

  const profiles = await listCandidateProfiles(populateQuery, tokens);
  return (
    profiles.find((profile) =>
      matchesCandidateUser(profile, options.userId, options.userDocumentId)
    ) || null
  );
}

/**
 * Rebind helper: find an unowned profile with the same name + phone.
 * Used when session documentId was lost but the Strapi row still exists.
 */
export async function findUnownedCandidateProfileByContact(options: {
  fullName?: string | null;
  phone?: string | null;
  authToken?: string | null;
  fallbackAuthToken?: string | null;
}): Promise<CandidateProfileRecord | null> {
  const fullName = String(options.fullName || "").trim().toLowerCase();
  const phone = String(options.phone || "").trim();
  if (!fullName || !phone) return null;

  const profiles = await listCandidateProfiles(
    "populate[user][fields][0]=id&populate[user][fields][1]=documentId",
    authTokens(options)
  );

  return (
    profiles.find((profile) => {
      // Only trust rows where `user` was populated and is explicitly null.
      // If the key is missing, permissions hid the relation — do not reclaim.
      if (!Object.prototype.hasOwnProperty.call(profile, "user")) return false;
      if (profile.user != null) return false;
      const name = String(profile.fullName || "").trim().toLowerCase();
      const profilePhone = String(profile.phone || "").trim();
      return name === fullName && profilePhone === phone;
    }) || null
  );
}

/**
 * List candidate profiles linked to any of the given user IDs via populated `user`.
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

async function putUserCandidateProfileLink(options: {
  body: unknown;
  userJwt?: string | null;
  apiToken?: string | null;
  userId?: string | number | null;
}): Promise<boolean> {
  const strapiUrl = getStrapiURL();
  if (!strapiUrl) return false;

  const endpoints: Array<{
    url: string;
    tokens: Array<string | null | undefined>;
  }> = [
    { url: `${strapiUrl}/api/users/me`, tokens: [options.userJwt] },
  ];

  if (options.userId != null) {
    endpoints.push({
      url: `${strapiUrl}/api/users/${options.userId}`,
      tokens: [options.userJwt, options.apiToken],
    });
  }

  for (const endpoint of endpoints) {
    if (!endpoint.tokens.some(Boolean)) continue;
    const response = await fetchWithAuthFallback(
      endpoint.url,
      endpoint.tokens,
      {
        method: "PUT",
        body: JSON.stringify(options.body),
      }
    );
    if (response.ok) {
      await response.text().catch(() => "");
      return true;
    }
    await response.text().catch(() => "");
  }
  return false;
}

/**
 * Attach profile via User.candidate_profile (owning side of the oneToOne).
 * User owns this relation (same pattern as employer_profile) so /users/me works.
 */
export async function attachProfileToAuthenticatedUser(options: {
  profileDocumentId: string;
  userJwt?: string | null;
  apiToken?: string | null;
  userId?: string | number | null;
}): Promise<void> {
  if (!options.profileDocumentId) return;

  const linkBodies: unknown[] = [
    { candidate_profile: options.profileDocumentId },
    { candidate_profile: { connect: [options.profileDocumentId] } },
    { candidate_profile: { set: [options.profileDocumentId] } },
  ];

  for (const body of linkBodies) {
    const ok = await putUserCandidateProfileLink({
      body,
      userJwt: options.userJwt,
      apiToken: options.apiToken,
      userId: options.userId,
    });
    if (ok) return;
  }
}

/** Clear User.candidate_profile so this account no longer resolves another profile. */
export async function detachCandidateProfileFromAuthenticatedUser(options: {
  userJwt?: string | null;
  apiToken?: string | null;
  userId?: string | number | null;
  profileDocumentId?: string | null;
}): Promise<boolean> {
  const unlinkBodies: unknown[] = [
    { candidate_profile: null },
    { candidate_profile: { set: [] } },
    { candidate_profile: { disconnect: options.profileDocumentId ? [options.profileDocumentId] : [] } },
  ];

  for (const body of unlinkBodies) {
    const ok = await putUserCandidateProfileLink({
      body,
      userJwt: options.userJwt,
      apiToken: options.apiToken,
      userId: options.userId,
    });
    if (ok) return true;
  }
  return false;
}
