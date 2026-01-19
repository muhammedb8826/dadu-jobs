"use client";

import { useState } from "react";
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
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ApplyButtonProps {
  jobId: number;
  isDeadlinePassed: boolean;
  candidateResumeId?: number | null;
}

export function ApplyButton({ jobId, isDeadlinePassed, candidateResumeId }: ApplyButtonProps) {
  const [open, setOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setSuccess(false);
        router.refresh(); // Refresh to show updated application status
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

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
                      href="/dashboard/candidate-profile/complete"
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
              <Button type="submit" disabled={isSubmitting || success}>
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
