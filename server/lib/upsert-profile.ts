import type { db as Db } from "@/server/db";
import { profiles } from "@/server/db/schema";

export type ProfileUpsertInput = {
  displayName?: string;
  gender?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  experienceLevel?: string | null;
  fitnessGoals?: string[];
  dietaryPreference?: string | null;
  allergies?: string[];
  calorieGoal?: number | null;
};

/**
 * Shared by profiles.upsert (full profile edit — always passes displayName)
 * and vietmeal.generate/vietfit.generate (partial, implicit profile touch —
 * omits displayName so an existing one is never overwritten, and falls back
 * to `fallbackDisplayName` only when creating a brand-new row).
 *
 * Insert uses defaults for any omitted field (nothing to preserve on first
 * creation); update only touches fields actually present in the input, so a
 * partial call never silently nulls out the rest of an existing profile —
 * this is exactly the bug the original profiles.upsert had before a test
 * caught it (see git history).
 */
export async function upsertProfile(
  db: typeof Db,
  userId: string,
  input: ProfileUpsertInput,
  fallbackDisplayName: string,
) {
  const insertValues = {
    id: userId,
    displayName: input.displayName ?? fallbackDisplayName,
    gender: input.gender ?? null,
    age: input.age ?? null,
    heightCm: input.heightCm != null ? String(input.heightCm) : null,
    weightKg: input.weightKg != null ? String(input.weightKg) : null,
    experienceLevel: input.experienceLevel ?? null,
    fitnessGoals: input.fitnessGoals ?? [],
    dietaryPreference: input.dietaryPreference ?? null,
    allergies: input.allergies ?? [],
    calorieGoal: input.calorieGoal ?? null,
  };

  const updateValues: Partial<typeof insertValues> & { updatedAt: Date } = {
    updatedAt: new Date(),
  };
  if (input.displayName !== undefined) updateValues.displayName = input.displayName;
  if (input.gender !== undefined) updateValues.gender = input.gender ?? null;
  if (input.age !== undefined) updateValues.age = input.age ?? null;
  if (input.heightCm !== undefined)
    updateValues.heightCm = input.heightCm != null ? String(input.heightCm) : null;
  if (input.weightKg !== undefined)
    updateValues.weightKg = input.weightKg != null ? String(input.weightKg) : null;
  if (input.experienceLevel !== undefined)
    updateValues.experienceLevel = input.experienceLevel ?? null;
  if (input.fitnessGoals !== undefined) updateValues.fitnessGoals = input.fitnessGoals;
  if (input.dietaryPreference !== undefined)
    updateValues.dietaryPreference = input.dietaryPreference ?? null;
  if (input.allergies !== undefined) updateValues.allergies = input.allergies;
  if (input.calorieGoal !== undefined) updateValues.calorieGoal = input.calorieGoal ?? null;

  const [profile] = await db
    .insert(profiles)
    .values(insertValues)
    .onConflictDoUpdate({ target: profiles.id, set: updateValues })
    .returning();

  return profile;
}
