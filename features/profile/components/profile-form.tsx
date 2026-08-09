"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useI18n } from "@/features/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  allergies: string; // comma-separated in the UI, array on the wire
  fitnessGoals: string;
  calorieGoal: string;
};

function formFromProfile(profile: Profile | null): FormState {
  if (!profile) {
    return {
      displayName: "",
      gender: "",
      age: "",
      heightCm: "",
      weightKg: "",
      experienceLevel: "",
      dietaryPreference: "",
      allergies: "",
      fitnessGoals: "",
      calorieGoal: "",
    };
  }
  return {
    displayName: profile.displayName ?? "",
    gender: profile.gender ?? "",
    age: profile.age?.toString() ?? "",
    heightCm: profile.heightCm ?? "",
    weightKg: profile.weightKg ?? "",
    experienceLevel: profile.experienceLevel ?? "",
    dietaryPreference: profile.dietaryPreference ?? "",
    allergies: (profile.allergies ?? []).join(", "),
    fitnessGoals: (profile.fitnessGoals ?? []).join(", "),
    calorieGoal: profile.calorieGoal?.toString() ?? "",
  };
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toArray(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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

function ProfileFormFields({ initialProfile }: { initialProfile: Profile | null }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => formFromProfile(initialProfile));

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
            gender: form.gender || null,
            age: toNumberOrNull(form.age),
            heightCm: toNumberOrNull(form.heightCm),
            weightKg: toNumberOrNull(form.weightKg),
            experienceLevel: form.experienceLevel || null,
            dietaryPreference: form.dietaryPreference || null,
            allergies: toArray(form.allergies),
            fitnessGoals: toArray(form.fitnessGoals),
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
          <Input
            id="gender"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          />
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
          <Input
            id="experienceLevel"
            placeholder={t.profile.experienceLevelPlaceholder}
            value={form.experienceLevel}
            onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dietaryPreference">{t.profile.dietaryPreference}</Label>
          <Input
            id="dietaryPreference"
            placeholder={t.profile.dietaryPreferencePlaceholder}
            value={form.dietaryPreference}
            onChange={(e) => setForm({ ...form, dietaryPreference: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calorieGoal">{t.profile.calorieGoal}</Label>
          <Input
            id="calorieGoal"
            type="number"
            value={form.calorieGoal}
            onChange={(e) => setForm({ ...form, calorieGoal: e.target.value })}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="allergies">{t.profile.allergies}</Label>
          <Input
            id="allergies"
            value={form.allergies}
            onChange={(e) => setForm({ ...form, allergies: e.target.value })}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="fitnessGoals">{t.profile.fitnessGoals}</Label>
          <Input
            id="fitnessGoals"
            value={form.fitnessGoals}
            onChange={(e) => setForm({ ...form, fitnessGoals: e.target.value })}
          />
        </div>
        <Button type="submit" className="col-span-2" disabled={upsert.isPending}>
          {upsert.isPending ? t.profile.savingProfile : t.profile.saveProfile}
        </Button>
      </form>
    </Card>
  );
}
