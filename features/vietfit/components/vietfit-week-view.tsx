"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import type { AppRouter } from "@/server/trpc/root";
import { useExperienceMode } from "@/features/experience-mode";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type ExercisePlanWithItems = NonNullable<RouterOutputs["vietfit"]["getCurrentPlan"]>;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function VietFitWeekView({ plan }: { plan: ExercisePlanWithItems }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mode } = useExperienceMode();
  const [activeDay, setActiveDay] = useState(0);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const toggle = useMutation(
    trpc.vietfit.toggleItemCompleted.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.vietfit.getCurrentPlan.queryKey() });
      },
    }),
  );

  const itemsByDay = useMemo(() => {
    const map = new Map<number, ExercisePlanWithItems["items"]>();
    for (const item of plan.items) {
      const list = map.get(item.day) ?? [];
      list.push(item);
      map.set(item.day, list);
    }
    return map;
  }, [plan.items]);

  const dayItems = (itemsByDay.get(activeDay) ?? []).slice().sort((a, b) => a.order - b.order);

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
        {dayItems.length === 0 && (
          <p className="text-sm text-muted-foreground">Rest day — no exercises scheduled.</p>
        )}
        {dayItems.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-lg border p-4 transition-colors duration-200",
              item.completed && "border-primary/30 bg-primary/5",
            )}
          >
            <div className="flex gap-3">
              <Checkbox
                checked={item.completed}
                onCheckedChange={(v) => toggle.mutate({ itemId: item.id, completed: v === true })}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {item.exercise.difficulty}
                  </Badge>
                  <button
                    type="button"
                    className={cn(
                      "cursor-pointer font-medium hover:underline disabled:cursor-default",
                      item.completed && "text-muted-foreground line-through",
                    )}
                    disabled={mode !== "advanced"}
                    onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                  >
                    {item.exercise.name}
                  </button>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.sets} sets × {item.repScheme}
                </p>
                <p className="mt-2 text-sm">{item.exercise.instructions}</p>

                {mode === "advanced" && expandedItemId === item.id && (
                  <div className="mt-3 rounded-md bg-muted p-3">
                    <p className="mb-1 text-sm font-medium">Targeted muscles</p>
                    <div className="mb-2 flex flex-wrap gap-1">
                      {item.exercise.muscleGroups.map((m) => (
                        <Badge key={m} variant="outline" className="capitalize">
                          {m.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                    {item.exercise.videoUrl ? (
                      <a
                        href={item.exercise.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Watch instructional video
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Instructional video not yet added for this exercise.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
