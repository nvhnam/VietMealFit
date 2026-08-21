"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useI18n } from "@/features/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  isGender,
  normalizeGender,
} from "@/features/shared/gender";
import {
  ALLERGEN_VALUES,
  DIET_VALUES,
  EXPERIENCE_VALUES,
  GOAL_VALUES,
  UNSPECIFIED,
  normalizeChoice,
  partitionKnown,
} from "@/features/shared/vocabularies";
import type { profiles } from "@/server/db/schema";

type Profile = typeof profiles.$inferSelect;

type FormState = {
  displayName: string;
  gender: string;
  age: string;
  heightCm: string;
  weightKg: string;
  experienceLevel: string;
  dietaryPreference: string;
  allergies: string[];
  fitnessGoals: string[];
  calorieGoal: string;
};

function formFromProfile(profile: Profile | null): FormState {
  if (!profile) {
    return {
      displayName: "",
      gender: GENDER_UNSPECIFIED,
      age: "",
      heightCm: "",
      weightKg: "",
      experienceLevel: UNSPECIFIED,
      // isDietCompatible() treats a null column and "anything" identically, so
      // there is no separate unset state to preserve here.
      dietaryPreference: "anything",
      allergies: [],
      fitnessGoals: [],
      calorieGoal: "",
    };
  }
  return {
    displayName: profile.displayName ?? "",
    gender: normalizeGender(profile.gender),
    age: profile.age?.toString() ?? "",
    heightCm: profile.heightCm ?? "",
    weightKg: profile.weightKg ?? "",
    experienceLevel: normalizeChoice(profile.experienceLevel, EXPERIENCE_VALUES),
    dietaryPreference:
      profile.dietaryPreference?.trim()
        ? normalizeChoice(profile.dietaryPreference, DIET_VALUES)
        : "anything",
    // Canonicalised on load, not just for display: the checkbox for "peanut"
    // compares against the stored string, so a legacy "Peanut" would render
    // unchecked while still being a live allergy — and ticking it would then
    // append a duplicate. Legacy values keep their own position after.
    allergies: flattenPartition(profile.allergies ?? [], ALLERGEN_VALUES),
    fitnessGoals: flattenPartition(profile.fitnessGoals ?? [], GOAL_VALUES),
    calorieGoal: profile.calorieGoal?.toString() ?? "",
  };
}

function flattenPartition(stored: readonly string[], known: readonly string[]): string[] {
  const { known: canonical, legacy } = partitionKnown(stored, known);
  return [...canonical, ...legacy];
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function ProfileForm() {
  const trpc = useTRPC();
  const { data: profile, isLoading } = useQuery(trpc.profiles.get.queryOptions());

  if (isLoading) {
    return (
      <Card className="mx-auto max-w-lg space-y-3 p-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  // key forces a remount (and fresh lazy useState init) exactly once, on the
  // loading -> loaded transition — not on every later refetch, which would
  // otherwise clobber in-progress edits (the useEffect+setState version of
  // this component had exactly that bug, flagged by eslint's
  // react-hooks/set-state-in-effect rule).
  return <ProfileFormFields key={profile?.id ?? "new"} initialProfile={profile ?? null} />;
}

/** Checkbox group over a closed vocabulary, with any legacy free-text values appended. */
function CheckboxGroup({
  idPrefix,
  values,
  legacy,
  selected,
  onToggle,
  label,
}: {
  idPrefix: string;
  values: readonly string[];
  legacy: readonly string[];
  selected: readonly string[];
  onToggle: (value: string, checked: boolean) => void;
  label: (value: string) => ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {values.map((value) => (
        <div key={value} className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-${value}`}
            checked={selected.includes(value)}
            onCheckedChange={(v) => onToggle(value, v === true)}
          />
          <Label htmlFor={`${idPrefix}-${value}`} className="font-normal">
            {label(value)}
          </Label>
        </div>
      ))}
      {legacy.map((value) => (
        <div key={value} className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-legacy-${value}`}
            checked={selected.includes(value)}
            onCheckedChange={(v) => onToggle(value, v === true)}
          />
          <Label htmlFor={`${idPrefix}-legacy-${value}`} className="font-normal italic">
            {value}
          </Label>
        </div>
      ))}
    </div>
  );
}

function ProfileFormFields({ initialProfile }: { initialProfile: Profile | null }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => formFromProfile(initialProfile));

  // Passing `items` is what makes <SelectValue> render the translated label
  // instead of the raw stored value. Rendering the options from this same map
  // keeps the trigger and the list from drifting apart.
  //
  // Each map may also carry one value this profile already holds that predates
  // the closed vocabulary, kept selectable so it is not silently rewritten just
  // by opening and saving the form.
  const genderItems: Record<string, ReactNode> = {
    [GENDER_UNSPECIFIED]: t.common.genderUnspecified,
    ...Object.fromEntries(GENDER_VALUES.map((v) => [v, t.common.genderOption[v]])),
    ...(form.gender !== GENDER_UNSPECIFIED && !isGender(form.gender)
      ? { [form.gender]: form.gender }
      : {}),
  };

  // Labels are deliberately read from the VietFit/VietMeal dictionaries rather
  // than copied into the profile's: these *are* those modules' vocabularies,
  // and the profile is pre-filling their forms.
  const experienceItems: Record<string, ReactNode> = {
    [UNSPECIFIED]: t.profile.notSet,
    ...Object.fromEntries(EXPERIENCE_VALUES.map((v) => [v, t.vietfit.experienceOption[v]])),
    ...(form.experienceLevel !== UNSPECIFIED &&
    !(EXPERIENCE_VALUES as readonly string[]).includes(form.experienceLevel)
      ? { [form.experienceLevel]: form.experienceLevel }
      : {}),
  };

  const dietItems: Record<string, ReactNode> = {
    ...Object.fromEntries(DIET_VALUES.map((v) => [v, t.vietmeal.dietOption[v]])),
    ...(!(DIET_VALUES as readonly string[]).includes(form.dietaryPreference)
      ? { [form.dietaryPreference]: form.dietaryPreference }
      : {}),
  };

  const allergyParts = partitionKnown(form.allergies, ALLERGEN_VALUES);
  const goalParts = partitionKnown(form.fitnessGoals, GOAL_VALUES);

  const toggle = (field: "allergies" | "fitnessGoals") => (value: string, checked: boolean) =>
    setForm((prev) => ({
      ...prev,
      [field]: checked ? [...prev[field], value] : prev[field].filter((v) => v !== value),
    }));

  const upsert = useMutation(
    trpc.profiles.upsert.mutationOptions({
      onSuccess: () => {
        toast.success(t.profile.profileSaved);
        queryClient.invalidateQueries({ queryKey: trpc.profiles.get.queryKey() });
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <Card className="mx-auto max-w-lg p-6">
      <h1 className="mb-4 text-xl font-semibold">{t.profile.heading}</h1>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          upsert.mutate({
            displayName: form.displayName,
            gender: genderToWire(form.gender),
            age: toNumberOrNull(form.age),
            heightCm: toNumberOrNull(form.heightCm),
            weightKg: toNumberOrNull(form.weightKg),
            experienceLevel: form.experienceLevel === UNSPECIFIED ? null : form.experienceLevel,
            dietaryPreference: form.dietaryPreference || null,
            allergies: form.allergies,
            fitnessGoals: form.fitnessGoals,
            calorieGoal: toNumberOrNull(form.calorieGoal),
          });
        }}
      >
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="displayName">{t.profile.displayName}</Label>
          <Input
            id="displayName"
            required
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gender">{t.profile.gender}</Label>
          <Select
            items={genderItems}
            value={form.gender}
            onValueChange={(v) => v && setForm({ ...form, gender: v as string })}
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
          <Label htmlFor="age">{t.profile.age}</Label>
          <Input
            id="age"
            type="number"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="heightCm">{t.profile.heightCm}</Label>
          <Input
            id="heightCm"
            type="number"
            value={form.heightCm}
            onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weightKg">{t.profile.weightKg}</Label>
          <Input
            id="weightKg"
            type="number"
            value={form.weightKg}
            onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="experienceLevel">{t.profile.experienceLevel}</Label>
          <Select
            items={experienceItems}
            value={form.experienceLevel}
            onValueChange={(v) => v && setForm({ ...form, experienceLevel: v as string })}
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
          <Label htmlFor="dietaryPreference">{t.profile.dietaryPreference}</Label>
          <Select
            items={dietItems}
            value={form.dietaryPreference}
            onValueChange={(v) => v && setForm({ ...form, dietaryPreference: v as string })}
          >
            <SelectTrigger id="dietaryPreference" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(dietItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="calorieGoal">{t.profile.calorieGoalOptional}</Label>
          <Input
            id="calorieGoal"
            type="number"
            value={form.calorieGoal}
            onChange={(e) => setForm({ ...form, calorieGoal: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t.profile.calorieGoalHint}</p>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>{t.profile.allergies}</Label>
          <CheckboxGroup
            idPrefix="profile-allergy"
            values={ALLERGEN_VALUES}
            legacy={allergyParts.legacy}
            selected={form.allergies}
            onToggle={toggle("allergies")}
            label={(v) => t.vietmeal.allergenOption[v as (typeof ALLERGEN_VALUES)[number]]}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>{t.profile.fitnessGoals}</Label>
          <CheckboxGroup
            idPrefix="profile-goal"
            values={GOAL_VALUES}
            legacy={goalParts.legacy}
            selected={form.fitnessGoals}
            onToggle={toggle("fitnessGoals")}
            label={(v) => t.vietfit.goalOption[v as (typeof GOAL_VALUES)[number]]}
          />
        </div>
        <Button type="submit" className="col-span-2" disabled={upsert.isPending}>
          {upsert.isPending ? t.profile.savingProfile : t.profile.saveProfile}
        </Button>
      </form>
    </Card>
  );
}
