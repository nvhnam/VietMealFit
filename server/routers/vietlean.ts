import { z } from "zod";
import { eq } from "drizzle-orm";
import { phaseFoodRecommendations } from "@/server/db/schema";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/init";
import { calculateVietLean } from "@/features/vietlean/calculate";

const phaseSchema = z.enum(["bulking", "lean", "cutting"]);
const activitySchema = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
// Mifflin-St Jeor publishes coefficients for two groups only, so this is
// intentionally narrower than the profile's gender column.
const sexSchema = z.enum(["male", "female"]);

export const vietleanRouter = createTRPCRouter({
  // No auth required — VietLean is a stateless calculator (plan §1.4: no
  // table, pure computation + a static reference table), gated by
  // Experience Mode at the route level, not by ownership.
  calculate: publicProcedure
    .input(
      z.object({
        sex: sexSchema,
        age: z.number().int().min(1).max(120),
        heightCm: z.number().min(50).max(300),
        weightKg: z.number().min(20).max(400),
        activityLevel: activitySchema,
        phase: phaseSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const result = calculateVietLean(input);
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
