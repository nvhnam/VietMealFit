import { z } from "zod";
import { eq } from "drizzle-orm";
import { profiles } from "@/server/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";
import { upsertProfile } from "@/server/lib/upsert-profile";

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

  upsert: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
    return upsertProfile(ctx.db, ctx.user.id, input, input.displayName);
  }),
});
