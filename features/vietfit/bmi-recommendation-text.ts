import type { Messages } from "@/features/i18n/messages/en";

// Pure text-generation function, deliberately kept out of
// vietfit-bmi-recommendation.tsx (a 'use client' component that imports
// useI18n -> next/navigation's useRouter). Importing that chain from a unit
// test breaks under this project's vitest "react-server" condition/node
// environment (next/navigation's app-router-context calls React.createContext
// at module load, which isn't available there) — this module has zero
// framework dependencies, so it's safe to import directly from tests.
export function recommendation(category: string, goal: string, t: Messages): string {
  const goalOptions: Record<string, string> = t.vietfit.goalOption;
  const goalText = goalOptions[goal] ?? goal.replace("_", " ");
  if (category === "Underweight") {
    return t.vietfit.bmiRecommendation.underweight(goalText);
  }
  if (category === "Overweight" || category === "Obese") {
    return t.vietfit.bmiRecommendation.overweightOrObese(goalText);
  }
  return t.vietfit.bmiRecommendation.normal(goalText);
}
