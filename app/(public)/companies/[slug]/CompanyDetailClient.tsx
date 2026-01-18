"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { resolveImageUrl } from "@/lib/strapi/media";
import { PublicJobList } from "@/features/jobs";
import type { Company } from "@/features/companies";
import type { Job } from "@/features/jobs";

interface CompanyDetailClientProps {
  company: Company;
  jobs: Job[];
  strapiBaseUrl?: string;
}

export function CompanyDetailClient({
  company,
  jobs,
  strapiBaseUrl,
}: CompanyDetailClientProps) {
  const logoUrl = React.useMemo(() => {
    if (!company.logo) {
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

    // Otherwise, resolve with base URL
    if (strapiBaseUrl) {
      const resolved = resolveImageUrl(logo, strapiBaseUrl);
      if (resolved) {
        return resolved;
      }
    }

    // Fallback: try to construct URL from relative path if base URL exists
    if (strapiBaseUrl && logo.url) {
      const base = strapiBaseUrl.replace(/\/$/, "");
      const url = logo.url.startsWith("/") ? logo.url : `/${logo.url}`;
      return `${base}${url}`;
    }

    return null;
  }, [company.logo, strapiBaseUrl]);

  // Debug: Log logo data
  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("Company logo data:", JSON.stringify(company.logo, null, 2));
      console.log("Strapi base URL:", strapiBaseUrl);
      console.log("Resolved logo URL:", logoUrl);
    }
  }, [company.logo, strapiBaseUrl, logoUrl]);

  return (
    <div className="container mx-auto px-4 py-8 lg:px-8">
      <Button asChild variant="ghost" className="mb-6">
        <Link href="/companies">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Companies
        </Link>
      </Button>

      {/* Company Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          {logoUrl ? (
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
              <Image
                src={logoUrl}
                alt={(Array.isArray(company.logo) ? company.logo[0] : company.logo)?.alternativeText || company.name}
                width={80}
                height={80}
                className="object-contain w-full h-full"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Building2 className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold mb-1">{company.name}</h1>
            {company.industry && (
              <p className="text-muted-foreground">{company.industry}</p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-transparent p-0 h-auto border-b rounded-none">
          <TabsTrigger 
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="positions"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Open Positions
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-2">Working at {company.name}</h2>
              <h3 className="text-xl font-semibold mb-6">{company.name}</h3>

              {/* Who we are */}
              {company.description && (
                <div className="mb-8">
                  <h4 className="text-lg font-semibold mb-4 underline">Who we are?</h4>
                  <div
                    className="prose prose-sm max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: company.description }}
                  />
                </div>
              )}

              {/* Mission */}
              {company.tagline && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-4">Mission:</h4>
                  <p className="text-muted-foreground">{company.tagline}</p>
                </div>
              )}

              {/* Additional Company Info */}
              <div className="grid gap-4 md:grid-cols-2 mt-8 pt-8 border-t">
                {company.location && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Location</p>
                    <p className="text-sm text-muted-foreground">{company.location}</p>
                  </div>
                )}
                {company.companySize && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Company Size</p>
                    <p className="text-sm text-muted-foreground">{company.companySize}</p>
                  </div>
                )}
                {company.website && (
                  <div>
                    <p className="text-sm font-semibold mb-1">Website</p>
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {company.website}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Open Positions Tab */}
        <TabsContent value="positions" className="mt-6">
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {jobs.length} {jobs.length === 1 ? "position" : "positions"}
          </div>
          {jobs.length > 0 ? (
            <PublicJobList jobs={jobs} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No open positions</h3>
                <p className="text-sm text-muted-foreground">
                  This company doesn&apos;t have any open positions at the moment.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
