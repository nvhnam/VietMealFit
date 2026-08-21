"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dumbbell } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useI18n } from "@/features/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/shared/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GENDER_UNSPECIFIED,
  GENDER_VALUES,
  genderToWire,
} from "@/features/shared/gender";
// Shared with the profile form, which writes the same profile columns.
import { EXPERIENCE_VALUES, GOAL_VALUES } from "@/features/shared/vocabularies";


// Closed vocabulary, not free text: must stay in sync with the
// limitation_tags actually present in data/seed/exercises.json. A free-text
// field here would silently fail closed on any spelling/synonym the seed
// data doesn't happen to use (e.g. "knee pain" vs "knee_pain") — a real
// safety gap for a hard-exclusion limitation filter, not just a UX nicety.
const LIMITATION_VALUES = ["knee_pain", "lower_back_pain", "shoulder_injury", "wrist_pain"] as const;

export function VietFitGenerateForm({ hasExistingPlan }: { hasExistingPlan: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [gender, setGender] = useState<string>(GENDER_UNSPECIFIED);
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("170");
  const [weightKg, setWeightKg] = useState("65");
  const [experienceLevel, setExperienceLevel] = useState<(typeof EXPERIENCE_VALUES)[number]>("beginner");
  const [limitations, setLimitations] = useState<string[]>([]);
  const [goal, setGoal] = useState<(typeof GOAL_VALUES)[number]>(GOAL_VALUES[0]);
  const [preferredCardioQuery, setPreferredCardioQuery] = useState("");

  // Passing `items` is what makes <SelectValue> render the translated label
  // instead of the raw stored value ("weight_loss", "beginner"). Rendering the
  // options from these same maps keeps the trigger and the list in sync.
  const genderItems: Record<string, ReactNode> = {
    [GENDER_UNSPECIFIED]: t.common.genderUnspecified,
    ...Object.fromEntries(GENDER_VALUES.map((v) => [v, t.common.genderOption[v]])),
  };
  const experienceItems: Record<string, ReactNode> = Object.fromEntries(
    EXPERIENCE_VALUES.map((v) => [v, t.vietfit.experienceOption[v]]),
  );
  const goalItems: Record<string, ReactNode> = Object.fromEntries(
    GOAL_VALUES.map((v) => [v, t.vietfit.goalOption[v]]),
  );

  const generate = useMutation(
    trpc.vietfit.generate.mutationOptions({
      onSuccess: () => {
        toast.success(t.vietfit.scheduleGenerated);
        queryClient.invalidateQueries({ queryKey: trpc.vietfit.getCurrentPlan.queryKey() });
      },
      onError: (err) => {
        if (err.message === "NO_ELIGIBLE_EXERCISES") {
          toast.error(t.vietfit.errors.noEligibleExercises());
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={Dumbbell} title={t.vietfit.title} description={t.vietfit.description} />
      <Card className="p-6">
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const height = Number(heightCm);
          const weight = Number(weightKg);
          if (!Number.isFinite(height) || !Number.isFinite(weight)) return;
          generate.mutate({
            gender: genderToWire(gender) ?? undefined,
            age: age.trim() ? Number(age) : undefined,
            heightCm: height,
            weightKg: weight,
            experienceLevel,
            limitations,
            goal,
            preferredCardioQuery: preferredCardioQuery || undefined,
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gender">{t.vietfit.gender}</Label>
          <Select
            items={genderItems}
            value={gender}
            onValueChange={(v) => v && setGender(v as string)}
          >
            <SelectTrigger id="gender" className="w-full">
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
          <Label htmlFor="age">{t.vietfit.age}</Label>
          <Input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="heightCm">{t.vietfit.heightCm}</Label>
          <Input
            id="heightCm"
            type="number"
            required
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weightKg">{t.vietfit.weightKg}</Label>
          <Input
            id="weightKg"
            type="number"
            required
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="experienceLevel">{t.vietfit.experienceLevel}</Label>
          <Select
            items={experienceItems}
            value={experienceLevel}
            onValueChange={(v) => v && setExperienceLevel(v as (typeof EXPERIENCE_VALUES)[number])}
          >
            <SelectTrigger id="experienceLevel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(experienceItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal">{t.vietfit.goal}</Label>
          <Select
            items={goalItems}
            value={goal}
            onValueChange={(v) => v && setGoal(v as (typeof GOAL_VALUES)[number])}
          >
            <SelectTrigger id="goal" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(goalItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>{t.vietfit.limitations}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {LIMITATION_VALUES.map((value) => (
              <div key={value} className="flex items-center gap-2">
                <Checkbox
                  id={`limitation-${value}`}
                  checked={limitations.includes(value)}
                  onCheckedChange={(v) =>
                    setLimitations((prev) =>
                      v === true ? [...prev, value] : prev.filter((l) => l !== value),
                    )
                  }
                />
                <Label htmlFor={`limitation-${value}`} className="font-normal">
                  {t.vietfit.limitationOption[value]}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="preferredCardioQuery">{t.vietfit.preferredCardioOptional}</Label>
          <Input
            id="preferredCardioQuery"
            value={preferredCardioQuery}
            onChange={(e) => setPreferredCardioQuery(e.target.value)}
            placeholder={t.vietfit.preferredCardioPlaceholder}
          />
        </div>
        <Button type="submit" className="col-span-2" disabled={generate.isPending}>
          {generate.isPending
            ? t.vietfit.generating
            : hasExistingPlan
              ? t.vietfit.regenerateSchedule
              : t.vietfit.generateSchedule}
        </Button>
      </form>
      </Card>
    </div>
  );
}
