import { z } from "zod";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { nutritionItems } from "@/server/db/schema";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/init";
import { FOOD_GROUPS } from "@/features/vietsearch/food-groups";

// No auth required — VietSearch is a read-only dictionary, gated by
// Experience Mode at the route level (plan §1.5 is Advanced-only), not by
// ownership. Matches D2: anonymous browsing everywhere.
export const vietsearchRouter = createTRPCRouter({
  search: publicProcedure
    .input(
      z.object({
        query: z.string().max(200).optional(),
        group: z.number().int().min(1).max(FOOD_GROUPS.length).optional(),
        language: z.enum(["en", "vi"]).default("vi"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.query?.trim()) {
        const like = `%${input.query.trim()}%`;
        conditions.push(or(ilike(nutritionItems.nameVi, like), ilike(nutritionItems.nameEn, like)));
      }
      if (input.group !== undefined) {
        // The group is the leading digits of the food code (1001 -> 1, 14016 -> 14),
        // as the 2007 table numbers its foods, so filtering never depends on the
        // label text stored in `category`.
        conditions.push(sql`${nutritionItems.foodCode}::int / 1000 = ${input.group}`);
      }

      return ctx.db
        .select({
          id: nutritionItems.id,
          foodCode: nutritionItems.foodCode,
          nameVi: nutritionItems.nameVi,
          nameEn: nutritionItems.nameEn,
        })
        .from(nutritionItems)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        // Alphabetise by the name the reader will actually see. This is not
        // cosmetic: the LIMIT means the ordering decides *which* 30 rows come
        // back, so ordering by nameVi in English mode returns a window that
        // looks arbitrary. coalesce keeps the foods whose English name the 2007
        // table never supplied (name_en IS NULL) sorted in place rather than
        // dumped at the end.
        .orderBy(
          input.language === "en"
            ? asc(sql`coalesce(${nutritionItems.nameEn}, ${nutritionItems.nameVi})`)
            : asc(nutritionItems.nameVi),
        )
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
        sourceCitationEn: item.sourceCitationEn,
      };
    }),
});
