/**
 * Closed vocabularies shared by the module forms that consume these values and
 * the profile form that pre-fills them.
 *
 * They live here rather than in each form because the profile writes to the
 * same `profiles` columns VietMeal and VietFit read back. Two copies of a list
 * that must match byte-for-byte is a drift bug waiting to happen: a value the
 * profile offers but the matcher doesn't recognise fails silently, with no
 * error anywhere.
 */

/**
 * UI-only sentinel for "not answered" on a nullable single-select. Goes to the
 * wire as null. Shared with the gender field, which uses the same convention.
 */
export const UNSPECIFIED = "unspecified";

/**
 * Compared byte-for-byte against recipes.diet_tags in
 * features/vietmeal/generate.ts — must stay in English regardless of UI
 * language. Only the displayed label is translated.
 *
 * Note "anything" and a null column are treated identically by
 * isDietCompatible(), so there is deliberately no separate "not set" option.
 */
export const DIET_VALUES = ["anything", "vegan", "vegetarian", "pescatarian", "keto"] as const;

/**
 * Must stay in sync with the allergen_tags actually present in
 * data/seed/recipes.json. Free text here would silently fail closed on any
 * spelling or synonym the seed data doesn't happen to use ("peanuts" vs
 * "peanut") — a real safety gap for a hard-exclusion allergy filter, not just
 * a UX nicety.
 */
export const ALLERGEN_VALUES = [
  "peanut",
  "shellfish",
  "dairy",
  "egg",
  "gluten",
  "soy",
  "fish",
] as const;

/** Matched against DIFFICULTY_RANK in features/vietfit/generate.ts and stored as the Postgres difficulty enum. */
export const EXPERIENCE_VALUES = ["beginner", "intermediate", "advanced"] as const;

export const GOAL_VALUES = ["weight_loss", "muscle_gain", "general_fitness", "endurance"] as const;

/**
 * Splits stored multi-select values into the ones our vocabulary knows and the
 * ones it doesn't.
 *
 * The unknown half exists because these fields used to be free text, so a
 * profile can hold anything a user once typed. Rendering only the known values
 * would silently drop the rest the next time that user pressed Save — the
 * checkbox group would have no box representing them, so they'd serialise away
 * as if deliberately removed. They are surfaced as extra checked boxes instead,
 * which keeps removal an explicit act.
 */
export function partitionKnown(
  stored: readonly string[],
  known: readonly string[],
): { known: string[]; legacy: string[] } {
  const knownSet = new Set<string>(known);
  const result = { known: [] as string[], legacy: [] as string[] };
  for (const raw of stored) {
    const value = raw.trim();
    if (!value) continue;
    // Case-insensitive: the old free-text field let users type "Peanut".
    const match = known.find((k) => k.toLowerCase() === value.toLowerCase());
    if (match) {
      if (!result.known.includes(match)) result.known.push(match);
    } else if (knownSet.has(value)) {
      if (!result.known.includes(value)) result.known.push(value);
    } else if (!result.legacy.includes(value)) {
      result.legacy.push(value);
    }
  }
  return result;
}

/**
 * Maps a stored single-select value onto the vocabulary, tolerating the casing
 * the old free-text field allowed. Unrecognised values are returned verbatim so
 * the form can surface them rather than discard them; empty becomes UNSPECIFIED.
 */
export function normalizeChoice(stored: string | null | undefined, known: readonly string[]): string {
  const value = (stored ?? "").trim();
  if (!value) return UNSPECIFIED;
  return known.find((k) => k.toLowerCase() === value.toLowerCase()) ?? value;
}
