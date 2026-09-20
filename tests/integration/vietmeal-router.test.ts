import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { appRouter } from "@/server/trpc/root";
import { db } from "@/server/db";
import { profiles, mealPlans, mealPlanItems, recipes } from "@/server/db/schema";
import { createTestUser, deleteTestUser } from "./helpers";

describe("vietmeal router", () => {
  let user: User;
  let user2: User;

  beforeAll(async () => {
    user = await createTestUser("vietmeal");
    user2 = await createTestUser("vietmeal2");
  });

  afterAll(async () => {
    await db.delete(mealPlans).where(eq(mealPlans.userId, user.id)); // cascades to items
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await deleteTestUser(user.id);
    await deleteTestUser(user2.id);
    // See profiles-router.test.ts for why: closes this file's connection
    // pool so it doesn't sit open (and count against Supabase's connection
    // limit) for the rest of a multi-file test run.
    await db.$client.end({ timeout: 5 });
  });

  it("rejects an unauthenticated caller", async () => {
    const anonCaller = appRouter.createCaller({ db, user: null });
    await expect(anonCaller.vietmeal.getCurrentPlan()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("has no plan before the first generate()", async () => {
    const caller = appRouter.createCaller({ db, user });
    await expect(caller.vietmeal.getCurrentPlan()).resolves.toBeNull();
  });

  it("generate() implicitly creates a profile, a 21-item plan, and honors allergies", async () => {
    const caller = appRouter.createCaller({ db, user });
    const plan = await caller.vietmeal.generate({
      weightKg: 68,
      heightCm: 172,
      dietaryPreference: "vegan",
      allergies: ["peanut"],
      preferHighProtein: false,
    });

    expect(plan).not.toBeNull();
    expect(plan!.items).toHaveLength(21);

    const [profileRow] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    expect(profileRow?.weightKg).toBe("68.0");
    expect(profileRow?.dietaryPreference).toBe("vegan");

    for (const item of plan!.items) {
      expect(item.recipe.allergenTags.map((t) => t.toLowerCase())).not.toContain("peanut");
    }
  });

  it("getCurrentPlan returns the persisted plan", async () => {
    const caller = appRouter.createCaller({ db, user });
    const fetched = await caller.vietmeal.getCurrentPlan();
    const [existing] = await db.select().from(mealPlans).where(eq(mealPlans.userId, user.id)).limit(1);
    expect(fetched?.id).toBe(existing.id);
  });

  it("regenerating replaces which plan getCurrentPlan returns (regression: getCurrentPlan used to order ascending, always returning the first-ever plan)", async () => {
    const caller = appRouter.createCaller({ db, user });
    const firstPlan = await caller.vietmeal.getCurrentPlan();

    const secondPlan = await caller.vietmeal.generate({
      weightKg: 70,
      dietaryPreference: "anything",
      allergies: [],
      preferHighProtein: true,
    });

    expect(secondPlan!.id).not.toBe(firstPlan!.id);

    const latest = await caller.vietmeal.getCurrentPlan();
    expect(latest?.id).toBe(secondPlan!.id);
  });

  it("generate() leaves a saved calorie goal and height alone when the form leaves them blank", async () => {
    const caller = appRouter.createCaller({ db, user });
    await db.update(profiles).set({ calorieGoal: 2100, heightCm: "172.0" }).where(eq(profiles.id, user.id));

    await caller.vietmeal.generate({ weightKg: 70, dietaryPreference: "anything", allergies: [] });

    const [profileRow] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    expect(profileRow?.calorieGoal).toBe(2100);
    expect(profileRow?.heightCm).toBe("172.0");
    expect(profileRow?.weightKg).toBe("70.0");
  });

  it("toggleItemCompleted marks the item completed in the DB", async () => {
    const caller = appRouter.createCaller({ db, user });
    const plan = await caller.vietmeal.getCurrentPlan();
    const firstItem = plan!.items[0];

    await caller.vietmeal.toggleItemCompleted({ itemId: firstItem.id, completed: true });

    const [dbItem] = await db
      .select({ completed: mealPlanItems.completed })
      .from(mealPlanItems)
      .where(eq(mealPlanItems.id, firstItem.id))
      .limit(1);
    expect(dbItem?.completed).toBe(true);
  });

  it("rejects toggling another user's item (ownership check bypasses RLS via service-role db, so this is enforced in application code)", async () => {
    const caller = appRouter.createCaller({ db, user });
    const caller2 = appRouter.createCaller({ db, user: user2 });
    const plan = await caller.vietmeal.getCurrentPlan();
    const firstItem = plan!.items[0];

    await expect(
      caller2.vietmeal.toggleItemCompleted({ itemId: firstItem.id, completed: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getCompletedHistory lists ticked items with their tick time, only for their owner, and drops them on untick", async () => {
    const caller = appRouter.createCaller({ db, user });
    const caller2 = appRouter.createCaller({ db, user: user2 });
    const plan = await caller.vietmeal.getCurrentPlan();
    // Items come back unordered, so tick this one here rather than relying on
    // which item an earlier test happened to tick.
    const firstItem = plan!.items[0];
    await caller.vietmeal.toggleItemCompleted({ itemId: firstItem.id, completed: true });

    const history = await caller.vietmeal.getCompletedHistory();
    const entry = history.find((h) => h.id === firstItem.id);
    expect(entry).toBeDefined();
    expect(entry!.completedAt).toBeInstanceOf(Date);
    expect(Date.now() - entry!.completedAt!.getTime()).toBeLessThan(5 * 60_000);
    expect(entry!.recipe.calories).toBeTypeOf("number");

    const otherHistory = await caller2.vietmeal.getCompletedHistory();
    expect(otherHistory.map((h) => h.id)).not.toContain(firstItem.id);

    await caller.vietmeal.toggleItemCompleted({ itemId: firstItem.id, completed: false });
    const [dbItem] = await db
      .select({ completedAt: mealPlanItems.completedAt })
      .from(mealPlanItems)
      .where(eq(mealPlanItems.id, firstItem.id))
      .limit(1);
    expect(dbItem?.completedAt).toBeNull();
    const after = await caller.vietmeal.getCompletedHistory();
    expect(after.map((h) => h.id)).not.toContain(firstItem.id);
  });

  it("throws a BAD_REQUEST (not a silent allergen-unsafe plan or a 500) when every breakfast recipe conflicts with allergies", async () => {
    // Derive an allergy list from the real seeded catalog's own allergen
    // tags, rather than guessing a vocabulary — guarantees the breakfast
    // pool is actually exhausted regardless of what the catalog contains.
    const breakfastRecipes = await db
      .select({ allergenTags: recipes.allergenTags })
      .from(recipes)
      .where(eq(recipes.mealType, "breakfast"));
    const allAllergens = [...new Set(breakfastRecipes.flatMap((r) => r.allergenTags))];
    // Only a meaningful test if every breakfast recipe carries at least one
    // allergen tag — otherwise there's an allergen-free recipe no allergy
    // list could ever exclude, and NoEligibleRecipesError is unreachable.
    const everyRecipeTagged = breakfastRecipes.every((r) => r.allergenTags.length > 0);
    if (!everyRecipeTagged) {
      expect(breakfastRecipes.length).toBeGreaterThan(0); // sanity: seed data exists
      return;
    }

    const caller = appRouter.createCaller({ db, user });
    await expect(
      caller.vietmeal.generate({
        weightKg: 70,
        dietaryPreference: "anything",
        allergies: allAllergens,
        preferHighProtein: false,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("fits the week to an explicit calorie goal and persists the portion multipliers", async () => {
    const caller = appRouter.createCaller({ db, user });
    const calorieGoal = 1800;
    const plan = await caller.vietmeal.generate({
      weightKg: 68,
      heightCm: 172,
      calorieGoal,
      dietaryPreference: "anything",
      allergies: [],
      preferHighProtein: false,
    });

    expect((plan!.params as { calorieTarget?: number }).calorieTarget).toBe(calorieGoal);
    expect((plan!.params as { calorieTargetSource?: string }).calorieTargetSource).toBe("explicit");

    for (const item of plan!.items) {
      const multiplier = Number(item.portionMultiplier);
      expect(multiplier).toBeGreaterThanOrEqual(0.75);
      expect(multiplier).toBeLessThanOrEqual(1.5);
    }

    // The served week, not the catalog week: every day should land near goal.
    for (let day = 0; day < 7; day++) {
      const served = plan!.items
        .filter((i) => i.day === day)
        .reduce((sum, i) => sum + i.recipe.calories * Number(i.portionMultiplier), 0);
      expect(Math.abs(served - calorieGoal) / calorieGoal).toBeLessThan(0.1);
    }
  });

  it("leaves multipliers at 1 when no goal is set and the profile can't supply one", async () => {
    const caller = appRouter.createCaller({ db, user });
    await db.update(profiles).set({ gender: null, age: null }).where(eq(profiles.id, user.id));

    const plan = await caller.vietmeal.generate({
      weightKg: 68,
      dietaryPreference: "anything",
      allergies: [],
      preferHighProtein: false,
    });

    expect((plan!.params as { calorieTarget?: number | null }).calorieTarget).toBeNull();
    expect(plan!.items.every((i) => Number(i.portionMultiplier) === 1)).toBe(true);
  });

  it("derives the target from VietLean when the profile has sex and age but no goal is typed", async () => {
    const caller = appRouter.createCaller({ db, user });
    await db.update(profiles).set({ gender: "male", age: 30 }).where(eq(profiles.id, user.id));

    const plan = await caller.vietmeal.generate({
      weightKg: 70,
      heightCm: 175,
      activityLevel: "moderate",
      dietaryPreference: "anything",
      allergies: [],
      preferHighProtein: false,
    });

    const params = plan!.params as { calorieTarget?: number; calorieTargetSource?: string };
    // Mifflin-St Jeor for a 30y male at 175cm/70kg, moderate activity,
    // maintenance: the same figure VietLean's own page returns.
    expect(params.calorieTarget).toBe(2556);
    expect(params.calorieTargetSource).toBe("vietlean");
  });

  it("excludes soy-sauce dishes from a gluten-free plan", async () => {
    const caller = appRouter.createCaller({ db, user });
    const plan = await caller.vietmeal.generate({
      weightKg: 68,
      heightCm: 172,
      dietaryPreference: "anything",
      allergies: ["gluten"],
      preferHighProtein: false,
    });

    for (const item of plan!.items) {
      expect(item.recipe.allergenTags.map((t) => t.toLowerCase())).not.toContain("gluten");
    }
  });
});
