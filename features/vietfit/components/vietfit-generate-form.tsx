"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dumbbell } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
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

const EXPERIENCE_OPTIONS = ["beginner", "intermediate", "advanced"] as const;
const GOAL_OPTIONS = ["weight_loss", "muscle_gain", "general_fitness", "endurance"];

// Closed vocabulary, not free text: must stay in sync with the
// limitation_tags actually present in data/seed/exercises.json. A free-text
// field here would silently fail closed on any spelling/synonym the seed
// data doesn't happen to use (e.g. "knee pain" vs "knee_pain") — a real
// safety gap for a hard-exclusion limitation filter, not just a UX nicety.
const LIMITATION_OPTIONS = [
  { value: "knee_pain", label: "Knee pain" },
  { value: "lower_back_pain", label: "Lower back pain" },
  { value: "shoulder_injury", label: "Shoulder injury" },
  { value: "wrist_pain", label: "Wrist pain" },
];

export function VietFitGenerateForm({ hasExistingPlan }: { hasExistingPlan: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("170");
  const [weightKg, setWeightKg] = useState("65");
  const [experienceLevel, setExperienceLevel] = useState<(typeof EXPERIENCE_OPTIONS)[number]>("beginner");
  const [limitations, setLimitations] = useState<string[]>([]);
  const [goal, setGoal] = useState(GOAL_OPTIONS[0]);
  const [preferredCardioQuery, setPreferredCardioQuery] = useState("");

  const generate = useMutation(
    trpc.vietfit.generate.mutationOptions({
      onSuccess: () => {
        toast.success("Exercise plan generated");
        queryClient.invalidateQueries({ queryKey: trpc.vietfit.getCurrentPlan.queryKey() });
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Dumbbell}
        title="VietFit"
        description="Generate a structured weekly workout schedule tailored to your goals and experience level."
      />
      <Card className="p-6">
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const height = Number(heightCm);
          const weight = Number(weightKg);
          if (!Number.isFinite(height) || !Number.isFinite(weight)) return;
          generate.mutate({
            gender: gender || undefined,
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
          <Label htmlFor="gender">Gender</Label>
          <Input id="gender" value={gender} onChange={(e) => setGender(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="age">Age</Label>
          <Input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="heightCm">Height (cm)</Label>
          <Input
            id="heightCm"
            type="number"
            required
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="weightKg">Weight (kg)</Label>
          <Input
            id="weightKg"
            type="number"
            required
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="experienceLevel">Experience level</Label>
          <Select
            value={experienceLevel}
            onValueChange={(v) => v && setExperienceLevel(v as (typeof EXPERIENCE_OPTIONS)[number])}
          >
            <SelectTrigger id="experienceLevel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPERIENCE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="goal">Fitness goal</Label>
          <Select value={goal} onValueChange={(v) => v && setGoal(v)}>
            <SelectTrigger id="goal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>Physical limitations</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {LIMITATION_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`limitation-${opt.value}`}
                  checked={limitations.includes(opt.value)}
                  onCheckedChange={(v) =>
                    setLimitations((prev) =>
                      v === true ? [...prev, opt.value] : prev.filter((l) => l !== opt.value),
                    )
                  }
                />
                <Label htmlFor={`limitation-${opt.value}`} className="font-normal">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="preferredCardioQuery">Preferred cardio — optional</Label>
          <Input
            id="preferredCardioQuery"
            value={preferredCardioQuery}
            onChange={(e) => setPreferredCardioQuery(e.target.value)}
            placeholder="jump rope, burpee, ..."
          />
        </div>
        <Button type="submit" className="col-span-2" disabled={generate.isPending}>
          {generate.isPending
            ? "Generating..."
            : hasExistingPlan
              ? "Regenerate schedule"
              : "Generate schedule"}
        </Button>
      </form>
      </Card>
    </div>
  );
}
