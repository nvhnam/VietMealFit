"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui/skeleton";
import { VietFitGenerateForm } from "./vietfit-generate-form";
import { VietFitWeekView } from "./vietfit-week-view";
import { VietFitBmiRecommendation } from "./vietfit-bmi-recommendation";
import { VietFitDownloadButton } from "./vietfit-download-button";

export function VietFitPageClient() {
  const trpc = useTRPC();
  const { data: plan, isLoading } = useQuery(trpc.vietfit.getCurrentPlan.queryOptions());

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <VietFitGenerateForm hasExistingPlan={!!plan} />

      {isLoading && <Skeleton className="h-48 w-full" />}

      {plan && (
        <>
          <div className="flex justify-end">
            <VietFitDownloadButton plan={plan} />
          </div>
          <VietFitBmiRecommendation plan={plan} />
          <VietFitWeekView plan={plan} />
        </>
      )}
    </div>
  );
}
