"use client";

import { useMemo } from "react";
import { MacroPieChart } from "@/components/shared/macro-pie-chart";
import { useI18n } from "@/features/i18n";
import { scaleRecipeMacros } from "@/features/vietmeal/portion";
import type { MealPlanWithItems } from "./vietmeal-week-view";

export function VietMealMacroChart({ plan }: { plan: MealPlanWithItems }) {
  const { t } = useI18n();
  const totals = useMemo(() => {
    let proteinG = 0;
    let carbG = 0;
    let fatG = 0;
    for (const item of plan.items) {
      // Served portions, not catalog portions — the split is meant to
      // describe the week the user was actually given.
      const scaled = scaleRecipeMacros(item.recipe, item.portionMultiplier);
      proteinG += scaled.proteinG;
      carbG += scaled.carbG;
      fatG += scaled.fatG;
    }
    return {
      proteinG: Math.round(proteinG),
      carbG: Math.round(carbG),
      fatG: Math.round(fatG),
    };
  }, [plan.items]);

  return (
    <MacroPieChart
      heading={t.vietmeal.macroChartHeading}
      proteinLabel={t.common.macro.protein}
      carbsLabel={t.common.macro.carbs}
      fatLabel={t.common.macro.fat}
      {...totals}
    />
  );
}
