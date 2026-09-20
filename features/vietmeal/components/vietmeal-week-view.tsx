"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { AppRouter } from "@/server/trpc/root";
import { useI18n } from "@/features/i18n";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPortionMultiplier,
  isScaledPortion,
  scaleRecipeMacros,
} from "@/features/vietmeal/portion";
import { VietMealDownloadButton } from "./vietmeal-download-button";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type MealPlanWithItems = NonNullable<RouterOutputs["vietmeal"]["getCurrentPlan"]>;

// meal_plan_items.mealType shares its column type with recipes.mealType
// (both use the same Postgres enum), which includes "snack" even though
// generated plans never produce one — widened to string[] so .indexOf()
// doesn't fight that at the type level.
const MEAL_TYPE_ORDER: string[] = ["breakfast", "lunch", "dinner"];

export function VietMealWeekView({ plan }: { plan: MealPlanWithItems }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { t, language } = useI18n();
  const [activeDay, setActiveDay] = useState(0);

  const toggle = useMutation(
    trpc.vietmeal.toggleItemCompleted.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.vietmeal.getCurrentPlan.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.vietmeal.getCompletedHistory.queryKey() });
      },
    }),
  );

  const itemsByDay = useMemo(() => {
    const map = new Map<number, MealPlanWithItems["items"]>();
    for (const item of plan.items) {
      const list = map.get(item.day) ?? [];
      list.push(item);
      map.set(item.day, list);
    }
    return map;
  }, [plan.items]);

  const dayItems = (itemsByDay.get(activeDay) ?? []).slice().sort(
    (a, b) => MEAL_TYPE_ORDER.indexOf(a.mealType) - MEAL_TYPE_ORDER.indexOf(b.mealType),
  );

  // params is jsonb, so it is `unknown` to the client — read the one field we
  // need defensively rather than asserting a shape the column can't guarantee.
  const calorieTarget = (() => {
    const params = plan.params as { calorieTarget?: unknown } | null;
    const value = Number(params?.calorieTarget);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  })();

  const dayTotalKcal = dayItems.reduce(
    (sum, item) => sum + scaleRecipeMacros(item.recipe, item.portionMultiplier).calories,
    0,
  );

  return (
    <Card className="p-6">
      {/* The export sits with the plan it exports rather than in a row of its
          own between sections, which cost a full band of vertical space. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Seven day tabs do not fit a 320px card; let the strip scroll
            instead of being clipped by the card's overflow-hidden. */}
        <Tabs
          className="min-w-0 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          value={String(activeDay)}
          onValueChange={(v) => setActiveDay(Number(v))}
        >
          <TabsList>
            {t.common.dayLabelsShort.map((label, day) => (
              <TabsTrigger key={day} value={String(day)}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <VietMealDownloadButton plan={plan} />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {dayItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex gap-3 rounded-lg border p-4 transition-colors duration-200",
              item.completed && "border-primary/30 bg-primary/5",
            )}
          >
            <Checkbox
              checked={item.completed}
              onCheckedChange={(v) => toggle.mutate({ itemId: item.id, completed: v === true })}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {t.common.mealType[item.mealType as keyof typeof t.common.mealType] ?? item.mealType}
                </Badge>
                {(() => {
                  const primary = language === "vi" ? item.recipe.nameVi : (item.recipe.nameEn ?? item.recipe.nameVi);
                  const secondary = language === "vi" ? item.recipe.nameEn : item.recipe.nameVi;
                  return (
                    <>
                      <span className={cn("font-medium", item.completed && "text-muted-foreground line-through")}>
                        {primary}
                      </span>
                      {secondary && secondary !== primary && (
                        <span className="text-sm text-muted-foreground">({secondary})</span>
                      )}
                      {isScaledPortion(item.portionMultiplier) && (
                        <Badge variant="outline" title={t.vietmeal.portion.tooltip}>
                          {formatPortionMultiplier(item.portionMultiplier)}
                        </Badge>
                      )}
                    </>
                  );
                })()}
              </div>
              {(() => {
                const scaled = scaleRecipeMacros(item.recipe, item.portionMultiplier);
                return (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scaled.calories} kcal · {scaled.proteinG}g {t.common.macro.protein.toLowerCase()} ·{" "}
                    {scaled.carbG}g {t.common.macro.carbs.toLowerCase()} · {scaled.fatG}g{" "}
                    {t.common.macro.fat.toLowerCase()}
                    {isScaledPortion(item.portionMultiplier) && (
                      <span className="ml-1">
                        {t.vietmeal.portion.basedOn(
                          item.recipe.calories,
                          formatPortionMultiplier(item.portionMultiplier),
                        )}
                      </span>
                    )}
                  </p>
                );
              })()}
              <p className="mt-2 text-sm">
                {language === "vi" ? (item.recipe.instructionsVi ?? item.recipe.instructions) : item.recipe.instructions}
              </p>
            </div>
          </div>
        ))}

        {dayItems.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              {calorieTarget == null
                ? t.vietmeal.portion.dayTotal(dayTotalKcal)
                : t.vietmeal.portion.dayTotalWithTarget(dayTotalKcal, calorieTarget)}
            </p>
            {/* A miss here is a catalog limit, not a rounding artefact — say
                so rather than leaving the reader to wonder. */}
            {calorieTarget != null && dayTotalKcal < calorieTarget * 0.95 && (
              <p className="text-sm text-muted-foreground">{t.vietmeal.portion.belowTarget}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
