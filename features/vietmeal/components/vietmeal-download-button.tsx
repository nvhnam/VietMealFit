"use client";

import { Button } from "@/components/ui/button";
import { useI18n, type Messages, type Language } from "@/features/i18n";
import type { MealPlanWithItems } from "./vietmeal-week-view";

const MEAL_TYPE_ORDER: string[] = ["breakfast", "lunch", "dinner"];

function formatPlanAsText(plan: MealPlanWithItems, t: Messages, language: Language): string {
  const lines: string[] = [t.vietmeal.downloadFileHeading(plan.weekStart), ""];

  for (let day = 0; day < 7; day++) {
    const items = plan.items
      .filter((i) => i.day === day)
      .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType));
    if (items.length === 0) continue;

    const dayLabel = t.common.dayLabelsLong[day];
    lines.push(dayLabel, "-".repeat(dayLabel.length));
    for (const item of items) {
      const mealLabel = t.common.mealType[item.mealType as keyof typeof t.common.mealType] ?? item.mealType;
      const primaryName = language === "vi" ? item.recipe.nameVi : (item.recipe.nameEn ?? item.recipe.nameVi);
      const secondaryName = language === "vi" ? item.recipe.nameEn : item.recipe.nameVi;
      lines.push(
        `${mealLabel}: ${primaryName}${
          secondaryName && secondaryName !== primaryName ? ` (${secondaryName})` : ""
        } — ${item.recipe.calories} kcal, ${item.recipe.proteinG}g ${t.common.macro.protein.toLowerCase()}, ${
          item.recipe.carbG
        }g ${t.common.macro.carbs.toLowerCase()}, ${item.recipe.fatG}g ${t.common.macro.fat.toLowerCase()}`,
      );
    }
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
      {t.common.downloadAsText}
    </Button>
  );
}
