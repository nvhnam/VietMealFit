"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/features/i18n";

// Same design-token colors as VietMeal's macro chart, for a consistent
// macro-color language across modules.
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];

export function VietLeanMacroChart({
  proteinG,
  carbG,
  fatG,
}: {
  proteinG: number;
  carbG: number;
  fatG: number;
}) {
  const { t } = useI18n();
  const data = useMemo(
    () => [
      { name: t.common.macro.protein, grams: proteinG },
      { name: t.common.macro.carbs, grams: carbG },
      { name: t.common.macro.fat, grams: fatG },
    ],
    [t, proteinG, carbG, fatG],
  );

  return (
    <Card className="p-6">
      <h2 className="mb-2 font-semibold">{t.vietlean.macroChartHeading}</h2>
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
