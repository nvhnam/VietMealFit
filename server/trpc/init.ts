import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import superjson from "superjson";
import { db } from "@/server/db";
import { profiles } from "@/server/db/schema";
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

/**
 * Throws UNAUTHORIZED if there's no session; narrows ctx.user to non-null.
 *
 * Also guarantees a `profiles` row exists for the caller before the
 * procedure runs. A large fraction of owner-scoped tables (meal_plans,
 * exercise_plans, forum_threads, chat_sessions, ...) reference profiles.id,
 * not auth.users.id directly — a freshly signed-up user has an auth.users
 * row but no profiles row until something creates one. Individual routers
 * that collect real profile fields (vietmeal.generate, vietfit.generate)
 * still call upsertProfile() themselves with actual data; this is just a
 * cheap existence guard (INSERT ... ON CONFLICT DO NOTHING) so routers that
 * have no profile fields of their own to collect (vietmeet, vietask, ...)
 * don't need to remember this FK dependency exists at all.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  await ctx.db
    .insert(profiles)
    .values({ id: ctx.user.id, displayName: ctx.user.email?.split("@")[0] ?? "VietMealFit User" })
    .onConflictDoNothing({ target: profiles.id });

  return next({ ctx: { ...ctx, user: ctx.user } });
});
