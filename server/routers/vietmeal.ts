import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { mealPlans, mealPlanItems, recipes } from "@/server/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";
import { upsertProfile } from "@/server/lib/upsert-profile";
import { generateWeekPlan, currentWeekStart, type MealType } from "@/features/vietmeal/generate";
import { bmiCategory, computeBmi } from "@/features/shared/bmi";
import { TRPCError } from "@trpc/server";

const generateInput = z.object({
  weightKg: z.number().min(20).max(400),
  heightCm: z.number().min(50).max(300).optional(),
  calorieGoal: z.number().int().min(0).max(10000).optional(),
  dietaryPreference: z.string().max(50).optional(),
  allergies: z.array(z.string()).default([]),
  preferHighProtein: z.boolean().default(false),
});

export const vietmealRouter = createTRPCRouter({
  generate: protectedProcedure.input(generateInput).mutation(async ({ ctx, input }) => {
    // Implicitly creates/updates the profile with the fields this form
    // collects, without touching displayName (never in this input) or
    // requiring a separate "complete your profile first" step — VietMeal
    // is meant to be usable standalone per plan §1.2.
    await upsertProfile(
      ctx.db,
      ctx.user.id,
      {
        weightKg: input.weightKg,
        heightCm: input.heightCm ?? null,
        dietaryPreference: input.dietaryPreference ?? null,
        allergies: input.allergies,
        calorieGoal: input.calorieGoal ?? null,
      },
      ctx.user.email?.split("@")[0] ?? "VietMealFit User",
    );

    const allRecipes = await ctx.db
      .select({
        id: recipes.id,
        mealType: recipes.mealType,
        dietTags: recipes.dietTags,
        allergenTags: recipes.allergenTags,
        calories: recipes.calories,
      })
      .from(recipes)
      .where(inArray(recipes.mealType, ["breakfast", "lunch", "dinner"]));

    // Redundant with the WHERE clause above, but narrows the type explicitly
    // rather than relying on TS to infer it from a runtime SQL filter — and
    // stays correct even if that WHERE clause is ever changed carelessly.
    const weekRecipes = allRecipes.filter(
      (r): r is typeof r & { mealType: MealType } => r.mealType !== "snack",
    );

    // Height is optional on this form — BMI-based nudging only applies when
    // it's available; weight alone isn't enough to compute BMI.
    const bmi = input.heightCm ? computeBmi(input.heightCm, input.weightKg) : null;

    let slots;
    try {
      slots = generateWeekPlan(weekRecipes, {
        dietaryPreference: input.dietaryPreference,
        allergies: input.allergies,
        preferHighProtein: input.preferHighProtein,
        bmiCategory: bmi ? bmiCategory(bmi) : null,
      });
    } catch (err) {
      throw new TRPCError({ code: "BAD_REQUEST", message: (err as Error).message });
    }

    const weekStart = currentWeekStart();

    const [plan] = await ctx.db
      .insert(mealPlans)
      .values({
        userId: ctx.user.id,
        weekStart,
        params: {
          weightKg: input.weightKg,
          calorieGoal: input.calorieGoal ?? null,
          dietaryPreference: input.dietaryPreference ?? null,
          allergies: input.allergies,
          preferHighProtein: input.preferHighProtein,
        },
      })
      .returning();

    await ctx.db.insert(mealPlanItems).values(
      slots.map((slot) => ({
        planId: plan.id,
        day: slot.day,
        mealType: slot.mealType,
        recipeId: slot.recipeId,
      })),
    );

    return getPlanWithItems(ctx.db, plan.id, ctx.user.id);
  }),

  getCurrentPlan: protectedProcedure.query(async ({ ctx }) => {
    const [latest] = await ctx.db
      .select({ id: mealPlans.id })
      .from(mealPlans)
      .where(eq(mealPlans.userId, ctx.user.id))
      .orderBy(desc(mealPlans.createdAt))
      .limit(1);

    if (!latest) return null;
    return getPlanWithItems(ctx.db, latest.id, ctx.user.id);
  }),

  toggleItemCompleted: protectedProcedure
    .input(z.object({ itemId: z.string().uuid(), completed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // ctx.db bypasses RLS (service-role connection) — ownership MUST be
      // verified here, in application code. This join is that check: the
      // update only matches if the item's plan actually belongs to the
      // caller, so one user can never toggle another user's tracking state
      // by guessing an item id.
      const [updated] = await ctx.db
        .update(mealPlanItems)
        .set({ completed: input.completed })
        .from(mealPlans)
        .where(
          and(
            eq(mealPlanItems.id, input.itemId),
            eq(mealPlanItems.planId, mealPlans.id),
            eq(mealPlans.userId, ctx.user.id),
          ),
        )
        .returning({ id: mealPlanItems.id });

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Meal plan item not found." });
      }
      return { success: true };
    }),
});

async function getPlanWithItems(db: typeof import("@/server/db").db, planId: string, userId: string) {
  const plan = await db.query.mealPlans.findFirst({
    where: (mp, { eq: eqOp, and: andOp }) => andOp(eqOp(mp.id, planId), eqOp(mp.userId, userId)),
    with: {
      items: {
        with: { recipe: true },
      },
    },
  });
  return plan ?? null;
}
