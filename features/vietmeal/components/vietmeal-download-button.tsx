"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, type Messages, type Language } from "@/features/i18n";
import {
  formatPortionMultiplier,
  isScaledPortion,
  scaleRecipeMacros,
} from "@/features/vietmeal/portion";
import type { MealPlanWithItems } from "./vietmeal-week-view";

const MEAL_TYPE_ORDER: string[] = ["breakfast", "lunch", "dinner"];

function formatPlanAsText(plan: MealPlanWithItems, t: Messages, language: Language): string {
  const lines: string[] = [t.vietmeal.downloadFileHeading(plan.weekStart), ""];

  // jsonb column, so `unknown` on the client — read defensively (same as the
  // week view, which shows this figure on screen).
  const params = plan.params as { calorieTarget?: unknown } | null;
  const targetValue = Number(params?.calorieTarget);
  const calorieTarget = Number.isFinite(targetValue) && targetValue > 0 ? Math.round(targetValue) : null;

  for (let day = 0; day < 7; day++) {
    const items = plan.items
      .filter((i) => i.day === day)
      .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType));
    if (items.length === 0) continue;

    const dayLabel = t.common.dayLabelsLong[day];
    lines.push(dayLabel, "-".repeat(dayLabel.length));
    let dayTotalKcal = 0;
    for (const item of items) {
      const mealLabel = t.common.mealType[item.mealType as keyof typeof t.common.mealType] ?? item.mealType;
      const primaryName = language === "vi" ? item.recipe.nameVi : (item.recipe.nameEn ?? item.recipe.nameVi);
      const secondaryName = language === "vi" ? item.recipe.nameEn : item.recipe.nameVi;
      const scaled = scaleRecipeMacros(item.recipe, item.portionMultiplier);
      dayTotalKcal += scaled.calories;
      const portionNote = isScaledPortion(item.portionMultiplier)
        ? ` ${t.vietmeal.portion.basedOn(item.recipe.calories, formatPortionMultiplier(item.portionMultiplier))}`
        : "";
      lines.push(
        `${mealLabel}: ${primaryName}${
          secondaryName && secondaryName !== primaryName ? ` (${secondaryName})` : ""
        } — ${scaled.calories} kcal, ${scaled.proteinG}g ${t.common.macro.protein.toLowerCase()}, ${
          scaled.carbG
        }g ${t.common.macro.carbs.toLowerCase()}, ${scaled.fatG}g ${t.common.macro.fat.toLowerCase()}${portionNote}`,
      );
    }
    lines.push(
      calorieTarget == null
        ? t.vietmeal.portion.dayTotal(dayTotalKcal)
        : t.vietmeal.portion.dayTotalWithTarget(dayTotalKcal, calorieTarget),
    );
    lines.push("");
  }

  return lines.join("\n");
}

export function VietMealDownloadButton({ plan }: { plan: MealPlanWithItems }) {
  const { t, language } = useI18n();
  return (
    <Button
      variant="outline"
      onClick={() => {
        const blob = new Blob([formatPlanAsText(plan, t, language)], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // Filename stays ASCII regardless of language to avoid
        // Content-Disposition mojibake with Vietnamese diacritics.
        a.download = `vietmealfit-meal-plan-${plan.weekStart}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download aria-hidden="true" />
      {t.common.downloadAsText}
    </Button>
  );
}
