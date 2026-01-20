"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";
import Link from "next/link";

interface JobActionsProps {
  jobId: number;
  jobSlug: string;
  isDeadlinePassed: boolean;
}

type UserType = "candidate" | "employer";

interface SessionData {
  authenticated: boolean;
  user?: {
    userType?: UserType;
    [key: string]: unknown;
  };
}

export function JobActions({ jobId, jobSlug, isDeadlinePassed }: JobActionsProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check authentication status and user role
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (response.ok) {
          const sessionData: SessionData = await response.json();
          setSession(sessionData);
          
          // Only check saved status if user is authenticated AND is a candidate
          if (sessionData.authenticated && sessionData.user?.userType === "candidate") {
            const savedResponse = await fetch(`/api/saved-jobs?jobId=${jobId}`);
            if (savedResponse.ok) {
              const data = await savedResponse.json();
              setIsSaved(data.saved || false);
            }
          }
        } else {
          setSession({ authenticated: false });
        }
      } catch (error) {
        setSession({ authenticated: false });
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [jobId]);

  const handleApply = () => {
    if (!session?.authenticated) {
      // Redirect to login, then to job detail in dashboard
      router.push(`/auth/login?redirectTo=/dashboard/browse-jobs/${jobSlug}`);
    } else {
      // Redirect to authenticated job page to apply
      router.push(`/dashboard/browse-jobs/${jobSlug}`);
    }
  };

  const handleSaveJob = async () => {
    if (!session?.authenticated) {
      // Redirect to login
      router.push(`/auth/login?redirectTo=/jobs/${jobSlug}`);
      return;
    }

    // Check if user is a candidate
    if (session.user?.userType !== "candidate") {
      // Employers can't save jobs, redirect them to dashboard
      router.push("/dashboard");
      return;
    }

    setSaveLoading(true);
    try {
      if (isSaved) {
        // Unsave the job
        const response = await fetch(`/api/saved-jobs?jobId=${jobId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setIsSaved(false);
        }
      } else {
        // Save the job
        const response = await fetch("/api/saved-jobs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ jobId }),
        });

        if (response.ok) {
          setIsSaved(true);
        }
      }
    } catch (error) {
      console.error("Error saving job:", error);
    } finally {
      setSaveLoading(false);
    }
  };

  if (isCheckingAuth) {
    // Loading state
    return (
      <div className="space-y-4">
        <Button className="w-full" size="lg" disabled>
          Loading...
        </Button>
        <Button variant="outline" className="w-full" disabled>
          Loading...
        </Button>
      </div>
    );
  }

  const isCandidate = session?.authenticated && session.user?.userType === "candidate";

  return (
    <div className="space-y-4">
      {isDeadlinePassed ? (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground mb-4">
            This job posting has expired.
          </p>
          <Button variant="outline" disabled className="w-full">
            Application Closed
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          size="lg"
          onClick={handleApply}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Apply Now"}
        </Button>
      )}

      {/* Only show Save button for candidates */}
      {isCandidate && (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleSaveJob}
          disabled={saveLoading}
        >
          <Bookmark
            className={`mr-2 h-4 w-4 ${isSaved ? "fill-current" : ""}`}
          />
          {saveLoading ? "Loading..." : isSaved ? "Saved" : "Save Job"}
        </Button>
      )}

      {/* If not authenticated or not a candidate, show save button that redirects */}
      {!isCandidate && (
        <Button
          variant="outline"
          className="w-full"
          onClick={handleSaveJob}
          disabled={saveLoading}
        >
          <Bookmark className="mr-2 h-4 w-4" />
          Save Job
        </Button>
      )}
    </div>
  );
}
