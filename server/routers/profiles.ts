import { z } from "zod";
import { eq } from "drizzle-orm";
import { profiles } from "@/server/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

const profileInput = z.object({
  displayName: z.string().min(1).max(100),
  gender: z.string().max(50).nullable().optional(),
  age: z.number().int().min(1).max(120).nullable().optional(),
  heightCm: z.number().min(1).max(300).nullable().optional(),
  weightKg: z.number().min(1).max(500).nullable().optional(),
  experienceLevel: z.string().max(50).nullable().optional(),
  fitnessGoals: z.array(z.string()).optional(),
  dietaryPreference: z.string().max(50).nullable().optional(),
  allergies: z.array(z.string()).optional(),
  calorieGoal: z.number().int().min(0).max(10000).nullable().optional(),
});

export const profilesRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await ctx.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, ctx.user.id))
      .limit(1);
    return profile ?? null;
  }),

  // Insert uses defaults for any omitted field (first-time creation has
  // nothing to preserve); update only touches fields actually present in
  // the input, so a partial call can never silently null out the rest of
  // an existing profile.
  upsert: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
    const insertValues = {
      id: ctx.user.id,
      displayName: input.displayName,
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

    const [profile] = await ctx.db
      .insert(profiles)
      .values(insertValues)
      .onConflictDoUpdate({ target: profiles.id, set: updateValues })
      .returning();

    return profile;
  }),
});
