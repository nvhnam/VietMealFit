"use client";

import { FlagEn, FlagVi } from "@/components/shared/flag-icons";
import { useI18n, type Language } from "@/features/i18n";
import { cn } from "@/lib/utils";

/**
 * Segmented VI | EN switcher rather than the previous single toggle button.
 *
 * The old button showed the *target* language ("Tiếng Việt" while in English),
 * which read as an action. A short code can't carry that: "VI" alone is
 * ambiguous — current state or the thing you'd switch to? Showing both codes
 * and highlighting the active one removes the ambiguity that the long label
 * was doing the work of resolving.
 */
const OPTIONS: ReadonlyArray<{
  value: Language;
  code: string;
  Flag: (props: { className?: string }) => React.ReactElement;
}> = [
  { value: "vi", code: "VI", Flag: FlagVi },
  { value: "en", code: "EN", Flag: FlagEn },
];

export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.common.languageSwitcherLabel}
      // Matches the h-7 / rounded / border of the size="sm" outline Button
      // siblings (ExperienceModeToggle, AccountMenu) it sits beside.
      className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background p-0.5 dark:border-input dark:bg-input/30"
    >
      {OPTIONS.map(({ value, code, Flag }) => {
        const isActive = language === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setLanguage(value)}
            aria-pressed={isActive}
            aria-label={t.common.switchToLanguageLabel(t.common.languageName[value])}
            title={t.common.languageName[value]}
            className={cn(
              "inline-flex h-6 cursor-pointer items-center gap-1 rounded-[min(var(--radius-md),10px)] px-1.5 text-[0.7rem] font-semibold tracking-wide outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Flag className="h-3 w-[1.125rem] shrink-0 rounded-[2px]" />
            {code}
          </button>
        );
      })}
    </div>
  );
}
