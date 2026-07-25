// Throwaway verification script for the vietfit router, mirroring
// test-vietmeal-router.ts's approach.
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { appRouter } from "../server/trpc/root";
import { db } from "../server/db";
import { profiles, exercisePlans, exercisePlanItems } from "../server/db/schema";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const email = `vmf.vietfit.test.${Date.now()}@gmail.com`;
  console.log("Creating pre-confirmed test user:", email);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: "TestPassword123!",
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(`createUser failed: ${createErr?.message}`);
  const user = created.user;
  console.log("Created user id:", user.id);
  const caller = appRouter.createCaller({ db, user });

  try {
    const anonCaller = appRouter.createCaller({ db, user: null });
    let rejected = false;
    try {
      await anonCaller.vietfit.getCurrentPlan();
    } catch (err: unknown) {
      rejected = (err as { code?: string }).code === "UNAUTHORIZED";
    }
    console.log("Unauthorized caller rejected:", rejected);
    if (!rejected) throw new Error("FAIL: expected UNAUTHORIZED for anon caller");

    const before = await caller.vietfit.getCurrentPlan();
    if (before !== null) throw new Error("FAIL: expected null before first generate");

    const plan = await caller.vietfit.generate({
      heightCm: 175,
      weightKg: 80,
      experienceLevel: "beginner",
      limitations: ["knee_pain"],
      goal: "muscle_gain",
    });
    console.log("generate() returned plan id:", plan?.id, "item count:", plan?.items.length);
    if (!plan) throw new Error("FAIL: generate returned null");
    if (plan.items.length !== 15) throw new Error(`FAIL: expected 15 items (beginner=3 days x 5), got ${plan.items.length}`);

    const [profileRow] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    if (!profileRow) throw new Error("FAIL: no profile row created");
    if (profileRow.heightCm !== "175.0") throw new Error(`FAIL: heightCm mismatch: ${profileRow.heightCm}`);
    if (profileRow.experienceLevel !== "beginner") throw new Error("FAIL: experienceLevel mismatch");
    console.log("Implicitly created profile with correct fields — correct.");

    for (const item of plan.items) {
      if (item.exercise.limitationTags.includes("knee_pain")) {
        throw new Error(`FAIL: plan includes a knee_pain-tagged exercise despite limitation: ${item.exercise.name}`);
      }
      if (item.exercise.difficulty !== "beginner") {
        throw new Error(`FAIL: beginner plan includes non-beginner exercise: ${item.exercise.name} (${item.exercise.difficulty})`);
      }
    }
    console.log("No knee_pain-tagged or non-beginner exercises in the plan — correct.");

    const fetched = await caller.vietfit.getCurrentPlan();
    if (fetched?.id !== plan.id) throw new Error("FAIL: getCurrentPlan didn't return the generated plan");
    console.log("getCurrentPlan returns the persisted plan — correct.");

    const firstItem = plan.items[0];
    await caller.vietfit.toggleItemCompleted({ itemId: firstItem.id, completed: true });
    const [dbItem] = await db
      .select({ completed: exercisePlanItems.completed })
      .from(exercisePlanItems)
      .where(eq(exercisePlanItems.id, firstItem.id))
      .limit(1);
    if (!dbItem?.completed) throw new Error("FAIL: item not marked completed in DB");
    console.log("Item correctly marked completed in DB.");

    const { data: created2 } = await admin.auth.admin.createUser({
      email: `vmf.vietfit.test2.${Date.now()}@gmail.com`,
      password: "TestPassword123!",
      email_confirm: true,
    });
    if (!created2?.user) throw new Error("FAIL: could not create second test user");
    const caller2 = appRouter.createCaller({ db, user: created2.user });
    let crossUserRejected = false;
    try {
      await caller2.vietfit.toggleItemCompleted({ itemId: firstItem.id, completed: false });
    } catch (err: unknown) {
      crossUserRejected = (err as { code?: string }).code === "NOT_FOUND";
    }
    console.log("Cross-user toggle attempt rejected:", crossUserRejected);
    if (!crossUserRejected) throw new Error("FAIL: a different user was able to toggle this item!");
    await admin.auth.admin.deleteUser(created2.user.id);

    console.log("ALL CHECKS PASSED");
  } finally {
    await db.delete(exercisePlans).where(eq(exercisePlans.userId, user.id));
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await admin.auth.admin.deleteUser(user.id);
    console.log("Cleaned up test users, profile, and plan.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
