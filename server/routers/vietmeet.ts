import { z } from "zod";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  forumThreads,
  forumComments,
  threadLikes,
  forumAttachments,
  profiles,
} from "@/server/db/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc/init";
import { assertNotProfane } from "@/server/lib/content-moderation";
import { TRPCError } from "@trpc/server";
import type { db as Db } from "@/server/db";

const attachmentInput = z.object({
  storagePath: z.string().min(1),
  filename: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().min(0),
});

/** ctx.db bypasses RLS — "own or admin" must be checked here, same as every other owner-scoped mutation in this app. */
async function isAdmin(db: typeof Db, userId: string): Promise<boolean> {
  const [profile] = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return profile?.role === "admin";
}

export const vietmeetRouter = createTRPCRouter({
  listThreads: publicProcedure
    .input(
      z.object({
        search: z.string().max(200).optional(),
        sort: z.enum(["newest", "oldest"]).default("newest"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search?.trim()) {
        const like = `%${input.search.trim()}%`;
        conditions.push(or(ilike(forumThreads.title, like), ilike(forumThreads.content, like)));
      }

      const commentCountSubquery = ctx.db.$count(forumComments, eq(forumComments.threadId, forumThreads.id));

      return ctx.db
        .select({
          id: forumThreads.id,
          title: forumThreads.title,
          description: forumThreads.description,
          likeCount: forumThreads.likeCount,
          createdAt: forumThreads.createdAt,
          authorId: forumThreads.authorId,
          authorDisplayName: profiles.displayName,
          commentCount: commentCountSubquery,
        })
        .from(forumThreads)
        .innerJoin(profiles, eq(forumThreads.authorId, profiles.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(input.sort === "newest" ? desc(forumThreads.createdAt) : asc(forumThreads.createdAt))
        .limit(50);
    }),

  getThread: publicProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => {
    const thread = await ctx.db.query.forumThreads.findFirst({
      where: eq(forumThreads.id, input.id),
      with: {
        author: { columns: { id: true, displayName: true } },
        attachments: true,
        comments: {
          orderBy: (c, { asc: ascOp }) => ascOp(c.createdAt),
          with: {
            author: { columns: { id: true, displayName: true } },
            attachments: true,
          },
        },
      },
    });

    if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

    let likedByMe = false;
    if (ctx.user) {
      const [like] = await ctx.db
        .select()
        .from(threadLikes)
        .where(and(eq(threadLikes.threadId, input.id), eq(threadLikes.userId, ctx.user.id)))
        .limit(1);
      likedByMe = !!like;
    }

    return { ...thread, likedByMe };
  }),

  createThread: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(500).optional(),
        content: z.string().min(1).max(20000),
        attachments: z.array(attachmentInput).max(5).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertNotProfane(input.title, "Title");
      if (input.description) assertNotProfane(input.description, "Description");
      assertNotProfane(input.content, "Content");

      const [thread] = await ctx.db
        .insert(forumThreads)
        .values({
          authorId: ctx.user.id,
          title: input.title,
          description: input.description ?? null,
          content: input.content,
        })
        .returning();

      if (input.attachments.length > 0) {
        await ctx.db.insert(forumAttachments).values(
          input.attachments.map((a) => ({ threadId: thread.id, ...a })),
        );
      }

      return thread;
    }),

  deleteThread: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const [thread] = await ctx.db.select().from(forumThreads).where(eq(forumThreads.id, input.id)).limit(1);
    if (!thread) throw new TRPCError({ code: "NOT_FOUND" });

    const admin = await isAdmin(ctx.db, ctx.user.id);
    if (thread.authorId !== ctx.user.id && !admin) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    await ctx.db.delete(forumThreads).where(eq(forumThreads.id, input.id));
    return { success: true };
  }),

  createComment: protectedProcedure
    .input(
      z.object({
        threadId: z.string().uuid(),
        content: z.string().min(1).max(5000),
        attachments: z.array(attachmentInput).max(5).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertNotProfane(input.content, "Comment");

      const [thread] = await ctx.db.select({ id: forumThreads.id }).from(forumThreads).where(eq(forumThreads.id, input.threadId)).limit(1);
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Thread not found." });

      const [comment] = await ctx.db
        .insert(forumComments)
        .values({ threadId: input.threadId, authorId: ctx.user.id, content: input.content })
        .returning();

      if (input.attachments.length > 0) {
        await ctx.db.insert(forumAttachments).values(
          input.attachments.map((a) => ({ commentId: comment.id, ...a })),
        );
      }

      return comment;
    }),

  deleteComment: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const [comment] = await ctx.db.select().from(forumComments).where(eq(forumComments.id, input.id)).limit(1);
    if (!comment) throw new TRPCError({ code: "NOT_FOUND" });

    const admin = await isAdmin(ctx.db, ctx.user.id);
    if (comment.authorId !== ctx.user.id && !admin) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    await ctx.db.delete(forumComments).where(eq(forumComments.id, input.id));
    return { success: true };
  }),

  toggleThreadLike: protectedProcedure
    .input(z.object({ threadId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(threadLikes)
          .where(and(eq(threadLikes.threadId, input.threadId), eq(threadLikes.userId, ctx.user.id)))
          .limit(1);

        if (existing) {
          await tx
            .delete(threadLikes)
            .where(and(eq(threadLikes.threadId, input.threadId), eq(threadLikes.userId, ctx.user.id)));
          await tx
            .update(forumThreads)
            .set({ likeCount: sql`${forumThreads.likeCount} - 1` })
            .where(eq(forumThreads.id, input.threadId));
          return { liked: false };
        }

        await tx.insert(threadLikes).values({ threadId: input.threadId, userId: ctx.user.id });
        await tx
          .update(forumThreads)
          .set({ likeCount: sql`${forumThreads.likeCount} + 1` })
          .where(eq(forumThreads.id, input.threadId));
        return { liked: true };
      });
    }),
});
