// Throwaway verification script for the vietmeet router, same pattern as
// the other test-*-router.ts scripts in this directory.
import { createClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { appRouter } from "../server/trpc/root";
import { db } from "../server/db";
import { profiles, forumThreads } from "../server/db/schema";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const email = `vmf.vietmeet.test.${Date.now()}@gmail.com`;
  const { data: created } = await admin.auth.admin.createUser({ email, password: "TestPassword123!", email_confirm: true });
  const user = created.user!;
  console.log("Created user:", user.id);
  const caller = appRouter.createCaller({ db, user });
  const anonCaller = appRouter.createCaller({ db, user: null });

  let threadId: string | undefined;
  try {
    // Anonymous can read (public), not write.
    const emptyList = await anonCaller.vietmeet.listThreads({ sort: "newest" });
    console.log("Anonymous listThreads works, count:", emptyList.length);

    let anonBlocked = false;
    try {
      await anonCaller.vietmeet.createThread({ title: "x", content: "y" });
    } catch (e: unknown) {
      anonBlocked = (e as { code?: string }).code === "UNAUTHORIZED";
    }
    console.log("Anonymous createThread blocked:", anonBlocked);
    if (!anonBlocked) throw new Error("FAIL: anon should not be able to create a thread");

    // Create a thread with an attachment.
    const thread = await caller.vietmeet.createThread({
      title: "Test thread " + Date.now(),
      description: "A test description",
      content: "Test content body",
      attachments: [{ storagePath: `forum/${user.id}/test.png`, filename: "test.png", mime: "image/png", size: 123 }],
    });
    threadId = thread.id;
    console.log("Created thread:", thread.id);

    // listThreads: verify the correlated comment-count subquery works correctly.
    const list = await caller.vietmeet.listThreads({ sort: "newest" });
    const listed = list.find((t) => t.id === threadId);
    console.log("Thread in list, commentCount:", listed?.commentCount, "(expect 0)");
    if (listed?.commentCount !== 0) throw new Error(`FAIL: expected commentCount 0, got ${listed?.commentCount}`);

    // getThread detail with attachment and author join.
    const detail = await caller.vietmeet.getThread({ id: threadId });
    console.log("Thread detail author:", detail.author.displayName, "attachments:", detail.attachments.length);
    if (detail.attachments.length !== 1) throw new Error("FAIL: expected 1 attachment");
    if (detail.likedByMe !== false) throw new Error("FAIL: expected likedByMe=false before liking");

    // Like, verify denormalized count updates, then verify commentCount subquery again after adding a comment.
    const likeResult = await caller.vietmeet.toggleThreadLike({ threadId });
    console.log("Like result:", likeResult);
    const afterLike = await caller.vietmeet.getThread({ id: threadId });
    console.log("likeCount after like:", afterLike.likeCount, "likedByMe:", afterLike.likedByMe);
    if (afterLike.likeCount !== 1) throw new Error(`FAIL: expected likeCount 1, got ${afterLike.likeCount}`);
    if (!afterLike.likedByMe) throw new Error("FAIL: expected likedByMe true");

    const unlikeResult = await caller.vietmeet.toggleThreadLike({ threadId });
    console.log("Unlike result:", unlikeResult);
    const afterUnlike = await caller.vietmeet.getThread({ id: threadId });
    if (afterUnlike.likeCount !== 0) throw new Error(`FAIL: expected likeCount 0 after unlike, got ${afterUnlike.likeCount}`);

    // Comment.
    const comment = await caller.vietmeet.createComment({ threadId, content: "A test comment" });
    console.log("Created comment:", comment.id);
    const listAfterComment = await caller.vietmeet.listThreads({ sort: "newest" });
    const listedAfterComment = listAfterComment.find((t) => t.id === threadId);
    console.log("commentCount after 1 comment:", listedAfterComment?.commentCount, "(expect 1)");
    if (listedAfterComment?.commentCount !== 1) throw new Error(`FAIL: expected commentCount 1, got ${listedAfterComment?.commentCount}`);

    // Cross-user delete rejection.
    const { data: created2 } = await admin.auth.admin.createUser({
      email: `vmf.vietmeet.test2.${Date.now()}@gmail.com`,
      password: "TestPassword123!",
      email_confirm: true,
    });
    const caller2 = appRouter.createCaller({ db, user: created2.user! });
    let crossDeleteBlocked = false;
    try {
      await caller2.vietmeet.deleteThread({ id: threadId });
    } catch (e: unknown) {
      crossDeleteBlocked = (e as { code?: string }).code === "FORBIDDEN";
    }
    console.log("Cross-user delete blocked:", crossDeleteBlocked);
    if (!crossDeleteBlocked) throw new Error("FAIL: a different user deleted this thread!");
    await admin.auth.admin.deleteUser(created2.user!.id);

    // Search.
    const searchResults = await anonCaller.vietmeet.listThreads({ search: "Test thread", sort: "newest" });
    console.log("Search results for 'Test thread':", searchResults.length);
    if (searchResults.length === 0) throw new Error("FAIL: search should find the created thread");

    // Owner delete works (cascades comment + attachment + like row).
    await caller.vietmeet.deleteThread({ id: threadId });
    const afterDelete = await anonCaller.vietmeet.listThreads({ sort: "newest" });
    if (afterDelete.some((t) => t.id === threadId)) throw new Error("FAIL: thread still present after delete");
    console.log("Owner delete works, thread gone.");
    threadId = undefined;

    console.log("ALL CHECKS PASSED");
  } finally {
    if (threadId) await db.delete(forumThreads).where(eq(forumThreads.id, threadId)).catch(() => {});
    await db.delete(profiles).where(eq(profiles.id, user.id));
    await admin.auth.admin.deleteUser(user.id);
    console.log("Cleaned up.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
