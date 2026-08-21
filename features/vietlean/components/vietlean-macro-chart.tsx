"use client";

import { MacroPieChart } from "@/components/shared/macro-pie-chart";
import { useI18n } from "@/features/i18n";

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
  return (
    <MacroPieChart
      heading={t.vietlean.macroChartHeading}
      proteinLabel={t.common.macro.protein}
      carbsLabel={t.common.macro.carbs}
      fatLabel={t.common.macro.fat}
      proteinG={proteinG}
      carbG={carbG}
      fatG={fatG}
    />
  );
}
