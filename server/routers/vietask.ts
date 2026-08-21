import { z } from "zod";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { chatSessions, chatMessages } from "@/server/db/schema";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc/init";

// Anonymous chat has no stable identity to look up later (see
// server/db/policies.sql's chat_sessions comment) — resuming a specific
// session across page loads is only meaningful for authenticated users.
export const vietaskRouter = createTRPCRouter({
  getLatestSession: protectedProcedure.query(async ({ ctx }) => {
    const [session] = await ctx.db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.userId, ctx.user.id))
      .orderBy(desc(chatSessions.createdAt))
      .limit(1);

    if (!session) return null;

    const messages = await ctx.db
      .select({ id: chatMessages.id, role: chatMessages.role, content: chatMessages.content })
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, session.id))
      .orderBy(asc(chatMessages.createdAt));

    return { sessionId: session.id, messages };
  }),

  /**
   * Wipes the caller's VietAsk history. chat_messages cascades on the session
   * delete, so removing the sessions is enough.
   *
   * Public rather than protected because anonymous users can chat too (D2) and
   * a "delete my conversation" button that silently left their messages on the
   * server would be a lie.
   */
  clearHistory: publicProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user) {
        // Every session the user owns, not only the newest. use-vietask-chat
        // mints a fresh session id on each mount, so a signed-in user
        // accumulates one chat_sessions row per visit while the dock only ever
        // displays the latest. Deleting just that one would pop the previous
        // conversation into view instead of clearing anything.
        const deleted = await ctx.db
          .delete(chatSessions)
          .where(eq(chatSessions.userId, ctx.user.id))
          .returning({ id: chatSessions.id });
        return { deletedSessions: deleted.length };
      }

      // An anonymous caller can only reach the session their own browser is
      // holding, and only while it is still unowned — so a guessed UUID can
      // never delete a signed-in user's history.
      const deleted = await ctx.db
        .delete(chatSessions)
        .where(and(eq(chatSessions.id, input.sessionId), isNull(chatSessions.userId)))
        .returning({ id: chatSessions.id });
      return { deletedSessions: deleted.length };
    }),
});
