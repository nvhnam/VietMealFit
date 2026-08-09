/**
 * VietMeal week-plan generation (plan §1.2). Deliberately rule-based, not
 * ML — the plan explicitly scopes "auto meal-swapping AI" as future work,
 * not part of this build.
 *
 * Safety rule: allergy exclusion is never relaxed, even as a fallback.
 * Dietary preference (a want) can be relaxed if the strict pool is empty;
 * an allergen match (a safety constraint) cannot — if every recipe for a
 * meal type conflicts with the user's allergies, generation fails loudly
 * rather than silently serving something the user is allergic to.
 *
 * BMI (from the user's declared height/weight) is a further soft nudge,
 * same tier as preferHighProtein: it reorders the already-safe, already
 * diet-filtered pool toward lighter or heartier recipes, it never excludes
 * anything. Mirrors the advice already shown on the BMI card (underweight
 * -> lean toward more calorie-dense options; overweight/obese -> lean
 * toward lighter ones); "Normal" applies no nudge.
 */
export type MealType = "breakfast" | "lunch" | "dinner";
export type BmiCategory = "Underweight" | "Normal" | "Overweight" | "Obese";

export type RecipeForGeneration = {
  id: string;
  mealType: MealType;
  dietTags: string[];
  allergenTags: string[];
  calories: number;
};

export type MealSlot = { day: number; mealType: MealType; recipeId: string };

// Message is a stable machine code ("NO_ELIGIBLE_RECIPES:<mealType>"), not
// English prose — the client parses it and renders localized text from the
// i18n dictionary, since the server has no notion of the user's UI language.
export class NoEligibleRecipesError extends Error {
  constructor(mealType: MealType) {
    super(`NO_ELIGIBLE_RECIPES:${mealType}`);
    this.name = "NoEligibleRecipesError";
  }
}

function isDietCompatible(recipe: RecipeForGeneration, dietaryPreference?: string | null): boolean {
  if (!dietaryPreference || dietaryPreference.trim().toLowerCase() === "anything") return true;
  const want = dietaryPreference.trim().toLowerCase();
  return recipe.dietTags.some((t) => t.toLowerCase() === want);
}

function isAllergenFree(recipe: RecipeForGeneration, allergies: string[]): boolean {
  if (allergies.length === 0) return true;
  const lowerAllergies = new Set(allergies.map((a) => a.toLowerCase()));
  return !recipe.allergenTags.some((tag) => lowerAllergies.has(tag.toLowerCase()));
}

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner"];
const DAYS_IN_WEEK = 7;

// Splits `pool` by the median calorie count within it and moves the
// requested half to the front, preserving relative order within each half
// — same "boost, don't exclude" shape as the preferHighProtein reorder.
function boostByCalorieTier(pool: RecipeForGeneration[], tier: "lighter" | "heartier"): RecipeForGeneration[] {
  if (pool.length < 2) return pool;
  const sortedCalories = pool.map((r) => r.calories).sort((a, b) => a - b);
  const mid = Math.floor(sortedCalories.length / 2);
  const median =
    sortedCalories.length % 2 !== 0 ? sortedCalories[mid] : (sortedCalories[mid - 1] + sortedCalories[mid]) / 2;

  const preferred =
    tier === "lighter" ? pool.filter((r) => r.calories <= median) : pool.filter((r) => r.calories >= median);
  if (preferred.length === 0 || preferred.length === pool.length) return pool;

  const rest = pool.filter((r) => !preferred.includes(r));
  return [...preferred, ...rest];
}

export function generateWeekPlan(
  recipes: RecipeForGeneration[],
  opts: {
    dietaryPreference?: string | null;
    allergies?: string[];
    preferHighProtein?: boolean;
    bmiCategory?: BmiCategory | null;
  },
): MealSlot[] {
  const allergies = opts.allergies ?? [];
  const slots: MealSlot[] = [];

  for (const mealType of MEAL_TYPES) {
    const byMealType = recipes.filter((r) => r.mealType === mealType && isAllergenFree(r, allergies));
    if (byMealType.length === 0) throw new NoEligibleRecipesError(mealType);

    // Diet preference is a soft filter: fall back to the allergy-safe pool
    // (not the diet-matching one) if honoring it would leave nothing to pick from.
    const strict = byMealType.filter((r) => isDietCompatible(r, opts.dietaryPreference));
    let pool = strict.length > 0 ? strict : byMealType;

    if (opts.preferHighProtein) {
      const highProtein = pool.filter((r) => r.dietTags.some((t) => t.toLowerCase() === "high-protein"));
      if (highProtein.length > 0) {
        const rest = pool.filter((r) => !highProtein.includes(r));
        pool = [...highProtein, ...rest];
      }
    }

    // Applied after preferHighProtein, so calorie tier becomes the primary
    // sort key and the high-protein preference becomes a secondary one
    // within each tier — both still shape the outcome, neither is excluded.
    if (opts.bmiCategory === "Overweight" || opts.bmiCategory === "Obese") {
      pool = boostByCalorieTier(pool, "lighter");
    } else if (opts.bmiCategory === "Underweight") {
      pool = boostByCalorieTier(pool, "heartier");
    }

    for (let day = 0; day < DAYS_IN_WEEK; day++) {
      slots.push({ day, mealType, recipeId: pool[day % pool.length].id });
    }
  }

  return slots;
}

/**
 * Monday of the current week, as a YYYY-MM-DD date string (no time/TZ component).
 *
 * Built from local date components throughout, not `toISOString()` — that
 * method always converts to UTC, which silently shifts the result to the
 * wrong calendar day in any timezone ahead of UTC (e.g. in Asia/Saigon,
 * UTC+7, local midnight becomes 17:00 the previous day in UTC). Since the
 * day-of-week arithmetic above is already local-time, the serialization
 * has to stay local-time too, or the two halves disagree on "today".
 */
export function currentWeekStart(now = new Date()): string {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
