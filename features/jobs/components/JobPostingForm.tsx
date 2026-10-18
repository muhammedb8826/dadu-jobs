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
import { toast } from "sonner";
import type { Category, JobFormData } from "../types/job.types";
import { WORKPLACE_TYPES, JOB_TYPES, EXPERIENCE_LEVELS } from "../constants/job.constants";
import { extractRichTextPlainText } from "@/lib/strapi/rich-text";

export function JobPostingForm({ jobId }: { jobId?: number | string }) {
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
    workplaceType: WORKPLACE_TYPES[1], // Default to "On Site"
    isFeatured: false,
    isActive: true,
    experience: EXPERIENCE_LEVELS[0], // Default to "Entry"
    salaryMin: "",
    salaryMax: "",
    salaryCurrency: "ETB",
    isNegotiable: false,
    categories: [],
    jobCode: "",
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
          console.log("Loading job with ID:", jobId);
          const response = await fetch(`/api/jobs?id=${jobId}`);
          console.log("Job fetch response status:", response.status);
          
          if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            console.error("Job fetch failed:", response.status, errorText);
            setSubmitError(`Failed to load job details: ${response.status}`);
            setIsLoading(false);
            return;
          }

          const result = await response.json();
          console.log("Job fetch result:", result);
          
          if (result?.data) {
            const job = result.data;
            console.log("Setting form data with job:", job);
            setFormData({
              title: job.title || "",
              description: extractRichTextPlainText(job.description),
              location: job.location || "",
              jobType: job.jobType || "",
              deadline: job.deadline || "",
              workplaceType: job.workplaceType || "On Site",
              isFeatured: job.isFeatured || false,
              isActive: job.isActive ?? true,
              experience: job.experience || "Entry",
              salaryMin: job.salary?.min?.toString() || "",
              salaryMax: job.salary?.max?.toString() || "",
              salaryCurrency: job.salary?.currency || "ETB",
              isNegotiable: job.salary?.isNegotiable || false,
              categories: job.categories?.map((cat: Category) => cat.id) || [],
              jobCode: job.jobCode || "",
            });
          } else {
            console.error("No data in response:", result);
            setSubmitError("Job data not found in response");
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
        toast.error("Job title is required");
        setIsSaving(false);
        return;
      }
      if (!formData.description.trim()) {
        toast.error("Job description is required");
        setIsSaving(false);
        return;
      }
      if (!formData.deadline) {
        toast.error("Application deadline is required");
        setIsSaving(false);
        return;
      }
      if (!formData.jobCode.trim()) {
        toast.error("Job code is required");
        setIsSaving(false);
        return;
      }
      if (formData.categories.length === 0) {
        toast.error("At least one category is required");
        setIsSaving(false);
        return;
      }

      // Prepare payload
      const payload: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        deadline: formData.deadline,
        workplaceType: formData.workplaceType,
        isFeatured: formData.isFeatured,
        isActive: formData.isActive,
        experience: formData.experience,
        categories: formData.categories,
        jobCode: formData.jobCode.trim(),
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
        
        toast.error(errorMessage);
        setSubmitError(errorMessage);
        setIsSaving(false);
        return;
      }

      toast.success(jobId ? "Job updated successfully!" : "Job created successfully!");
      setSubmitSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/jobs");
        router.refresh();
      }, 2000);
    } catch (error) {
      console.error("Error saving job:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save job posting";
      toast.error(errorMessage);
      setSubmitError(errorMessage);
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
            <Label htmlFor="jobCode">
              Job Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="jobCode"
              value={formData.jobCode}
              onChange={(e) => handleInputChange("jobCode", e.target.value)}
              placeholder="e.g., 8.40/DaDU-52565"
              required
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier for this job posting
            </p>
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
                  {JOB_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
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
                  {WORKPLACE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
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
                  {EXPERIENCE_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
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

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange("isActive", checked === true)}
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Job is active
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
