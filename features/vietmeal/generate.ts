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
 *
 * Energy target: when the caller supplies `calorieTarget` (the user's own
 * figure, or VietLean's Mifflin-St Jeor result for the same person — see
 * server/routers/vietmeal.ts), the daily figure is split across the three
 * meals by MEAL_ENERGY_SHARE and each slot is filled in two steps:
 *   1. pick the pool entry whose energy lands closest to that slot's share
 *      once a portion multiplier has been applied, preferring recipes not
 *      already used this week so a target-fitted plan still varies;
 *   2. record the multiplier that gets it there, clamped to
 *      [MIN_PORTION_MULTIPLIER, MAX_PORTION_MULTIPLIER] so no serving is
 *      scaled past what a real plate can hold.
 * Ties resolve to the earlier pool entry, which is what keeps the
 * preferHighProtein and BMI orderings meaningful rather than overridden.
 *
 * With no `calorieTarget` the original round-robin is used unchanged and
 * every multiplier is 1 — a plan can still be generated from weight alone,
 * which is all the form has ever required.
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

export type MealSlot = {
  day: number;
  mealType: MealType;
  recipeId: string;
  /** 1 when no energy target applied; see portionMultiplierFor(). */
  portionMultiplier: number;
};

/**
 * Share of the daily energy target used to *choose* each meal. A 30/40/30
 * split with lunch as the largest meal follows NIN's own guidance for
 * Vietnamese adults; it is a convention, not a derived quantity, and is
 * exported so the UI can explain the split rather than present it as a
 * black box.
 *
 * It is a starting allocation, not a guarantee. After selection the day is
 * rebalanced as a whole (see rebalanceDay), because a single dish can only
 * stretch so far: at a high target no breakfast in the catalog reaches 30%
 * of the day even at MAX_PORTION_MULTIPLIER, and holding each meal to its
 * share would bank that shortfall instead of covering it from the two meals
 * that do have headroom. The daily total is the figure that matters, so it
 * is the one the generator fits.
 */
export const MEAL_ENERGY_SHARE: Record<MealType, number> = {
  breakfast: 0.3,
  lunch: 0.4,
  dinner: 0.3,
};

/**
 * Serving sizes are scaled, not invented: a dish is only ever served between
 * three quarters and one and a half times the portion NIN recorded for it.
 * Outside that band the result stops describing the dish that was costed, so
 * the generator accepts a miss against the target instead — the shortfall is
 * visible in the day's total rather than hidden in an implausible serving.
 */
export const MIN_PORTION_MULTIPLIER = 0.75;
export const MAX_PORTION_MULTIPLIER = 1.5;

/** Multipliers snap to this step so the UI shows "x1.25", not "x1.2437". */
const PORTION_STEP = 0.05;

/** Snap to PORTION_STEP and hold inside the plausible-serving band. */
function clampToStep(multiplier: number): number {
  const stepped = Math.round(multiplier / PORTION_STEP) * PORTION_STEP;
  const clamped = Math.min(MAX_PORTION_MULTIPLIER, Math.max(MIN_PORTION_MULTIPLIER, stepped));
  // Two decimals: PORTION_STEP is not binary-exact, so round the float away.
  return Math.round(clamped * 100) / 100;
}

export function portionMultiplierFor(recipeCalories: number, slotTargetKcal: number): number {
  if (!Number.isFinite(recipeCalories) || recipeCalories <= 0) return 1;
  return clampToStep(slotTargetKcal / recipeCalories);
}

// Message is a stable machine code ("NO_ELIGIBLE_RECIPES:<mealType>"), not
// English prose — the client parses it and renders localized text from the
// i18n dictionary, since the server has no notion of the user's UI language.
export class NoEligibleRecipesError extends Error {
  constructor(mealType: MealType) {
    super(`NO_ELIGIBLE_RECIPES:${mealType}`);
    this.name = "NoEligibleRecipesError";
  }
}

// Structural (not RecipeForGeneration-typed) parameters: both are reused by
// VietAsk's search_meal_ideas tool (server/ai/vietask-tools.ts) against
// recipe rows that include "snack" as a mealType, which RecipeForGeneration's
// breakfast|lunch|dinner union deliberately excludes — only dietTags/
// allergenTags are actually read here, so widening to just those fields
// keeps this reusable without a type mismatch or a second implementation.
export function isDietCompatible(recipe: { dietTags: string[] }, dietaryPreference?: string | null): boolean {
  if (!dietaryPreference || dietaryPreference.trim().toLowerCase() === "anything") return true;
  const want = dietaryPreference.trim().toLowerCase();
  return recipe.dietTags.some((t) => t.toLowerCase() === want);
}

export function isAllergenFree(recipe: { allergenTags: string[] }, allergies: string[]): boolean {
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

/**
 * How many candidates per meal type are considered for a given day. The
 * shortlist is taken by closeness to that meal's share of the target, in
 * pool order, which bounds the search below at CANDIDATES_PER_SLOT^3 while
 * keeping every dish that could plausibly win.
 */
const CANDIDATES_PER_SLOT = 8;

/**
 * Deliberately no "relax the no-repeat rule to reach the target" fallback.
 *
 * It was tried and removed: where a day falls short, the shortfall is a
 * catalog capacity limit, not a scheduling one. Serving the seven densest
 * dishes at MAX_PORTION_MULTIPLIER — repeats and all — tops out around
 * 2380 kcal/day across the whole catalog, and far lower inside a single
 * diet (roughly 1460 vegan, 1210 keto). Repeating dishes therefore buys
 * almost no energy while costing the entire week's variety, so the
 * generator keeps the variety, misses the target, and reports the miss:
 * every day's served total is shown against the target it was fitted to.
 */

function shortlist(
  candidates: RecipeForGeneration[],
  slotTargetKcal: number,
): RecipeForGeneration[] {
  if (candidates.length <= CANDIDATES_PER_SLOT) return candidates;
  const byCloseness = candidates
    .map((recipe, poolIndex) => ({
      recipe,
      poolIndex,
      residual: Math.abs(
        slotTargetKcal - recipe.calories * portionMultiplierFor(recipe.calories, slotTargetKcal),
      ),
    }))
    // Ties keep pool order, so preferHighProtein/BMI ordering survives the cut.
    .sort((a, b) => a.residual - b.residual || a.poolIndex - b.poolIndex)
    .slice(0, CANDIDATES_PER_SLOT);
  // Restore pool order within the shortlist for the same reason.
  return byCloseness.sort((a, b) => a.poolIndex - b.poolIndex).map((c) => c.recipe);
}

/**
 * Fills all seven days across all three meal types against a daily target.
 *
 * The three servings for a day are chosen *together*, scored on the day's
 * total after rebalancing, rather than each slot independently against its
 * own share. Choosing per slot looks equivalent but is not: it picks the
 * best-fitting dish for every slot in isolation, which drains the
 * calorie-dense end of each pool early and strands the smallest breakfast,
 * lunch and dinner on the same late day, where even MAX_PORTION_MULTIPLIER
 * on all three cannot reach the target. Scoring whole days instead pairs a
 * light dish with heavier ones and keeps every day reachable.
 *
 * Dishes already used are held back per meal type until that pool is
 * exhausted, so fitting a target never collapses the week onto one dish.
 * Combinations are scanned in pool order and compared strictly, so an exact
 * tie keeps the earlier entry — the one preferHighProtein and the BMI tier
 * put in front.
 */
function pickTargetedWeek(
  poolsByMealType: Map<MealType, RecipeForGeneration[]>,
  dayTargetKcal: number,
): Map<MealType, Pick[]> {
  const used = new Map<MealType, Set<string>>(MEAL_TYPES.map((m) => [m, new Set<string>()]));
  const result = new Map<MealType, Pick[]>(MEAL_TYPES.map((m) => [m, []]));

  const trialPicks = (combo: RecipeForGeneration[]): Pick[] =>
    combo.map((recipe, i) => ({
      recipe,
      portionMultiplier: portionMultiplierFor(
        recipe.calories,
        dayTargetKcal * MEAL_ENERGY_SHARE[MEAL_TYPES[i]],
      ),
    }));

  /** Best (lowest-residual) combination over the given per-slot shortlists. */
  const solve = (shortlists: RecipeForGeneration[][]) => {
    let bestPicks: Pick[] | null = null;
    let bestResidual = Number.POSITIVE_INFINITY;

    for (const breakfast of shortlists[0]) {
      for (const lunch of shortlists[1]) {
        for (const dinner of shortlists[2]) {
          const picks = trialPicks([breakfast, lunch, dinner]);
          rebalanceDay(picks, dayTargetKcal);
          const served = picks.reduce((sum, p) => sum + p.recipe.calories * p.portionMultiplier, 0);
          const residual = Math.abs(dayTargetKcal - served);
          if (residual < bestResidual) {
            bestResidual = residual;
            bestPicks = picks;
          }
        }
      }
    }
    return { picks: bestPicks, residual: bestResidual };
  };

  for (let day = 0; day < DAYS_IN_WEEK; day++) {
    const freshCandidates = MEAL_TYPES.map((mealType) => {
      const pool = poolsByMealType.get(mealType)!;
      const seen = used.get(mealType)!;
      const unused = pool.filter((r) => !seen.has(r.id));
      if (unused.length === 0) {
        seen.clear();
        return pool;
      }
      return unused;
    });

    const shortlists = MEAL_TYPES.map((mealType, i) =>
      shortlist(freshCandidates[i], dayTargetKcal * MEAL_ENERGY_SHARE[mealType]),
    );
    const best = solve(shortlists);

    // Non-null in practice: every shortlist is non-empty because the pool it
    // came from is non-empty (checked by the caller before we get here).
    const chosen = best.picks ?? trialPicks([shortlists[0][0], shortlists[1][0], shortlists[2][0]]);
    MEAL_TYPES.forEach((mealType, i) => {
      used.get(mealType)!.add(chosen[i].recipe.id);
      result.get(mealType)!.push(chosen[i]);
    });
  }

  return result;
}

type Pick = { recipe: RecipeForGeneration; portionMultiplier: number };

/**
 * Nudges one day's three multipliers together until the day's energy lands
 * on target, or until every serving has hit a clamp.
 *
 * Each pass computes the uniform multiplier delta that would close the gap
 * across the servings still free to move, applies it, then re-measures —
 * re-measuring matters because snapping to PORTION_STEP and hitting a clamp
 * both change how much a pass actually delivers. Four passes is ample for
 * three slots; the loop exits as soon as the gap is under a kcal or nothing
 * can move, so an unreachable target settles at the closest the catalog and
 * the clamp band allow rather than spinning.
 */
function rebalanceDay(picks: Pick[], dayTargetKcal: number): void {
  const servedKcal = () =>
    picks.reduce((sum, p) => sum + p.recipe.calories * p.portionMultiplier, 0);

  for (let pass = 0; pass < 4; pass++) {
    const gap = dayTargetKcal - servedKcal();
    if (Math.abs(gap) < 1) return;

    const movable = picks.filter((p) =>
      gap > 0 ? p.portionMultiplier < MAX_PORTION_MULTIPLIER : p.portionMultiplier > MIN_PORTION_MULTIPLIER,
    );
    // kcal delivered per +1.00 of multiplier across the servings that can move.
    const capacity = movable.reduce((sum, p) => sum + p.recipe.calories, 0);
    if (capacity <= 0) return;

    const delta = gap / capacity;
    for (const p of movable) {
      p.portionMultiplier = clampToStep(p.portionMultiplier + delta);
    }
  }
}

export function generateWeekPlan(
  recipes: RecipeForGeneration[],
  opts: {
    dietaryPreference?: string | null;
    allergies?: string[];
    preferHighProtein?: boolean;
    bmiCategory?: BmiCategory | null;
    /** Daily kcal. Omit/null to keep the original unscaled round-robin. */
    calorieTarget?: number | null;
  },
): MealSlot[] {
  const allergies = opts.allergies ?? [];
  const slots: MealSlot[] = [];
  const calorieTarget = opts.calorieTarget ?? 0;
  const hasTarget = Number.isFinite(calorieTarget) && calorieTarget > 0;
  const poolsByMealType = new Map<MealType, RecipeForGeneration[]>();

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

    if (!hasTarget) {
      for (let day = 0; day < DAYS_IN_WEEK; day++) {
        slots.push({ day, mealType, recipeId: pool[day % pool.length].id, portionMultiplier: 1 });
      }
      continue;
    }

    poolsByMealType.set(mealType, pool);
  }

  if (!hasTarget) return slots;

  const picksByMealType = pickTargetedWeek(poolsByMealType, calorieTarget);
  for (let day = 0; day < DAYS_IN_WEEK; day++) {
    for (const mealType of MEAL_TYPES) {
      const pick = picksByMealType.get(mealType)![day];
      slots.push({
        day,
        mealType,
        recipeId: pick.recipe.id,
        portionMultiplier: pick.portionMultiplier,
      });
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
