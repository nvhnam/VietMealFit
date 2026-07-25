"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

const EXPERIENCE_OPTIONS = ["beginner", "intermediate", "advanced"] as const;
const GOAL_OPTIONS = ["weight_loss", "muscle_gain", "general_fitness", "endurance"];

export function VietFitGenerateForm({ hasExistingPlan }: { hasExistingPlan: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("170");
  const [weightKg, setWeightKg] = useState("65");
  const [experienceLevel, setExperienceLevel] = useState<(typeof EXPERIENCE_OPTIONS)[number]>("beginner");
  const [limitations, setLimitations] = useState("");
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
    <Card className="p-6">
      <h1 className="mb-4 text-xl font-semibold">VietFit</h1>
      <form
        className="grid grid-cols-2 gap-4"
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
            limitations: limitations
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
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
          <Label htmlFor="limitations">Physical limitations (comma-separated)</Label>
          <Input
            id="limitations"
            value={limitations}
            onChange={(e) => setLimitations(e.target.value)}
            placeholder="knee_pain, shoulder_injury, ..."
          />
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
  );
}
