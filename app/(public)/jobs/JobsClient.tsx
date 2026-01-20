"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PublicJobList, JOB_TYPES } from "@/features/jobs";
import { COMPANY_INDUSTRIES } from "@/features/companies";
import type { Job } from "@/features/jobs/types/job.types";
import type { Category } from "@/features/jobs/types/job.types";

interface JobsClientProps {
  initialJobs: Job[];
  categories: Category[];
}

export function JobsClient({ initialJobs, categories }: JobsClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedJobType, setSelectedJobType] = useState<string>("all");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("all");
  const [showFeatured, setShowFeatured] = useState(false);

  // Get unique locations from jobs
  const locations = useMemo(() => {
    const locs = initialJobs
      .map((job) => job.location)
      .filter((loc): loc is string => Boolean(loc));
    return Array.from(new Set(locs)).sort();
  }, [initialJobs]);

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    let filtered = initialJobs.filter((job) => job.isActive);

    // Featured filter
    if (showFeatured) {
      filtered = filtered.filter((job) => job.isFeatured);
    }

    // Search filter
    if (activeSearchTerm.trim()) {
      const searchLower = activeSearchTerm.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(searchLower) ||
          job.description?.toLowerCase().includes(searchLower) ||
          job.company?.name.toLowerCase().includes(searchLower) ||
          job.location?.toLowerCase().includes(searchLower) ||
          job.categories?.some((cat) =>
            cat.name.toLowerCase().includes(searchLower)
          )
      );
    }

    // Category filter
    if (selectedCategory !== "all") {
      const categoryId = parseInt(selectedCategory);
      filtered = filtered.filter((job) =>
        job.categories?.some((cat) => cat.id === categoryId)
      );
    }

    // Location filter
    if (selectedLocation !== "all") {
      filtered = filtered.filter((job) => job.location === selectedLocation);
    }

    // Job type filter
    if (selectedJobType !== "all") {
      filtered = filtered.filter((job) => job.jobType === selectedJobType);
    }

    // Industry filter
    if (selectedIndustry !== "all") {
      filtered = filtered.filter((job) => job.company?.industry === selectedIndustry);
    }

    // Time range filter
    if (selectedTimeRange !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      switch (selectedTimeRange) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter((job) => {
        if (!job.publishedAt) return false;
        const publishedDate = new Date(job.publishedAt);
        return publishedDate >= filterDate;
      });
    }

    return filtered;
  }, [
    initialJobs,
    activeSearchTerm,
    selectedCategory,
    selectedLocation,
    selectedJobType,
    selectedIndustry,
    selectedTimeRange,
    showFeatured,
  ]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Update active search term when search button is clicked
    setActiveSearchTerm(searchTerm);
  };

  const handleClearFilters = () => {
    setSearchTerm("");
    setActiveSearchTerm("");
    setSelectedCategory("all");
    setSelectedLocation("all");
    setSelectedJobType("all");
    setSelectedIndustry("all");
    setSelectedTimeRange("all");
    setShowFeatured(false);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      activeSearchTerm.trim() !== "" ||
      selectedCategory !== "all" ||
      selectedLocation !== "all" ||
      selectedJobType !== "all" ||
      selectedIndustry !== "all" ||
      selectedTimeRange !== "all" ||
      showFeatured
    );
  }, [
    activeSearchTerm,
    selectedCategory,
    selectedLocation,
    selectedJobType,
    selectedIndustry,
    selectedTimeRange,
    showFeatured,
  ]);

  return (
    <div className="w-full">
      {/* Green Header Section */}
      <div className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto max-w-7xl px-4 lg:px-8">
          <h1 className="text-3xl font-bold text-center mb-8">
            Find Your Dream Job in Ethiopia
          </h1>

          {/* Search Bar */}
          <div className="max-w-3xl mx-auto mb-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Job title, Keywords or industry"
                  className="pl-10 h-12 bg-background text-foreground"
                  id="job-search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button type="submit" size="lg" className="h-12 px-8 bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                Search
              </Button>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-12 px-6 bg-background text-foreground border-background/30 hover:bg-background/90"
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </form>
          </div>

          {/* Filter Buttons */}
          <div className="max-w-4xl mx-auto flex flex-wrap gap-2 justify-center">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[140px] bg-background/10 text-foreground border-background/20">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[140px] bg-background/10 text-foreground border-background/20">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((location) => (
                  <SelectItem key={location} value={location}>
                    {location}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedJobType} onValueChange={setSelectedJobType}>
              <SelectTrigger className="w-[140px] bg-background/10 text-foreground border-background/20">
                <SelectValue placeholder="Employment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {JOB_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
              <SelectTrigger className="w-[140px] bg-background/10 text-foreground border-background/20">
                <SelectValue placeholder="Industry" />
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

            <Select
              value={selectedTimeRange}
              onValueChange={setSelectedTimeRange}
            >
              <SelectTrigger className="w-[160px] bg-background/10 text-foreground border-background/20">
                <SelectValue placeholder="Posted Within" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="container mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-4">
            <Button
              variant="ghost"
              className={`rounded-none ${
                !showFeatured
                  ? "border-b-2 border-primary"
                  : "hover:border-b-2 hover:border-primary"
              }`}
              onClick={() => setShowFeatured(false)}
            >
              All Jobs
            </Button>
            <Button
              variant="ghost"
              className={`rounded-none ${
                showFeatured
                  ? "border-b-2 border-primary"
                  : "hover:border-b-2 hover:border-primary"
              }`}
              onClick={() => setShowFeatured(true)}
            >
              Featured Jobs
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>Sort by date</span>
          </div>
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          Showing {filteredJobs.length}{" "}
          {filteredJobs.length === 1 ? "job" : "jobs"}
        </div>

        <PublicJobList jobs={filteredJobs} />
      </div>
    </div>
  );
}
