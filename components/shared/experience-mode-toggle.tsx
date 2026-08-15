"use client";

import { Button } from "@/components/ui/button";
import { useExperienceMode } from "@/features/experience-mode";
import { useI18n } from "@/features/i18n";

export function ExperienceModeToggle() {
  const { mode, setMode } = useExperienceMode();
  const { t } = useI18n();
  const currentModeLabel = mode === "advanced" ? t.app.modeAdvanced : t.app.modeBasic;
  const nextModeLabel = mode === "advanced" ? t.app.modeBasic : t.app.modeAdvanced;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setMode(mode === "advanced" ? "basic" : "advanced")}
      aria-label={t.app.switchToModeLabel(nextModeLabel)}
    >
      {t.app.modeLabel(currentModeLabel)}
    </Button>
  );
}
