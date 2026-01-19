"use client";

import * as React from "react";
import { CompanyList, COMPANY_INDUSTRIES } from "@/features/companies";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Menu } from "lucide-react";
import type { Company } from "@/features/companies";

interface CompaniesPageClientProps {
  initialCompanies: Company[];
  initialFeaturedCompanies: Company[];
  strapiBaseUrl?: string;
}

export function CompaniesPageClient({
  initialCompanies,
  initialFeaturedCompanies,
  strapiBaseUrl,
}: CompaniesPageClientProps) {
  const [activeTab, setActiveTab] = React.useState<"featured" | "all">("featured");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedIndustry, setSelectedIndustry] = React.useState<string>("all");

  // Filter companies based on search query and industry
  const filteredCompanies = React.useMemo(() => {
    let companiesToShow = activeTab === "featured" ? initialFeaturedCompanies : initialCompanies;
    
    // Industry filter
    if (selectedIndustry !== "all") {
      companiesToShow = companiesToShow.filter(
        (company) => company.industry === selectedIndustry
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      companiesToShow = companiesToShow.filter(
        (company) =>
          company.name.toLowerCase().includes(query) ||
          company.industry?.toLowerCase().includes(query) ||
          company.location?.toLowerCase().includes(query)
      );
    }

    return companiesToShow;
  }, [initialCompanies, initialFeaturedCompanies, activeTab, searchQuery, selectedIndustry]);

  return (
    <div className="container mx-auto px-4 py-8 lg:px-8">
      {/* Header with Tabs and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex gap-4">
          <Button
            variant="ghost"
            className={`rounded-none border-b-2 ${
              activeTab === "featured"
                ? "border-primary text-primary"
                : "border-transparent"
            }`}
            onClick={() => setActiveTab("featured")}
          >
            Featured Companies
          </Button>
          <Button
            variant="ghost"
            className={`rounded-none border-b-2 ${
              activeTab === "all"
                ? "border-primary text-primary"
                : "border-transparent"
            }`}
            onClick={() => setActiveTab("all")}
          >
            All Companies
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Industries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {COMPANY_INDUSTRIES.map((industry) => (
                <SelectItem key={industry} value={industry}>
                  {industry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1 sm:flex-initial sm:min-w-[300px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search Companies"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="ghost" size="icon" className="shrink-0">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Company Count */}
      <div className="mb-6 text-sm text-muted-foreground">
        Showing {filteredCompanies.length}{" "}
        {filteredCompanies.length === 1 ? "company" : "companies"}
        {activeTab === "featured" && " (Featured)"}
      </div>

      {/* Company List */}
      <CompanyList 
        companies={filteredCompanies} 
        strapiBaseUrl={strapiBaseUrl}
      />
    </div>
  );
}
