import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { db } from "@/server/db";
import { createClient } from "@/lib/supabase/server";

/**
 * Per-request context. `db` is the Drizzle client connected via the
 * service-role DATABASE_URL — it bypasses Postgres RLS entirely. RLS
 * (server/db/policies.sql) still protects direct browser->Supabase access
 * (REST/Storage/Realtime), but every owner-scoped query in a tRPC procedure
 * MUST filter by ctx.user.id itself; RLS will NOT catch a missing filter
 * here. Cached with React's cache() so one auth check is shared across all
 * procedures batched into a single request.
 */
export const createTRPCContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { db, user };
});

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const publicProcedure = t.procedure;

/** Throws UNAUTHORIZED if there's no session; narrows ctx.user to non-null. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
