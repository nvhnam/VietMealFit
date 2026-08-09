"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { bmiBadgeVariant, bmiCategory } from "@/features/shared/bmi";
import { useI18n } from "@/features/i18n";
import { recommendation } from "@/features/vietfit/bmi-recommendation-text";
import type { ExercisePlanWithItems } from "./vietfit-week-view";

/**
 * Shown in both Basic and Advanced mode — plan §1.3 only tags the
 * muscle-group/video exercise detail as Advanced-only, not this.
 */
export function VietFitBmiRecommendation({ plan }: { plan: ExercisePlanWithItems }) {
  const { t } = useI18n();
  const params = plan.params as { heightCm?: number; weightKg?: number };
  const heightCm = params.heightCm;
  const weightKg = params.weightKg;
  const bmi = heightCm && weightKg ? weightKg / (heightCm / 100) ** 2 : null;

  return (
    <Card className="p-6">
      <h2 className="mb-2 font-semibold">{t.vietfit.bmiRecommendation.heading}</h2>
      {bmi ? (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">BMI {bmi.toFixed(1)}</span>
            <Badge variant={bmiBadgeVariant(bmi)}>{t.bmi.category[bmiCategory(bmi)]}</Badge>
            <span>{t.vietfit.bmiRecommendation.note}</span>
          </p>
          <p className="mt-2 text-sm">{recommendation(bmiCategory(bmi), plan.goal, t)}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t.vietfit.bmiRecommendation.noHeightWeight}</p>
      )}
    </Card>
  );
}
