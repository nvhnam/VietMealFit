"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/features/i18n";
import type { MealPlanWithItems } from "./vietmeal-week-view";

// Colors mapped to CSS custom properties (design tokens), not hardcoded hex —
// keeps this chart restylable in the later ui-ux-pro-max pass (plan §6).
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export function VietMealMacroChart({ plan }: { plan: MealPlanWithItems }) {
  const { t } = useI18n();
  const data = useMemo(() => {
    let proteinG = 0;
    let carbG = 0;
    let fatG = 0;
    for (const item of plan.items) {
      proteinG += Number(item.recipe.proteinG);
      carbG += Number(item.recipe.carbG);
      fatG += Number(item.recipe.fatG);
    }
    return [
      { name: t.common.macro.protein, grams: Math.round(proteinG) },
      { name: t.common.macro.carbs, grams: Math.round(carbG) },
      { name: t.common.macro.fat, grams: Math.round(fatG) },
    ];
  }, [plan.items, t]);

  return (
    <Card className="p-6">
      <h2 className="mb-2 font-semibold">{t.vietmeal.macroChartHeading}</h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="grams" nameKey="name" outerRadius={90} label>
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
