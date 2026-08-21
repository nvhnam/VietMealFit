"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UtensilsCrossed } from "lucide-react";
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

// Values are a closed vocabulary compared byte-for-byte against
// recipes.diet_tags in features/vietmeal/generate.ts — must stay in English
// regardless of UI language. Only the displayed label is translated.
const DIET_VALUES = ["anything", "vegan", "vegetarian", "pescatarian", "keto"] as const;

// Closed vocabulary, not free text: must stay in sync with the
// allergen_tags actually present in data/seed/recipes.json. A free-text
// field here would silently fail closed on any spelling/synonym the seed
// data doesn't happen to use (e.g. "peanuts" vs "peanut") — a real safety
// gap for a hard-exclusion allergy filter, not just a UX nicety.
const ALLERGEN_VALUES = ["peanut", "shellfish", "dairy", "egg", "gluten", "soy", "fish"] as const;

export function VietMealGenerateForm({ hasExistingPlan }: { hasExistingPlan: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  // `items` is what makes <SelectValue> render the translated label instead of
  // the raw stored value; the options render from this same map so the trigger
  // and the list cannot drift apart.
  const dietItems: Record<string, ReactNode> = Object.fromEntries(
    DIET_VALUES.map((v) => [v, t.vietmeal.dietOption[v]]),
  );
  const [weightKg, setWeightKg] = useState("65");
  const [heightCm, setHeightCm] = useState("");
  const [calorieGoal, setCalorieGoal] = useState("");
  const [dietaryPreference, setDietaryPreference] = useState("anything");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [preferHighProtein, setPreferHighProtein] = useState(false);

  const generate = useMutation(
    trpc.vietmeal.generate.mutationOptions({
      onSuccess: () => {
        toast.success(t.vietmeal.planGenerated);
        queryClient.invalidateQueries({ queryKey: trpc.vietmeal.getCurrentPlan.queryKey() });
      },
      onError: (err) => {
        // Server sends a stable machine code ("NO_ELIGIBLE_RECIPES:<mealType>")
        // rather than prose, so it can be rendered in the user's language here.
        const [code, param] = err.message.split(":");
        if (code === "NO_ELIGIBLE_RECIPES" && param) {
          const mealLabel = t.common.mealType[param as keyof typeof t.common.mealType] ?? param;
          toast.error(t.vietmeal.errors.noEligibleRecipes(mealLabel));
        } else {
          toast.error(err.message);
        }
      },
    }),
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={UtensilsCrossed} title={t.vietmeal.title} description={t.vietmeal.description} />
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
          <Label htmlFor="weightKg">{t.vietmeal.weightKg}</Label>
          <Input
            id="weightKg"
            type="number"
            required
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="heightCm">{t.vietmeal.heightCmOptional}</Label>
          <Input
            id="heightCm"
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calorieGoal">{t.vietmeal.calorieGoalOptional}</Label>
          <Input
            id="calorieGoal"
            type="number"
            value={calorieGoal}
            onChange={(e) => setCalorieGoal(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dietaryPreference">{t.vietmeal.dietaryPreference}</Label>
          <Select
            items={dietItems}
            value={dietaryPreference}
            onValueChange={(v) => v && setDietaryPreference(v)}
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
          <Label>{t.vietmeal.allergiesLabel}</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {ALLERGEN_VALUES.map((value) => (
              <div key={value} className="flex items-center gap-2">
                <Checkbox
                  id={`allergy-${value}`}
                  checked={allergies.includes(value)}
                  onCheckedChange={(v) =>
                    setAllergies((prev) =>
                      v === true ? [...prev, value] : prev.filter((a) => a !== value),
                    )
                  }
                />
                <Label htmlFor={`allergy-${value}`} className="font-normal">
                  {t.vietmeal.allergenOption[value]}
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
          <Label htmlFor="preferHighProtein">{t.vietmeal.preferHighProtein}</Label>
        </div>
        <Button type="submit" className="col-span-2" disabled={generate.isPending}>
          {generate.isPending
            ? t.vietmeal.generating
            : hasExistingPlan
              ? t.vietmeal.regeneratePlan
              : t.vietmeal.generatePlan}
        </Button>
      </form>
      </Card>
    </div>
  );
}
