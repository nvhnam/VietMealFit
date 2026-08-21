import "server-only";
import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/server/db";
import { nutritionItems, recipes } from "@/server/db/schema";
import { isAllergenFree, isDietCompatible } from "@/features/vietmeal/generate";
import {
  ACTIVITY_VALUES,
  calculateVietLean,
  type ActivityLevel,
  type LeanPhase,
} from "@/features/vietlean/calculate";
import { isGender, normalizeGender, type Gender } from "@/features/shared/gender";

// Fisher-Yates — used to vary search_meal_ideas' results across separate
// tool calls (e.g. two "suggest a breakfast" turns in the same session)
// instead of always returning the same top-N rows.
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Hard-excludes anything conflicting with the user's allergies (never
 * relaxed — same safety rule generateWeekPlan uses), then soft-filters by
 * dietary preference with a fallback to the allergen-safe pool if that
 * would leave nothing (mirrors generateWeekPlan's exact tiering, reusing
 * its isAllergenFree/isDietCompatible rather than a second implementation).
 */
export function filterSafeRecipeCandidates<T extends { dietTags: string[]; allergenTags: string[] }>(
  candidates: T[],
  allergies: string[],
  dietaryPreference: string | null,
): T[] {
  const safe = candidates.filter((c) => isAllergenFree(c, allergies));
  const preferred = safe.filter((c) => isDietCompatible(c, dietaryPreference));
  return preferred.length > 0 ? preferred : safe;
}

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
const LEAN_PHASES = ["bulking", "lean", "cutting"] as const;
const SEXES = ["male", "female"] as const;

type CalorieMacroTargetResult =
  | {
      found: true;
      sex: Gender;
      age: number;
      heightCm: number;
      weightKg: number;
      activityLevel: ActivityLevel;
      phase: LeanPhase;
      bmr: number;
      tdee: number;
      calorieTarget: number;
      proteinG: number;
      fatG: number;
      carbG: number;
      flooredAtBmr: boolean;
    }
  | { found: false; message: string };

/** Profile-sourced fallbacks for anything the model did not supply. */
export type CalorieMacroTargetDefaults = {
  gender: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
};

/**
 * Wraps calculateVietLean (features/vietlean/calculate.ts) — the exact same
 * formula VietLean's own calculator page uses — so a daily calorie/macro
 * target stated in chat can never disagree with what VietLean itself would
 * compute for the same person. Pure and exported for direct unit testing,
 * same shape as filterSafeRecipeCandidates above.
 *
 * Every input is resolved as "model-supplied, else profile, else unknown",
 * and *any* unknown makes the whole call fail with a message naming what's
 * missing. That is deliberate: Mifflin-St Jeor needs sex, age, height and
 * weight, and quietly defaulting any of them would produce a confident number
 * built on an invented premise. Activity level has no profile column at all,
 * so it is always either stated by the user or asked for.
 */
export function computeCalorieMacroTarget(
  defaults: CalorieMacroTargetDefaults,
  params: {
    sex?: Gender;
    age?: number;
    heightCm?: number;
    weightKg?: number;
    activityLevel?: ActivityLevel;
    phase: LeanPhase;
  },
): CalorieMacroTargetResult {
  // A profile's gender column is free-form legacy text for older rows, and
  // Mifflin-St Jeor only defines coefficients for two groups — so anything
  // that doesn't normalise cleanly counts as unknown and gets asked about.
  const profileSex = normalizeGender(defaults.gender);
  const sex = params.sex ?? (isGender(profileSex) ? profileSex : null);
  const age = params.age ?? defaults.age;
  const heightCm = params.heightCm ?? defaults.heightCm;
  const weightKg = params.weightKg ?? defaults.weightKg;
  const activityLevel = params.activityLevel ?? null;

  const missing: string[] = [];
  if (sex === null) missing.push("sex (male or female — the equation only defines these two)");
  if (age === null) missing.push("age in years");
  if (heightCm === null) missing.push("height in cm");
  if (weightKg === null) missing.push("weight in kg");
  if (activityLevel === null) missing.push("activity level");

  if (missing.length > 0) {
    return {
      found: false,
      message: `Missing: ${missing.join(", ")}. Ask the user for these before calculating a target — don't assume any of them.`,
    };
  }

  try {
    const result = calculateVietLean({
      sex: sex!,
      age: age!,
      heightCm: heightCm!,
      weightKg: weightKg!,
      activityLevel: activityLevel!,
      phase: params.phase,
    });
    return {
      found: true,
      sex: sex!,
      age: age!,
      heightCm: heightCm!,
      weightKg: weightKg!,
      activityLevel: activityLevel!,
      phase: params.phase,
      ...result,
    };
  } catch {
    // calculateVietLean throws on non-positive/non-finite measurements. The
    // tool's own inputSchema range-checks model-supplied values, but
    // profile-sourced ones reach here unvalidated, so this stays as a
    // defensive backstop rather than becoming unreachable dead code.
    return {
      found: false,
      message:
        "Those measurements aren't usable for this calculation. Ask the user to confirm their age, height and weight.",
    };
  }
}

/**
 * Builds VietAsk's grounding tools, bound to one request's signed-in user
 * context. Deliberately a per-request factory, not a module-level ToolSet:
 * search_meal_ideas' allergy filter must be scoped to *this* caller's
 * profile, never shared across requests.
 */
export function buildVietAskTools({
  allergies,
  dietaryPreference,
  profile,
}: {
  allergies: string[];
  dietaryPreference: string | null;
  profile: CalorieMacroTargetDefaults;
}): ToolSet {
  return {
    lookup_food_nutrition: tool({
      description:
        "Look up nutrition facts (per 100g) for a specific raw Vietnamese food or ingredient, sourced from the official 2007 Vietnamese Ministry of Health food composition table (VietSearch). Use this before stating any specific food's calorie/protein/carb/fat figures — never guess them.",
      inputSchema: z.object({
        query: z.string().min(1).max(200).describe("Vietnamese or English name of the food, e.g. 'gạo tẻ' or 'rice'"),
      }),
      execute: async ({ query }) => {
        const like = `%${query.trim()}%`;
        const rows = await db
          .select({
            nameVi: nutritionItems.nameVi,
            nameEn: nutritionItems.nameEn,
            energyKcal: nutritionItems.energyKcal,
            proteinG: nutritionItems.proteinG,
            carbohydrateG: nutritionItems.carbohydrateG,
            fatG: nutritionItems.fatG,
            sourceCitation: nutritionItems.sourceCitation,
          })
          .from(nutritionItems)
          .where(or(ilike(nutritionItems.nameVi, like), ilike(nutritionItems.nameEn, like)))
          .limit(6);

        if (rows.length === 0) {
          return {
            found: false,
            message: `No verified data found in VietSearch for "${query}". Say so plainly rather than guessing figures.`,
          };
        }

        return {
          found: true,
          per: "100g",
          items: rows.map((r) => ({
            nameVi: r.nameVi,
            nameEn: r.nameEn,
            energyKcal: r.energyKcal !== null ? Number(r.energyKcal) : null,
            proteinG: r.proteinG !== null ? Number(r.proteinG) : null,
            carbohydrateG: r.carbohydrateG !== null ? Number(r.carbohydrateG) : null,
            fatG: r.fatG !== null ? Number(r.fatG) : null,
            source: r.sourceCitation,
          })),
        };
      },
    }),

    search_meal_ideas: tool({
      description:
        "Search VietMealFit's curated Vietnamese recipe catalog (VietMeal) for meal suggestions. Results are already filtered to exclude anything conflicting with the signed-in user's allergies. Use this before naming any specific dish or its nutrition figures — never invent a dish name.",
      inputSchema: z.object({
        mealType: z.enum(MEAL_TYPES).optional().describe("Omit to search across all meal types"),
        dietaryPreference: z
          .string()
          .optional()
          .describe("e.g. vegan, vegetarian, keto — omit to use the user's saved preference"),
        keyword: z.string().optional().describe("Optional dish name or ingredient keyword to narrow the search"),
      }),
      execute: async ({ mealType, dietaryPreference: dietPrefParam, keyword }) => {
        const conditions = [];
        if (mealType) conditions.push(eq(recipes.mealType, mealType));
        if (keyword?.trim()) {
          const like = `%${keyword.trim()}%`;
          conditions.push(or(ilike(recipes.nameVi, like), ilike(recipes.nameEn, like)));
        }

        const rows = await db
          .select({
            nameVi: recipes.nameVi,
            nameEn: recipes.nameEn,
            mealType: recipes.mealType,
            calories: recipes.calories,
            proteinG: recipes.proteinG,
            carbG: recipes.carbG,
            fatG: recipes.fatG,
            dietTags: recipes.dietTags,
            allergenTags: recipes.allergenTags,
          })
          .from(recipes)
          .where(conditions.length > 0 ? and(...conditions) : undefined);

        const safe = filterSafeRecipeCandidates(rows, allergies, dietPrefParam ?? dietaryPreference);

        if (safe.length === 0) {
          return {
            found: false,
            message:
              "No verified recipes match those criteria once the user's allergies/dietary preference are applied. Say so plainly rather than inventing a dish.",
          };
        }

        return {
          found: true,
          items: shuffle(safe)
            .slice(0, 5)
            .map((r) => ({
              nameVi: r.nameVi,
              nameEn: r.nameEn,
              mealType: r.mealType,
              calories: r.calories,
              proteinG: Number(r.proteinG),
              carbG: Number(r.carbG),
              fatG: Number(r.fatG),
              dietTags: r.dietTags,
              allergenTags: r.allergenTags,
            })),
        };
      },
    }),

    get_calorie_macro_target: tool({
      description:
        "Calculate a daily calorie and protein/fat/carb target for a bulking, lean/maintenance, or cutting phase — the exact same formula VietLean's calculator page uses. Call this before stating any daily calorie or macro target; never compute or estimate one yourself, and state the returned figures exactly rather than adjusting them.",
      inputSchema: z.object({
        sex: z
          .enum(SEXES)
          .optional()
          .describe("Only what the user has stated. Omit to use their saved profile value, if any."),
        age: z
          .number()
          .int()
          .min(1)
          .max(120)
          .optional()
          .describe("User's age in years, from this conversation. Omit to use their saved profile value, if any."),
        heightCm: z
          .number()
          .min(50)
          .max(300)
          .optional()
          .describe("User's height in cm, from this conversation. Omit to use their saved profile value, if any."),
        weightKg: z
          .number()
          .min(20)
          .max(400)
          .optional()
          .describe("User's weight in kg, from what they've said in this conversation. Omit to use their saved profile weight, if any."),
        activityLevel: z
          .enum(ACTIVITY_VALUES as [ActivityLevel, ...ActivityLevel[]])
          .optional()
          .describe("sedentary = little/no exercise, light = 1-3 days/week, moderate = 3-5, active = 6-7, very_active = physical job or twice-daily training. There is no saved profile value for this — omit it unless the user has told you, and ask them rather than guessing."),
        phase: z
          .enum(LEAN_PHASES)
          .describe("bulking = gaining weight/muscle, lean = maintenance, cutting = losing weight/fat"),
      }),
      execute: async ({ phase, ...supplied }) => computeCalorieMacroTarget(profile, { ...supplied, phase }),
    }),
  };
}
