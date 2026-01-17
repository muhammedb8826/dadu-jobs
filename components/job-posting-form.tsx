"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type Category = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
};

type JobFormData = {
  title: string;
  description: string;
  location: string;
  jobType: string;
  deadline: string;
  workplaceType: string;
  isFeatured: boolean;
  experience: string;
  salaryMin: string;
  salaryMax: string;
  salaryCurrency: string;
  isNegotiable: boolean;
  categories: number[];
};

export function JobPostingForm({ jobId }: { jobId?: number }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(!!jobId);
  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const [formData, setFormData] = useState<JobFormData>({
    title: "",
    description: "",
    location: "",
    jobType: "",
    deadline: "",
    workplaceType: "On Site",
    isFeatured: false,
    experience: "Entry",
    salaryMin: "",
    salaryMax: "",
    salaryCurrency: "ETB",
    isNegotiable: false,
    categories: [],
  });

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch("/api/jobs?categories=true");
        if (response.ok) {
          const result = await response.json();
          if (result?.data) {
            setCategories(result.data);
          }
        }
      } catch (error) {
        console.error("Error loading categories:", error);
      }
    };

    loadCategories();
  }, []);

  // Load existing job if editing
  useEffect(() => {
    if (jobId) {
      const loadJob = async () => {
        try {
          const response = await fetch(`/api/jobs?id=${jobId}`);
          if (response.ok) {
            const result = await response.json();
            if (result?.data) {
              const job = result.data;
              setFormData({
                title: job.title || "",
                description: job.description || "",
                location: job.location || "",
                jobType: job.jobType || "",
                deadline: job.deadline || "",
                workplaceType: job.workplaceType || "On Site",
                isFeatured: job.isFeatured || false,
                experience: job.experience || "Entry",
                salaryMin: job.salary?.min?.toString() || "",
                salaryMax: job.salary?.max?.toString() || "",
                salaryCurrency: job.salary?.currency || "ETB",
                isNegotiable: job.salary?.isNegotiable || false,
                categories: job.categories?.map((cat: Category) => cat.id) || [],
              });
            }
          }
        } catch (error) {
          console.error("Error loading job:", error);
          setSubmitError("Failed to load job details");
        } finally {
          setIsLoading(false);
        }
      };

      loadJob();
    } else {
      setIsLoading(false);
    }
  }, [jobId]);

  const handleInputChange = (field: keyof JobFormData, value: string | boolean | number[]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCategoryToggle = (categoryId: number) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter((id) => id !== categoryId)
        : [...prev.categories, categoryId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSubmitError(null);

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error("Job title is required");
      }
      if (!formData.description.trim()) {
        throw new Error("Job description is required");
      }
      if (!formData.deadline) {
        throw new Error("Application deadline is required");
      }
      if (formData.categories.length === 0) {
        throw new Error("At least one category is required");
      }

      // Prepare payload
      const payload: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        deadline: formData.deadline,
        workplaceType: formData.workplaceType,
        isFeatured: formData.isFeatured,
        experience: formData.experience,
        categories: formData.categories,
      };

      if (formData.location) {
        payload.location = formData.location.trim();
      }

      if (formData.jobType) {
        payload.jobType = formData.jobType;
      }

      // Handle salary
      const salary: Record<string, unknown> = {
        currency: formData.salaryCurrency,
        isNegotiable: formData.isNegotiable,
      };

      if (formData.salaryMin) {
        salary.min = parseFloat(formData.salaryMin);
      }

      if (formData.salaryMax) {
        salary.max = parseFloat(formData.salaryMax);
      }

      payload.salary = salary;

      const url = "/api/jobs";
      const method = jobId ? "PUT" : "POST";
      const body = jobId
        ? { data: { id: jobId, ...payload } }
        : { data: payload };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      let result: Record<string, unknown> = {};
      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch {
          result = { error: responseText };
        }
      }

      if (!response.ok) {
        let errorMessage = "Failed to save job posting";
        
        if (result?.error) {
          if (typeof result.error === "string") {
            errorMessage = result.error;
          } else if (typeof result.error === "object" && result.error !== null && "message" in result.error) {
            errorMessage = (result.error as { message?: string }).message || errorMessage;
          }
        } else if (result?.message && typeof result.message === "string") {
          errorMessage = result.message;
        }
        
        throw new Error(errorMessage);
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/jobs");
        router.refresh();
      }, 2000);
    } catch (error) {
      console.error("Error saving job:", error);
      setSubmitError(error instanceof Error ? error.message : "Failed to save job posting");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {submitSuccess && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>Job posting saved successfully! Redirecting...</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Job Information</CardTitle>
          <CardDescription>Basic details about the job posting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Job Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              placeholder="e.g., Senior Software Engineer"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Job Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter a detailed job description..."
              rows={12}
              required
            />
            <p className="text-xs text-muted-foreground">
              You can use HTML formatting in the description
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange("location", e.target.value)}
                placeholder="e.g., Addis Ababa, Ethiopia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobType">Job Type</Label>
              <Select
                value={formData.jobType}
                onValueChange={(value) => handleInputChange("jobType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full Time">Full Time</SelectItem>
                  <SelectItem value="Part Time">Part Time</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Internship">Internship</SelectItem>
                  <SelectItem value="Temporary">Temporary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workplaceType">
                Workplace Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.workplaceType}
                onValueChange={(value) => handleInputChange("workplaceType", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="On Site">On Site</SelectItem>
                  <SelectItem value="Remote">Remote</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">
                Experience Level <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.experience}
                onValueChange={(value) => handleInputChange("experience", value)}
                required
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entry">Entry</SelectItem>
                  <SelectItem value="Mid">Mid</SelectItem>
                  <SelectItem value="Senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">
              Application Deadline <span className="text-destructive">*</span>
            </Label>
            <Input
              id="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => handleInputChange("deadline", e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      {/* Salary Information */}
      <Card>
        <CardHeader>
          <CardTitle>Salary Information</CardTitle>
          <CardDescription>Compensation details for this position</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="salaryMin">Minimum Salary</Label>
              <Input
                id="salaryMin"
                type="number"
                value={formData.salaryMin}
                onChange={(e) => handleInputChange("salaryMin", e.target.value)}
                placeholder="e.g., 10000"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salaryMax">Maximum Salary</Label>
              <Input
                id="salaryMax"
                type="number"
                value={formData.salaryMax}
                onChange={(e) => handleInputChange("salaryMax", e.target.value)}
                placeholder="e.g., 20000"
                min="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salaryCurrency">Currency</Label>
              <Select
                value={formData.salaryCurrency}
                onValueChange={(value) => handleInputChange("salaryCurrency", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ETB">ETB (Ethiopian Birr)</SelectItem>
                  <SelectItem value="USD">USD (US Dollar)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isNegotiable"
              checked={formData.isNegotiable}
              onCheckedChange={(checked) => handleInputChange("isNegotiable", checked === true)}
            />
            <Label htmlFor="isNegotiable" className="cursor-pointer">
              Salary is negotiable
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Job Categories</CardTitle>
          <CardDescription>
            Select at least one category for this job <span className="text-destructive">*</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading categories...</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category.id}`}
                    checked={formData.categories.includes(category.id)}
                    onCheckedChange={() => handleCategoryToggle(category.id)}
                  />
                  <Label
                    htmlFor={`category-${category.id}`}
                    className="cursor-pointer font-normal"
                  >
                    {category.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Options */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Options</CardTitle>
          <CardDescription>Extra settings for your job posting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isFeatured"
              checked={formData.isFeatured}
              onCheckedChange={(checked) => handleInputChange("isFeatured", checked === true)}
            />
            <Label htmlFor="isFeatured" className="cursor-pointer">
              Feature this job posting (may require approval)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            jobId ? "Update Job Posting" : "Create Job Posting"
          )}
        </Button>
      </div>
    </form>
  );
}
