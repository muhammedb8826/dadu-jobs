import { getPublicJobs, PublicJobList } from "@/features/jobs";
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

export const metadata = {
  title: "Job Opportunities | DADU Jobs",
  description: "Browse available job opportunities and find your next career move",
};

export default async function JobsPage() {
  const jobs = await getPublicJobs();

  // Ensure only active jobs are displayed (defensive filter)
  const activeJobs = jobs.filter((job) => job.isActive);

  return (
    <div className="w-full">
      {/* Green Header Section */}
      <div className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <h1 className="text-3xl font-bold text-center mb-8">
            Find Your Dream Job in Ethiopia
          </h1>

          {/* Search Bar */}
          <div className="max-w-3xl mx-auto mb-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Job title, Keywords or industry"
                  className="pl-10 h-12 bg-background text-foreground"
                  id="job-search"
                />
              </div>
              <Button size="lg" className="h-12 px-8">
                Search
              </Button>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="max-w-4xl mx-auto flex flex-wrap gap-2 justify-center">
            <Select>
              <SelectTrigger className="w-[140px] bg-background/10 text-foreground border-background/20">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger className="w-[140px] bg-background/10 text-foreground border-background/20">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger className="w-[140px] bg-background/10 text-foreground border-background/20">
                <SelectValue placeholder="Career" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Careers</SelectItem>
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger className="w-[140px] bg-background/10 text-foreground border-background/20">
                <SelectValue placeholder="Employment Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
              </SelectContent>
            </Select>

            <Select>
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
      <div className="container mx-auto px-4 py-8 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-4">
            <Button variant="ghost" className="border-b-2 border-primary rounded-none">
              All Jobs
            </Button>
            <Button variant="ghost" className="rounded-none">
              Featured Jobs
            </Button>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="h-4 w-4" />
            <span>Sort by date</span>
          </div>
        </div>

        <div className="mb-4 text-sm text-muted-foreground">
          Showing {activeJobs.length} {activeJobs.length === 1 ? "job" : "jobs"}
        </div>

        <PublicJobList jobs={activeJobs} />
      </div>
    </div>
  );
}
