import "server-only";
import { z } from "zod";
import { tool, type ToolSet } from "ai";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "@/server/db";
import { nutritionItems, recipes } from "@/server/db/schema";
import { isAllergenFree, isDietCompatible } from "@/features/vietmeal/generate";

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

/**
 * Builds VietAsk's grounding tools, bound to one request's signed-in user
 * context. Deliberately a per-request factory, not a module-level ToolSet:
 * search_meal_ideas' allergy filter must be scoped to *this* caller's
 * profile, never shared across requests.
 */
export function buildVietAskTools({
  allergies,
  dietaryPreference,
}: {
  allergies: string[];
  dietaryPreference: string | null;
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
  };
}
