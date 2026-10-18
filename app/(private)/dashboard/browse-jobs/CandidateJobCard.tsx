"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { resolveImageUrl } from "@/lib/strapi/media";
import { getStrapiURL } from "@/lib/strapi/client";
import type { Job } from "@/features/jobs/types/job.types";
import { SaveButton } from "./SaveButton";

interface CandidateJobCardProps {
  job: Job;
  viewMode: "grid" | "list";
  isApplied?: boolean;
  isSaved?: boolean;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const year = date.getFullYear();
    const suffix = day === 1 || day === 21 || day === 31 ? "st" : day === 2 || day === 22 ? "nd" : day === 3 || day === 23 ? "rd" : "th";
    return `${day}${suffix} ${month} ${year}`;
  } catch {
    return dateString;
  }
}

function formatSalary(salary: Job["salary"]): string {
  if (!salary) return "";
  const { min, max, currency, isNegotiable } = salary;
  if (isNegotiable) return "Negotiable";
  // Format as "$60k/m" style if we have min, otherwise show range
  if (min && max && min === max) {
    return `${currency}${min}k/m`;
  }
  if (min && max) {
    return `${currency}${min}k - ${currency}${max}k/m`;
  }
  if (min) {
    return `${currency}${min}k/m`;
  }
  if (max) {
    return `${currency}${max}k/m`;
  }
  return "";
}

function resolveLogoUrl(company: Job["company"]): string | null {
  if (!company?.logo) return null;

  const strapiBaseUrl = getStrapiURL();
  if (!strapiBaseUrl) return null;

  const logo = Array.isArray(company.logo) ? company.logo[0] : company.logo;
  if (!logo || !logo.url) return null;

  if (logo.url.startsWith("http://") || logo.url.startsWith("https://")) {
    return logo.url;
  }

  return resolveImageUrl(logo, strapiBaseUrl) || null;
}

export function CandidateJobCard({ job, viewMode, isApplied = false, isSaved = false }: CandidateJobCardProps) {
  const logoUrl = resolveLogoUrl(job.company);
  const salaryText = formatSalary(job.salary);
  const publishedDate = formatDate(job.publishedAt);

  // Get category name for tag
  const categoryName = job.categories?.[0]?.name || "";

  if (viewMode === "list") {
    return (
      <Link href={`/dashboard/browse-jobs/${job.slug}`} className="block">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* Company Logo */}
            <div className="shrink-0">
              {logoUrl ? (
                <div className="relative h-12 w-12 sm:h-16 sm:w-16 rounded-lg overflow-hidden bg-muted">
                  <Image
                    src={logoUrl}
                    alt={job.company?.name || "Company"}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold text-base sm:text-lg">
                  {job.company?.name?.substring(0, 2).toUpperCase() || "CO"}
                </div>
              )}
            </div>

            {/* Job Info */}
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 w-full sm:w-auto">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <h3 className="text-base sm:text-lg font-semibold text-foreground">
                      {job.title}
                    </h3>
                    {isApplied && (
                      <Badge variant="default" className="gap-1 w-fit">
                        <CheckCircle2 className="h-3 w-3" />
                        Applied
                      </Badge>
                    )}
                    {!isApplied && (
                      <div className="sm:hidden">
                        <SaveButton jobId={job.documentId || job.id} initialSaved={isSaved} />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {job.company?.name}
                  </p>
                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs sm:text-sm">
                    {job.location && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span className="truncate">{job.location}</span>
                      </div>
                    )}
                    {publishedDate && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                        <span>{publishedDate}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {job.jobType && (
                      <Badge variant="secondary" className="text-xs">
                        {job.jobType}
                      </Badge>
                    )}
                    {categoryName && (
                      <Badge variant="secondary" className="text-xs">
                        {categoryName}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                  {salaryText && (
                    <p className="text-base sm:text-lg font-bold text-primary whitespace-nowrap">{salaryText}</p>
                  )}
                  {!isApplied && (
                    <div className="hidden sm:block">
                      <SaveButton jobId={job.documentId || job.id} initialSaved={isSaved} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </Link>
    );
  }

  // Grid view
  return (
    <Link href={`/dashboard/browse-jobs/${job.slug}`} className="block h-full">
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
                <Image
                  src={logoUrl}
                  alt={job.company?.name || "Company"}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                {job.company?.name?.substring(0, 2).toUpperCase() || "CO"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground mb-1 line-clamp-1">
                {job.title}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {job.company?.name}
              </p>
            </div>
          </div>
          {isApplied ? (
            <Badge variant="default" className="gap-1 shrink-0">
              <CheckCircle2 className="h-3 w-3" />
              Applied
            </Badge>
          ) : (
            <SaveButton jobId={job.documentId || job.id} initialSaved={isSaved} />
          )}
        </div>

        <div className="space-y-3">
          {job.location && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{job.location}</span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {job.jobType && (
              <Badge variant="secondary" className="text-xs">
                {job.jobType}
              </Badge>
            )}
            {categoryName && (
              <Badge variant="secondary" className="text-xs">
                {categoryName}
              </Badge>
            )}
          </div>

          {publishedDate && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{publishedDate}</span>
            </div>
          )}

          {salaryText && (
            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-base font-bold text-primary">{salaryText}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
