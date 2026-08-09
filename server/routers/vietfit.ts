import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { exercisePlans, exercisePlanItems, exercises } from "@/server/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";
import { upsertProfile } from "@/server/lib/upsert-profile";
import { generateWeekSchedule, type Difficulty } from "@/features/vietfit/generate";
import { bmiCategory, computeBmi } from "@/features/shared/bmi";
import { TRPCError } from "@trpc/server";

const difficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

const generateInput = z.object({
  gender: z.string().max(50).optional(),
  age: z.number().int().min(1).max(120).optional(),
  heightCm: z.number().min(50).max(300),
  weightKg: z.number().min(20).max(400),
  experienceLevel: difficultySchema.default("beginner"),
  limitations: z.array(z.string()).default([]),
  goal: z.string().min(1).max(100),
  preferredCardioQuery: z.string().max(100).optional(),
});

export const vietfitRouter = createTRPCRouter({
  generate: protectedProcedure.input(generateInput).mutation(async ({ ctx, input }) => {
    // Same implicit profile touch as vietmeal.generate — see that router
    // and server/lib/upsert-profile.ts for the rationale.
    await upsertProfile(
      ctx.db,
      ctx.user.id,
      {
        gender: input.gender ?? null,
        age: input.age ?? null,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        experienceLevel: input.experienceLevel,
      },
      ctx.user.email?.split("@")[0] ?? "VietMealFit User",
    );

    const allExercises = await ctx.db
      .select({
        id: exercises.id,
        name: exercises.name,
        difficulty: exercises.difficulty,
        muscleGroups: exercises.muscleGroups,
        limitationTags: exercises.limitationTags,
        defaultSets: exercises.defaultSets,
        repScheme: exercises.repScheme,
      })
      .from(exercises);

    const bmi = computeBmi(input.heightCm, input.weightKg);

    let slots;
    try {
      slots = generateWeekSchedule(allExercises, {
        experienceLevel: input.experienceLevel as Difficulty,
        limitations: input.limitations,
        preferredCardioQuery: input.preferredCardioQuery,
        bmiCategory: bmiCategory(bmi),
      });
    } catch (err) {
      throw new TRPCError({ code: "BAD_REQUEST", message: (err as Error).message });
    }

    const byId = new Map(allExercises.map((e) => [e.id, e]));

    const [plan] = await ctx.db
      .insert(exercisePlans)
      .values({
        userId: ctx.user.id,
        goal: input.goal,
        params: {
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          experienceLevel: input.experienceLevel,
          limitations: input.limitations,
        },
      })
      .returning();

    await ctx.db.insert(exercisePlanItems).values(
      slots.map((slot) => {
        const exercise = byId.get(slot.exerciseId)!;
        return {
          planId: plan.id,
          day: slot.day,
          order: slot.order,
          exerciseId: slot.exerciseId,
          sets: exercise.defaultSets,
          repScheme: exercise.repScheme,
        };
      }),
    );

    return getPlanWithItems(ctx.db, plan.id, ctx.user.id);
  }),

  getCurrentPlan: protectedProcedure.query(async ({ ctx }) => {
    const [latest] = await ctx.db
      .select({ id: exercisePlans.id })
      .from(exercisePlans)
      .where(eq(exercisePlans.userId, ctx.user.id))
      .orderBy(desc(exercisePlans.createdAt))
      .limit(1);

    if (!latest) return null;
    return getPlanWithItems(ctx.db, latest.id, ctx.user.id);
  }),

  toggleItemCompleted: protectedProcedure
    .input(z.object({ itemId: z.string().uuid(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // Same ownership-join requirement as vietmeal — ctx.db bypasses RLS,
      // so this join is the only thing preventing cross-user tampering.
      const [updated] = await ctx.db
        .update(exercisePlanItems)
        .set({ completed: input.completed })
        .from(exercisePlans)
        .where(
          and(
            eq(exercisePlanItems.id, input.itemId),
            eq(exercisePlanItems.planId, exercisePlans.id),
            eq(exercisePlans.userId, ctx.user.id),
          ),
        )
        .returning({ id: exercisePlanItems.id });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Exercise plan item not found." });
      }
      return { success: true };
    }),
});

async function getPlanWithItems(db: typeof import("@/server/db").db, planId: string, userId: string) {
  const plan = await db.query.exercisePlans.findFirst({
    where: (ep, { eq: eqOp, and: andOp }) => andOp(eqOp(ep.id, planId), eqOp(ep.userId, userId)),
    with: {
      items: {
        with: { exercise: true },
      },
    },
  });
  return plan ?? null;
}
