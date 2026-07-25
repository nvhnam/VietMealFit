"use client";

import { useState } from "react";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeanPhase } from "@/features/vietlean/calculate";

const PHASE_LABELS: Record<LeanPhase, string> = {
  bulking: "Bulking",
  lean: "Lean / maintenance",
  cutting: "Cutting",
};

export function VietLeanCalculator() {
  const trpc = useTRPC();
  const [weightInput, setWeightInput] = useState("70");
  const [phase, setPhase] = useState<LeanPhase>("lean");
  const [submitted, setSubmitted] = useState<{ weightKg: number; phase: LeanPhase } | null>(null);

  const { data, isLoading, isError, error } = useQuery(
    trpc.vietlean.calculate.queryOptions(submitted ?? skipToken),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Card className="p-6">
        <h1 className="mb-4 text-xl font-semibold">VietLean</h1>
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
            <Label htmlFor="weight">Weight (kg)</Label>
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
            <Label htmlFor="phase">Phase</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v as LeanPhase)}>
              <SelectTrigger id="phase" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PHASE_LABELS) as LeanPhase[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PHASE_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Calculating..." : "Calculate"}
          </Button>
        </form>
      </Card>

      {isError && (
        <p className="text-sm text-destructive">{error?.message ?? "Something went wrong."}</p>
      )}

      {data && (
        <>
          <Card className="p-6">
            <h2 className="mb-3 font-semibold">Daily targets</h2>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{data.calorieTarget}</div>
                <div className="text-xs text-muted-foreground">kcal</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{data.proteinG}g</div>
                <div className="text-xs text-muted-foreground">Protein</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{data.carbG}g</div>
                <div className="text-xs text-muted-foreground">Carbs</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{data.fatG}g</div>
                <div className="text-xs text-muted-foreground">Fat</div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-3 font-semibold">Food category guidance — {PHASE_LABELS[phase]}</h2>
            <dl className="flex flex-col gap-3">
              {data.recommendations.map((r) => (
                <div key={r.foodCategory}>
                  <dt className="text-sm font-medium">{r.foodCategory}</dt>
                  <dd className="text-sm text-muted-foreground">{r.recommendation}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </>
      )}
    </div>
  );
}
