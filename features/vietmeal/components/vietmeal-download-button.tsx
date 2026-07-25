"use client";

import { Button } from "@/components/ui/button";
import type { MealPlanWithItems } from "./vietmeal-week-view";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEAL_TYPE_ORDER: string[] = ["breakfast", "lunch", "dinner"];

function formatPlanAsText(plan: MealPlanWithItems): string {
  const lines: string[] = [`VietMealFit — Meal Plan (week of ${plan.weekStart})`, ""];

  for (let day = 0; day < 7; day++) {
    const items = plan.items
      .filter((i) => i.day === day)
      .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType));
    if (items.length === 0) continue;

    lines.push(DAY_LABELS[day], "-".repeat(DAY_LABELS[day].length));
    for (const item of items) {
      lines.push(
        `${item.mealType[0].toUpperCase()}${item.mealType.slice(1)}: ${item.recipe.nameVi}${
          item.recipe.nameEn ? ` (${item.recipe.nameEn})` : ""
        } — ${item.recipe.calories} kcal, ${item.recipe.proteinG}g protein, ${item.recipe.carbG}g carb, ${item.recipe.fatG}g fat`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function VietMealDownloadButton({ plan }: { plan: MealPlanWithItems }) {
  return (
    <Button
      variant="outline"
      onClick={() => {
        const blob = new Blob([formatPlanAsText(plan)], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vietmealfit-meal-plan-${plan.weekStart}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      Download as text
    </Button>
  );
}
