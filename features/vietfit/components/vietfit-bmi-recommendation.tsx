"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { bmiBadgeVariant, bmiCategory } from "@/features/shared/bmi";
import type { ExercisePlanWithItems } from "./vietfit-week-view";

export function recommendation(category: string, goal: string): string {
  const goalText = goal.replace("_", " ");
  if (category === "Underweight") {
    return `Your BMI suggests you're underweight. Combined with your ${goalText} goal, prioritize consistent meals and progressive strength training over heavy cardio.`;
  }
  if (category === "Overweight" || category === "Obese") {
    return `Your BMI suggests some extra weight to manage. Combined with your ${goalText} goal, pair this schedule with a modest calorie deficit — see VietLean for a target.`;
  }
  return `Your BMI is in the normal range. Combined with your ${goalText} goal, this schedule and consistent nutrition should support steady progress.`;
}

/**
 * Shown in both Basic and Advanced mode — plan §1.3 only tags the
 * muscle-group/video exercise detail as Advanced-only, not this.
 */
export function VietFitBmiRecommendation({ plan }: { plan: ExercisePlanWithItems }) {
  const params = plan.params as { heightCm?: number; weightKg?: number };
  const heightCm = params.heightCm;
  const weightKg = params.weightKg;
  const bmi = heightCm && weightKg ? weightKg / (heightCm / 100) ** 2 : null;

  return (
    <Card className="p-6">
      <h2 className="mb-2 font-semibold">BMI & recommendation</h2>
      {bmi ? (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">BMI {bmi.toFixed(1)}</span>
            <Badge variant={bmiBadgeVariant(bmi)}>{bmiCategory(bmi)}</Badge>
            <span>— informational only, not a diagnosis.</span>
          </p>
          <p className="mt-2 text-sm">{recommendation(bmiCategory(bmi), plan.goal)}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Height/weight not available for this plan.</p>
      )}
    </Card>
  );
}
