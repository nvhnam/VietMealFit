import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { appRouter } from "@/server/trpc/root";
import { db } from "@/server/db";
import { profiles, exercisePlans, exercisePlanItems } from "@/server/db/schema";
import { createTestUser, deleteTestUser } from "./helpers";

describe("vietfit router", () => {
  let user: User;
  let user2: User;

  beforeAll(async () => {
    user = await createTestUser("vietfit");
    user2 = await createTestUser("vietfit2");
  });

  afterAll(async () => {
    await db.delete(exercisePlans).where(eq(exercisePlans.userId, user.id));
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await deleteTestUser(user.id);
    await deleteTestUser(user2.id);
    // See profiles-router.test.ts for why: closes this file's connection pool.
    await db.$client.end({ timeout: 5 });
  });

  it("rejects an unauthenticated caller", async () => {
    const anonCaller = appRouter.createCaller({ db, user: null });
    await expect(anonCaller.vietfit.getCurrentPlan()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("has no plan before the first generate()", async () => {
    const caller = appRouter.createCaller({ db, user });
    await expect(caller.vietfit.getCurrentPlan()).resolves.toBeNull();
  });

  it("generate() creates a 15-item plan for a beginner (3 days x 5) honoring limitations and difficulty", async () => {
    const caller = appRouter.createCaller({ db, user });
    const plan = await caller.vietfit.generate({
      heightCm: 175,
      weightKg: 80,
      experienceLevel: "beginner",
      limitations: ["knee_pain"],
      goal: "muscle_gain",
    });

    expect(plan!.items).toHaveLength(15);

    const [profileRow] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    expect(profileRow?.heightCm).toBe("175.0");
    expect(profileRow?.experienceLevel).toBe("beginner");

    for (const item of plan!.items) {
      expect(item.exercise.limitationTags).not.toContain("knee_pain");
      expect(item.exercise.difficulty).toBe("beginner");
    }
  });

  it("getCurrentPlan returns the persisted plan", async () => {
    const caller = appRouter.createCaller({ db, user });
    const fetched = await caller.vietfit.getCurrentPlan();
    const [existing] = await db.select().from(exercisePlans).where(eq(exercisePlans.userId, user.id)).limit(1);
    expect(fetched?.id).toBe(existing.id);
  });

  it("regenerating replaces which plan getCurrentPlan returns (same ordering regression as vietmeal)", async () => {
    const caller = appRouter.createCaller({ db, user });
    const firstPlan = await caller.vietfit.getCurrentPlan();

    const secondPlan = await caller.vietfit.generate({
      heightCm: 175,
      weightKg: 80,
      experienceLevel: "advanced",
      limitations: [],
      goal: "endurance",
    });

    expect(secondPlan!.id).not.toBe(firstPlan!.id);
    const latest = await caller.vietfit.getCurrentPlan();
    expect(latest?.id).toBe(secondPlan!.id);
  });

  it("toggleItemCompleted marks the item completed in the DB", async () => {
    const caller = appRouter.createCaller({ db, user });
    const plan = await caller.vietfit.getCurrentPlan();
    const firstItem = plan!.items[0];

    await caller.vietfit.toggleItemCompleted({ itemId: firstItem.id, completed: true });

    const [dbItem] = await db
      .select({ completed: exercisePlanItems.completed })
      .from(exercisePlanItems)
      .where(eq(exercisePlanItems.id, firstItem.id))
      .limit(1);
    expect(dbItem?.completed).toBe(true);
  });

  it("rejects toggling another user's item", async () => {
    const caller = appRouter.createCaller({ db, user });
    const caller2 = appRouter.createCaller({ db, user: user2 });
    const plan = await caller.vietfit.getCurrentPlan();
    const firstItem = plan!.items[0];

    await expect(
      caller2.vietfit.toggleItemCompleted({ itemId: firstItem.id, completed: false }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
