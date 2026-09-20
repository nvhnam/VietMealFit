"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useTRPC } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/trpc/root";
import { useI18n, type Language, type Messages } from "@/features/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPortionMultiplier,
  isScaledPortion,
  scaleRecipeMacros,
} from "@/features/vietmeal/portion";
import {
  dailyTargets,
  dateFromKey,
  groupByLocalDay,
  localDateKey,
  sumMacros,
  type DailyTargets,
  type DayGroup,
  type MacroTotals,
} from "../progress";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type MealEntry = RouterOutputs["vietmeal"]["getCompletedHistory"][number];
type ExerciseEntry = RouterOutputs["vietfit"]["getCompletedHistory"][number];

/** Day groups rendered per "show older" step, so long histories stay light. */
const DAYS_PER_PAGE = 7;

export function ProfileProgress() {
  const trpc = useTRPC();
  const { t } = useI18n();
  const meals = useQuery(trpc.vietmeal.getCompletedHistory.queryOptions());
  const exercises = useQuery(trpc.vietfit.getCompletedHistory.queryOptions());
  const { data: profile } = useQuery(trpc.profiles.get.queryOptions());

  const targets = dailyTargets({
    calorieGoal: profile?.calorieGoal ?? null,
    weightKg: profile?.weightKg ?? null,
  });

  return (
    <Card className="p-6">
      <h2 className="font-semibold">{t.profile.progressHeading}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{t.profile.progressDescription}</p>

      <Tabs defaultValue="meals" className="mt-4">
        <TabsList>
          <TabsTrigger value="meals">VietMeal</TabsTrigger>
          <TabsTrigger value="exercises">VietFit</TabsTrigger>
        </TabsList>

        <TabsContent value="meals" className="mt-4">
          {meals.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <MealHistory entries={meals.data ?? []} targets={targets} />
          )}
        </TabsContent>

        <TabsContent value="exercises" className="mt-4">
          {exercises.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <ExerciseHistory entries={exercises.data ?? []} />
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function MealHistory({ entries, targets }: { entries: MealEntry[]; targets: DailyTargets }) {
  const { t, language } = useI18n();
  const groups = useMemo(() => groupByLocalDay(entries), [entries]);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.profile.noMealsTicked}</p>;
  }

  const targetsHint =
    targets.proteinG == null
      ? t.profile.targetsNeedWeight
      : targets.calories == null
        ? t.profile.targetsNeedCalorieGoal
        : t.profile.targetsNote;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{targetsHint}</p>
      <PagedDayGroups
        groups={groups}
        renderGroup={(group) => (
          <>
            {/* Totals only mean something for a single real day. */}
            {group.key && (
              <DailyTotals
                totals={sumMacros(
                  group.items.map((e) => scaleRecipeMacros(e.recipe, e.portionMultiplier)),
                )}
                targets={targets}
              />
            )}
            {group.items.map((entry) => {
              const primary =
                language === "vi" ? entry.recipe.nameVi : (entry.recipe.nameEn ?? entry.recipe.nameVi);
              const secondary = language === "vi" ? entry.recipe.nameEn : entry.recipe.nameVi;
              const scaled = scaleRecipeMacros(entry.recipe, entry.portionMultiplier);
              return (
                <div key={entry.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {t.common.mealType[entry.mealType as keyof typeof t.common.mealType] ?? entry.mealType}
                    </Badge>
                    <span className="font-medium">{primary}</span>
                    {secondary && secondary !== primary && (
                      <span className="text-sm text-muted-foreground">({secondary})</span>
                    )}
                    {isScaledPortion(entry.portionMultiplier) && (
                      <Badge variant="outline">{formatPortionMultiplier(entry.portionMultiplier)}</Badge>
                    )}
                    <TickTime date={entry.completedAt} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {scaled.calories} kcal · {scaled.proteinG}g {t.common.macro.protein.toLowerCase()} ·{" "}
                    {scaled.carbG}g {t.common.macro.carbs.toLowerCase()} · {scaled.fatG}g{" "}
                    {t.common.macro.fat.toLowerCase()}
                  </p>
                </div>
              );
            })}
          </>
        )}
      />
    </div>
  );
}

function ExerciseHistory({ entries }: { entries: ExerciseEntry[] }) {
  const { t, language } = useI18n();
  const groups = useMemo(() => groupByLocalDay(entries), [entries]);

  if (groups.length === 0) {
    return <p className="text-sm text-muted-foreground">{t.profile.noExercisesTicked}</p>;
  }

  return (
    <PagedDayGroups
      groups={groups}
      summary={(group) =>
        t.profile.exerciseSummary(
          group.items.length,
          group.items.reduce((n, e) => n + e.sets, 0),
        )
      }
      renderGroup={(group) =>
        group.items.map((entry) => (
          <div key={entry.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {t.vietfit.experienceOption[entry.exercise.difficulty as keyof typeof t.vietfit.experienceOption] ??
                  entry.exercise.difficulty}
              </Badge>
              <span className="font-medium">
                {language === "vi" ? (entry.exercise.nameVi ?? entry.exercise.name) : entry.exercise.name}
              </span>
              <TickTime date={entry.completedAt} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {entry.sets}{" "}
              {language === "vi"
                ? `set × ${entry.exercise.repSchemeVi ?? entry.repScheme}`
                : `sets × ${entry.repScheme}`}
            </p>
            {entry.exercise.muscleGroups.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {entry.exercise.muscleGroups.map((m) => (
                  <Badge key={m} variant="outline" className="capitalize">
                    {m.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))
      }
    />
  );
}

function PagedDayGroups<T>({
  groups,
  renderGroup,
  summary,
}: {
  groups: DayGroup<T>[];
  renderGroup: (group: DayGroup<T>) => ReactNode;
  summary?: (group: DayGroup<T>) => string;
}) {
  const { t, language } = useI18n();
  const [shown, setShown] = useState(DAYS_PER_PAGE);

  return (
    <div className="flex flex-col gap-6">
      {groups.slice(0, shown).map((group) => (
        <section key={group.key ?? "undated"} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold">{dayLabel(group.key, t, language)}</h3>
            {summary && <span className="text-xs text-muted-foreground">{summary(group)}</span>}
          </div>
          {renderGroup(group)}
        </section>
      ))}
      {groups.length > shown && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setShown((n) => n + DAYS_PER_PAGE)}>
          {t.profile.showOlderDays}
        </Button>
      )}
    </div>
  );
}

function DailyTotals({ totals, targets }: { totals: MacroTotals; targets: DailyTargets }) {
  const { t } = useI18n();
  const hasAnyTarget = Object.values(targets).some((v) => v != null);
  const rows: { label: string; value: number; target: number | null; unit: string }[] = [
    { label: t.common.macro.calories, value: totals.calories, target: targets.calories, unit: "kcal" },
    { label: t.common.macro.protein, value: totals.proteinG, target: targets.proteinG, unit: "g" },
    { label: t.common.macro.carbs, value: totals.carbG, target: targets.carbG, unit: "g" },
    { label: t.common.macro.fat, value: totals.fatG, target: targets.fatG, unit: "g" },
  ];

  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {hasAnyTarget ? t.profile.dailyTotalVsTarget : t.profile.dailyTotal}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {rows.map((row) => {
          const pct = row.target ? Math.round((row.value / row.target) * 100) : null;
          return (
            <div key={row.label} className="min-w-0">
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="text-sm font-medium tabular-nums">
                {row.value}
                {row.target != null && <span className="text-muted-foreground"> / {row.target}</span>} {row.unit}
              </p>
              {pct != null && (
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-primary/15"
                  role="progressbar"
                  aria-label={row.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(pct, 100)}
                  aria-valuetext={`${pct}%`}
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TickTime({ date }: { date: Date | null }) {
  const { language } = useI18n();
  if (!date) return null;
  return (
    <time dateTime={date.toISOString()} className="ml-auto text-xs text-muted-foreground tabular-nums">
      {date.toLocaleTimeString(localeFor(language), { hour: "2-digit", minute: "2-digit" })}
    </time>
  );
}

function localeFor(language: Language) {
  return language === "vi" ? "vi-VN" : "en-GB";
}

function dayLabel(key: string | null, t: Messages, language: Language) {
  if (!key) return t.profile.undatedGroup;
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const formatted = dateFromKey(key).toLocaleDateString(localeFor(language), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (key === localDateKey(today)) return `${t.profile.today} · ${formatted}`;
  if (key === localDateKey(yesterday)) return `${t.profile.yesterday} · ${formatted}`;
  return formatted;
}
