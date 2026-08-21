"use client";

import { useMemo } from "react";
import { MacroPieChart } from "@/components/shared/macro-pie-chart";
import { useI18n } from "@/features/i18n";
import type { MealPlanWithItems } from "./vietmeal-week-view";

export function VietMealMacroChart({ plan }: { plan: MealPlanWithItems }) {
  const { t } = useI18n();
  const totals = useMemo(() => {
    let proteinG = 0;
    let carbG = 0;
    let fatG = 0;
    for (const item of plan.items) {
      proteinG += Number(item.recipe.proteinG);
      carbG += Number(item.recipe.carbG);
      fatG += Number(item.recipe.fatG);
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
