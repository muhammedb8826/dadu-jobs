import { NextRequest, NextResponse } from "next/server";
import { getStrapiURL } from "@/lib/strapi/client";
import { getSession } from "@/lib/auth/session";
import { isCandidate, requireRole } from "@/lib/auth/rbac";
import { UserType } from "@/lib/types/user.types";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Role-based access: Only candidates can create/update student profiles
    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can manage student profiles." },
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

    // Use the user's JWT token from session for authenticated requests
    // This allows the user to create/update their own profile using their permissions
    // Fall back to API token if JWT is not available
    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const authToken = userJwt || apiToken;

    // Since Strapi creates a student profile on signup, we should UPDATE the existing profile
    // instead of creating a new one. First, check if a profile exists for this user.
    const userId = Number(session.userId);
    const userProfileUrl = `${strapiUrl}/api/student-profiles?filters[user][id][$eq]=${userId}&populate=user`;
    
    console.log("Checking for existing profile (POST):", { userId, verifyUrl: userProfileUrl });
    
    const verifyResponse = await fetch(userProfileUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
    });

    let existingProfile = null;
    let existingProfileId: number | null = null;
    
    if (verifyResponse.ok) {
      const verifyResult = await verifyResponse.json().catch(() => ({}));
      const userProfiles = Array.isArray(verifyResult?.data) ? verifyResult.data : (verifyResult?.data ? [verifyResult.data] : []);
      
      if (userProfiles.length > 0) {
        existingProfile = userProfiles[0];
        existingProfileId = existingProfile?.id;
        console.log("Existing profile found (POST will update):", {
          profileId: existingProfileId,
          userId,
        });
      } else {
        console.log("No existing profile found (POST will create):", { userId });
      }
    } else {
      console.warn("Could not verify existing profile (POST will attempt to create):", {
        status: verifyResponse.status,
        userId,
      });
    }

    // Associate the profile with the logged-in user
    // Remove email field if present (not in Strapi schema)
    const profileData = Object.fromEntries(
      Object.entries(body.data).filter(([key]) => key !== 'email' && key !== 'id')
    );
    
    // Set the user relation to associate this profile with the logged-in user
    profileData.user = Number(session.userId);

    // Helper function to clean component relations (for addresses)
    const cleanComponentRelations = (obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
      
      const cleaned: Record<string, unknown> = {};
      
      // Process all fields
      for (const [key, value] of Object.entries(obj)) {
        // For relation fields (country, region, zone, woreda), ensure they're just numbers
        if (['country', 'region', 'zone', 'woreda'].includes(key)) {
          if (typeof value === 'number') {
            cleaned[key] = value;
          } else if (value && typeof value === 'object' && 'set' in value && Array.isArray(value.set)) {
            const setId = value.set[0]?.id;
            if (setId && typeof setId === 'number') {
              cleaned[key] = setId;
            }
          } else if (value !== null && value !== undefined) {
            const numValue = Number(value);
            if (!isNaN(numValue) && numValue > 0) {
              cleaned[key] = numValue;
            }
          }
        } else {
          // For other fields, keep as is
          cleaned[key] = value;
        }
      }
      return cleaned;
    };

    // Education fields are RELATIONS, not components
    // We need to create the education records first, then link them
    let primaryEducationId: number | null = null;
    let secondaryEducationId: number | null = null;
    const tertiaryEducationIds: number[] = [];
    
    // Handle primary_education relation
    if (profileData.primary_education && typeof profileData.primary_education === 'object') {
      const primaryData = profileData.primary_education as Record<string, unknown>;
      const existingId = primaryData.id as number | undefined;
      
      // Clean the education data (remove id, clean location relations)
      const cleanedPrimary = cleanComponentRelations(primaryData);
      if (cleanedPrimary && typeof cleanedPrimary === 'object') {
        delete (cleanedPrimary as Record<string, unknown>).id;
      }
      
      // Create or update primary education
      if (existingId) {
        // Update existing
        const updateResponse = await fetch(`${strapiUrl}/api/primary-educations/${existingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify({ data: cleanedPrimary }),
        });
        
        if (updateResponse.ok) {
          const updateResult = await updateResponse.json().catch(() => ({}));
          primaryEducationId = updateResult?.data?.id || existingId;
        }
      } else {
        // Create new
      const createResponse = await fetch(`${strapiUrl}/api/primary-educations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({ data: cleanedPrimary }),
      });
      
      if (createResponse.ok) {
        const createResult = await createResponse.json().catch(() => ({}));
        primaryEducationId = createResult?.data?.id;
        }
      }
      
      // Replace with relation format
      if (primaryEducationId) {
        profileData.primary_education = { id: primaryEducationId };
      } else {
        delete profileData.primary_education;
      }
    }
    
    // Handle secondary_education relation
    if (profileData.secondary_education && typeof profileData.secondary_education === 'object') {
      const secondaryData = profileData.secondary_education as Record<string, unknown>;
      const existingId = secondaryData.id as number | undefined;
      
      // Clean the education data
      const cleanedSecondary = cleanComponentRelations(secondaryData);
      if (cleanedSecondary && typeof cleanedSecondary === 'object') {
        delete (cleanedSecondary as Record<string, unknown>).id;
      }
      
      // Create or update secondary education
      if (existingId) {
        const updateResponse = await fetch(`${strapiUrl}/api/secondary-educations/${existingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify({ data: cleanedSecondary }),
        });
        
        if (updateResponse.ok) {
          const updateResult = await updateResponse.json().catch(() => ({}));
          secondaryEducationId = updateResult?.data?.id || existingId;
        }
      } else {
      const createResponse = await fetch(`${strapiUrl}/api/secondary-educations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
        body: JSON.stringify({ data: cleanedSecondary }),
      });
      
      if (createResponse.ok) {
        const createResult = await createResponse.json().catch(() => ({}));
        secondaryEducationId = createResult?.data?.id;
        }
      }
      
      // Replace with relation format
      if (secondaryEducationId) {
        profileData.secondary_education = { id: secondaryEducationId };
      } else {
        delete profileData.secondary_education;
      }
    }
    
    // Handle tertiary_educations relation (oneToMany)
    if (profileData.tertiary_educations && Array.isArray(profileData.tertiary_educations)) {
      for (const tertiaryData of profileData.tertiary_educations) {
        if (tertiaryData && typeof tertiaryData === 'object') {
          const tertiary = tertiaryData as Record<string, unknown>;
          const existingId = tertiary.id as number | undefined;
          
          // Clean the education data
          const cleanedTertiary = cleanComponentRelations(tertiary);
          if (cleanedTertiary && typeof cleanedTertiary === 'object') {
            delete (cleanedTertiary as Record<string, unknown>).id;
          }
          
          // Create or update tertiary education
          if (existingId) {
            const updateResponse = await fetch(`${strapiUrl}/api/tertiar-educations/${existingId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(authToken && { Authorization: `Bearer ${authToken}` }),
              },
              body: JSON.stringify({ data: cleanedTertiary }),
            });
            
            const updateResult = await updateResponse.json().catch(() => ({}));
            
            if (updateResponse.ok) {
              const tertiaryId = updateResult?.data?.id || existingId;
              if (tertiaryId) {
                tertiaryEducationIds.push(tertiaryId);
                console.log("Tertiary education updated:", tertiaryId);
              }
            } else {
              console.error("Failed to update tertiary education:", {
                status: updateResponse.status,
                error: updateResult,
                existingId,
              });
            }
          } else {
          // Use the correct endpoint name: tertiar-educations (note the spelling)
          const createResponse = await fetch(`${strapiUrl}/api/tertiar-educations`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(authToken && { Authorization: `Bearer ${authToken}` }),
            },
            body: JSON.stringify({ data: cleanedTertiary }),
          });
          
          const createResult = await createResponse.json().catch(() => ({}));
          
          if (createResponse.ok) {
            if (createResult?.data?.id) {
              tertiaryEducationIds.push(createResult.data.id);
                console.log("Tertiary education created:", createResult.data.id);
            } else {
                console.error("Tertiary education created but no ID returned:", createResult);
            }
          } else {
              console.error("Failed to create tertiary education:", {
              status: createResponse.status,
              error: createResult,
              url: `${strapiUrl}/api/tertiar-educations`,
            });
            }
          }
        }
      }
      
      // Replace with relation format (oneToMany uses set)
      if (tertiaryEducationIds.length > 0) {
        profileData.tertiary_educations = { set: tertiaryEducationIds.map(id => ({ id })) };
        console.log("Setting tertiary_educations relation:", profileData.tertiary_educations);
      } else {
        console.warn("No tertiary education IDs collected, removing from profile data");
        delete profileData.tertiary_educations;
      }
    }

    // Clean component relations in nested objects (addresses are components)
    // Remove ids from components - Strapi doesn't allow id in component payloads
    const removeIdFromComponent = (obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
      const cleaned = { ...obj };
      delete cleaned.id;
      return cleaned;
    };

    // Remove ids from components only (addresses are components)
    // NOTE: Education fields are relations, not components, so they're already handled above
    if (profileData.residentialAddress && typeof profileData.residentialAddress === 'object') {
      profileData.residentialAddress = removeIdFromComponent(profileData.residentialAddress as Record<string, unknown>) as typeof profileData.residentialAddress;
    }
    if (profileData.birthAddress && typeof profileData.birthAddress === 'object') {
      profileData.birthAddress = removeIdFromComponent(profileData.birthAddress as Record<string, unknown>) as typeof profileData.birthAddress;
    }
    if (profileData.personToBeContacted && typeof profileData.personToBeContacted === 'object') {
      profileData.personToBeContacted = removeIdFromComponent(profileData.personToBeContacted as Record<string, unknown>) as typeof profileData.personToBeContacted;
    }

    // If an existing profile was found, UPDATE it instead of creating a new one
    // This prevents duplicate profiles since Strapi creates a profile on signup
    if (existingProfileId) {
      console.log("Updating existing profile (POST -> PUT):", {
        profileId: existingProfileId,
        userId,
      });

      const updateUrl = `${strapiUrl}/api/student-profiles/${existingProfileId}`;
      
      const response = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
        },
        body: JSON.stringify({
          data: profileData,
        }),
      });

      let result = await response.json().catch(() => ({}));
      
      // If we got 403 with user JWT, try with API token
      if (!response.ok && response.status === 403 && userJwt && apiToken) {
        console.log("Got 403 with user JWT, retrying with API token...");
        const retryResponse = await fetch(updateUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
          },
          body: JSON.stringify({
            data: profileData,
          }),
        });
        result = await retryResponse.json().catch(() => ({}));
        
        if (retryResponse.ok) {
          return NextResponse.json(result, { status: 200 });
        }
      }

      if (!response.ok) {
        const errorMessage =
          result?.error?.message ||
          result?.message ||
          "Failed to update student profile";
        
        console.error("Strapi API error (update):", {
          status: response.status,
          error: result,
          url: updateUrl,
        });
        
        return NextResponse.json(
          { error: errorMessage, details: result },
          { status: response.status || 500 }
        );
      }

      // Return the result with proper structure
      return NextResponse.json(result, { status: 200 });
    } else {
      // No existing profile found - create new one (edge case, shouldn't happen if Strapi auto-creates)
      console.log("Creating new profile (no existing profile found):", { userId });

    const response = await fetch(`${strapiUrl}/api/student-profiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify({
        data: profileData,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        result?.error?.message ||
        result?.message ||
        "Failed to create student profile";
      
        console.error("Strapi API error (create):", {
        status: response.status,
        error: result,
        url: `${strapiUrl}/api/student-profiles`,
      });
      
      return NextResponse.json(
        { error: errorMessage, details: result },
        { status: response.status || 500 }
      );
    }

    // Return the result with proper structure
    return NextResponse.json(result, { status: 201 });
    }
  } catch (error) {
    console.error("Student profile creation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create student profile";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
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

    // Role-based access: Only candidates can view student profiles
    if (!isCandidate(session)) {
      return NextResponse.json(
        { error: "Access denied. Only candidates can view student profiles." },
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
    const requestUrl = new URL(request.url);
    
    // Extract the original query string and preserve all populate parameters
    // Decode URL-encoded parameters first
    const originalQuery = requestUrl.search;
    const decodedQuery = decodeURIComponent(originalQuery);
    
    // Extract populate parameters from the decoded query string
    // Handle both simple (populate=*) and nested (populate[residentialAddress][populate]=*) formats
    const populateParams: string[] = [];
    const queryString = decodedQuery.startsWith('?') ? decodedQuery.substring(1) : decodedQuery;
    const params = queryString.split('&');
    
    for (const param of params) {
      if (param.startsWith('populate')) {
        // Parameters are already decoded from decodeURIComponent(originalQuery)
        populateParams.push(param);
      }
    }
    
    // Build the query string
    const queryStringParts: string[] = [];
    
    // Add populate parameters (don't populate user to avoid role field issues)
    if (populateParams.length > 0) {
      queryStringParts.push(...populateParams);
    } else {
      queryStringParts.push('populate=*');
    }
    
    // Add user filter (we don't need to populate user, just filter by it)
    const userId = Number(session.userId);
    queryStringParts.push(`filters[user][id][$eq]=${userId}`);
    
    const url = `${strapiUrl}/api/student-profiles?${queryStringParts.join('&')}`;
    
    console.log("Fetching profile:", { 
      originalQuery,
      decodedQuery,
      populateParams,
      queryStringParts,
      url,
      userId 
    });
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Strapi fetch error:", { status: response.status, error: result });
      const errorMessage =
        result?.error?.message ||
        result?.message ||
        "Failed to fetch student profiles";
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status || 500 }
      );
    }

    console.log("Strapi response:", { 
      hasData: !!result?.data, 
      isArray: Array.isArray(result?.data),
      dataLength: Array.isArray(result?.data) ? result.data.length : result?.data ? 1 : 0,
      firstProfileUserId: Array.isArray(result?.data) ? result.data[0]?.user?.id : result?.data?.user?.id,
    });

    // Strapi should return only the user's profile due to the filter
    // But we still validate server-side for security
    let filteredData = null;
    
    type ProfileData = {
      user?: {
        id?: number;
      };
      [key: string]: unknown;
    };
    
    if (result?.data) {
      if (Array.isArray(result.data)) {
        // Filter should have already filtered by user, so return first match or first item
        const userId = Number(session.userId);
        filteredData = result.data.find((profile: ProfileData) => {
          return profile.user?.id === userId;
        }) || result.data[0] || null;
      } else if (result.data) {
        // Single object - filter should have worked, so return it
        filteredData = result.data;
      }
    }
    
    console.log("Final filtered data:", { 
      hasData: !!filteredData, 
      profileId: filteredData?.id,
      hasResidentialAddress: !!filteredData?.residentialAddress 
    });

    // Return only the user's profile or null
    return NextResponse.json(
      { 
        data: filteredData, 
        meta: result.meta || { pagination: { total: filteredData ? 1 : 0 } } 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Student profile fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch student profiles";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || !body.data) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { id, ...restData } = body.data;

    if (!id) {
      return NextResponse.json(
        { error: "Profile ID is required for update" },
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

    // Use the user's JWT token from session for authenticated requests
    // Fall back to API token if JWT is not available
    const userJwt = session.jwt;
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    const authToken = userJwt || apiToken;

    // Verify the profile exists and belongs to the logged-in user
    // Use user filter instead of direct ID lookup to avoid Strapi permission issues
    const userId = Number(session.userId);
    const userProfileUrl = `${strapiUrl}/api/student-profiles?filters[user][id][$eq]=${userId}&populate=user`;
    
    console.log("Verifying profile ownership:", { profileId: id, userId, verifyUrl: userProfileUrl });
    
    const verifyResponse = await fetch(userProfileUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
    });

    if (!verifyResponse.ok) {
      const verifyError = await verifyResponse.json().catch(() => ({}));
      console.error("Profile verification failed:", {
        status: verifyResponse.status,
        profileId: id,
        userId,
        error: verifyError,
      });
      
      return NextResponse.json(
        { error: "Failed to verify profile ownership" },
        { status: verifyResponse.status || 500 }
      );
    }

    const verifyResult = await verifyResponse.json().catch(() => ({}));
    const userProfiles = Array.isArray(verifyResult?.data) ? verifyResult.data : (verifyResult?.data ? [verifyResult.data] : []);
    
    if (userProfiles.length === 0) {
      console.error("No profile found for user:", { userId });
      return NextResponse.json(
        { error: "Student profile not found. Please complete your profile first." },
        { status: 404 }
      );
    }

    // Always use the first (and should be only) profile for this user
    // Since profiles are auto-created on registration, there should always be exactly one
    const profile = userProfiles[0];
    const actualProfileId = profile?.id;
    const profileDocumentId = (profile as { documentId?: string })?.documentId;
    
    console.log("User's profile found (always use this ID for updates):", {
      requestedProfileId: id,
      actualProfileId,
      profileDocumentId,
      profileUserId: profile?.user?.id,
      loggedInUserId: userId,
      profileMatches: actualProfileId === id,
      totalUserProfiles: userProfiles.length,
    });

    // If the requested ID doesn't match the actual profile ID, log a warning
    // But always use the actual profile ID to prevent duplicates
    if (actualProfileId !== id) {
      console.warn("Profile ID mismatch - using actual profile ID from database:", {
        requestedId: id,
        actualProfileId,
        userId,
        message: "Using the profile ID fetched by user ID, not the requested ID. This prevents duplicate profiles."
      });
    }

    // Verify the profile belongs to the logged-in user (double-check)
    if (profile?.user?.id !== userId) {
      console.error("Profile ownership mismatch:", {
        profileUserId: profile?.user?.id,
        loggedInUserId: userId,
        profileId: id,
      });
      
      return NextResponse.json(
        { error: "You do not have permission to update this profile" },
        { status: 403 }
      );
    }

    // Remove email and id fields if present
    // id should not be in the update payload - Strapi identifies records by URL parameter
    const updateData = Object.fromEntries(
      Object.entries(restData).filter(([key]) => key !== 'email' && key !== 'id')
    );

    // Helper function to clean component relations
    // For components, relations should be just the ID number, not wrapped in { set: [...] }
    // Strapi v4 requires component IDs for updates, and relations within components should be plain numbers
    const cleanComponentRelations = (obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
      
      const cleaned: Record<string, unknown> = {};
      
      // Preserve the component ID if it exists
      if (obj.id && typeof obj.id === 'number') {
        cleaned.id = obj.id;
      }
      
      // Process all other fields
      for (const [key, value] of Object.entries(obj)) {
        // Skip 'id' as we already handled it
        if (key === 'id') continue;
        
        // For relation fields (country, region, zone, woreda), ensure they're just numbers
        // Remove any wrapping like { set: [...] } that Strapi might have added
        if (['country', 'region', 'zone', 'woreda'].includes(key)) {
          if (typeof value === 'number') {
            cleaned[key] = value;
          } else if (value && typeof value === 'object' && 'set' in value && Array.isArray(value.set)) {
            // If Strapi wrapped it in { set: [...] }, extract the ID
            const setId = value.set[0]?.id;
            if (setId && typeof setId === 'number') {
              cleaned[key] = setId;
            }
          } else if (value !== null && value !== undefined) {
            const numValue = Number(value);
            if (!isNaN(numValue) && numValue > 0) {
              cleaned[key] = numValue;
            }
          }
        } else {
          // For other fields, keep as is (recursively clean if it's an object)
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            cleaned[key] = cleanComponentRelations(value as Record<string, unknown>);
          } else {
            cleaned[key] = value;
          }
        }
      }
      return cleaned;
    };

    // Clean component relations in nested objects (addresses are components)
    if (updateData.residentialAddress && typeof updateData.residentialAddress === 'object') {
      updateData.residentialAddress = cleanComponentRelations(updateData.residentialAddress as Record<string, unknown>) as typeof updateData.residentialAddress;
    }
    if (updateData.birthAddress && typeof updateData.birthAddress === 'object') {
      updateData.birthAddress = cleanComponentRelations(updateData.birthAddress as Record<string, unknown>) as typeof updateData.birthAddress;
    }
    if (updateData.personToBeContacted && typeof updateData.personToBeContacted === 'object') {
      updateData.personToBeContacted = cleanComponentRelations(updateData.personToBeContacted as Record<string, unknown>) as typeof updateData.personToBeContacted;
    }
    
    // Education fields are RELATIONS, not components
    // We need to create/update the education records first, then link them
    let primaryEducationId: number | null = null;
    let secondaryEducationId: number | null = null;
    const tertiaryEducationIds: number[] = [];
    
    // Handle primary_education relation
    if (updateData.primary_education && typeof updateData.primary_education === 'object') {
      const primaryData = updateData.primary_education as Record<string, unknown>;
      const existingId = primaryData.id as number | undefined;
      
      // Clean the education data (remove id, clean location relations)
      const cleanedPrimary = cleanComponentRelations(primaryData);
      if (cleanedPrimary && typeof cleanedPrimary === 'object') {
        delete (cleanedPrimary as Record<string, unknown>).id;
      }
      
      // Create or update primary education
      if (existingId) {
        // Update existing
        const updateResponse = await fetch(`${strapiUrl}/api/primary-educations/${existingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify({ data: cleanedPrimary }),
        });
        
        if (updateResponse.ok) {
          const updateResult = await updateResponse.json().catch(() => ({}));
          primaryEducationId = updateResult?.data?.id || existingId;
        }
      } else {
        // Create new
        const createResponse = await fetch(`${strapiUrl}/api/primary-educations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify({ data: cleanedPrimary }),
        });
        
        if (createResponse.ok) {
          const createResult = await createResponse.json().catch(() => ({}));
          primaryEducationId = createResult?.data?.id;
        }
      }
      
      // Replace with relation format
      if (primaryEducationId) {
        updateData.primary_education = { id: primaryEducationId };
      } else {
        delete updateData.primary_education;
      }
    }
    
    // Handle secondary_education relation
    if (updateData.secondary_education && typeof updateData.secondary_education === 'object') {
      const secondaryData = updateData.secondary_education as Record<string, unknown>;
      const existingId = secondaryData.id as number | undefined;
      
      // Clean the education data
      const cleanedSecondary = cleanComponentRelations(secondaryData);
      if (cleanedSecondary && typeof cleanedSecondary === 'object') {
        delete (cleanedSecondary as Record<string, unknown>).id;
      }
      
      // Create or update secondary education
      if (existingId) {
        const updateResponse = await fetch(`${strapiUrl}/api/secondary-educations/${existingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify({ data: cleanedSecondary }),
        });
        
        if (updateResponse.ok) {
          const updateResult = await updateResponse.json().catch(() => ({}));
          secondaryEducationId = updateResult?.data?.id || existingId;
        }
      } else {
        const createResponse = await fetch(`${strapiUrl}/api/secondary-educations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken && { Authorization: `Bearer ${authToken}` }),
          },
          body: JSON.stringify({ data: cleanedSecondary }),
        });
        
        if (createResponse.ok) {
          const createResult = await createResponse.json().catch(() => ({}));
          secondaryEducationId = createResult?.data?.id;
        }
      }
      
      // Replace with relation format
      if (secondaryEducationId) {
        updateData.secondary_education = { id: secondaryEducationId };
      } else {
        delete updateData.secondary_education;
      }
    }
    
    // Handle tertiary_educations relation (oneToMany)
    if (updateData.tertiary_educations && Array.isArray(updateData.tertiary_educations)) {
      console.log("Processing tertiary_educations:", {
        count: updateData.tertiary_educations.length,
        items: updateData.tertiary_educations.map((item: Record<string, unknown>) => ({
          hasId: !!(item?.id),
          institution: item?.institution as string | undefined,
        })),
      });
      
      for (const tertiaryData of updateData.tertiary_educations) {
        if (tertiaryData && typeof tertiaryData === 'object') {
          const tertiary = tertiaryData as Record<string, unknown>;
          const existingId = tertiary.id as number | undefined;
          
          // Clean the education data
          const cleanedTertiary = cleanComponentRelations(tertiary);
          if (cleanedTertiary && typeof cleanedTertiary === 'object') {
            delete (cleanedTertiary as Record<string, unknown>).id;
          }
          
          console.log("Tertiary education data:", {
            existingId,
            cleanedData: cleanedTertiary,
            url: existingId 
              ? `${strapiUrl}/api/tertiar-educations/${existingId}`
              : `${strapiUrl}/api/tertiar-educations`,
          });
          
          // Create or update tertiary education
          if (existingId) {
            const updateResponse = await fetch(`${strapiUrl}/api/tertiar-educations/${existingId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(authToken && { Authorization: `Bearer ${authToken}` }),
              },
              body: JSON.stringify({ data: cleanedTertiary }),
            });
            
            const updateResult = await updateResponse.json().catch(() => ({}));
            
            if (updateResponse.ok) {
              const tertiaryId = updateResult?.data?.id || existingId;
              if (tertiaryId) {
                tertiaryEducationIds.push(tertiaryId);
                console.log("Tertiary education updated successfully:", tertiaryId);
              }
            } else {
              console.error("Failed to update tertiary education:", {
                status: updateResponse.status,
                error: updateResult,
                existingId,
                url: `${strapiUrl}/api/tertiar-educations/${existingId}`,
              });
            }
          } else {
            // Use the correct endpoint name: tertiar-educations (note the spelling)
            const createResponse = await fetch(`${strapiUrl}/api/tertiar-educations`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(authToken && { Authorization: `Bearer ${authToken}` }),
              },
              body: JSON.stringify({ data: cleanedTertiary }),
            });
            
            const createResult = await createResponse.json().catch(() => ({}));
            
            if (createResponse.ok) {
              if (createResult?.data?.id) {
                tertiaryEducationIds.push(createResult.data.id);
                console.log("Tertiary education created successfully:", createResult.data.id);
              } else {
                console.error("Tertiary education created but no ID returned:", createResult);
              }
            } else {
              console.error("Failed to create tertiary education:", {
                status: createResponse.status,
                error: createResult,
                cleanedData: cleanedTertiary,
                url: `${strapiUrl}/api/tertiar-educations`,
              });
            }
          }
        }
      }
      
      console.log("Tertiary education IDs collected:", tertiaryEducationIds);
      
      // Replace with relation format (oneToMany uses set)
      if (tertiaryEducationIds.length > 0) {
        updateData.tertiary_educations = { set: tertiaryEducationIds.map(id => ({ id })) };
        console.log("Setting tertiary_educations relation:", updateData.tertiary_educations);
      } else {
        console.warn("No tertiary education IDs collected, removing from update");
        delete updateData.tertiary_educations;
      }
    }
    
    // Handle professional_experiences relation (oneToMany)
    const professionalExperienceIds: number[] = [];
    if (updateData.professional_experiences && Array.isArray(updateData.professional_experiences)) {
      console.log("Processing professional_experiences:", {
        count: updateData.professional_experiences.length,
      });
      
      for (const professionalData of updateData.professional_experiences) {
        if (professionalData && typeof professionalData === 'object') {
          const professional = professionalData as Record<string, unknown>;
          const existingId = professional.id as number | undefined;
          
          // Remove id from data
          const cleanedProfessional = { ...professional };
          delete cleanedProfessional.id;
          
          console.log("Professional experience data:", {
            existingId,
            cleanedData: cleanedProfessional,
            hasAttachments: !!cleanedProfessional.attachments,
            attachmentsValue: cleanedProfessional.attachments,
            url: existingId 
              ? `${strapiUrl}/api/professional-experiences/${existingId}`
              : `${strapiUrl}/api/professional-experiences`,
          });
          
          // Create or update professional experience
          if (existingId) {
            const updateResponse = await fetch(`${strapiUrl}/api/professional-experiences/${existingId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(authToken && { Authorization: `Bearer ${authToken}` }),
              },
              body: JSON.stringify({ data: cleanedProfessional }),
            });
            
            const updateResult = await updateResponse.json().catch(() => ({}));
            
            if (updateResponse.ok) {
              const professionalId = updateResult?.data?.id || existingId;
              if (professionalId) {
                professionalExperienceIds.push(professionalId);
                console.log("Professional experience updated successfully:", professionalId);
              }
            } else {
              console.error("Failed to update professional experience:", {
                status: updateResponse.status,
                error: updateResult,
                existingId,
              });
            }
          } else {
            const createResponse = await fetch(`${strapiUrl}/api/professional-experiences`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(authToken && { Authorization: `Bearer ${authToken}` }),
              },
              body: JSON.stringify({ data: cleanedProfessional }),
            });
            
            const createResult = await createResponse.json().catch(() => ({}));
            
            if (createResponse.ok) {
              if (createResult?.data?.id) {
                professionalExperienceIds.push(createResult.data.id);
                console.log("Professional experience created successfully:", createResult.data.id);
              } else {
                console.error("Professional experience created but no ID returned:", createResult);
              }
            } else {
              console.error("Failed to create professional experience:", {
                status: createResponse.status,
                error: createResult,
                url: `${strapiUrl}/api/professional-experiences`,
              });
            }
          }
        }
      }
      
      // Replace with relation format (oneToMany uses set)
      if (professionalExperienceIds.length > 0) {
        updateData.professional_experiences = { set: professionalExperienceIds.map(id => ({ id })) };
        console.log("Setting professional_experiences relation:", updateData.professional_experiences);
      } else {
        console.warn("No professional experience IDs collected, removing from update");
        delete updateData.professional_experiences;
      }
    }
    
    // Handle research_engagements relation (oneToMany)
    const researchEngagementIds: number[] = [];
    if (updateData.research_engagements && Array.isArray(updateData.research_engagements)) {
      console.log("Processing research_engagements:", {
        count: updateData.research_engagements.length,
      });
      
      for (const researchData of updateData.research_engagements) {
        if (researchData && typeof researchData === 'object') {
          const research = researchData as Record<string, unknown>;
          const existingId = research.id as number | undefined;
          
          // Remove id from data
          const cleanedResearch = { ...research };
          delete cleanedResearch.id;
          
          console.log("Research engagement data:", {
            existingId,
            cleanedData: cleanedResearch,
            hasAttachments: !!cleanedResearch.attachments,
            attachmentsValue: cleanedResearch.attachments,
            url: existingId 
              ? `${strapiUrl}/api/research-engagements/${existingId}`
              : `${strapiUrl}/api/research-engagements`,
          });
          
          // Create or update research engagement
          if (existingId) {
            const updateResponse = await fetch(`${strapiUrl}/api/research-engagements/${existingId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(authToken && { Authorization: `Bearer ${authToken}` }),
              },
              body: JSON.stringify({ data: cleanedResearch }),
            });
            
            const updateResult = await updateResponse.json().catch(() => ({}));
            
            if (updateResponse.ok) {
              const researchId = updateResult?.data?.id || existingId;
              if (researchId) {
                researchEngagementIds.push(researchId);
                console.log("Research engagement updated successfully:", researchId);
              }
            } else {
              console.error("Failed to update research engagement:", {
                status: updateResponse.status,
                error: updateResult,
                existingId,
              });
            }
          } else {
            const createResponse = await fetch(`${strapiUrl}/api/research-engagements`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(authToken && { Authorization: `Bearer ${authToken}` }),
              },
              body: JSON.stringify({ data: cleanedResearch }),
            });
            
            const createResult = await createResponse.json().catch(() => ({}));
            
            if (createResponse.ok) {
              if (createResult?.data?.id) {
                researchEngagementIds.push(createResult.data.id);
                console.log("Research engagement created successfully:", createResult.data.id);
              } else {
                console.error("Research engagement created but no ID returned:", createResult);
              }
            } else {
              console.error("Failed to create research engagement:", {
                status: createResponse.status,
                error: createResult,
                url: `${strapiUrl}/api/research-engagements`,
              });
            }
          }
        }
      }
      
      // Replace with relation format (oneToMany uses set)
      if (researchEngagementIds.length > 0) {
        updateData.research_engagements = { set: researchEngagementIds.map(id => ({ id })) };
        console.log("Setting research_engagements relation:", updateData.research_engagements);
      } else {
        console.warn("No research engagement IDs collected, removing from update");
        delete updateData.research_engagements;
      }
    }

    // Update the profile
    // Use user's JWT for the update since we've verified ownership
    // Strapi permissions may require the user's own token for updates
    // Try user JWT first, fall back to API token if needed
    
    // Remove id from components - Strapi doesn't allow id in component payloads
    // Components are updated by field name, not by id
    const removeIdFromComponent = (obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null | undefined => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
      const cleaned = { ...obj };
      delete cleaned.id;
      return cleaned;
    };

    // Remove ids from components only (addresses are components)
    // NOTE: Education fields are relations, not components, so they're already handled above
    if (updateData.residentialAddress && typeof updateData.residentialAddress === 'object') {
      updateData.residentialAddress = removeIdFromComponent(updateData.residentialAddress as Record<string, unknown>) as typeof updateData.residentialAddress;
    }
    if (updateData.birthAddress && typeof updateData.birthAddress === 'object') {
      updateData.birthAddress = removeIdFromComponent(updateData.birthAddress as Record<string, unknown>) as typeof updateData.birthAddress;
    }
    if (updateData.personToBeContacted && typeof updateData.personToBeContacted === 'object') {
      updateData.personToBeContacted = removeIdFromComponent(updateData.personToBeContacted as Record<string, unknown>) as typeof updateData.personToBeContacted;
    }
    
    // Try using numeric ID first, fall back to documentId if needed
    // Use actualProfileId (always fetched by user ID to prevent duplicates)
    const updateUrl = `${strapiUrl}/api/student-profiles/${actualProfileId}`;
    
    console.log("Updating profile (trying numeric ID first):", {
      requestedProfileId: id,
      actualProfileId,
      documentId: profileDocumentId,
      userId,
      usingUserJwt: !!userJwt,
      updateUrl,
      updateDataKeys: Object.keys(updateData),
      residentialAddress: updateData.residentialAddress ? JSON.stringify(updateData.residentialAddress).substring(0, 200) : null,
    });
    
    // Try with user's JWT first using numeric ID
    // Following Strapi API pattern: PUT /api/{collection}/{id} with { data: {...} } in body
    // IMPORTANT: ID must NOT be in the payload - it's only in the URL
    const requestBody = {
      data: updateData,
    };
    
    // Verify ID is not in the payload (should be removed by line 711-713)
    if ('id' in updateData) {
      console.error("CRITICAL: ID found in updateData payload! This should have been removed.");
      delete (updateData as { id?: number }).id;
    }
    
    console.log("PUT request details:", {
      url: updateUrl,
      method: "PUT",
      hasAuth: !!userJwt,
      profileIdInUrl: actualProfileId,
      bodyStructure: { data: "updateData object" },
      updateDataKeys: Object.keys(updateData),
      updateDataSample: Object.keys(updateData).slice(0, 5), // First 5 keys for debugging
      hasIdInPayload: 'id' in updateData, // Should be false
      payloadPreview: JSON.stringify(requestBody).substring(0, 200), // First 200 chars
    });
    
    // Diagnostic: Try GET by ID first to verify access permissions
    const diagnosticGetUrl = `${strapiUrl}/api/student-profiles/${actualProfileId}`;
    const diagnosticGetResponse = await fetch(diagnosticGetUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
      },
    });
    
    const canGetById = diagnosticGetResponse.ok;
    console.log("Diagnostic: Can GET profile by ID?", {
      canGetById,
      status: diagnosticGetResponse.status,
      profileId: actualProfileId,
      usingUserJwt: !!userJwt,
    });
    
    // If we can't even GET by ID, the issue is definitely permissions
    if (!canGetById && diagnosticGetResponse.status === 404) {
      console.error("DIAGNOSTIC: Cannot GET profile by ID - confirms permissions issue:", {
        profileId: actualProfileId,
        canQueryByFilter: true, // We know this works from line 634
        canGetById: false,
        canUpdate: false, // Will also fail
        issue: "API token/user JWT lacks permission to access profiles by numeric ID",
      });
    }
    
    let response = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
      },
      body: JSON.stringify(requestBody),
    });

    let result = await response.json().catch(() => ({}));
    
    console.log("First update attempt result:", {
      ok: response.ok,
      status: response.status,
      usingUserJwt: !!userJwt,
      hasApiToken: !!apiToken,
      error: result?.error || null,
      requestUrl: updateUrl,
      requestMethod: "PUT",
    });

    // If we got 403 with user JWT, immediately try with API token on numeric ID
    if (!response.ok && response.status === 403 && userJwt && apiToken) {
      console.log("Got 403 with user JWT on numeric ID, retrying with API token...");
      response = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
        body: JSON.stringify({
          data: updateData,
        }),
      });
      result = await response.json().catch(() => ({}));
      console.log("API token retry result:", {
        ok: response.ok,
        status: response.status,
        error: result?.error || null,
        returnedId: result?.data?.id || null,
      });
      
      // Check if update created a new profile (different ID returned)
      if (response.ok && result?.data?.id && result.data.id !== actualProfileId) {
        console.error("Update with API token on numeric ID created a new profile instead of updating:", {
          expectedId: actualProfileId,
          returnedId: result.data.id,
        });
        // Return error with actualProfileId so client can update and retry
        return NextResponse.json(
          { 
            error: "Update failed: Profile ID mismatch. The system will retry with the correct profile ID.",
            details: { 
              requestedId: actualProfileId, 
              returnedId: result.data.id,
              actualProfileId: actualProfileId, // Provide this so client can update and retry
              message: "The update created a new profile. Using the correct profile ID from database."
            }
          },
          { status: 400 }
        );
      }
    }

    // If numeric ID failed with 404, try with API token (user JWT might not have access to that ID)
    if (!response.ok && response.status === 404 && apiToken) {
      console.log("Numeric ID failed with 404, trying with API token...");
      response = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
        body: JSON.stringify({
          data: updateData,
        }),
      });
      result = await response.json().catch(() => ({}));
      console.log("API token retry on 404 result:", {
        ok: response.ok,
        status: response.status,
        error: result?.error || null,
        returnedId: result?.data?.id || null,
      });
      
      // Check if update created a new profile
      if (response.ok && result?.data?.id && result.data.id !== actualProfileId) {
        console.error("Update with API token on numeric ID (404 retry) created a new profile:", {
          expectedId: actualProfileId,
          returnedId: result.data.id,
        });
        return NextResponse.json(
          { 
            error: "Update failed: Profile ID mismatch. Please refresh the page and try again.",
            details: { 
              requestedId: actualProfileId, 
              returnedId: result.data.id,
              message: "The update created a new profile instead of updating the existing one"
            }
          },
          { status: 400 }
        );
      }
    }

    // If numeric ID still failed with 404 or 403, re-fetch the profile by user ID
    // and try again with the freshly fetched ID. This handles cases where the ID
    // might have changed or there's a permission issue.
    // NOTE: We NEVER use documentId in the URL for PUT requests as it creates duplicates
    if (!response.ok && (response.status === 404 || response.status === 403)) {
      console.log("Numeric ID failed, re-fetching profile by user ID to get current ID...");
      
      // Re-fetch the profile by user ID to get the current state
      const refetchUrl = `${strapiUrl}/api/student-profiles?filters[user][id][$eq]=${userId}&populate=user`;
      const refetchResponse = await fetch(refetchUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
        },
      });
      
      if (refetchResponse.ok) {
        const refetchResult = await refetchResponse.json().catch(() => ({}));
        const refetchedProfiles = Array.isArray(refetchResult?.data) ? refetchResult.data : (refetchResult?.data ? [refetchResult.data] : []);
        
        if (refetchedProfiles.length > 0) {
          const refetchedProfile = refetchedProfiles[0];
          const refetchedProfileId = refetchedProfile?.id;
          
          console.log("Re-fetched profile:", {
            originalId: actualProfileId,
            refetchedId: refetchedProfileId,
            match: refetchedProfileId === actualProfileId,
          });
          
          // If the ID is different, try updating with the refetched ID
          if (refetchedProfileId && refetchedProfileId !== actualProfileId) {
            console.log("Profile ID changed, trying update with refetched ID:", refetchedProfileId);
            const refetchedUpdateUrl = `${strapiUrl}/api/student-profiles/${refetchedProfileId}`;
            const refetchedUpdateResponse = await fetch(refetchedUpdateUrl, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
              },
              body: JSON.stringify({
                data: updateData,
              }),
            });
            
            const refetchedUpdateResult = await refetchedUpdateResponse.json().catch(() => ({}));
            
            if (refetchedUpdateResponse.ok && refetchedUpdateResult?.data?.id === refetchedProfileId) {
              console.log("Update with refetched ID succeeded:", refetchedProfileId);
              return NextResponse.json(refetchedUpdateResult, { status: 200 });
            }
          } else if (refetchedProfileId === actualProfileId) {
            // ID matches but update failed - try diagnostic checks and alternative methods
            console.log("Profile ID matches but update failed, running diagnostics...");
            
            // Diagnostic: Try to GET the profile by numeric ID to see if it's accessible
            const diagnosticGetUrl = `${strapiUrl}/api/student-profiles/${refetchedProfileId}`;
            const diagnosticGetResponse = await fetch(diagnosticGetUrl, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
              },
            });
            
            const canGetById = diagnosticGetResponse.ok;
            console.log("Diagnostic check - Can GET by numeric ID:", canGetById);
            
            // If we can GET by ID but not PUT, try PATCH as an alternative
            if (canGetById) {
              console.log("Can GET by ID but PUT failed, trying PATCH method...");
              const patchUrl = `${strapiUrl}/api/student-profiles/${refetchedProfileId}`;
              const patchResponse = await fetch(patchUrl, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                  ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
                },
                body: JSON.stringify({
                  data: updateData,
                }),
              });
              
              const patchResult = await patchResponse.json().catch(() => ({}));
              
              if (patchResponse.ok && patchResult?.data?.id === refetchedProfileId) {
                console.log("Update with PATCH succeeded:", refetchedProfileId);
                return NextResponse.json(patchResult, { status: 200 });
              } else {
                console.error("PATCH also failed:", {
                  status: patchResponse.status,
                  error: patchResult?.error || null,
                });
              }
            }
            
            // Log the permissions issue
            console.error("Profile ID matches but update failed - Strapi permissions issue:", {
              profileId: refetchedProfileId,
              userId,
              canQueryByFilter: true,
              canGetById,
              canUpdate: false,
              triedMethods: ["PUT", canGetById ? "PATCH" : null].filter(Boolean),
            });
          }
        }
      }
      
      // If we get here, all update attempts failed
      console.error("All update attempts failed:", {
        originalId: actualProfileId,
        status: response.status,
        error: result?.error || null,
      });
    }


    if (!response.ok) {
      console.error("Strapi API error:", {
        status: response.status,
        error: result,
        url: updateUrl,
        triedUserJwt: !!userJwt,
        triedApiToken: !!apiToken,
        actualProfileId,
      });

      let errorMessage: string;
      if (response.status === 404) {
        // Profile exists (can be queried by user filter) but cannot be updated by numeric ID
        // This is a Strapi permissions issue where the profile is accessible via filter
        // but not via direct ID lookup/update
        // 
        // FIX: See STRAPI_PERMISSIONS_FIX.md for detailed instructions on fixing this issue.
        // The API token needs 'update' permission for 'student-profiles' content type.
        errorMessage = 
          "Cannot update profile: Profile found but update by ID returned 404 Not Found. " +
          "This indicates a Strapi permissions configuration issue. The profile exists and can be queried, " +
          "but cannot be updated using the numeric ID. Please check:\n\n" +
          "1. API Token permissions (MOST LIKELY ISSUE):\n" +
          "   - Go to Strapi Admin → Settings → API Tokens\n" +
          "   - Edit the API token used in NEXT_PUBLIC_API_TOKEN\n" +
          "   - Under Permissions, ensure 'student-profiles' has 'update' permission enabled\n" +
          "   - The token may have 'find' (read) but NOT 'update' (write) permission\n\n" +
          "2. User Role permissions:\n" +
          "   - Go to Settings → Users & Permissions plugin → Roles → Authenticated\n" +
          "   - Ensure 'student-profiles' has 'updateOwn' permission checked\n\n" +
          "3. Check if the profile ID is correct:\n" +
          "   - Profile ID: " + actualProfileId + "\n" +
          "   - User ID: " + userId + "\n" +
          "   - The profile exists when queried by user filter but returns 404 when accessed by ID\n\n" +
          "All update attempts (user JWT, API token with numeric ID) failed with 404 Not Found.";
      } else if (response.status === 403) {
        // Provide detailed error message for 403
        // Diagnostic shows API token can READ but cannot UPDATE - this is a permissions issue
        errorMessage = 
          "Access denied: You do not have permission to update this profile. " +
          "Diagnostic check shows the API token can READ the profile but cannot UPDATE it. " +
          "This is a Strapi permissions configuration issue. Please check:\n\n" +
          "1. API Token permissions (MOST LIKELY ISSUE):\n" +
          "   - Go to Strapi Admin → Settings → API Tokens\n" +
          "   - Edit the API token used in NEXT_PUBLIC_API_TOKEN\n" +
          "   - Under Permissions, ensure 'student-profiles' has 'update' permission enabled\n" +
          "   - Currently the token has 'find'/'findOne' (read) but NOT 'update' (write)\n\n" +
          "2. User Role permissions:\n" +
          "   - Go to Settings → Users & Permissions plugin → Roles → Authenticated\n" +
          "   - Ensure 'student-profiles' has 'updateOwn' permission checked\n\n" +
          "3. Content-Type permissions:\n" +
          "   - Verify the 'student-profiles' content type allows updates in Strapi settings\n\n" +
          "All update attempts (user JWT, API token with numeric ID) failed with 403 Forbidden.";
      } else {
        errorMessage = result?.error?.message || result?.message || "Failed to update student profile";
      }
      
      return NextResponse.json(
        { 
          error: errorMessage, 
          details: {
            ...result,
            triedUserJwt: !!userJwt,
            triedApiToken: !!apiToken,
            actualProfileId,
            requestedProfileId: id,
          }
        },
        { status: response.status || 500 }
      );
    }

    // Check if the update result has a different ID (new profile created)
    const updatedProfileId = result?.data?.id;
    let finalProfileId = actualProfileId;
    if (updatedProfileId && updatedProfileId !== actualProfileId) {
      console.warn("Update returned different profile ID:", {
        requestedId: id,
        actualProfileId,
        returnedId: updatedProfileId,
        message: "This might indicate a new profile was created instead of updated"
      });
      // Use the returned ID for fetching
      finalProfileId = updatedProfileId;
    }
    
    // Fetch the updated profile with populated components to verify the update
    // Use documentId if available, otherwise use the final profile ID
    const fetchUrl = profileDocumentId 
      ? `${strapiUrl}/api/student-profiles/${profileDocumentId}?populate[residentialAddress][populate]=*&populate[birthAddress][populate]=*&populate[personToBeContacted][populate]=*&populate[primary_education][populate]=*&populate[secondary_education][populate]=*&populate[tertiary_educations][populate]=*&populate[professional_experiences][populate]=*&populate[research_engagements][populate]=*`
      : `${strapiUrl}/api/student-profiles/${finalProfileId}?populate[residentialAddress][populate]=*&populate[birthAddress][populate]=*&populate[personToBeContacted][populate]=*&populate[primary_education][populate]=*&populate[secondary_education][populate]=*&populate[tertiary_educations][populate]=*&populate[professional_experiences][populate]=*&populate[research_engagements][populate]=*`;
    
    const fetchResponse = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(userJwt && { Authorization: `Bearer ${userJwt}` }),
      },
    });
    
    if (fetchResponse.ok) {
      const fetchedResult = await fetchResponse.json().catch(() => ({}));
      const fetchedProfileId = fetchedResult?.data?.id;
      console.log("Fetched updated profile:", {
        requestedId: id,
        actualProfileId,
        finalProfileId,
        fetchedProfileId,
        hasResidentialAddress: !!fetchedResult?.data?.residentialAddress,
        residentialAddressId: fetchedResult?.data?.residentialAddress?.id,
      });
      
      // If the fetched profile has a different ID, include it in the response details
      if (fetchedProfileId && fetchedProfileId !== actualProfileId) {
        return NextResponse.json({
          ...fetchedResult,
          profileIdChanged: true,
          oldProfileId: actualProfileId,
          newProfileId: fetchedProfileId
        }, { status: 200 });
      }
      
      // Return the fetched profile with populated components
      return NextResponse.json(fetchedResult, { status: 200 });
    }
    
    // If fetch failed, return the original result
    console.log("Update successful (could not fetch populated):", {
      profileId: result?.data?.id,
      hasResidentialAddress: !!result?.data?.residentialAddress,
    });
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Student profile update error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to update student profile";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

