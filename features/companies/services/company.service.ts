import { getStrapiURL } from "@/lib/strapi/client";
import type { Company } from "../types/company.types";

/**
 * Get all companies (public listing)
 */
export async function getCompanies(featuredOnly: boolean = false): Promise<Company[]> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return [];
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    // Populate logo with only needed fields (not * to avoid invalid relations)
    const populateQuery = "populate[logo][fields][0]=id&populate[logo][fields][1]=url&populate[logo][fields][2]=name&populate[logo][fields][3]=alternativeText&populate[logo][fields][4]=formats&populate[socialLinks]=*";
    
    // Filter for featured companies if requested
    const filterQuery = featuredOnly 
      ? `filters[isFeatured][$eq]=true&` 
      : "";
    
    const url = `${strapiUrl}/api/companies?${filterQuery}${populateQuery}&pagination[limit]=1000`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("getCompanies: Response not OK. Status:", response.status, "Error:", errorText);
      return [];
    }

    const result = await response.json();
    return result?.data || [];
  } catch (error) {
    console.error("Error fetching companies:", error);
    return [];
  }
}

/**
 * Get featured companies only
 */
export async function getFeaturedCompanies(): Promise<Company[]> {
  return getCompanies(true);
}

/**
 * Get a single company by slug
 */
export async function getCompanyBySlug(slug: string): Promise<Company | null> {
  try {
    const strapiUrl = getStrapiURL();
    if (!strapiUrl) {
      return null;
    }

    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    // Populate logo with only needed fields (not * to avoid invalid relations)
    // Using the same approach as other media fields in the codebase
    const populateQuery = "populate[logo][fields][0]=id&populate[logo][fields][1]=url&populate[logo][fields][2]=name&populate[logo][fields][3]=alternativeText&populate[logo][fields][4]=formats&populate[socialLinks]=*";
    
    const url = `${strapiUrl}/api/companies?filters[slug][$eq]=${encodeURIComponent(slug)}&${populateQuery}&pagination[limit]=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken && { Authorization: `Bearer ${apiToken}` }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    if (!result?.data || result.data.length === 0) {
      return null;
    }

    return result.data[0];
  } catch (error) {
    console.error("Error fetching company by slug:", error);
    return null;
  }
}
