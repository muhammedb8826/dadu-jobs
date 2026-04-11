import { getCompanyBySlug } from "@/features/companies";
import { getJobsByCompany } from "@/features/jobs";
import { getStrapiURL } from "@/lib/strapi/client";
import { extractRichTextPlainText } from "@/lib/strapi/rich-text";
import { CompanyDetailClient } from "./CompanyDetailClient";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);

  if (!company) {
    return {
      title: "Company Not Found | DADU Jobs",
    };
  }

  const descriptionText = extractRichTextPlainText(company.description);

  return {
    title: `${company.name} | DADU Jobs`,
    description: descriptionText
      ? descriptionText.substring(0, 160)
      : `Learn more about ${company.name}`,
  };
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);

  if (!company) {
    notFound();
  }

  // Fetch jobs for this company
  const companyJobs = await getJobsByCompany(company.id);
  const strapiBaseUrl = getStrapiURL();

  return (
    <CompanyDetailClient
      company={company}
      jobs={companyJobs}
      strapiBaseUrl={strapiBaseUrl || undefined}
    />
  );
}
