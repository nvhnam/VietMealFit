"use client";

import { Button } from "@/components/ui/button";
import type { ExercisePlanWithItems } from "./vietfit-week-view";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatPlanAsText(plan: ExercisePlanWithItems): string {
  const lines: string[] = [`VietMealFit — Exercise Plan (goal: ${plan.goal.replace("_", " ")})`, ""];

  for (let day = 0; day < 7; day++) {
    const items = plan.items.filter((i) => i.day === day).sort((a, b) => a.order - b.order);
    lines.push(DAY_LABELS[day], "-".repeat(DAY_LABELS[day].length));
    if (items.length === 0) {
      lines.push("Rest day");
    } else {
      for (const item of items) {
        lines.push(`${item.exercise.name} — ${item.sets} sets x ${item.repScheme}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function VietFitDownloadButton({ plan }: { plan: ExercisePlanWithItems }) {
  return (
    <Button
      variant="outline"
      onClick={() => {
        const blob = new Blob([formatPlanAsText(plan)], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vietmealfit-exercise-plan.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }}
    >
      Download as text
    </Button>
  );
}
