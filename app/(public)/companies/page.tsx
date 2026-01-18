import { getCompanies, getFeaturedCompanies } from "@/features/companies";
import { getStrapiURL } from "@/lib/strapi/client";
import { CompaniesPageClient } from "./CompaniesPageClient";

export const metadata = {
  title: "Companies | DADU Jobs",
  description: "Browse companies and find your next career opportunity",
};

export default async function CompaniesPage() {
  const [allCompanies, featuredCompanies] = await Promise.all([
    getCompanies(false),
    getFeaturedCompanies(),
  ]);

  const strapiBaseUrl = getStrapiURL();

  return (
    <CompaniesPageClient
      initialCompanies={allCompanies}
      initialFeaturedCompanies={featuredCompanies}
      strapiBaseUrl={strapiBaseUrl || undefined}
    />
  );
}
