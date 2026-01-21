"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bookmark } from "lucide-react";

interface SaveJobButtonProps {
  jobId: number;
  jobSlug: string;
  variant?: "default" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

type UserType = "candidate" | "employer";

interface SessionData {
  authenticated: boolean;
  user?: {
    userType?: UserType;
    [key: string]: unknown;
  };
}

export function SaveJobButton({ 
  jobId, 
  jobSlug, 
  variant = "ghost", 
  size = "icon",
  className = ""
}: SaveJobButtonProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check authentication status and saved state
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

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any parent link clicks
    e.stopPropagation();

    if (!session?.authenticated) {
      // Redirect to login
      router.push(`/login?redirectTo=/jobs/${jobSlug}`);
      return;
    }

    // Check if user is a candidate
    if (session.user?.userType !== "candidate") {
      // Employers can't save jobs
      return;
    }

    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  // Don't show for employers
  if (session?.authenticated && session.user?.userType === "employer") {
    return null;
  }

  if (isCheckingAuth) {
    return (
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled
        aria-label="Loading"
      >
        <Bookmark className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleSave}
      disabled={isLoading}
      aria-label={isSaved ? "Unsave job" : "Save job"}
    >
      <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
    </Button>
  );
}
