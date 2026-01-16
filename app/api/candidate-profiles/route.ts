import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isEmployer, isCandidate } from "@/lib/auth/rbac";

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

    // Build populate query for candidate profile
    // Skills are manyToOne relation - populate only specific fields to avoid reverse relation issues
    // Education and experience are components - can be populated with *
    // profilePicture and resume are media fields - populate only needed fields to avoid reverse relations
    const populateQuery = "populate[skills][fields][0]=id&populate[skills][fields][1]=skillName&populate[skills][fields][2]=level&populate[education]=*&populate[experience]=*&populate[profilePicture][fields][0]=id&populate[profilePicture][fields][1]=name&populate[profilePicture][fields][2]=url&populate[profilePicture][fields][3]=alternativeText&populate[profilePicture][fields][4]=formats&populate[resume][fields][0]=id&populate[resume][fields][1]=name&populate[resume][fields][2]=url&populate[resume][fields][3]=mime&populate[resume][fields][4]=size&populate[user][fields][0]=username&populate[user][fields][1]=email&populate[user][fields][2]=type";

    let url: string;
    
    // If candidate wants to view their own profile
    if (myProfile && isCandidate(session)) {
      const userId = Number(session.userId);
      url = `${strapiUrl}/api/candidate-profiles?filters[user][id][$eq]=${userId}&${populateQuery}`;
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
      console.error("Strapi fetch error:", { status: response.status, error: result });
      const errorMessage =
        result?.error?.message ||
        result?.message ||
        "Failed to fetch candidate profiles";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    // If candidate is fetching their own profile, return single object instead of array
    if (myProfile && isCandidate(session) && Array.isArray(result?.data) && result.data.length > 0) {
      return NextResponse.json({ data: result.data[0], meta: result.meta }, { status: 200 });
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

    // Check if profile already exists for this user
    const userProfileUrl = `${strapiUrl}/api/candidate-profiles?filters[user][id][$eq]=${userId}&populate=user`;
    
    const verifyResponse = await fetch(userProfileUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
    });

    let existingProfileId: number | null = null;
    
    if (verifyResponse.ok) {
      const verifyResult = await verifyResponse.json().catch(() => ({}));
      const userProfiles = Array.isArray(verifyResult?.data) ? verifyResult.data : (verifyResult?.data ? [verifyResult.data] : []);
      
      if (userProfiles.length > 0) {
        existingProfileId = userProfiles[0]?.id;
        console.log("Existing candidate profile found, will update:", { profileId: existingProfileId, userId });
      }
    }

    // Prepare profile data
    const profileData = { ...body.data };
    
    // Remove id if present (it's in the URL for PUT)
    delete profileData.id;
    
    // Associate with logged-in user
    profileData.user = userId;

    // Handle skills - they're a relation, so we need IDs (integer or documentId)
    // Skills can be: numbers/strings (existing skill IDs), or objects (new/updated skills)
    if (profileData.skills && Array.isArray(profileData.skills)) {
      const skillIds: (number | string)[] = [];
      
      for (const skillItem of profileData.skills) {
        // If it's already a number or string (ID), just use it
        if (typeof skillItem === "number" || typeof skillItem === "string") {
          skillIds.push(skillItem);
          continue;
        }
        
        // Otherwise, it's an object with skill data
        const skill = skillItem as { id?: number; documentId?: string; skillName?: string; level?: string };
        // Use documentId if available, otherwise use id
        const skillIdentifier = skill.documentId || skill.id;
        
        if (skillIdentifier) {
          // Existing skill - update it
          try {
            const updateResponse = await fetch(`${strapiUrl}/api/skills/${skillIdentifier}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
                ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
              },
              body: JSON.stringify({
                data: {
                  skillName: skill.skillName,
                  level: skill.level,
                },
              }),
            });
            
            if (updateResponse.ok) {
              // Return the same identifier (documentId or id)
              skillIds.push(skillIdentifier);
            } else {
              console.error("Failed to update skill:", skillIdentifier);
            }
          } catch (error) {
            console.error("Error updating skill:", error);
          }
        } else if (skill.skillName) {
          // New skill - check if exists, then create or update
          try {
            const checkResponse = await fetch(
              `${strapiUrl}/api/skills?filters[skillName][$eq]=${encodeURIComponent(skill.skillName)}`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
                },
              }
            );
            
            let skillId: number | string | null = null;
            
            if (checkResponse.ok) {
              const checkResult = await checkResponse.json().catch(() => ({}));
              const existingSkills = Array.isArray(checkResult?.data) ? checkResult.data : (checkResult?.data ? [checkResult.data] : []);
              
              if (existingSkills.length > 0) {
                // Prefer documentId, fall back to id
                skillId = existingSkills[0].documentId || existingSkills[0].id;
                const updateResponse = await fetch(`${strapiUrl}/api/skills/${skillId}`, {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
                    ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
                  },
                  body: JSON.stringify({
                    data: {
                      skillName: skill.skillName,
                      level: skill.level,
                    },
                  }),
                });
                
                if (!updateResponse.ok) {
                  skillId = null;
                }
              }
            }
            
            if (!skillId) {
              // Create new skill
              const createResponse = await fetch(`${strapiUrl}/api/skills`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
                  ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
                },
                body: JSON.stringify({
                  data: {
                    skillName: skill.skillName,
                    level: skill.level,
                  },
                }),
              });
              
              if (createResponse.ok) {
                const createResult = await createResponse.json().catch(() => ({}));
                const createdSkill = createResult?.data;
                // Prefer documentId, fall back to id
                if (createdSkill?.documentId) {
                  skillId = createdSkill.documentId;
                } else if (createdSkill?.id) {
                  skillId = createdSkill.id;
                }
              }
            }
            
            if (skillId) {
              skillIds.push(skillId);
            }
          } catch (error) {
            console.error("Error creating skill:", error);
          }
        }
      }
      
      profileData.skills = skillIds;
    }

    // Handle education and experience - they're components
    // KEEP IDs in component data - Strapi 5 uses IDs to identify which component to update
    // If ID is present, it updates; if not, it creates a new one
    // No need to remove IDs - Strapi handles it automatically

    let response: Response;
    let result: Record<string, unknown> = {};

    if (existingProfileId) {
      // Update existing profile
      const updateUrl = `${strapiUrl}/api/candidate-profiles/${existingProfileId}`;
      response = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
          ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
        body: JSON.stringify({ data: profileData }),
      });
    } else {
      // Create new profile
      response = await fetch(`${strapiUrl}/api/candidate-profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
          ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
        body: JSON.stringify({ data: profileData }),
      });
    }

    const responseText = await response.text();
    if (responseText) {
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { error: responseText };
      }
    }

    if (!response.ok) {
      const errorMessage =
        (result?.error as { message?: string })?.message ||
        (result?.error as string) ||
        result?.message ||
        "Failed to save candidate profile";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(result, { status: existingProfileId ? 200 : 201 });
  } catch (error) {
    console.error("Candidate profile save error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to save candidate profile";
    
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
    const userId = Number(session.userId);

    // Verify the profile belongs to the logged-in user
    const userProfileUrl = `${strapiUrl}/api/candidate-profiles?filters[user][id][$eq]=${userId}&populate=user`;
    
    const verifyResponse = await fetch(userProfileUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
    });

    if (verifyResponse.ok) {
      const verifyResult = await verifyResponse.json().catch(() => ({}));
      const userProfiles = Array.isArray(verifyResult?.data) ? verifyResult.data : (verifyResult?.data ? [verifyResult.data] : []);
      
      if (userProfiles.length > 0) {
        const userProfile = userProfiles[0];
        // Check both id and documentId
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

    // 4. PROCESS SKILLS (Sequential with await - ensures creation completes before profile update)
    // Use for...of to ensure we await each creation properly
    // If skills are provided, start from empty; otherwise, preserve existing relations
    const finalSkillIds: (string | number)[] = skillsProvided ? [] : [...existingSkillIds];

    const failedSkills: string[] = [];

    if (Array.isArray(skills)) {
      // Use for...of to ensure sequential processing and proper awaiting
      for (const item of skills) {
        // CASE A: It's already an ID (number or string)
        if (typeof item === "number" || typeof item === "string") {
          // Add to final list if not already present
          if (!finalSkillIds.includes(item)) {
            finalSkillIds.push(item);
          }
          continue;
        }
        
        // CASE B: It's an object with skill data
        if (typeof item === "object" && item !== null) {
          const skill = item as { id?: number; documentId?: string; skillName?: string; level?: string };
          
          // If it has an ID, use it directly (existing skill)
          if (skill.documentId || skill.id) {
            const skillId = skill.documentId || skill.id!;
            // Add to final list if not already present
            if (!finalSkillIds.includes(skillId)) {
              finalSkillIds.push(skillId);
            }
            continue;
          }
          
          // CASE C: It's a new skill object { skillName, level } - create or find it
          if (skill.skillName && skill.level) {
            try {
              // Check for existing skill with same name AND level (more specific check)
              const checkResponse = await fetch(
                `${strapiUrl}/api/skills?filters[skillName][$eq]=${encodeURIComponent(skill.skillName)}&filters[level][$eq]=${encodeURIComponent(skill.level)}`,
                {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                    ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
                    ...(!apiToken && userJwt && { Authorization: `Bearer ${userJwt}` }),
                  },
                }
              );
              
              let skillId: number | string | null = null;
              
              if (checkResponse.ok) {
                const existing = await checkResponse.json().catch(() => ({}));
                const existingSkills = Array.isArray(existing?.data) ? existing.data : (existing?.data ? [existing.data] : []);
                
                if (existingSkills.length > 0) {
                  // Use existing skill ID (prefers documentId for Strapi 5)
                  skillId = existingSkills[0].documentId || existingSkills[0].id;
                }
              }
              
              // Create new skill if it doesn't exist
              if (!skillId) {
                const createResponse = await fetch(`${strapiUrl}/api/skills`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
                    ...(!apiToken && userJwt && { Authorization: `Bearer ${userJwt}` }),
                  },
                  body: JSON.stringify({
                    data: {
                      skillName: skill.skillName,
                      level: skill.level,
                    },
                  }),
                });
                
                if (createResponse.ok) {
                  const newSkill = await createResponse.json().catch(() => ({}));
                  if (newSkill?.data) {
                    // Prefer documentId for Strapi 5
                    skillId = newSkill.data.documentId || newSkill.data.id;
                  }
                } else {
                  const errorText = await createResponse.text().catch(() => "Unknown error");
                  console.error(`Failed to create skill "${skill.skillName}":`, errorText);
                }
              }
              
              if (skillId) {
                // Add to final list if not already present
                if (!finalSkillIds.includes(skillId)) {
                  finalSkillIds.push(skillId);
                }
              } else {
                console.error(`Skill processing failed for: ${skill.skillName}`);
                failedSkills.push(`${skill.skillName} (${skill.level})`);
              }
            } catch (error) {
              console.error("Skill error:", error);
              // Continue with other skills even if one fails (error resilience)
              failedSkills.push(`${skill.skillName} (${skill.level})`);
            }
          } else {
            failedSkills.push(skill.skillName ? `${skill.skillName} (missing level)` : "Unnamed skill");
          }
        }
      }
    }

    // Remove duplicates (in case of any overlap) - ensure unique IDs
    const uniqueSkillIds = [...new Set(finalSkillIds)];

    if (skillsProvided && failedSkills.length > 0) {
      return NextResponse.json(
        { error: `Failed to save skills: ${failedSkills.join(", ")}` },
        { status: 400 }
      );
    }

    // 5. BUILD THE PAYLOAD
    // Important: We do NOT include 'id' or 'documentId' inside this object
    // For Components, remove IDs to avoid "Invalid key id" errors
    // Strapi will treat them as fresh entries (may replace existing ones)
    const finalUpdateData: Record<string, unknown> = {
      ...(fullName !== undefined && { fullName }),
      ...(phone !== undefined && { phone }),
      ...(bio !== undefined && { bio }),
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
      // If skills were provided, include them even if empty to allow clearing relations
      ...(skillsProvided && { skills: uniqueSkillIds }),
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
    // All skills have been processed and we have a clean array of IDs
    // Components have IDs removed to prevent "Invalid key id" errors
    // Added ?populate=* so the response includes skills, education, and experience
    const response = await fetch(`${strapiUrl}/api/candidate-profiles/${targetIdentifier}?populate=*`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
        ...(!userJwt && apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      body: JSON.stringify({ data: finalUpdateData }),
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
