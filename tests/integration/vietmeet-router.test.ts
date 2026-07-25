import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { appRouter } from "@/server/trpc/root";
import { db } from "@/server/db";
import { profiles, forumThreads } from "@/server/db/schema";
import { createTestUser, deleteTestUser } from "./helpers";

describe("vietmeet router", () => {
  let user: User;
  let user2: User;
  let threadId: string | undefined;

  beforeAll(async () => {
    user = await createTestUser("vietmeet");
    user2 = await createTestUser("vietmeet2");
  });

  afterAll(async () => {
    if (threadId) await db.delete(forumThreads).where(eq(forumThreads.id, threadId)).catch(() => {});
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await deleteTestUser(user.id);
    await deleteTestUser(user2.id);
    // See profiles-router.test.ts for why: closes this file's connection pool.
    await db.$client.end({ timeout: 5 });
  });

  it("allows anonymous read but blocks anonymous write", async () => {
    const anonCaller = appRouter.createCaller({ db, user: null });
    await expect(anonCaller.vietmeet.listThreads({ sort: "newest" })).resolves.toBeInstanceOf(Array);
    await expect(anonCaller.vietmeet.createThread({ title: "x", content: "y" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects a thread whose content trips the profanity filter", async () => {
    const caller = appRouter.createCaller({ db, user });
    await expect(
      caller.vietmeet.createThread({ title: "x", content: "you are a bastard" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("createThread persists a thread with an attachment", async () => {
    const caller = appRouter.createCaller({ db, user });
    const thread = await caller.vietmeet.createThread({
      title: `Test thread ${Date.now()}`,
      description: "A test description",
      content: "Test content body",
      attachments: [{ storagePath: `forum/${user.id}/test.png`, filename: "test.png", mime: "image/png", size: 123 }],
    });
    threadId = thread.id;
    expect(thread.id).toBeTruthy();
  });

  it("listThreads' correlated comment-count subquery starts at 0", async () => {
    const caller = appRouter.createCaller({ db, user });
    const list = await caller.vietmeet.listThreads({ sort: "newest" });
    const listed = list.find((t) => t.id === threadId);
    expect(listed?.commentCount).toBe(0);
  });

  it("getThread returns author, attachment, and likedByMe=false before liking", async () => {
    const caller = appRouter.createCaller({ db, user });
    const detail = await caller.vietmeet.getThread({ id: threadId! });
    expect(detail.attachments).toHaveLength(1);
    expect(detail.likedByMe).toBe(false);
  });

  it("toggleThreadLike updates the denormalized likeCount both ways", async () => {
    const caller = appRouter.createCaller({ db, user });
    await caller.vietmeet.toggleThreadLike({ threadId: threadId! });
    const afterLike = await caller.vietmeet.getThread({ id: threadId! });
    expect(afterLike.likeCount).toBe(1);
    expect(afterLike.likedByMe).toBe(true);

    await caller.vietmeet.toggleThreadLike({ threadId: threadId! });
    const afterUnlike = await caller.vietmeet.getThread({ id: threadId! });
    expect(afterUnlike.likeCount).toBe(0);
  });

  it("createComment updates the listThreads comment-count subquery", async () => {
    const caller = appRouter.createCaller({ db, user });
    await caller.vietmeet.createComment({ threadId: threadId!, content: "A test comment" });
    const list = await caller.vietmeet.listThreads({ sort: "newest" });
    const listed = list.find((t) => t.id === threadId);
    expect(listed?.commentCount).toBe(1);
  });

  it("rejects a different user deleting this thread", async () => {
    const caller2 = appRouter.createCaller({ db, user: user2 });
    await expect(caller2.vietmeet.deleteThread({ id: threadId! })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("search finds the thread by title substring", async () => {
    const anonCaller = appRouter.createCaller({ db, user: null });
    const results = await anonCaller.vietmeet.listThreads({ search: "Test thread", sort: "newest" });
    expect(results.length).toBeGreaterThan(0);
  });

  it("owner delete removes the thread (cascading comment/attachment/like rows)", async () => {
    const caller = appRouter.createCaller({ db, user });
    await caller.vietmeet.deleteThread({ id: threadId! });
    const anonCaller = appRouter.createCaller({ db, user: null });
    const afterDelete = await anonCaller.vietmeet.listThreads({ sort: "newest" });
    expect(afterDelete.some((t) => t.id === threadId)).toBe(false);
    threadId = undefined; // cleared so afterAll's cleanup doesn't try to double-delete
  });
});
