import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { appRouter } from "@/server/trpc/root";
import { db } from "@/server/db";
import { profiles, chatSessions, chatMessages } from "@/server/db/schema";
import { createTestUser, deleteTestUser } from "./helpers";

/** Seeds a session with one user + one assistant message, as a real chat would. */
async function seedSession(userId: string | null) {
  const [session] = await db.insert(chatSessions).values({ userId }).returning({ id: chatSessions.id });
  await db.insert(chatMessages).values([
    { sessionId: session.id, role: "user", content: "hello" },
    { sessionId: session.id, role: "assistant", content: "hi there" },
  ]);
  return session.id;
}

describe("vietask router", () => {
  let user: User;
  let other: User;
  const strays: string[] = [];

  beforeAll(async () => {
    user = await createTestUser("vietask");
    other = await createTestUser("vietask2");
    // protectedProcedure guarantees a profiles row, but these tests insert
    // chat_sessions directly and chat_sessions.user_id references profiles.id.
    await db
      .insert(profiles)
      .values([
        { id: user.id, displayName: "VietAsk Test" },
        { id: other.id, displayName: "VietAsk Other" },
      ])
      .onConflictDoNothing();
  });

  afterAll(async () => {
    if (strays.length) await db.delete(chatSessions).where(inArray(chatSessions.id, strays)).catch(() => {});
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await db.delete(profiles).where(eq(profiles.id, other.id));
    await deleteTestUser(user.id);
    await deleteTestUser(other.id);
    // See profiles-router.test.ts for why: closes this file's connection pool.
    await db.$client.end({ timeout: 5 });
  });

  it("deletes every session the user owns, not just the most recent", async () => {
    // The dock mints a new session id per mount, so a returning user owns
    // several sessions while only the latest is ever displayed. Deleting one
    // would surface the previous conversation instead of clearing it.
    await seedSession(user.id);
    await seedSession(user.id);
    const current = await seedSession(user.id);

    const caller = appRouter.createCaller({ db, user });
    const result = await caller.vietask.clearHistory({ sessionId: current });

    expect(result.deletedSessions).toBe(3);
    const left = await db.select().from(chatSessions).where(eq(chatSessions.userId, user.id));
    expect(left).toHaveLength(0);
  });

  it("cascades the delete to the messages", async () => {
    const sessionId = await seedSession(user.id);
    const before = await db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    expect(before).toHaveLength(2);

    await appRouter.createCaller({ db, user }).vietask.clearHistory({ sessionId });

    const after = await db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId));
    expect(after).toHaveLength(0);
  });

  it("leaves another user's history untouched", async () => {
    const mine = await seedSession(user.id);
    const theirs = await seedSession(other.id);
    strays.push(theirs);

    await appRouter.createCaller({ db, user }).vietask.clearHistory({ sessionId: mine });

    const survivors = await db.select().from(chatSessions).where(eq(chatSessions.id, theirs));
    expect(survivors).toHaveLength(1);
  });

  it("lets an anonymous caller delete only the session it names", async () => {
    const mine = await seedSession(null);
    const someoneElses = await seedSession(null);
    strays.push(someoneElses);

    const result = await appRouter
      .createCaller({ db, user: null })
      .vietask.clearHistory({ sessionId: mine });

    expect(result.deletedSessions).toBe(1);
    expect(await db.select().from(chatSessions).where(eq(chatSessions.id, mine))).toHaveLength(0);
    expect(await db.select().from(chatSessions).where(eq(chatSessions.id, someoneElses))).toHaveLength(1);
  });

  it("refuses to let an anonymous caller delete an owned session", async () => {
    // Session ids are unguessable UUIDs, but a leaked one still must not become
    // a way to wipe a signed-in user's history from an anonymous browser.
    const owned = await seedSession(user.id);
    strays.push(owned);

    const result = await appRouter
      .createCaller({ db, user: null })
      .vietask.clearHistory({ sessionId: owned });

    expect(result.deletedSessions).toBe(0);
    expect(await db.select().from(chatSessions).where(eq(chatSessions.id, owned))).toHaveLength(1);
  });

  it("is a no-op, not an error, when there is nothing to delete", async () => {
    const caller = appRouter.createCaller({ db, user });
    await caller.vietask.clearHistory({ sessionId: crypto.randomUUID() });
    const again = await caller.vietask.clearHistory({ sessionId: crypto.randomUUID() });
    expect(again.deletedSessions).toBe(0);
  });

  it("reports no session to resume after clearing", async () => {
    await seedSession(user.id);
    const caller = appRouter.createCaller({ db, user });
    expect(await caller.vietask.getLatestSession()).not.toBeNull();

    await caller.vietask.clearHistory({ sessionId: crypto.randomUUID() });
    expect(await caller.vietask.getLatestSession()).toBeNull();
  });
});
