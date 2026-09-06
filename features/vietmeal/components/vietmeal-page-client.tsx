"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useExperienceMode } from "@/features/experience-mode";
import { Skeleton } from "@/components/ui/skeleton";
import { VietMealGenerateForm } from "./vietmeal-generate-form";
import { VietMealWeekView } from "./vietmeal-week-view";
import { VietMealMacroChart } from "./vietmeal-macro-chart";
import { VietMealBmiCard } from "./vietmeal-bmi-card";

export function VietMealPageClient() {
  const trpc = useTRPC();
  const { mode } = useExperienceMode();
  const { data: plan, isLoading } = useQuery(trpc.vietmeal.getCurrentPlan.queryOptions());

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <VietMealGenerateForm hasExistingPlan={!!plan} />

      {isLoading && <Skeleton className="h-48 w-full" />}

      {plan && (
        <>
          <VietMealWeekView plan={plan} />
          {mode === "advanced" && (
            <>
              <VietMealMacroChart plan={plan} />
              <VietMealBmiCard />
            </>
          )}
        </>
      )}
    </div>
  );
}
