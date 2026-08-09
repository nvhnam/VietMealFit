import { z } from "zod";
import { eq } from "drizzle-orm";
import { phaseFoodRecommendations } from "@/server/db/schema";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/init";
import { calculateVietLean } from "@/features/vietlean/calculate";

const phaseSchema = z.enum(["bulking", "lean", "cutting"]);

export const vietleanRouter = createTRPCRouter({
  // No auth required — VietLean is a stateless calculator (plan §1.4: no
  // table, pure computation + a static reference table), gated by
  // Experience Mode at the route level, not by ownership.
  calculate: publicProcedure
    .input(z.object({ weightKg: z.number().min(20).max(400), phase: phaseSchema }))
    .query(async ({ ctx, input }) => {
      const result = calculateVietLean(input.weightKg, input.phase);
      const recommendations = await ctx.db
        .select({
          foodCategory: phaseFoodRecommendations.foodCategory,
          foodCategoryVi: phaseFoodRecommendations.foodCategoryVi,
          recommendation: phaseFoodRecommendations.recommendation,
          recommendationVi: phaseFoodRecommendations.recommendationVi,
        })
        .from(phaseFoodRecommendations)
        .where(eq(phaseFoodRecommendations.phase, input.phase));

      return { ...result, recommendations };
    }),
});
