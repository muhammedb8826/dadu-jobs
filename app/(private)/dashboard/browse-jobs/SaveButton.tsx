"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SaveButtonProps {
  jobId: number | string;
  initialSaved?: boolean;
  onSaveChange?: (saved: boolean) => void;
  variant?: "icon" | "button";
}

export function SaveButton({ jobId, initialSaved = false, onSaveChange, variant = "icon" }: SaveButtonProps) {
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if button is inside a link
    e.stopPropagation();

    setIsLoading(true);

    try {
      if (isSaved) {
        // Unsave the job
        const response = await fetch(`/api/saved-jobs?jobId=${jobId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setIsSaved(false);
          onSaveChange?.(false);
        } else {
          const error = await response.json().catch(() => ({}));
          console.error("Failed to unsave job:", error);
        }
      } else {
        // Save the job
        const response = await fetch("/api/saved-jobs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: { jobId } }),
        });

        if (response.ok) {
          setIsSaved(true);
          onSaveChange?.(true);
        } else {
          const error = await response.json().catch(() => ({}));
          // Treat "already saved" from older API as success
          if (
            response.status === 400 &&
            typeof error?.error === "string" &&
            error.error.toLowerCase().includes("already saved")
          ) {
            setIsSaved(true);
            onSaveChange?.(true);
          } else {
            console.error("Failed to save job. Status:", response.status);
            console.error("Error response:", error);
            console.error("Job ID:", jobId);
          }
        }
      }
    } catch (error) {
      console.error("Error toggling save status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        onClick={handleToggleSave}
        disabled={isLoading}
        className={cn(
          "w-full gap-2",
          isSaved && "border-primary text-primary hover:bg-primary/10"
        )}
      >
        <Bookmark
          className={cn(
            "h-4 w-4 transition-colors",
            isSaved && "fill-current"
          )}
        />
        {isSaved ? "Saved" : "Save Job"}
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggleSave}
      disabled={isLoading}
      className={cn(
        "h-8 w-8 hover:bg-accent",
        isSaved && "text-primary"
      )}
      title={isSaved ? "Unsave job" : "Save job"}
    >
      <Bookmark
        className={cn(
          "h-4 w-4 transition-colors",
          isSaved && "fill-current"
        )}
      />
    </Button>
  );
}
