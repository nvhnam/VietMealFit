import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { mealPlans, mealPlanItems, recipes } from "@/server/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";
import { upsertProfile } from "@/server/lib/upsert-profile";
import { generateWeekPlan, currentWeekStart, type MealType } from "@/features/vietmeal/generate";
import { bmiCategory, computeBmi } from "@/features/shared/bmi";
import { isGender, normalizeGender } from "@/features/shared/gender";
import {
  ACTIVITY_VALUES,
  calculateVietLean,
  type ActivityLevel,
} from "@/features/vietlean/calculate";
import { TRPCError } from "@trpc/server";

const generateInput = z.object({
  weightKg: z.number().min(20).max(400),
  heightCm: z.number().min(50).max(300).optional(),
  calorieGoal: z.number().int().min(0).max(10000).optional(),
  activityLevel: z.enum(ACTIVITY_VALUES as [ActivityLevel, ...ActivityLevel[]]).optional(),
  dietaryPreference: z.string().max(50).optional(),
  allergies: z.array(z.string()).default([]),
  preferHighProtein: z.boolean().default(false),
});

/**
 * The daily energy figure the plan is fitted to, or null to leave it unfitted.
 *
 * An explicit calorie goal always wins — it is the user's own stated number,
 * and silently overriding it with a computed one would make the field
 * decorative again. Otherwise the target is VietLean's, computed by the same
 * function VietLean's own page and VietAsk's chat tool call, so the three can
 * never quote different numbers for the same person.
 *
 * Falls back to null (unfitted, as before) whenever the Mifflin-St Jeor
 * inputs aren't all known: VietMeal's form asks only for weight and an
 * optional height, so sex and age come from the profile and may simply not be
 * there. That is the ordinary case for a new user, not an error.
 */
function resolveCalorieTarget(args: {
  calorieGoal?: number;
  activityLevel?: ActivityLevel;
  weightKg: number;
  heightCm: number | null;
  gender: string | null;
  age: number | null;
}): number | null {
  if (args.calorieGoal != null && args.calorieGoal > 0) return args.calorieGoal;

  const sex = normalizeGender(args.gender);
  if (!isGender(sex) || !args.age || !args.heightCm) return null;

  try {
    return calculateVietLean({
      sex,
      age: args.age,
      heightCm: args.heightCm,
      weightKg: args.weightKg,
      // Maintenance: VietMeal plans what to eat, it does not run a phase.
      // A cut or bulk is VietLean's job, and the user can carry that number
      // back here as an explicit calorie goal.
      phase: "lean",
      activityLevel: args.activityLevel ?? "moderate",
    }).calorieTarget;
  } catch {
    // Out-of-range stored profile values shouldn't block a plan.
    return null;
  }
}

export const vietmealRouter = createTRPCRouter({
  generate: protectedProcedure.input(generateInput).mutation(async ({ ctx, input }) => {
    // Implicitly creates/updates the profile with the fields this form
    // collects, without touching displayName (never in this input) or
    // requiring a separate "complete your profile first" step — VietMeal
    // is meant to be usable standalone per plan §1.2.
    const profile = await upsertProfile(
      ctx.db,
      ctx.user.id,
      {
        weightKg: input.weightKg,
        // Optional fields left blank stay undefined, which upsertProfile
        // skips: this form starts empty rather than from the profile, so a
        // blank here means "not given", not "clear the saved value".
        heightCm: input.heightCm,
        dietaryPreference: input.dietaryPreference ?? null,
        allergies: input.allergies,
        calorieGoal: input.calorieGoal,
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

    // Height is optional on this form — fall back to the stored profile value
    // before giving up, since a returning user has usually supplied it once
    // already (via this form, VietFit, VietLean or the profile page).
    const heightCm =
      input.heightCm ?? (profile.heightCm != null ? Number(profile.heightCm) : null);
    // BMI-based nudging only applies when height is available; weight alone
    // isn't enough to compute BMI.
    const bmi = heightCm ? computeBmi(heightCm, input.weightKg) : null;

    const calorieTarget = resolveCalorieTarget({
      calorieGoal: input.calorieGoal,
      activityLevel: input.activityLevel,
      weightKg: input.weightKg,
      heightCm,
      gender: profile.gender,
      age: profile.age,
    });

    let slots;
    try {
      slots = generateWeekPlan(weekRecipes, {
        dietaryPreference: input.dietaryPreference,
        allergies: input.allergies,
        preferHighProtein: input.preferHighProtein,
        bmiCategory: bmi ? bmiCategory(bmi) : null,
        calorieTarget,
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
          // What the plan was actually fitted to, and where it came from —
          // the client shows the target alongside each day's total, and
          // "explicit" vs "vietlean" is what tells it which note to render.
          calorieTarget,
          calorieTargetSource:
            calorieTarget == null ? null : input.calorieGoal ? "explicit" : "vietlean",
          activityLevel: input.activityLevel ?? null,
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
        // numeric(4,2) round-trips as a string through the driver.
        portionMultiplier: String(slot.portionMultiplier),
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
        .set({ completed: input.completed, completedAt: input.completed ? new Date() : null })
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

  /**
   * Every ticked meal across all of the caller's plans, newest tick first.
   * Rows ticked before completed_at existed come last, with a null timestamp.
   * Grouping by calendar day is left to the client, which knows the user's
   * timezone.
   */
  getCompletedHistory: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: mealPlanItems.id,
        completedAt: mealPlanItems.completedAt,
        mealType: mealPlanItems.mealType,
        portionMultiplier: mealPlanItems.portionMultiplier,
        recipe: {
          nameVi: recipes.nameVi,
          nameEn: recipes.nameEn,
          calories: recipes.calories,
          proteinG: recipes.proteinG,
          carbG: recipes.carbG,
          fatG: recipes.fatG,
        },
      })
      .from(mealPlanItems)
      .innerJoin(mealPlans, eq(mealPlanItems.planId, mealPlans.id))
      .innerJoin(recipes, eq(mealPlanItems.recipeId, recipes.id))
      .where(and(eq(mealPlans.userId, ctx.user.id), eq(mealPlanItems.completed, true)))
      .orderBy(sql`${mealPlanItems.completedAt} desc nulls last`, mealPlanItems.id);
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
