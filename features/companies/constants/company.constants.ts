/**
 * Company industry options
 */
export const COMPANY_INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Manufacturing",
  "Retail",
  "Hospitality",
  "Construction",
  "Consulting",
  "Other",
] as const;

export type CompanyIndustry = (typeof COMPANY_INDUSTRIES)[number];
