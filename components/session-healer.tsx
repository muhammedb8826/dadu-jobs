"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Persists a healed userType into the session cookie when the current cookie is missing it.
 * Layout/RSC can resolve type for the current render, but only a route handler can write cookies.
 */
export function SessionHealer({ needsHeal }: { needsHeal: boolean }) {
  const router = useRouter();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!needsHeal || attemptedRef.current) return;
    attemptedRef.current = true;

    const heal = async () => {
      try {
        const response = await fetch("/api/auth/refresh-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (response.ok) {
          router.refresh();
        }
      } catch (error) {
        console.error("Session heal failed:", error);
      }
    };

    void heal();
  }, [needsHeal, router]);

  return null;
}
