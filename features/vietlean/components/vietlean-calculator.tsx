"use client";

import { useState, type ReactNode } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useI18n } from "@/features/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVITY_VALUES,
  type ActivityLevel,
  type LeanPhase,
} from "@/features/vietlean/calculate";
import { GENDER_VALUES, type Gender } from "@/features/shared/gender";
import { VietLeanMacroChart } from "./vietlean-macro-chart";

const PHASE_VALUES: LeanPhase[] = ["bulking", "lean", "cutting"];

export function VietLeanCalculator() {
  const trpc = useTRPC();
  const { t, language } = useI18n();
  // `items` is what makes <SelectValue> render the translated label instead of
  // the raw stored value; the options render from this same map so the trigger
  // and the list cannot drift apart.
  const phaseItems: Record<string, ReactNode> = Object.fromEntries(
    PHASE_VALUES.map((p) => [p, t.vietlean.phaseOption[p]]),
  );
  const genderItems: Record<string, ReactNode> = Object.fromEntries(
    GENDER_VALUES.map((g) => [g, t.common.genderOption[g]]),
  );
  const activityItems: Record<string, ReactNode> = Object.fromEntries(
    ACTIVITY_VALUES.map((a) => [a, t.vietlean.activityOption[a]]),
  );

  // Mifflin-St Jeor needs sex, age and height on top of weight; this module
  // previously asked for weight alone and paid for it with a sex-blind target.
  const [sex, setSex] = useState<Gender>("male");
  const [ageInput, setAgeInput] = useState("30");
  const [heightInput, setHeightInput] = useState("170");
  const [weightInput, setWeightInput] = useState("70");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("moderate");
  const [phase, setPhase] = useState<LeanPhase>("lean");
  const [submitted, setSubmitted] = useState<{
    sex: Gender;
    age: number;
    heightCm: number;
    weightKg: number;
    activityLevel: ActivityLevel;
    phase: LeanPhase;
  } | null>(null);

  const { data, isLoading, isError, error } = useQuery(
    trpc.vietlean.calculate.queryOptions(submitted ?? skipToken),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader icon={Calculator} title={t.vietlean.title} description={t.vietlean.description} />
      <Card className="p-6">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const age = Number(ageInput);
            const heightCm = Number(heightInput);
            const weightKg = Number(weightInput);
            if (![age, heightCm, weightKg].every((n) => Number.isFinite(n) && n > 0)) return;
            setSubmitted({ sex, age, heightCm, weightKg, activityLevel, phase });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sex">{t.vietlean.gender}</Label>
            <Select items={genderItems} value={sex} onValueChange={(v) => v && setSex(v as Gender)}>
              <SelectTrigger id="sex" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(genderItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="age">{t.vietlean.age}</Label>
            <Input
              id="age"
              type="number"
              min={1}
              max={120}
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="height">{t.vietlean.heightCm}</Label>
            <Input
              id="height"
              type="number"
              min={50}
              max={300}
              value={heightInput}
              onChange={(e) => setHeightInput(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weight">{t.vietlean.weightKg}</Label>
            <Input
              id="weight"
              type="number"
              min={20}
              max={400}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activityLevel">{t.vietlean.activityLevel}</Label>
            <Select
              items={activityItems}
              value={activityLevel}
              onValueChange={(v) => v && setActivityLevel(v as ActivityLevel)}
            >
              <SelectTrigger id="activityLevel" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(activityItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phase">{t.vietlean.phase}</Label>
            <Select
              items={phaseItems}
              value={phase}
              onValueChange={(v) => v && setPhase(v as LeanPhase)}
            >
              <SelectTrigger id="phase" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(phaseItems).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t.vietlean.calculating : t.vietlean.calculate}
            </Button>
          </div>
        </form>
      </Card>

      {isError && (
        <p className="text-sm text-destructive">{error?.message ?? t.vietlean.somethingWentWrong}</p>
      )}

      {data && (
        <>
          <Card className="p-6">
            <h2 className="mb-3 font-semibold">{t.vietlean.dailyTargetsHeading}</h2>
            <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums">{data.calorieTarget}</div>
                <div className="text-xs text-muted-foreground">kcal</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums" style={{ color: "var(--chart-1)" }}>
                  {data.proteinG}g
                </div>
                <div className="text-xs text-muted-foreground">{t.common.macro.protein}</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums" style={{ color: "var(--chart-2)" }}>
                  {data.carbG}g
                </div>
                <div className="text-xs text-muted-foreground">{t.common.macro.carbs}</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums" style={{ color: "var(--chart-3)" }}>
                  {data.fatG}g
                </div>
                <div className="text-xs text-muted-foreground">{t.common.macro.fat}</div>
              </div>
            </div>
            {data.flooredAtBmr && (
              <p className="mt-4 text-sm text-destructive">{t.vietlean.bmrFloorNote}</p>
            )}
          </Card>

          {/* Showing the two intermediate figures makes the calorie target
              auditable rather than a bare number — and is where the sex, age
              and height inputs visibly do their work. */}
          <Card className="p-6">
            <h2 className="mb-3 font-semibold">{t.vietlean.energyBreakdownHeading}</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="font-mono text-xl font-bold tabular-nums">{data.bmr}</div>
                <div className="text-xs text-muted-foreground">{t.vietlean.restingLabel}</div>
              </div>
              <div>
                <div className="font-mono text-xl font-bold tabular-nums">{data.tdee}</div>
                <div className="text-xs text-muted-foreground">{t.vietlean.maintenanceLabel}</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t.vietlean.formulaNote}</p>
          </Card>

          <VietLeanMacroChart proteinG={data.proteinG} carbG={data.carbG} fatG={data.fatG} />

          <Card className="p-6">
            <h2 className="mb-3 font-semibold">
              {t.vietlean.foodGuidanceHeading(t.vietlean.phaseOption[phase])}
            </h2>
            <dl className="flex flex-col gap-3">
              {data.recommendations.map((r) => {
                const category = language === "vi" ? (r.foodCategoryVi ?? r.foodCategory) : r.foodCategory;
                const recommendation =
                  language === "vi" ? (r.recommendationVi ?? r.recommendation) : r.recommendation;
                return (
                  <div key={r.foodCategory}>
                    <dt className="text-sm font-medium">{category}</dt>
                    <dd className="text-sm text-muted-foreground">{recommendation}</dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        </>
      )}
    </div>
  );
}
