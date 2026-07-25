import { createTRPCRouter } from "./init";
import { profilesRouter } from "@/server/routers/profiles";
import { vietleanRouter } from "@/server/routers/vietlean";
import { vietmealRouter } from "@/server/routers/vietmeal";

export const appRouter = createTRPCRouter({
  profiles: profilesRouter,
  vietlean: vietleanRouter,
  vietmeal: vietmealRouter,
  // Further module routers are added here as they're built.
});

export type AppRouter = typeof appRouter;
