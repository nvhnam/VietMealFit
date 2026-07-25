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
});
