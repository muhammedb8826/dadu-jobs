"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Education {
  id?: number;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  description?: string;
}

interface Experience {
  id?: number;
  companyName: string;
  jobTitle: string;
  location?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  description?: Array<{
    type: string;
    children?: Array<{ text?: string }>;
  }>;
}

interface ApplyButtonProps {
  jobId: number;
  isDeadlinePassed: boolean;
  candidateResumeId?: number | null;
  hasApplied?: boolean;
  education?: Education[];
  experience?: Experience[];
}

export function ApplyButton({ 
  jobId, 
  isDeadlinePassed, 
  candidateResumeId, 
  hasApplied = false,
  education = [],
  experience = []
}: ApplyButtonProps) {
  const [open, setOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [selectedEducationId, setSelectedEducationId] = useState<string>("");
  const [cgpa, setCgpa] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Reset CGPA when education selection changes
  const handleEducationChange = (value: string) => {
    setSelectedEducationId(value);
    setCgpa(""); // Reset CGPA
  };

  // Get selected education details
  const selectedEducation = useMemo(() => {
    if (!selectedEducationId) return null;
    return education.find(edu => edu.id?.toString() === selectedEducationId);
  }, [selectedEducationId, education]);

  // Calculate total experience years from selected education dates
  const totalExperienceYears = useMemo(() => {
    if (!selectedEducation) return 0;

    const startDate = new Date(selectedEducation.startDate);
    const endDate = new Date(selectedEducation.endDate);
    
    const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                      (endDate.getMonth() - startDate.getMonth());
    
    const years = Math.max(0, monthsDiff) / 12;
    return Math.round(years * 10) / 10; // Round to 1 decimal place
  }, [selectedEducation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate education selection
    if (!selectedEducationId) {
      setError("Please select your education background");
      return;
    }
    
    // Validate CGPA
    if (!cgpa || cgpa.trim() === "") {
      setError("Please enter your CGPA");
      return;
    }
    
    const cgpaNumber = parseFloat(cgpa);
    if (isNaN(cgpaNumber) || cgpaNumber < 0 || cgpaNumber > 4) {
      setError("Please enter a valid CGPA between 0 and 4");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            jobId,
            coverLetter: coverLetter.trim() || null,
            resumeId: candidateResumeId || null,
            selectedDegree: selectedEducation?.degree || null,
            selectedFieldOfStudy: selectedEducation?.fieldOfStudy || null,
            selectedCgpa: cgpaNumber,
            totalExperienceYears: totalExperienceYears,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit application");
      }

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setCoverLetter("");
        setSelectedEducationId("");
        setCgpa("");
        setSuccess(false);
        router.refresh(); // Refresh to show updated application status
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasApplied) {
    return (
      <div className="text-center py-4">
        <Alert className="mb-4">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            You have already applied to this job. View your application status in the Applications page.
          </AlertDescription>
        </Alert>
        <Button variant="outline" disabled className="w-full gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Already Applied
        </Button>
      </div>
    );
  }

  if (isDeadlinePassed) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground mb-4">
          This job posting has expired.
        </p>
        <Button variant="outline" disabled className="w-full">
          Application Closed
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button className="w-full" size="lg" onClick={() => setOpen(true)}>
        Apply Now
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for this Job</DialogTitle>
            <DialogDescription>
              Submit your application. {candidateResumeId ? "Your resume will be attached automatically." : "Please make sure you have uploaded a resume in your profile."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Application submitted successfully!
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Education Selection */}
              <div className="space-y-2">
                <Label htmlFor="education">Select Your Education <span className="text-destructive">*</span></Label>
                {education.length > 0 ? (
                  <Select value={selectedEducationId} onValueChange={handleEducationChange} disabled={isSubmitting || success}>
                    <SelectTrigger id="education">
                      <SelectValue placeholder="Choose your education background" />
                    </SelectTrigger>
                    <SelectContent>
                      {education.map((edu) => (
                        <SelectItem key={edu.id} value={edu.id?.toString() || ""}>
                          {edu.degree} in {edu.fieldOfStudy} - {edu.institution}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You haven&apos;t added any education yet. Please add education in your{" "}
                      <a
                        href="/dashboard/candidate-profile/edit"
                        className="underline font-medium"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        candidate profile
                      </a>
                      .
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* CGPA Input */}
              <div className="space-y-2">
                <Label htmlFor="cgpa">CGPA <span className="text-destructive">*</span></Label>
                <Input
                  id="cgpa"
                  type="number"
                  step="0.01"
                  min="0"
                  max="4"
                  placeholder="Enter your CGPA (e.g., 3.5)"
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                  disabled={isSubmitting || success}
                />
                <p className="text-xs text-muted-foreground">Enter a value between 0 and 4.0</p>
              </div>

              {/* Show selected education details */}
              {selectedEducation && (
                <div className="rounded-md bg-muted p-3 space-y-1 text-sm">
                  <p><span className="font-medium">Degree:</span> {selectedEducation.degree}</p>
                  <p><span className="font-medium">Field of Study:</span> {selectedEducation.fieldOfStudy}</p>
                  <p><span className="font-medium">Institution:</span> {selectedEducation.institution}</p>
                </div>
              )}

              {/* Total Experience Years (calculated from selected education) */}
              {selectedEducation && totalExperienceYears > 0 && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p><span className="font-medium">Years of Study:</span> {totalExperienceYears} {totalExperienceYears === 1 ? 'year' : 'years'}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="coverLetter">Cover Letter (Optional)</Label>
                <Textarea
                  id="coverLetter"
                  placeholder="Tell the employer why you're a great fit for this position..."
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={6}
                  disabled={isSubmitting || success}
                />
              </div>
              {!candidateResumeId && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You don&apos;t have a resume uploaded. Please upload one in your{" "}
                    <a
                      href="/dashboard/candidate-profile/edit"
                      className="underline font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      candidate profile
                    </a>
                    .
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setCoverLetter("");
                  setError(null);
                }}
                disabled={isSubmitting || success}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || success || !selectedEducationId || !cgpa || education.length === 0}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
