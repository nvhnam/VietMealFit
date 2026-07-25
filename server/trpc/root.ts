import { createTRPCRouter } from "./init";
import { profilesRouter } from "@/server/routers/profiles";

export const appRouter = createTRPCRouter({
  profiles: profilesRouter,
  // Further module routers are added here as they're built (vietlean, ...).
});

export type AppRouter = typeof appRouter;
