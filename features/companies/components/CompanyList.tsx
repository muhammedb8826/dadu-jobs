"use client";

import { CompanyCard } from "./CompanyCard";
import type { Company } from "../types/company.types";
import { Building2 } from "lucide-react";

interface CompanyListProps {
  companies: Company[];
  strapiBaseUrl?: string;
}

export function CompanyList({ companies, strapiBaseUrl }: CompanyListProps) {
  if (companies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No companies available</h3>
        <p className="text-sm text-muted-foreground">
          Check back later for new companies
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <CompanyCard key={company.id} company={company} strapiBaseUrl={strapiBaseUrl} />
      ))}
    </div>
  );
}
