import { describe, expect, it } from "vitest";
import {
  generateWeekPlan,
  currentWeekStart,
  NoEligibleRecipesError,
  type RecipeForGeneration,
} from "@/features/vietmeal/generate";

function recipe(overrides: Partial<RecipeForGeneration> & Pick<RecipeForGeneration, "id" | "mealType">): RecipeForGeneration {
  return { dietTags: [], allergenTags: [], calories: 400, ...overrides };
}

describe("generateWeekPlan", () => {
  it("produces exactly 7 slots per meal type (21 total)", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "b1", mealType: "breakfast" }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    const slots = generateWeekPlan(recipes, {});
    expect(slots).toHaveLength(21);
    for (const mealType of ["breakfast", "lunch", "dinner"] as const) {
      expect(slots.filter((s) => s.mealType === mealType)).toHaveLength(7);
    }
    for (let day = 0; day < 7; day++) {
      expect(slots.filter((s) => s.day === day)).toHaveLength(3);
    }
  });

  it("never assigns a recipe that contains one of the user's allergens (safety rule, no fallback)", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "safe", mealType: "breakfast", allergenTags: [] }),
      recipe({ id: "peanut", mealType: "breakfast", allergenTags: ["peanut"] }),
      recipe({ id: "shellfish", mealType: "breakfast", allergenTags: ["shellfish"] }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    const slots = generateWeekPlan(recipes, { allergies: ["peanut", "shellfish"] });
    const breakfastRecipeIds = new Set(slots.filter((s) => s.mealType === "breakfast").map((s) => s.recipeId));
    expect(breakfastRecipeIds).toEqual(new Set(["safe"]));
  });

  it("allergen matching is case-insensitive", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "safe", mealType: "breakfast" }),
      recipe({ id: "peanut", mealType: "breakfast", allergenTags: ["Peanut"] }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    const slots = generateWeekPlan(recipes, { allergies: ["PEANUT"] });
    const breakfastRecipeIds = new Set(slots.filter((s) => s.mealType === "breakfast").map((s) => s.recipeId));
    expect(breakfastRecipeIds).toEqual(new Set(["safe"]));
  });

  it("throws NoEligibleRecipesError rather than silently serving an allergen when the whole pool is unsafe", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "peanut1", mealType: "breakfast", allergenTags: ["peanut"] }),
      recipe({ id: "peanut2", mealType: "breakfast", allergenTags: ["peanut"] }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    expect(() => generateWeekPlan(recipes, { allergies: ["peanut"] })).toThrow(NoEligibleRecipesError);
  });

  it("falls back to the allergy-safe pool (not empty) when the dietary preference has zero matches", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "b1", mealType: "breakfast", dietTags: ["anything"] }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    // No recipe is tagged "vegan" — must fall back rather than throw, since
    // dietary preference is a soft want, not a safety constraint.
    const slots = generateWeekPlan(recipes, { dietaryPreference: "vegan" });
    expect(slots.filter((s) => s.mealType === "breakfast")).toHaveLength(7);
  });

  it("honors dietary preference strictly when a matching pool exists", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "vegan1", mealType: "breakfast", dietTags: ["vegan"] }),
      recipe({ id: "meat1", mealType: "breakfast", dietTags: ["anything"] }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    const slots = generateWeekPlan(recipes, { dietaryPreference: "vegan" });
    const breakfastRecipeIds = new Set(slots.filter((s) => s.mealType === "breakfast").map((s) => s.recipeId));
    expect(breakfastRecipeIds).toEqual(new Set(["vegan1"]));
  });

  it("prioritizes high-protein recipes first when preferHighProtein is set, without excluding others", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "hp1", mealType: "breakfast", dietTags: ["high-protein"] }),
      recipe({ id: "reg1", mealType: "breakfast" }),
      recipe({ id: "reg2", mealType: "breakfast" }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    const slots = generateWeekPlan(recipes, { preferHighProtein: true });
    const breakfastSlots = slots.filter((s) => s.mealType === "breakfast").sort((a, b) => a.day - b.day);
    // Cycling starts with the high-protein recipe first (day 0).
    expect(breakfastSlots[0].recipeId).toBe("hp1");
  });

  it("throws for a meal type with zero recipes at all", () => {
    const recipes: RecipeForGeneration[] = [recipe({ id: "l1", mealType: "lunch" })];
    expect(() => generateWeekPlan(recipes, {})).toThrow(NoEligibleRecipesError);
  });

  it("prioritizes lower-calorie recipes when bmiCategory is Overweight or Obese", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "light", mealType: "breakfast", calories: 250 }),
      recipe({ id: "heavy", mealType: "breakfast", calories: 700 }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    for (const bmiCategory of ["Overweight", "Obese"] as const) {
      const slots = generateWeekPlan(recipes, { bmiCategory });
      const breakfastSlots = slots.filter((s) => s.mealType === "breakfast").sort((a, b) => a.day - b.day);
      expect(breakfastSlots[0].recipeId).toBe("light");
    }
  });

  it("prioritizes higher-calorie recipes when bmiCategory is Underweight", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "light", mealType: "breakfast", calories: 250 }),
      recipe({ id: "heavy", mealType: "breakfast", calories: 700 }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    const slots = generateWeekPlan(recipes, { bmiCategory: "Underweight" });
    const breakfastSlots = slots.filter((s) => s.mealType === "breakfast").sort((a, b) => a.day - b.day);
    expect(breakfastSlots[0].recipeId).toBe("heavy");
  });

  it("applies no calorie-tier nudge for a Normal bmiCategory or when omitted", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "light", mealType: "breakfast", calories: 250 }),
      recipe({ id: "heavy", mealType: "breakfast", calories: 700 }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    const withNormal = generateWeekPlan(recipes, { bmiCategory: "Normal" });
    const withoutBmi = generateWeekPlan(recipes, {});
    const firstIds = (slots: typeof withNormal) =>
      slots
        .filter((s) => s.mealType === "breakfast")
        .sort((a, b) => a.day - b.day)
        .map((s) => s.recipeId);
    expect(firstIds(withNormal)).toEqual(firstIds(withoutBmi));
  });

  it("does not exclude any allergy-safe recipe when a BMI nudge is applied", () => {
    const recipes: RecipeForGeneration[] = [
      recipe({ id: "light", mealType: "breakfast", calories: 250 }),
      recipe({ id: "heavy", mealType: "breakfast", calories: 700 }),
      recipe({ id: "l1", mealType: "lunch" }),
      recipe({ id: "d1", mealType: "dinner" }),
    ];
    const slots = generateWeekPlan(recipes, { bmiCategory: "Obese" });
    const breakfastRecipeIds = new Set(slots.filter((s) => s.mealType === "breakfast").map((s) => s.recipeId));
    expect(breakfastRecipeIds).toEqual(new Set(["light", "heavy"]));
  });
});

describe("currentWeekStart", () => {
  // Constructed with the local-time (year, monthIndex, day) constructor, not
  // an ISO UTC string — the function under test reads getDay()/setDate() in
  // local time, so a UTC string near midnight could roll to a different
  // local calendar day depending on the machine's timezone.
  it("returns the Monday of the current week for a mid-week date", () => {
    // Wednesday 2026-07-22 -> Monday 2026-07-20
    expect(currentWeekStart(new Date(2026, 6, 22))).toBe("2026-07-20");
  });

  it("returns the same date when given a Monday", () => {
    expect(currentWeekStart(new Date(2026, 6, 20))).toBe("2026-07-20");
  });

  it("rolls a Sunday back to the preceding Monday, not forward", () => {
    // Sunday 2026-07-26 -> Monday 2026-07-20
    expect(currentWeekStart(new Date(2026, 6, 26))).toBe("2026-07-20");
  });
});
