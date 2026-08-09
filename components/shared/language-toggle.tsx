"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/features/i18n";

export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();
  const target = language === "en" ? "vi" : "en";

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLanguage(target)}
      aria-label={`Switch to ${t.common.languageName[target]}`}
    >
      {t.common.languageName[target]}
    </Button>
  );
}
