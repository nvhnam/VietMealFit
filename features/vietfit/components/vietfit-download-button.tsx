"use client";

import { Button } from "@/components/ui/button";
import { useI18n, type Messages, type Language } from "@/features/i18n";
import type { ExercisePlanWithItems } from "./vietfit-week-view";

function formatPlanAsText(plan: ExercisePlanWithItems, t: Messages, language: Language): string {
  const goalOptions: Record<string, string> = t.vietfit.goalOption;
  const goalText = goalOptions[plan.goal] ?? plan.goal.replace("_", " ");
  const lines: string[] = [t.vietfit.downloadFileHeading(goalText), ""];

  for (let day = 0; day < 7; day++) {
    const items = plan.items.filter((i) => i.day === day).sort((a, b) => a.order - b.order);
    const dayLabel = t.common.dayLabelsLong[day];
    lines.push(dayLabel, "-".repeat(dayLabel.length));
    if (items.length === 0) {
      lines.push(t.common.restDay);
    } else {
      for (const item of items) {
        const name = language === "vi" ? (item.exercise.nameVi ?? item.exercise.name) : item.exercise.name;
        const repScheme =
          language === "vi" ? (item.exercise.repSchemeVi ?? item.repScheme) : item.repScheme;
        lines.push(`${name} — ${item.sets} ${language === "vi" ? "set" : "sets"} x ${repScheme}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function VietFitDownloadButton({ plan }: { plan: ExercisePlanWithItems }) {
  const { t, language } = useI18n();
  return (
    <Button
      variant="outline"
      onClick={() => {
        const blob = new Blob([formatPlanAsText(plan, t, language)], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // Filename stays ASCII regardless of language.
        a.download = `vietmealfit-exercise-plan.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      {t.common.downloadAsText}
    </Button>
  );
}
