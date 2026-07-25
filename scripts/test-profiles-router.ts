// Throwaway verification script — exercises the real profilesRouter code
// (Zod validation, Drizzle upsert, protectedProcedure auth gate) via tRPC's
// server-side caller, bypassing HTTP/cookies. Not meant to be kept as a
// permanent test; deleted once real integration tests exist (plan Phase 7).
import { createClient } from "@supabase/supabase-js";
import { appRouter } from "../server/trpc/root";
import { db } from "../server/db";
import { profiles } from "../server/db/schema";
import { eq } from "drizzle-orm";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const email = `vmf.router.test.${Date.now()}@gmail.com`;
  console.log("Creating pre-confirmed test user:", email);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: "TestPassword123!",
    email_confirm: true,
    user_metadata: { display_name: "Router Test" },
  });
  if (createErr || !created.user) throw new Error(`createUser failed: ${createErr?.message}`);
  const user = created.user;
  console.log("Created user id:", user.id);

  try {
    // 1. Unauthorized caller must be rejected by protectedProcedure.
    const anonCaller = appRouter.createCaller({ db, user: null });
    let unauthorizedRejected = false;
    try {
      await anonCaller.profiles.get();
    } catch (err: unknown) {
      unauthorizedRejected = (err as { code?: string }).code === "UNAUTHORIZED";
    }
    console.log("Unauthorized caller rejected:", unauthorizedRejected);
    if (!unauthorizedRejected) throw new Error("FAIL: protectedProcedure did not reject anon caller");

    // 2. Authenticated caller: get() before any profile exists -> null.
    const caller = appRouter.createCaller({ db, user });
    const before = await caller.profiles.get();
    console.log("profiles.get() before upsert (expect null):", before);
    if (before !== null) throw new Error("FAIL: expected null profile before upsert");

    // 3. upsert() creates the row.
    const created1 = await caller.profiles.upsert({
      displayName: "Router Test User",
      gender: "other",
      age: 25,
      heightCm: 170,
      weightKg: 65,
      experienceLevel: "beginner",
      dietaryPreference: "anything",
      allergies: ["peanut"],
      fitnessGoals: ["weight_loss"],
      calorieGoal: 2000,
    });
    console.log("upsert() result:", created1);
    if (created1.id !== user.id) throw new Error("FAIL: returned profile id doesn't match user id");

    // 4. Verify directly against the DB, independent of the router's own return value.
    const [dbRow] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    console.log("Direct DB row:", dbRow);
    if (dbRow.displayName !== "Router Test User") throw new Error("FAIL: displayName mismatch in DB");
    if (dbRow.allergies?.[0] !== "peanut") throw new Error("FAIL: allergies array mismatch in DB");
    if (dbRow.calorieGoal !== 2000) throw new Error("FAIL: calorieGoal mismatch in DB");

    // 5. upsert() again updates in place rather than duplicating — AND a
    // partial call (omitting most fields) must not wipe the fields it
    // didn't mention. This caught a real bug: the first version of this
    // router did a full-replace on every upsert, silently nulling out
    // everything not in that call's input.
    await caller.profiles.upsert({ displayName: "Updated Name", calorieGoal: 2200 });
    const afterUpdate = await caller.profiles.get();
    console.log("profiles.get() after second (partial) upsert:", afterUpdate);
    if (afterUpdate?.displayName !== "Updated Name") throw new Error("FAIL: update did not apply");
    if (afterUpdate?.calorieGoal !== 2200) throw new Error("FAIL: calorieGoal update did not apply");
    if (afterUpdate?.gender !== "other") throw new Error("FAIL: partial update wiped gender");
    if (afterUpdate?.age !== 25) throw new Error("FAIL: partial update wiped age");
    if (afterUpdate?.allergies?.[0] !== "peanut") throw new Error("FAIL: partial update wiped allergies");
    if (afterUpdate?.dietaryPreference !== "anything")
      throw new Error("FAIL: partial update wiped dietaryPreference");

    const countCheck = await db.select().from(profiles).where(eq(profiles.id, user.id));
    if (countCheck.length !== 1) throw new Error(`FAIL: expected exactly 1 row, got ${countCheck.length}`);

    console.log("ALL CHECKS PASSED");
  } finally {
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await admin.auth.admin.deleteUser(user.id);
    console.log("Cleaned up test user and profile row.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
