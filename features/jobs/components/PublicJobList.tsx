"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { StrapiRichText } from "@/components/StrapiRichText";
import { MapPin, Calendar, Building2 } from "lucide-react";
import Image from "next/image";
import { resolveImageUrl } from "@/lib/strapi/media";
import { extractRichTextPlainText } from "@/lib/strapi/rich-text";
import type { Job } from "../types/job.types";
import { SaveJobButton } from "./SaveJobButton";

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInHours < 1) {
    return "Just now";
  } else if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`;
  } else {
    return formatDate(dateString);
  }
}

function resolveLogoUrl(company: Job["company"], strapiBaseUrl?: string): string | null {
  if (!company?.logo || !strapiBaseUrl) {
    return null;
  }

  // Handle case where logo might be an array (Strapi sometimes returns arrays)
  const logo = Array.isArray(company.logo) ? company.logo[0] : company.logo;
  
  if (!logo || !logo.url) {
    return null;
  }

  // If logo URL is already absolute, use it directly
  if (logo.url.startsWith("http://") || logo.url.startsWith("https://")) {
    return logo.url;
  }

  // Use the existing resolveImageUrl utility
  return resolveImageUrl(logo, strapiBaseUrl) || null;
}

interface PublicJobListProps {
  jobs: Job[];
}

export function PublicJobList({ jobs }: PublicJobListProps) {
  const strapiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No jobs available</h3>
        <p className="text-sm text-muted-foreground">
          Check back later for new job opportunities
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => {
        const descriptionText = extractRichTextPlainText(job.description);
        // Show summary (first 400 characters, within 300-500 range)
        const SUMMARY_LENGTH = 400;
        const summary = descriptionText.length > SUMMARY_LENGTH 
          ? descriptionText.substring(0, SUMMARY_LENGTH) + "..." 
          : descriptionText;
        const hasMoreContent = descriptionText.length > SUMMARY_LENGTH;
        
        // Resolve company logo URL
        const logoUrl = resolveLogoUrl(job.company, strapiBaseUrl);
        
        return (
          <Card key={job.id} className="relative">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-3">
                    {job.isFeatured && (
                      <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20">
                        New
                      </Badge>
                    )}
                    {/* <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                      Premium
                    </Badge>
                    <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                      <Zap className="h-3 w-3 mr-1" />
                      Easy Apply
                    </Badge> */}
                  </div>

                  {/* Category Badges */}
                  {job.categories && job.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {job.categories.map((category) => (
                        <Badge key={category.id} variant="outline">
                          {category.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Job Title and Company Logo Row */}
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-2">{job.title}</h3>
                      {/* Company and Time */}
                      <p className="text-sm text-muted-foreground">
                        {job.publishedAt 
                          ? `${getTimeAgo(job.publishedAt)} by ` 
                          : ""}
                        {job.company?.name && job.company?.slug && (
                          <Link 
                            href={`/companies/${job.company.slug}`}
                            className="text-primary hover:underline"
                          >
                            {job.company.name}
                          </Link>
                        )}
                        {!job.company?.name && "Company"}
                      </p>
                    </div>
                    {/* Company Logo/Info on Right - aligned with title */}
                    {job.company && (
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="w-20 h-20 bg-primary/10 rounded-lg overflow-hidden flex items-center justify-center">
                          {logoUrl ? (
                            <Image
                              src={logoUrl}
                              alt={Array.isArray(job.company?.logo) ? job.company.logo[0]?.alternativeText || job.company?.name : job.company?.logo?.alternativeText || job.company?.name || "Company logo"}
                              width={80}
                              height={80}
                              className="object-contain w-full h-full"
                            />
                          ) : (
                            <Building2 className="h-8 w-8 text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground text-right max-w-[100px]">
                          {job.company.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Job Details */}
                  <div className="space-y-2 mb-4">
                    {job.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>{job.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(job.deadline)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                      <span>{job.workplaceType}</span>
                    </div>
                  </div>

                  {/* Description Summary with Accordion */}
                  {job.description ? (
                    <Accordion type="single" collapsible className="w-full mb-4">
                      <AccordionItem value={`description-${job.id}`} className="border-none">
                        <div className="text-sm text-muted-foreground mb-2">
                          {summary}
                        </div>
                        {hasMoreContent && (
                          <>
                            <AccordionTrigger className="py-2 text-sm font-medium text-primary hover:no-underline justify-start gap-2">
                              <span className="data-[state=closed]:inline data-[state=open]:hidden">See more</span>
                              <span className="hidden data-[state=open]:inline">See less</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2">
                              <StrapiRichText
                                content={job.description}
                                className="text-sm text-muted-foreground max-w-none"
                              />
                            </AccordionContent>
                          </>
                        )}
                      </AccordionItem>
                    </Accordion>
                  ) : null}

                  {/* Action Buttons */}
                  <div className="mt-4 flex gap-2">
                    <Button asChild className="flex-1 sm:flex-initial">
                      <Link href={`/jobs/${job.slug}`}>
                        View Job
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Save Job Button */}
                <SaveJobButton
                  jobId={job.id}
                  jobSlug={job.slug}
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 h-8 w-8"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
