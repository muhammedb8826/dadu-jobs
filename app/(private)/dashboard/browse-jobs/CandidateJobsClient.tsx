"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, MapPin, Grid3x3, List, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CandidateJobCard } from "./CandidateJobCard";
import { JOB_TYPES, WORKPLACE_TYPES } from "@/features/jobs";
import { COMPANY_INDUSTRIES } from "@/features/companies";
import type { Job } from "@/features/jobs/types/job.types";
import type { Category } from "@/features/jobs/types/job.types";
import { extractRichTextPlainText } from "@/lib/strapi/rich-text";

interface CandidateJobsClientProps {
  initialJobs: Job[];
  categories: Category[];
  /** Numeric id and/or documentId strings */
  appliedJobIds: Array<number | string>;
  /** Numeric id and/or documentId strings */
  savedJobIds: Array<number | string>;
}

export function CandidateJobsClient({ initialJobs, appliedJobIds, savedJobIds }: CandidateJobsClientProps) {
  const appliedJobsSet = useMemo(
    () => new Set(appliedJobIds.map((id) => String(id))),
    [appliedJobIds]
  );
  const savedJobsSet = useMemo(
    () => new Set(savedJobIds.map((id) => String(id))),
    [savedJobIds]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [location, setLocation] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [activeLocation, setActiveLocation] = useState("");
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedWorkplaceTypes, setSelectedWorkplaceTypes] = useState<string[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12); // Show 12 jobs per page

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    let filtered = initialJobs.filter((job) => job.isActive);

    // Search filter
    if (activeSearchTerm.trim()) {
      const searchLower = activeSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (job) => {
          const descriptionText = extractRichTextPlainText(job.description).toLowerCase();
          return (
            job.title.toLowerCase().includes(searchLower) ||
            descriptionText.includes(searchLower) ||
            job.company?.name.toLowerCase().includes(searchLower) ||
            job.categories?.some((cat) =>
              cat.name.toLowerCase().includes(searchLower)
            )
          );
        }
      );
    }

    // Location filter
    if (activeLocation.trim()) {
      filtered = filtered.filter((job) =>
        job.location?.toLowerCase().includes(activeLocation.toLowerCase())
      );
    }

    // Job type filter
    if (selectedJobTypes.length > 0) {
      filtered = filtered.filter((job) =>
        selectedJobTypes.includes(job.jobType || "")
      );
    }

    // Workplace type filter
    if (selectedWorkplaceTypes.length > 0) {
      filtered = filtered.filter((job) =>
        selectedWorkplaceTypes.includes(job.workplaceType || "")
      );
    }

    // Industry filter
    if (selectedIndustry !== "all") {
      filtered = filtered.filter((job) => job.company?.industry === selectedIndustry);
    }

    // Salary filter
    if (minSalary) {
      const min = Number(minSalary);
      filtered = filtered.filter((job) => {
        const jobMin = job.salary?.min;
        return jobMin && jobMin >= min;
      });
    }
    if (maxSalary) {
      const max = Number(maxSalary);
      filtered = filtered.filter((job) => {
        const jobMax = job.salary?.max;
        return jobMax && jobMax <= max;
      });
    }

    return filtered;
  }, [
    initialJobs,
    activeSearchTerm,
    activeLocation,
    selectedJobTypes,
    selectedWorkplaceTypes,
    selectedIndustry,
    minSalary,
    maxSalary,
  ]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearchTerm(searchTerm);
    setActiveLocation(location);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setLocation("");
    setActiveSearchTerm("");
    setActiveLocation("");
    setSelectedJobTypes([]);
    setSelectedWorkplaceTypes([]);
    setSelectedIndustry("all");
    setMinSalary("");
    setMaxSalary("");
  };

  const hasActiveFilters = useMemo(() => {
    return (
      activeSearchTerm.trim() !== "" ||
      activeLocation.trim() !== "" ||
      selectedJobTypes.length > 0 ||
      selectedWorkplaceTypes.length > 0 ||
      selectedIndustry !== "all" ||
      minSalary !== "" ||
      maxSalary !== ""
    );
  }, [
    activeSearchTerm,
    activeLocation,
    selectedJobTypes,
    selectedWorkplaceTypes,
    selectedIndustry,
    minSalary,
    maxSalary,
  ]);

  const toggleJobType = (type: string) => {
    setSelectedJobTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setCurrentPage(1); // Reset to first page on filter change
  };

  const toggleWorkplaceType = (type: string) => {
    setSelectedWorkplaceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setCurrentPage(1); // Reset to first page on filter change
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    // Scroll to top of job list
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Header Section */}
      <header className="border-b bg-background px-4 sm:px-6 py-6 sm:py-8">
        <div className="container mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Find Your Dream Job
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Discover opportunities that match your passion
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Job title, keywords"
                className="pl-10 h-12"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Location"
                className="pl-10 h-12"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-8 w-full sm:w-auto">
              Search Jobs
            </Button>
          </form>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row flex-1 gap-6 px-4 sm:px-6 py-4 sm:py-6">
        {/* Left Sidebar - Filters */}
        <aside className="w-full lg:w-80 space-y-6">
          <div className="bg-background rounded-lg border p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold">Filter Jobs</h2>
              {hasActiveFilters && (
                <Button
                  variant="link"
                  className="h-auto p-0 text-primary"
                  onClick={handleClearFilters}
                >
                  Clear All
                </Button>
              )}
            </div>

            {/* Job Type Filter */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Job Type</Label>
              </div>
              <div className="space-y-2">
                {JOB_TYPES.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`job-type-${type}`}
                      checked={selectedJobTypes.includes(type)}
                      onCheckedChange={() => toggleJobType(type)}
                    />
                    <Label
                      htmlFor={`job-type-${type}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Workplace Type Filter */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Workplace Type</Label>
              </div>
              <div className="space-y-2">
                {WORKPLACE_TYPES.map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`workplace-${type}`}
                      checked={selectedWorkplaceTypes.includes(type)}
                      onCheckedChange={() => toggleWorkplaceType(type)}
                    />
                    <Label
                      htmlFor={`workplace-${type}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {type}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Industry Filter */}
            <div className="space-y-3 mb-6">
              <Label className="text-sm font-medium">Industry</Label>
              <Select 
                value={selectedIndustry} 
                onValueChange={(value) => {
                  setSelectedIndustry(value);
                  setCurrentPage(1); // Reset to first page on filter change
                }}
              >
                <SelectTrigger>
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
            </div>

            {/* Salary Range Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Salary Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="min-salary" className="text-xs text-muted-foreground">
                    Min Salary
                  </Label>
                  <Input
                    id="min-salary"
                    type="number"
                    placeholder="Min"
                    value={minSalary}
                    onChange={(e) => {
                      setMinSalary(e.target.value);
                      setCurrentPage(1); // Reset to first page on filter change
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="max-salary" className="text-xs text-muted-foreground">
                    Max Salary
                  </Label>
                  <Input
                    id="max-salary"
                    type="number"
                    placeholder="Max"
                    value={maxSalary}
                    onChange={(e) => {
                      setMaxSalary(e.target.value);
                      setCurrentPage(1); // Reset to first page on filter change
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1">
          <div className="bg-background rounded-lg border p-4 sm:p-6">
            {/* Header with count and view toggle */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-6">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Job Cards */}
            {filteredJobs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No jobs found matching your criteria.</p>
              </div>
            ) : (
              <>
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6"
                      : "space-y-4"
                  }
                >
                  {paginatedJobs.map((job) => (
                    <CandidateJobCard 
                      key={job.id} 
                      job={job} 
                      viewMode={viewMode}
                      isApplied={
                        appliedJobsSet.has(String(job.id)) ||
                        (!!job.documentId &&
                          appliedJobsSet.has(String(job.documentId)))
                      }
                      isSaved={
                        savedJobsSet.has(String(job.id)) ||
                        (!!job.documentId && savedJobsSet.has(String(job.documentId)))
                      }
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="text-xs sm:text-sm"
                    >
                      <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden xs:inline">Previous</span>
                      <span className="xs:hidden">Prev</span>
                    </Button>

                    <div className="flex items-center gap-1 order-last sm:order-0 w-full sm:w-auto justify-center mt-2 sm:mt-0">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, current page, and pages around current
                        const showPage =
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1);

                        const showEllipsis =
                          (page === currentPage - 2 && currentPage > 3) ||
                          (page === currentPage + 2 && currentPage < totalPages - 2);

                        if (showEllipsis) {
                          return (
                            <span key={page} className="px-2 text-muted-foreground">
                              ...
                            </span>
                          );
                        }

                        if (!showPage) return null;

                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(page)}
                            className="min-w-10"
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="text-xs sm:text-sm"
                    >
                      <span className="hidden xs:inline">Next</span>
                      <span className="xs:hidden">Next</span>
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
