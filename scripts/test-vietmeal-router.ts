// Throwaway verification script for the vietmeal router, same approach as
// test-profiles-router.ts: drive the real router via tRPC's server-side
// caller against a real pre-confirmed test user, then verify independently
// against the live DB. Not a permanent test suite (Phase 7 covers that).
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { appRouter } from "../server/trpc/root";
import { db } from "../server/db";
import { profiles, mealPlans, mealPlanItems } from "../server/db/schema";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const email = `vmf.vietmeal.test.${Date.now()}@gmail.com`;
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
    // 1. Anonymous caller must be rejected.
    const anonCaller = appRouter.createCaller({ db, user: null });
    let rejected = false;
    try {
      await anonCaller.vietmeal.getCurrentPlan();
    } catch (err: unknown) {
      rejected = (err as { code?: string }).code === "UNAUTHORIZED";
    }
    console.log("Unauthorized caller rejected:", rejected);
    if (!rejected) throw new Error("FAIL: expected UNAUTHORIZED for anon caller");

    // 2. No plan yet.
    const before = await caller.vietmeal.getCurrentPlan();
    console.log("getCurrentPlan before generate (expect null):", before);
    if (before !== null) throw new Error("FAIL: expected null before first generate");

    // 3. Generate — no profile exists yet, so this must implicitly create one.
    const plan = await caller.vietmeal.generate({
      weightKg: 68,
      heightCm: 172,
      dietaryPreference: "vegan",
      allergies: ["peanut"],
      preferHighProtein: false,
    });
    console.log("generate() returned plan id:", plan?.id, "item count:", plan?.items.length);
    if (!plan) throw new Error("FAIL: generate returned null");
    if (plan.items.length !== 21) throw new Error(`FAIL: expected 21 items, got ${plan.items.length}`);

    // 4. Profile was implicitly created with the right fields, and a sensible
    // fallback displayName (email local-part) since none was given.
    const [profileRow] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    console.log("Implicitly created profile:", profileRow);
    if (!profileRow) throw new Error("FAIL: no profile row created");
    if (profileRow.weightKg !== "68.0") throw new Error(`FAIL: weightKg mismatch: ${profileRow.weightKg}`);
    if (profileRow.dietaryPreference !== "vegan") throw new Error("FAIL: dietaryPreference mismatch");
    if (profileRow.displayName !== email.split("@")[0])
      throw new Error(`FAIL: expected fallback displayName, got ${profileRow.displayName}`);

    // 5. No item in the plan should be allergen-tagged with peanut.
    for (const item of plan.items) {
      if (item.recipe.allergenTags.some((t) => t.toLowerCase() === "peanut")) {
        throw new Error(`FAIL: plan includes a peanut-tagged recipe despite allergy: ${item.recipe.nameVi}`);
      }
    }
    console.log("No peanut-allergen recipes in the plan — correct.");

    // 6. getCurrentPlan returns the same plan (persistence check).
    const fetched = await caller.vietmeal.getCurrentPlan();
    if (fetched?.id !== plan.id) throw new Error("FAIL: getCurrentPlan didn't return the generated plan");
    console.log("getCurrentPlan returns the persisted plan — correct.");

    // 7. toggleItemCompleted: the join-based ownership-scoped update.
    const firstItem = plan.items[0];
    const toggled = await caller.vietmeal.toggleItemCompleted({ itemId: firstItem.id, completed: true });
    console.log("toggleItemCompleted result:", toggled);
    const [dbItem] = await db
      .select({ completed: mealPlanItems.completed })
      .from(mealPlanItems)
      .where(eq(mealPlanItems.id, firstItem.id))
      .limit(1);
    if (!dbItem?.completed) throw new Error("FAIL: item not marked completed in DB");
    console.log("Item correctly marked completed in DB.");

    // 8. Ownership enforcement: a second user must NOT be able to toggle the first user's item.
    const { data: created2 } = await admin.auth.admin.createUser({
      email: `vmf.vietmeal.test2.${Date.now()}@gmail.com`,
      password: "TestPassword123!",
      email_confirm: true,
    });
    if (!created2?.user) throw new Error("FAIL: could not create second test user");
    const caller2 = appRouter.createCaller({ db, user: created2.user });
    let crossUserRejected = false;
    try {
      await caller2.vietmeal.toggleItemCompleted({ itemId: firstItem.id, completed: false });
    } catch (err: unknown) {
      crossUserRejected = (err as { code?: string }).code === "NOT_FOUND";
    }
    console.log("Cross-user toggle attempt rejected:", crossUserRejected);
    if (!crossUserRejected) throw new Error("FAIL: a different user was able to toggle this item!");
    await admin.auth.admin.deleteUser(created2.user.id);

    console.log("ALL CHECKS PASSED");
  } finally {
    await db.delete(mealPlans).where(eq(mealPlans.userId, user.id)); // cascades to items
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
