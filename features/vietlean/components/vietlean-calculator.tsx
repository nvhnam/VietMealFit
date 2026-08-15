"use client";

import { useState } from "react";
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
import type { LeanPhase } from "@/features/vietlean/calculate";
import { VietLeanMacroChart } from "./vietlean-macro-chart";

const PHASE_VALUES: LeanPhase[] = ["bulking", "lean", "cutting"];

export function VietLeanCalculator() {
  const trpc = useTRPC();
  const { t, language } = useI18n();
  const [weightInput, setWeightInput] = useState("70");
  const [phase, setPhase] = useState<LeanPhase>("lean");
  const [submitted, setSubmitted] = useState<{ weightKg: number; phase: LeanPhase } | null>(null);

  const { data, isLoading, isError, error } = useQuery(
    trpc.vietlean.calculate.queryOptions(submitted ?? skipToken),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader icon={Calculator} title={t.vietlean.title} description={t.vietlean.description} />
      <Card className="p-6">
        <form
          className="flex flex-wrap items-end gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const weightKg = Number(weightInput);
            if (!Number.isFinite(weightKg) || weightKg <= 0) return;
            setSubmitted({ weightKg, phase });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="weight">{t.vietlean.weightKg}</Label>
            <Input
              id="weight"
              type="number"
              min={20}
              max={400}
              className="w-32"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phase">{t.vietlean.phase}</Label>
            <Select value={phase} onValueChange={(v) => v && setPhase(v as LeanPhase)}>
              <SelectTrigger id="phase" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASE_VALUES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t.vietlean.phaseOption[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t.vietlean.calculating : t.vietlean.calculate}
          </Button>
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
