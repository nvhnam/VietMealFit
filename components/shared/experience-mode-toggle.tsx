"use client";

import { Button } from "@/components/ui/button";
import { useExperienceMode } from "@/features/experience-mode";

export function ExperienceModeToggle() {
  const { mode, setMode } = useExperienceMode();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setMode(mode === "advanced" ? "basic" : "advanced")}
      aria-label={`Switch to ${mode === "advanced" ? "Basic" : "Advanced"} mode`}
    >
      {mode === "advanced" ? "Advanced" : "Basic"} mode
    </Button>
  );
}
