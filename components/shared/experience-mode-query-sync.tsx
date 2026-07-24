"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { isExperienceMode, useExperienceMode } from "@/features/experience-mode";

/**
 * Layouts can't read searchParams (Next.js App Router doesn't re-render
 * shared layouts on query changes), so `?mode=basic` deep-links (plan §1.1)
 * are picked up client-side here instead of in app/(app)/layout.tsx.
 */
export function ExperienceModeQuerySync() {
  const searchParams = useSearchParams();
  const { mode, setMode } = useExperienceMode();
  const appliedParam = useRef<string | null>(null);

  useEffect(() => {
    const param = searchParams.get("mode");
    if (param === appliedParam.current) return;
    appliedParam.current = param;
    if (isExperienceMode(param) && param !== mode) {
      setMode(param);
    }
  }, [searchParams, mode, setMode]);

  return null;
}
