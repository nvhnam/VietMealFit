import { z } from "zod";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { nutritionItems } from "@/server/db/schema";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/init";

// No auth required — VietSearch is a read-only dictionary, gated by
// Experience Mode at the route level (plan §1.5 is Advanced-only), not by
// ownership. Matches D2: anonymous browsing everywhere.
export const vietsearchRouter = createTRPCRouter({
  getCategories: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinct({ category: nutritionItems.category })
      .from(nutritionItems)
      .orderBy(asc(nutritionItems.category));
    return rows.map((r) => r.category).filter((c): c is string => c !== null);
  }),

  search: publicProcedure
    .input(z.object({ query: z.string().max(200).optional(), category: z.string().max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.query?.trim()) {
        const like = `%${input.query.trim()}%`;
        conditions.push(or(ilike(nutritionItems.nameVi, like), ilike(nutritionItems.nameEn, like)));
      }
      if (input.category) {
        conditions.push(eq(nutritionItems.category, input.category));
      }

      return ctx.db
        .select({
          id: nutritionItems.id,
          foodCode: nutritionItems.foodCode,
          nameVi: nutritionItems.nameVi,
          nameEn: nutritionItems.nameEn,
          category: nutritionItems.category,
        })
        .from(nutritionItems)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(nutritionItems.nameVi))
        .limit(30);
    }),

  getNutrients: publicProcedure
    .input(z.object({ id: z.string().uuid(), grams: z.number().int().min(100).max(100000) }))
    .query(async ({ ctx, input }) => {
      const [item] = await ctx.db
        .select()
        .from(nutritionItems)
        .where(eq(nutritionItems.id, input.id))
        .limit(1);

      if (!item) return null;

      // Source data is per-100g (standard for food composition tables) —
      // scale by the requested gram amount. NULL stays NULL (not measured
      // in the source table, per plan §4.1 — never coerced to 0), which is
      // exactly why these are `number | null`, not defaulted here.
      const scale = (value: string | null): number | null =>
        value === null ? null : Math.round((Number(value) * input.grams / 100) * 100) / 100;

      return {
        nameVi: item.nameVi,
        nameEn: item.nameEn,
        grams: input.grams,
        energyKcal: scale(item.energyKcal),
        proteinG: scale(item.proteinG),
        carbohydrateG: scale(item.carbohydrateG),
        fatG: scale(item.fatG),
        sourceCitation: item.sourceCitation,
      };
    }),
});
