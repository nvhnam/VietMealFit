/**
 * Applying a meal_plan_items.portion_multiplier to the recipe it points at.
 *
 * Every surface that shows a planned meal's energy or macros goes through
 * here — the week view, the macro chart, the text export and the profile
 * page's completed-meal history. A recipe row on its own is the unscaled
 * dish as NIN recorded it; what the user was actually served is that row
 * times this plan item's multiplier, so reading the recipe alone understates
 * (or overstates) the plan wherever the generator fitted it to a target.
 *
 * Multipliers arrive as strings: the column is numeric(4,2) and node-postgres
 * hands numerics back as strings to avoid float drift. Anything unparseable —
 * including a plan generated before the column existed — reads as 1.
 */
export type ScalableRecipe = {
  calories: number;
  proteinG: string | number;
  carbG: string | number;
  fatG: string | number;
};

export type ScaledMacros = {
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
};

export function parsePortionMultiplier(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** True when a multiplier is far enough from 1 to be worth showing. */
export function isScaledPortion(value: string | number | null | undefined): boolean {
  return Math.abs(parsePortionMultiplier(value) - 1) > 0.001;
}

/**
 * Rounds to whole kcal and one decimal gram, matching how the seed data and
 * the recipe cards already present unscaled figures.
 */
export function scaleRecipeMacros(
  recipe: ScalableRecipe,
  multiplier: string | number | null | undefined,
): ScaledMacros {
  const m = parsePortionMultiplier(multiplier);
  return {
    calories: Math.round(recipe.calories * m),
    proteinG: Math.round(Number(recipe.proteinG) * m * 10) / 10,
    carbG: Math.round(Number(recipe.carbG) * m * 10) / 10,
    fatG: Math.round(Number(recipe.fatG) * m * 10) / 10,
  };
}

/** "x1.25" / "×0.8" — trailing zeros trimmed so 1.50 reads as 1.5. */
export function formatPortionMultiplier(value: string | number | null | undefined): string {
  const m = parsePortionMultiplier(value);
  return `×${String(Math.round(m * 100) / 100)}`;
}
