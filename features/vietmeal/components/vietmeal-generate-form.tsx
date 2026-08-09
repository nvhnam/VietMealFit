"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";
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

const DIET_OPTIONS = ["anything", "vegan", "vegetarian", "pescatarian", "keto"];

// Closed vocabulary, not free text: must stay in sync with the
// allergen_tags actually present in data/seed/recipes.json. A free-text
// field here would silently fail closed on any spelling/synonym the seed
// data doesn't happen to use (e.g. "peanuts" vs "peanut") — a real safety
// gap for a hard-exclusion allergy filter, not just a UX nicety.
const ALLERGEN_OPTIONS = [
  { value: "peanut", label: "Peanut" },
  { value: "shellfish", label: "Shellfish" },
  { value: "dairy", label: "Dairy" },
  { value: "egg", label: "Egg" },
  { value: "gluten", label: "Gluten" },
  { value: "soy", label: "Soy" },
  { value: "fish", label: "Fish" },
];

export function VietMealGenerateForm({ hasExistingPlan }: { hasExistingPlan: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [weightKg, setWeightKg] = useState("65");
  const [heightCm, setHeightCm] = useState("");
  const [calorieGoal, setCalorieGoal] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("anything");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [preferHighProtein, setPreferHighProtein] = useState(false);

  const generate = useMutation(
    trpc.vietmeal.generate.mutationOptions({
      onSuccess: () => {
        toast.success("Meal plan generated");
        queryClient.invalidateQueries({ queryKey: trpc.vietmeal.getCurrentPlan.queryKey() });
      },
      onError: (err) => toast.error(err.message),
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={UtensilsCrossed}
        title="VietMeal"
        description="Generate a personalized Vietnamese meal plan, scaled to your macros and goals."
      />
      <Card className="p-6">
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const weight = Number(weightKg);
          if (!Number.isFinite(weight) || weight <= 0) return;
          generate.mutate({
            weightKg: weight,
            heightCm: heightCm.trim() ? Number(heightCm) : undefined,
            calorieGoal: calorieGoal.trim() ? Number(calorieGoal) : undefined,
            dietaryPreference,
            allergies,
            preferHighProtein,
          });
        }}
      >
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
          <Label htmlFor="heightCm">Height (cm) — optional</Label>
          <Input
            id="heightCm"
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calorieGoal">Calorie goal — optional</Label>
          <Input
            id="calorieGoal"
            type="number"
            value={calorieGoal}
            onChange={(e) => setCalorieGoal(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dietaryPreference">Dietary preference</Label>
          <Select value={dietaryPreference} onValueChange={(v) => v && setDietaryPreference(v)}>
            <SelectTrigger id="dietaryPreference">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIET_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>Allergies</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {ALLERGEN_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <Checkbox
                  id={`allergy-${opt.value}`}
                  checked={allergies.includes(opt.value)}
                  onCheckedChange={(v) =>
                    setAllergies((prev) =>
                      v === true ? [...prev, opt.value] : prev.filter((a) => a !== opt.value),
                    )
                  }
                />
                <Label htmlFor={`allergy-${opt.value}`} className="font-normal">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Checkbox
            id="preferHighProtein"
            checked={preferHighProtein}
            onCheckedChange={(v) => setPreferHighProtein(v === true)}
          />
          <Label htmlFor="preferHighProtein">Prioritize high-protein meals</Label>
        </div>
        <Button type="submit" className="col-span-2" disabled={generate.isPending}>
          {generate.isPending
            ? "Generating..."
            : hasExistingPlan
              ? "Regenerate plan"
              : "Generate plan"}
        </Button>
      </form>
      </Card>
    </div>
  );
}
