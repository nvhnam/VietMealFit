// Exercises the real profilesRouter (Zod validation, Drizzle upsert,
// protectedProcedure auth gate) via tRPC's server-side caller against a real
// pre-confirmed Supabase test user, verified independently against the live
// DB — not against the router's own return values.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { appRouter } from "@/server/trpc/root";
import { db } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { createTestUser, deleteTestUser, errorCode } from "./helpers";

describe("profiles router", () => {
  let user: User;

  beforeAll(async () => {
    user = await createTestUser("profiles");
  });

  afterAll(async () => {
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await deleteTestUser(user.id);
    // Each test file gets its own module registry (Vitest isolation), so
    // each one that imports `@/server/db` opens its own postgres.js
    // connection pool — closing it here keeps pools from accumulating
    // across a multi-file run and exceeding Supabase's real connection
    // ceiling (which surfaced as ECONNRESET on whichever file ran once the
    // limit was hit, not random network noise).
    await db.$client.end({ timeout: 5 });
  });

  it("rejects an unauthenticated caller", async () => {
    const anonCaller = appRouter.createCaller({ db, user: null });
    await expect(anonCaller.profiles.get()).rejects.toSatisfy((err) => errorCode(err) === "UNAUTHORIZED");
  });

  it("auto-creates a blank profile row on first protectedProcedure call (protectedProcedure middleware), not an actual null", async () => {
    // profiles.get() is itself a protectedProcedure — the ON CONFLICT DO
    // NOTHING middleware (server/trpc/init.ts) has already ensured a row
    // exists by the time this query runs, so it returns a blank row with a
    // fallback displayName, not null.
    const caller = appRouter.createCaller({ db, user });
    const profile = await caller.profiles.get();
    expect(profile).not.toBeNull();
    expect(profile?.id).toBe(user.id);
    expect(profile?.displayName).toBe(user.email?.split("@")[0]);
    expect(profile?.weightKg).toBeNull();
    expect(profile?.calorieGoal).toBeNull();
  });

  it("upsert() creates the row and matches the caller's own id", async () => {
    const caller = appRouter.createCaller({ db, user });
    const created = await caller.profiles.upsert({
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
    expect(created.id).toBe(user.id);

    const [dbRow] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    expect(dbRow.displayName).toBe("Router Test User");
    expect(dbRow.allergies).toEqual(["peanut"]);
    expect(dbRow.calorieGoal).toBe(2000);
  });

  it("a partial upsert() updates in place without wiping fields it didn't mention", async () => {
    // Regression coverage: the first version of this router did a
    // full-replace on every upsert, silently nulling out everything not
    // mentioned in that call's input.
    const caller = appRouter.createCaller({ db, user });
    await caller.profiles.upsert({ displayName: "Updated Name", calorieGoal: 2200 });

    const afterUpdate = await caller.profiles.get();
    expect(afterUpdate?.displayName).toBe("Updated Name");
    expect(afterUpdate?.calorieGoal).toBe(2200);
    expect(afterUpdate?.gender).toBe("other");
    expect(afterUpdate?.age).toBe(25);
    expect(afterUpdate?.allergies).toEqual(["peanut"]);
    expect(afterUpdate?.dietaryPreference).toBe("anything");

    const rows = await db.select().from(profiles).where(eq(profiles.id, user.id));
    expect(rows).toHaveLength(1);
  });
});
