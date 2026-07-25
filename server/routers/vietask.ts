import { asc, desc, eq } from "drizzle-orm";
import { chatSessions, chatMessages } from "@/server/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/init";

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
});
