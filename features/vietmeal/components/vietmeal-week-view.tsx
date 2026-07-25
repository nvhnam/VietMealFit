"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { AppRouter } from "@/server/trpc/root";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type MealPlanWithItems = NonNullable<RouterOutputs["vietmeal"]["getCurrentPlan"]>;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// meal_plan_items.mealType shares its column type with recipes.mealType
// (both use the same Postgres enum), which includes "snack" even though
// generated plans never produce one — widened to string[] so .indexOf()
// doesn't fight that at the type level.
const MEAL_TYPE_ORDER: string[] = ["breakfast", "lunch", "dinner"];

export function VietMealWeekView({ plan }: { plan: MealPlanWithItems }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeDay, setActiveDay] = useState(0);

  const toggle = useMutation(
    trpc.vietmeal.toggleItemCompleted.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.vietmeal.getCurrentPlan.queryKey() });
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

  return (
    <Card className="p-6">
      <Tabs value={String(activeDay)} onValueChange={(v) => setActiveDay(Number(v))}>
        <TabsList>
          {DAY_LABELS.map((label, day) => (
            <TabsTrigger key={day} value={String(day)}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
                  {item.mealType}
                </Badge>
                <span className={cn("font-medium", item.completed && "text-muted-foreground line-through")}>
                  {item.recipe.nameVi}
                </span>
                {item.recipe.nameEn && (
                  <span className="text-sm text-muted-foreground">({item.recipe.nameEn})</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.recipe.calories} kcal · {item.recipe.proteinG}g protein ·{" "}
                {item.recipe.carbG}g carb · {item.recipe.fatG}g fat
              </p>
              <p className="mt-2 text-sm">{item.recipe.instructions}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
