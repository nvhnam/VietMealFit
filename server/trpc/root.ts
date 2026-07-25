import { createTRPCRouter } from "./init";
import { profilesRouter } from "@/server/routers/profiles";
import { vietleanRouter } from "@/server/routers/vietlean";
import { vietmealRouter } from "@/server/routers/vietmeal";
import { vietfitRouter } from "@/server/routers/vietfit";
import { vietsearchRouter } from "@/server/routers/vietsearch";
import { vietaskRouter } from "@/server/routers/vietask";
import { vietmeetRouter } from "@/server/routers/vietmeet";
import { vietsmartRouter } from "@/server/routers/vietsmart";

export const appRouter = createTRPCRouter({
  profiles: profilesRouter,
  vietlean: vietleanRouter,
  vietmeal: vietmealRouter,
  vietfit: vietfitRouter,
  vietsearch: vietsearchRouter,
  vietask: vietaskRouter,
  vietmeet: vietmeetRouter,
  vietsmart: vietsmartRouter,
});

export type AppRouter = typeof appRouter;
