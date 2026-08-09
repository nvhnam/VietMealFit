"use client";

import { Flame, Beef, Wheat, Droplet, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useI18n } from "@/features/i18n";

export type NutrientResult = {
  nameVi: string;
  nameEn: string | null;
  grams: number;
  energyKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  sourceCitation: string;
  sourceCitationEn?: string | null;
};

function formatValue(value: number | null, unit: string): string {
  return value === null ? "—" : `${value}${unit}`;
}

export function VietSearchResults({ result }: { result: NutrientResult }) {
  const { t, language } = useI18n();

  const STATS = [
    { key: "energyKcal" as const, label: t.common.macro.calories, unit: " kcal", icon: Flame },
    { key: "proteinG" as const, label: t.common.macro.protein, unit: "g", icon: Beef },
    { key: "carbohydrateG" as const, label: t.common.macro.carbs, unit: "g", icon: Wheat },
    { key: "fatG" as const, label: t.common.macro.fat, unit: "g", icon: Droplet },
  ];

  const primaryName = language === "vi" ? result.nameVi : (result.nameEn ?? result.nameVi);
  const secondaryName = language === "vi" ? result.nameEn : result.nameVi;
  // Citations are conventionally kept in their original language; in English
  // mode we show the English gloss (when available) alongside the original.
  const citation =
    language === "en" && result.sourceCitationEn
      ? `${result.sourceCitationEn} (${result.sourceCitation})`
      : result.sourceCitation;

  return (
    <Card className="p-6">
      <h2 className="font-semibold">
        {t.vietsearch.resultsForLabel(result.grams)} {primaryName}
        {secondaryName && secondaryName !== primaryName && (
          <span className="font-normal text-muted-foreground"> ({secondaryName})</span>
        )}
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map(({ key, label, unit, icon: Icon }) => {
          const value = result[key];
          return (
            <div
              key={key}
              className="flex flex-col items-center gap-1.5 rounded-lg border bg-muted/30 p-4 text-center"
            >
              <Icon
                className={cn("size-5", value === null ? "text-muted-foreground/50" : "text-primary")}
                aria-hidden="true"
              />
              <span className="text-lg font-semibold tabular-nums">{formatValue(value, unit)}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
              {value === null && (
                <span className="text-[10px] text-muted-foreground">{t.vietsearch.notMeasured}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-1.5 border-t pt-3 text-xs text-muted-foreground">
        <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          {t.vietsearch.sourceLabel} {citation}
        </span>
      </div>
    </Card>
  );
}
