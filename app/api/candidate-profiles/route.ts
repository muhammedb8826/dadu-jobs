import { NextRequest, NextResponse } from "next/server";
import { fetchWithAuthFallback, getStrapiURL } from "@/lib/strapi/client";
import { getSession, updateSession } from "@/lib/auth/session";
import { isEmployer, isCandidate } from "@/lib/auth/rbac";
import { findCandidateProfileForUser } from "@/lib/strapi/candidate-profile";

const SKILL_LEVELS = new Set(["Beginner", "Intermediate", "Expert"]);

/** Map UI / legacy levels to Strapi skill.level enum. */
function normalizeSkillLevel(level?: string | null): string {
  const value = String(level || "").trim();
  if (SKILL_LEVELS.has(value)) return value;
  const lower = value.toLowerCase();
  if (lower === "advanced" || lower === "proficient") return "Intermediate";
  if (lower === "junior" || lower === "basic") return "Beginner";
  if (lower === "senior" || lower === "master") return "Expert";
  return "Intermediate";
}

async function ensureSkillId(options: {
  strapiUrl: string;
  skillName: string;
  level: string;
  userJwt?: string;
  apiToken?: string;
}): Promise<string | number | null> {
  const level = normalizeSkillLevel(options.level);
  const tokens = [options.userJwt, options.apiToken];

  const checkResponse = await fetchWithAuthFallback(
    `${options.strapiUrl}/api/skills?filters[skillName][$eq]=${encodeURIComponent(options.skillName)}&filters[level][$eq]=${encodeURIComponent(level)}&pagination[limit]=1`,
    tokens,
    { cache: "no-store" }
  );

  if (checkResponse.ok) {
    const existing = await checkResponse.json().catch(() => ({}));
    const rows = Array.isArray(existing?.data)
      ? existing.data
      : existing?.data
        ? [existing.data]
        : [];
    if (rows[0]) {
      return rows[0].documentId || rows[0].id || null;
    }
  }

  const createResponse = await fetchWithAuthFallback(
    `${options.strapiUrl}/api/skills`,
    tokens,
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          skillName: options.skillName,
          level,
        },
      }),
    }
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text().catch(() => "");
    console.error(
      `Failed to create skill "${options.skillName}":`,
      createResponse.status,
      errorText
    );
    return null;
  }

  const created = await createResponse.json().catch(() => ({}));
  return created?.data?.documentId || created?.data?.id || null;
}

async function linkSkillsToProfile(options: {
  strapiUrl: string;
  profileRef: string | number;
  skillIds: Array<string | number>;
  userJwt?: string;
  apiToken?: string;
}) {
  const tokens = [options.userJwt, options.apiToken];
  await Promise.all(
    options.skillIds.map(async (skillId) => {
      try {
        const response = await fetchWithAuthFallback(
          `${options.strapiUrl}/api/skills/${skillId}`,
          tokens,
          {
            method: "PUT",
            body: JSON.stringify({
              data: { candidate_profile: options.profileRef },
            }),
          }
        );
        if (!response.ok) {
          console.error(
            "Failed to link skill to profile:",
            skillId,
            await response.text().catch(() => "")
          );
        }
      } catch (error) {
        console.error("Failed to link skill to candidate profile:", skillId, error);
      }
    })
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
    const candidateId = searchParams.get("id");
    const documentId = searchParams.get("documentId");
    const myProfile = searchParams.get("myProfile") === "true";
    const claimDocumentId = searchParams.get("claimDocumentId");

    // Build populate query for candidate profile
    // Skills are manyToOne relation - populate only specific fields to avoid reverse relation issues
    // Education and experience are components - can be populated with *
    // profilePicture and resume are media fields - populate only needed fields to avoid reverse relations
    // Include user id/documentId so we can match the logged-in user in app code.
    // Strapi Content API rejects filters[user] with "Invalid key user".
    const populateQuery = "populate[skills][fields][0]=id&populate[skills][fields][1]=skillName&populate[skills][fields][2]=level&populate[education]=*&populate[experience]=*&populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=name&populate[profilePicture][fields][2]=url&populate[profilePicture][fields][3]=alternativeText&populate[profilePicture][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=name&populate[resume][fields][2]=url&populate[resume][fields][3]=mime&populate[resume][fields][4]=size&populate[user][fields][0]=id&populate[user][fields][1]=documentId&populate[user][fields][2]=username&populate[user][fields][3]=email&populate[user][fields][4]=type";

    let url: string;
    
    // If candidate wants to view their own profile
    if (myProfile && isCandidate(session)) {
      let mine = await findCandidateProfileForUser({
        userId: session.userId,
        userDocumentId: session.userDocumentId,
        profileDocumentId: session.candidateProfileDocumentId,
        authToken: session.jwt,
        fallbackAuthToken: apiToken,
        populateQuery,
      });

      // Reclaim an unowned / own profile via documentId from client localStorage
      if (!mine && claimDocumentId && typeof claimDocumentId === "string") {
        const claimed = await findCandidateProfileForUser({
          profileDocumentId: claimDocumentId,
          authToken: session.jwt,
          fallbackAuthToken: apiToken,
          populateQuery,
        });
        const ownerId = claimed?.ownerUserId;
        const unowned = ownerId == null || ownerId === "";
        const ownedByMe =
          ownerId != null && String(ownerId) === String(session.userId);
        if (claimed && (unowned || ownedByMe)) {
          mine = claimed;
        }
      }

      if (mine?.documentId && mine.documentId !== session.candidateProfileDocumentId) {
        await updateSession({
          candidateProfileDocumentId: mine.documentId,
          candidateProfileId: mine.id,
        });
      }
      return NextResponse.json({ data: mine, meta: {} }, { status: 200 });
    } else if (candidateId) {
      // Employers can view any candidate, candidates can only view their own
      if (!isEmployer(session)) {
        return NextResponse.json(
          { error: "Access denied. Only employers can view other candidate profiles." },
          { status: 403 }
        );
      }
      url = `${strapiUrl}/api/candidate-profiles/${candidateId}?${populateQuery}`;
    } else if (documentId) {
      if (!isEmployer(session)) {
        return NextResponse.json(
          { error: "Access denied. Only employers can view other candidate profiles." },
          { status: 403 }
        );
      }
      url = `${strapiUrl}/api/candidate-profiles/${documentId}?${populateQuery}`;
    } else {
      // List all candidates - only employers can do this
      if (!isEmployer(session)) {
        return NextResponse.json(
          { error: "Access denied. Only employers can view candidate profiles." },
          { status: 403 }
        );
      }
      url = `${strapiUrl}/api/candidate-profiles?${populateQuery}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Strapi fetch error:", { 
        status: response.status, 
        error: result,
        url: url,
        session: { userId: session.userId, role: session.userType }
      });
      
      const errorMessage =
        result?.error?.message ||
        result?.error ||
        result?.message ||
        "Failed to fetch candidate profiles";
      
      // Provide helpful message for permission errors
      if (result?.error?.message?.includes("Invalid key")) {
        console.error("PERMISSION ERROR: The Authenticated role needs 'find' permission on User (plugin::users-permissions.user) in Strapi Settings → Roles");
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Candidate profile fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch candidate profiles";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST handler for creating candidate profiles
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only candidates can create/update their own candidate profiles
    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can manage candidate profiles." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || !body.data) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const userId = Number(session.userId);

    // Check if profile already exists for this user (without filters[user])
    const existingProfile = await findCandidateProfileForUser({
      userId: session.userId,
      userDocumentId: session.userDocumentId,
      profileDocumentId: session.candidateProfileDocumentId,
      authToken: userJwt,
      fallbackAuthToken: apiToken,
      populateQuery: "populate[user][fields][0]=id&populate[user][fields][1]=documentId",
    });

    const existingProfileId: number | string | null = existingProfile?.id ?? null;
    const existingProfileDocumentId: string | null =
      existingProfile?.documentId ?? null;

    if (existingProfile) {
      console.log("Existing candidate profile found, will update:", {
        profileId: existingProfileId,
        documentId: existingProfileDocumentId,
        userId,
      });
    }

    // Prepare profile data
    const profileData = { ...body.data };
    
    // Remove id/documentId if present (belongs in the URL, not body)
    delete profileData.id;
    delete profileData.documentId;
    // Strapi REST rejects `user` on this content-type ("Invalid key user").
    // Ownership is tracked via ownerUserId (filterable integer) instead.
    delete profileData.user;
    profileData.ownerUserId = userId;

    // Resolve skill IDs; link after save (skills relation is owned by skill.candidate_profile)
    const skillIdsToLink: (number | string)[] = [];
    if (Array.isArray(profileData.skills)) {
      for (const skillItem of profileData.skills) {
        if (typeof skillItem === "number" || typeof skillItem === "string") {
          skillIdsToLink.push(skillItem);
          continue;
        }
        if (typeof skillItem === "object" && skillItem !== null) {
          const skill = skillItem as {
            id?: number;
            documentId?: string;
            skillName?: string;
            level?: string;
          };
          if (skill.documentId || skill.id) {
            skillIdsToLink.push(skill.documentId || skill.id!);
            continue;
          }
          if (skill.skillName && skill.level) {
            const skillId = await ensureSkillId({
              strapiUrl,
              skillName: skill.skillName,
              level: skill.level,
              userJwt,
              apiToken,
            });
            if (skillId) skillIdsToLink.push(skillId);
          }
        }
      }
    }
    delete profileData.skills;

    // Drop empty component rows that would fail date/blocks validation
    if (Array.isArray(profileData.education)) {
      profileData.education = (profileData.education as Array<Record<string, unknown>>).filter(
        (edu) => edu.institution || edu.degree || edu.fieldOfStudy
      );
    }
    if (Array.isArray(profileData.experience)) {
      profileData.experience = (profileData.experience as Array<Record<string, unknown>>)
        .filter((exp) => exp.companyName || exp.jobTitle)
        .map((exp) => {
          const next = { ...exp };
          // blocks field must be an array of nodes, never a plain string
          if (typeof next.description === "string") {
            const text = next.description.trim();
            next.description = text
              ? [{ type: "paragraph", children: [{ type: "text", text }] }]
              : [];
          }
          if (next.isCurrent) {
            delete next.endDate;
          }
          return next;
        });
    }

    // Handle education and experience - they're components
    // KEEP IDs in component data - Strapi 5 uses IDs to identify which component to update
    // If ID is present, it updates; if not, it creates a new one
    // No need to remove IDs - Strapi handles it automatically

    const saveWithToken = async (token?: string) => {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Prefer documentId for Strapi 5 updates
      const targetId = existingProfileDocumentId || existingProfileId;
      if (targetId) {
        return fetch(`${strapiUrl}/api/candidate-profiles/${targetId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ data: profileData }),
        });
      }

      return fetch(`${strapiUrl}/api/candidate-profiles`, {
        method: "POST",
        headers,
        body: JSON.stringify({ data: profileData }),
      });
    };

    // Prefer user JWT so Strapi can attach ctx.state.user on create/update.
    // Fall back to API token only if JWT is missing.
    if (!userJwt && !apiToken) {
      return NextResponse.json(
        { error: "No authentication token available" },
        { status: 500 }
      );
    }

    const parseResult = async (res: Response) => {
      const responseText = await res.text();
      let parsed: Record<string, unknown> = {};
      if (responseText) {
        try {
          parsed = JSON.parse(responseText);
        } catch {
          parsed = { error: responseText };
        }
      }
      return parsed;
    };

    let response = await saveWithToken(userJwt || apiToken);
    let result = await parseResult(response);

    // If Strapi hasn't been restarted yet, ownerUserId may be unknown — retry without it
    const firstError =
      typeof result?.error === "object" && result.error
        ? (result.error as { message?: string }).message
        : "";
    if (
      !response.ok &&
      response.status === 400 &&
      String(firstError).toLowerCase().includes("owneruserid")
    ) {
      delete profileData.ownerUserId;
      response = await saveWithToken(userJwt || apiToken);
      result = await parseResult(response);
    }

    if (
      !response.ok &&
      userJwt &&
      apiToken &&
      (response.status === 401 || response.status === 403)
    ) {
      console.warn(
        "Candidate profile save with user JWT failed, retrying with API token..."
      );
      response = await saveWithToken(apiToken);
      result = await parseResult(response);
    }

    if (!response.ok) {
      const strapiError = result?.error as
        | { message?: string; details?: unknown }
        | string
        | undefined;
      const errorMessage =
        (typeof strapiError === "object" ? strapiError?.message : strapiError) ||
        (result?.message as string | undefined) ||
        "Failed to save candidate profile";

      console.error("Candidate profile Strapi save failed:", {
        status: response.status,
        error: result,
        existingProfileId,
      });
      
      return NextResponse.json(
        {
          error: errorMessage,
          details: typeof strapiError === "object" ? strapiError?.details : undefined,
        },
        { status: response.status || 500 }
      );
    }

    const savedProfile = (result as { data?: { id?: number; documentId?: string } })?.data;
    const savedProfileRef = savedProfile?.documentId || savedProfile?.id;
    if (savedProfileRef && skillIdsToLink.length > 0) {
      await linkSkillsToProfile({
        strapiUrl,
        profileRef: savedProfileRef,
        skillIds: skillIdsToLink,
        userJwt,
        apiToken,
      });
    }

    // Persist profile ids on the session so reopen/edit can load this profile
    if (savedProfile?.documentId || savedProfile?.id) {
      await updateSession({
        candidateProfileDocumentId: savedProfile.documentId,
        candidateProfileId: savedProfile.id,
      });
    }

    return NextResponse.json(result, { status: existingProfileId ? 200 : 201 });
  } catch (error) {
    console.error("Candidate profile save error:", error);
    const causeCode =
      typeof error === "object" &&
      error &&
      "cause" in error &&
      typeof (error as { cause?: { code?: string } }).cause === "object"
        ? (error as { cause?: { code?: string } }).cause?.code
        : undefined;

    const errorMessage =
      causeCode === "ECONNREFUSED"
        ? "Cannot connect to the API server. Please make sure Strapi is running on the configured URL."
        : error instanceof Error
          ? error.message
          : "Failed to save candidate profile";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT handler for updating candidate profiles
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only candidates can update their own candidate profiles
    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can manage candidate profiles." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || !body.data) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    // 1. Identify the document to update (The ID/documentId comes from the BODY, but goes in the URL)
    const targetIdentifier = body.data.documentId || body.data.id;
    
    if (!targetIdentifier) {
      return NextResponse.json(
        { error: "Missing profile identifier" },
        { status: 400 }
      );
    }

    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return NextResponse.json(
        { error: "Strapi API is not configured" },
        { status: 500 }
      );
    }

    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;

    // Verify the profile belongs to the logged-in user (no filters[user])
    const userProfile = await findCandidateProfileForUser({
      userId: session.userId,
      userDocumentId: session.userDocumentId,
      profileDocumentId:
        session.candidateProfileDocumentId ||
        (typeof body.data.documentId === "string" ? body.data.documentId : null),
      authToken: userJwt,
      fallbackAuthToken: apiToken,
      populateQuery: "populate[user][fields][0]=id&populate[user][fields][1]=documentId",
    });

    if (userProfile) {
      const profileId = body.data.id ? Number(body.data.id) : null;
      const profileDocumentId = body.data.documentId || null;
      if (
        (profileId && userProfile.id !== profileId) ||
        (profileDocumentId && userProfile.documentId !== profileDocumentId)
      ) {
        return NextResponse.json(
          { error: "Access denied. You can only update your own profile." },
          { status: 403 }
        );
      }
    }

    // 2. DESTRUCTURE & RECONSTRUCT (The "Safe Guard")
    // We pull out only the fields we want to SAVE
    // We EXPLICITLY ignore 'id', 'documentId', 'user', 'createdAt', etc.
    const {
      fullName,
      phone,
      bio,
      profilePicture,
      resume,
      skills,
      education,
      experience,
    } = body.data;

    // 3. FETCH EXISTING SKILLS ONLY IF NOT PROVIDED
    // If skills are provided in the request (even empty), we treat that as the source of truth.
    const skillsProvided = Array.isArray(skills);
    let existingSkillIds: (string | number)[] = [];

    if (!skillsProvided) {
      try {
        const currentProfileResponse = await fetch(
          `${strapiUrl}/api/candidate-profiles/${targetIdentifier}?populate[skills][fields][0]=id&populate[skills][fields][1]=documentId`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
              ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
            },
          }
        );
        
        if (currentProfileResponse.ok) {
          const currentProfile = await currentProfileResponse.json().catch(() => ({}));
          const profileData = currentProfile?.data;
          if (profileData?.skills && Array.isArray(profileData.skills)) {
            existingSkillIds = profileData.skills
              .map((skill: { id?: number; documentId?: string }) => skill.documentId || skill.id)
              .filter((id: number | string | undefined): id is number | string => id !== undefined);
          }
        }
      } catch (error) {
        console.warn("Could not fetch existing skills, proceeding with new skills only:", error);
      }
    }

    // 4. PROCESS SKILLS — create/find via Content API, then link from skill side
    // (skills relation is mappedBy on candidate-profile, so it can't be set on the profile body)
    const finalSkillIds: (string | number)[] = skillsProvided ? [] : [...existingSkillIds];
    const failedSkills: string[] = [];

    if (Array.isArray(skills)) {
      for (const item of skills) {
        if (typeof item === "number" || typeof item === "string") {
          if (!finalSkillIds.includes(item)) finalSkillIds.push(item);
          continue;
        }

        if (typeof item === "object" && item !== null) {
          const skill = item as {
            id?: number;
            documentId?: string;
            skillName?: string;
            level?: string;
          };

          if (skill.documentId || skill.id) {
            const skillId = skill.documentId || skill.id!;
            if (!finalSkillIds.includes(skillId)) finalSkillIds.push(skillId);
            continue;
          }

          if (skill.skillName && skill.level) {
            const skillId = await ensureSkillId({
              strapiUrl,
              skillName: skill.skillName,
              level: skill.level,
              userJwt,
              apiToken,
            });
            if (skillId) {
              if (!finalSkillIds.includes(skillId)) finalSkillIds.push(skillId);
            } else {
              failedSkills.push(
                `${skill.skillName} (${normalizeSkillLevel(skill.level)})`
              );
            }
          } else if (skill.skillName) {
            failedSkills.push(`${skill.skillName} (missing level)`);
          }
        }
      }
    }

    const uniqueSkillIds = [...new Set(finalSkillIds)];

    if (skillsProvided && failedSkills.length > 0 && uniqueSkillIds.length === 0) {
      return NextResponse.json(
        { error: `Failed to save skills: ${failedSkills.join(", ")}` },
        { status: 400 }
      );
    }
    if (failedSkills.length > 0) {
      console.warn("Some skills could not be saved:", failedSkills);
    }

    // 5. BUILD THE PAYLOAD
    // Important: We do NOT include 'id' or 'documentId' inside this object
    // For Components, remove IDs to avoid "Invalid key id" errors
    // Strapi will treat them as fresh entries (may replace existing ones)
    const finalUpdateData: Record<string, unknown> = {
      ...(fullName !== undefined && { fullName }),
      ...(phone !== undefined && { phone }),
      ...(bio !== undefined && { bio }),
      ownerUserId: Number(session.userId),
      // Handle media fields - extract ID if it's an object
      ...(profilePicture !== undefined && {
        profilePicture: typeof profilePicture === 'object' && profilePicture !== null
          ? (profilePicture as { id?: number }).id || profilePicture
          : profilePicture
      }),
      ...(resume !== undefined && {
        resume: typeof resume === 'object' && resume !== null
          ? (resume as { id?: number }).id || resume
          : resume
      }),
      // Skills are linked after save from the owning side (skill.candidate_profile)
      // Remove IDs from components to avoid "Invalid key id" errors
      // Strapi will create new entries (this may replace existing ones)
      ...(education !== undefined && Array.isArray(education) && {
        education: education.map((edu: Record<string, unknown>) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, documentId, ...rest } = edu;
          return rest;
        })
      }),
      ...(experience !== undefined && Array.isArray(experience) && {
        experience: experience.map((exp: Record<string, unknown>) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, documentId, ...rest } = exp;
          return rest;
        })
      }),
    };

    // 6. EXECUTE PROFILE UPDATE & POPULATE
    const response = await fetchWithAuthFallback(
      `${strapiUrl}/api/candidate-profiles/${targetIdentifier}?populate=*`,
      [userJwt, apiToken],
      {
        method: "PUT",
        body: JSON.stringify({ data: finalUpdateData }),
      }
    );

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
      // Retry without ownerUserId if Strapi schema isn't updated yet
      const putErrorMsg =
        (result?.error as { message?: string })?.message || "";
      if (
        response.status === 400 &&
        String(putErrorMsg).toLowerCase().includes("owneruserid")
      ) {
        delete finalUpdateData.ownerUserId;
        const retry = await fetchWithAuthFallback(
          `${strapiUrl}/api/candidate-profiles/${targetIdentifier}?populate=*`,
          [userJwt, apiToken],
          {
            method: "PUT",
            body: JSON.stringify({ data: finalUpdateData }),
          }
        );
        const retryText = await retry.text();
        try {
          result = JSON.parse(retryText);
        } catch {
          result = { error: retryText };
        }
        if (retry.ok) {
          const saved = (result as { data?: { id?: number; documentId?: string } })?.data;
          const profileRef = saved?.documentId || saved?.id || targetIdentifier;
          if (skillsProvided && uniqueSkillIds.length > 0) {
            await linkSkillsToProfile({
              strapiUrl,
              profileRef,
              skillIds: uniqueSkillIds,
              userJwt,
              apiToken,
            });
          }
          if (saved?.documentId || saved?.id) {
            await updateSession({
              candidateProfileDocumentId: saved.documentId,
              candidateProfileId: saved.id,
            });
          }
          return NextResponse.json(result, { status: 200 });
        }
      }

      console.error("Strapi PUT Error:", result);
      const errorMessage =
        (result?.error as { message?: string })?.message ||
        (result?.error as string) ||
        result?.message ||
        "Failed to update candidate profile";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    const saved = (result as { data?: { id?: number; documentId?: string } })?.data;
    const profileRef = saved?.documentId || saved?.id || targetIdentifier;
    if (skillsProvided && uniqueSkillIds.length > 0) {
      await linkSkillsToProfile({
        strapiUrl,
        profileRef,
        skillIds: uniqueSkillIds,
        userJwt,
        apiToken,
      });
    }
    if (saved?.documentId || saved?.id) {
      await updateSession({
        candidateProfileDocumentId: saved.documentId,
        candidateProfileId: saved.id,
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("PUT Route Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
