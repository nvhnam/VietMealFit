// Read-only: runs the real search query against the nutrition_items table, so
// the food_code-based group filter is checked by Postgres, not just by tsc.
import { afterAll, describe, expect, it } from "vitest";
import { appRouter } from "@/server/trpc/root";
import { db } from "@/server/db";
import { FOOD_GROUPS, foodGroupOfCode } from "@/features/vietsearch/food-groups";

describe("vietsearch router", () => {
  const anonCaller = appRouter.createCaller({ db, user: null });

  afterAll(async () => {
    // See profiles-router.test.ts for why: closes this file's connection pool.
    await db.$client.end({ timeout: 5 });
  });

  it("returns only foods from the requested group, for each of the 14 groups", async () => {
    for (const { group } of FOOD_GROUPS) {
      const rows = await anonCaller.vietsearch.search({ group, language: "vi" });
      expect(rows.length, `group ${group}`).toBeGreaterThan(0);
      expect(rows.map((r) => foodGroupOfCode(r.foodCode))).toEqual(rows.map(() => group));
    }
  });

  it("narrows a name search to the chosen group", async () => {
    // "sữa" matches milk products (group 10) but also e.g. "Kẹo sữa" (group 12).
    const everywhere = await anonCaller.vietsearch.search({ query: "sữa", language: "vi" });
    const milkGroup = await anonCaller.vietsearch.search({ query: "sữa", group: 10, language: "vi" });
    expect(everywhere.some((r) => foodGroupOfCode(r.foodCode) !== 10)).toBe(true);
    expect(milkGroup.length).toBeGreaterThan(0);
    expect(milkGroup.every((r) => foodGroupOfCode(r.foodCode) === 10)).toBe(true);
  });

  it("rejects a group the table does not have", async () => {
    await expect(anonCaller.vietsearch.search({ group: 15 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
