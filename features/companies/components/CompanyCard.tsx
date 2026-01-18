"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import Image from "next/image";
import { resolveImageUrl } from "@/lib/strapi/media";
import type { Company } from "../types/company.types";

interface CompanyCardProps {
  company: Company;
  strapiBaseUrl?: string;
}

export function CompanyCard({ company, strapiBaseUrl }: CompanyCardProps) {
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

  return (
    <Link href={`/companies/${company.slug}`}>
      <Card className="transition-all hover:shadow-lg cursor-pointer h-full">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            {/* Company Logo */}
            <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={(Array.isArray(company.logo) ? company.logo[0] : company.logo)?.alternativeText || company.name}
                  width={64}
                  height={64}
                  className="object-contain w-full h-full"
                />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            {/* Company Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg mb-1 line-clamp-1">
                {company.name}
              </h3>
              {company.industry && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {company.industry}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
