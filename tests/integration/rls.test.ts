// Every other integration test uses `ctx.db`, which is the service-role
// Postgres connection — it bypasses RLS entirely, by design (that's how the
// trusted server code path works). These tests are the only ones that
// actually exercise RLS itself: real anon-key Supabase clients, signed in as
// real users, making direct PostgREST queries exactly as a browser would if
// it ever talked to Supabase directly (Storage uploads do, today).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { db } from "@/server/db";
import { profiles, mealPlans, forumThreads, libraryResources } from "@/server/db/schema";
import { createTestUser, deleteTestUser } from "./helpers";

const TEST_PASSWORD = "TestPassword123!";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

describe("Row-Level Security", () => {
  let userA: User;
  let userB: User;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;
  let anonClient: SupabaseClient;
  let planId: string;
  let threadId: string;
  let resourceId: string;

  beforeAll(async () => {
    userA = await createTestUser("rls-a");
    userB = await createTestUser("rls-b");

    // Profile rows are an FK dependency for meal_plans/forum_threads/etc —
    // create them directly via the service-role `db` (setup, not the thing
    // under test).
    await db.insert(profiles).values([
      { id: userA.id, displayName: "RLS User A" },
      { id: userB.id, displayName: "RLS User B" },
    ]);

    clientA = await signedInClient(userA.email!);
    clientB = await signedInClient(userB.email!);
    anonClient = createClient(url, anonKey);

    const [plan] = await db
      .insert(mealPlans)
      .values({ userId: userA.id, weekStart: "2026-01-05", params: {} })
      .returning();
    planId = plan.id;

    const [thread] = await db
      .insert(forumThreads)
      .values({ authorId: userA.id, title: "RLS test thread", content: "content" })
      .returning();
    threadId = thread.id;

    const [resource] = await db
      .insert(libraryResources)
      .values({
        uploaderId: userA.id,
        title: "RLS test resource",
        storagePath: `library/${userA.id}/rls-test.pdf`,
        filename: "rls-test.pdf",
        mime: "application/pdf",
        size: 100,
      })
      .returning();
    resourceId = resource.id;
  });

  afterAll(async () => {
    await db.delete(mealPlans).where(eq(mealPlans.userId, userA.id));
    await db.delete(forumThreads).where(eq(forumThreads.id, threadId)).catch(() => {});
    await db.delete(libraryResources).where(eq(libraryResources.id, resourceId)).catch(() => {});
    await db.delete(profiles).where(eq(profiles.id, userA.id));
    await db.delete(profiles).where(eq(profiles.id, userB.id));
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
    await db.$client.end({ timeout: 5 });
  });

  describe("profiles — private, owner-only, with a narrow public view", () => {
    it("lets a user read their own profile row directly", async () => {
      const { data, error } = await clientA.from("profiles").select("id").eq("id", userA.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("hides another user's profile row entirely (not an error — just filtered out)", async () => {
      const { data, error } = await clientB.from("profiles").select("id").eq("id", userA.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("blocks anonymous access to the base profiles table", async () => {
      const { data, error } = await anonClient.from("profiles").select("id").eq("id", userA.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("exposes id/display_name (not health data) to anyone via profiles_public", async () => {
      const { data, error } = await anonClient
        .from("profiles_public")
        .select("id, display_name")
        .eq("id", userA.id);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].display_name).toBe("RLS User A");
    });
  });

  describe("meal_plans — owner-only, no public read", () => {
    it("lets the owner read their own plan", async () => {
      const { data, error } = await clientA.from("meal_plans").select("id").eq("id", planId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("hides the plan from a different authenticated user", async () => {
      const { data, error } = await clientB.from("meal_plans").select("id").eq("id", planId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("hides the plan from an anonymous client (unlike community content, plans are never public)", async () => {
      const { data, error } = await anonClient.from("meal_plans").select("id").eq("id", planId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it("rejects a user trying to insert a plan under someone else's user_id (impersonation)", async () => {
      const { error } = await clientB
        .from("meal_plans")
        .insert({ user_id: userA.id, week_start: "2026-01-05", params: {} });
      expect(error).not.toBeNull();
    });
  });

  describe("forum_threads — public read, own write, impersonation blocked", () => {
    it("is readable by an anonymous client (D2: anonymous browsing)", async () => {
      const { data, error } = await anonClient.from("forum_threads").select("id").eq("id", threadId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("rejects a user inserting a thread under someone else's author_id", async () => {
      const { error } = await clientB
        .from("forum_threads")
        .insert({ author_id: userA.id, title: "hijack", content: "x" });
      expect(error).not.toBeNull();
    });

    it("rejects a non-author updating someone else's thread", async () => {
      const { error, data } = await clientB
        .from("forum_threads")
        .update({ title: "hijacked" })
        .eq("id", threadId)
        .select();
      // RLS silently filters the row out of the update rather than erroring
      // — the correct signal here is that zero rows were affected.
      expect(error === null ? data?.length : 1).not.toBe(1);
      const [row] = await db.select().from(forumThreads).where(eq(forumThreads.id, threadId));
      expect(row.title).toBe("RLS test thread");
    });
  });

  describe("library_resources — public read, own write", () => {
    it("is readable by an anonymous client", async () => {
      const { data, error } = await anonClient.from("library_resources").select("id").eq("id", resourceId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("rejects a user inserting a resource under someone else's uploader_id", async () => {
      const { error } = await clientB.from("library_resources").insert({
        uploader_id: userA.id,
        title: "hijack",
        storage_path: `library/${userA.id}/hijack.pdf`,
        filename: "hijack.pdf",
        mime: "application/pdf",
        size: 1,
      });
      expect(error).not.toBeNull();
    });
  });
});
