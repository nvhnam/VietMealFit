import { createTRPCRouter } from "./init";
import { profilesRouter } from "@/server/routers/profiles";
import { vietleanRouter } from "@/server/routers/vietlean";

export const appRouter = createTRPCRouter({
  profiles: profilesRouter,
  vietlean: vietleanRouter,
  // Further module routers are added here as they're built.
});

export type AppRouter = typeof appRouter;
