import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import FOOD_GROUP_DATA from "@/data/seed/food_groups_2007.json";
import { FOOD_GROUPS, foodGroupLabel, foodGroupOfCode } from "@/features/vietsearch/food-groups";

// Food_Code is the second field of every data row and is always a bare integer.
const seedCodes = readFileSync(path.resolve(__dirname, "../../data/seed/vietnam_food_composition_2007.csv"), "utf8")
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((line) => line.split(",")[1]);

describe("FOOD_GROUPS", () => {
  it("lists the book's 14 groups once each, in the book's order", () => {
    expect(FOOD_GROUPS.map((g) => g.group)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it("puts every seeded food in a listed group, with the per-group counts the book states", () => {
    // p. vii of the 2007 table: 526 foods in 14 groups. A code outside 1–14, or a
    // count that drifts, means the seed no longer matches the groups shown in the UI.
    expect(seedCodes).toHaveLength(526);
    const counts: Record<string, number> = {};
    for (const code of seedCodes) {
      const group = foodGroupOfCode(code);
      counts[group] = (counts[group] ?? 0) + 1;
    }
    expect(counts).toEqual(Object.fromEntries(FOOD_GROUP_DATA.groups.map((g) => [g.group, g.foods])));
  });

  it("labels a group in the reader's language", () => {
    const [cereals] = FOOD_GROUPS;
    expect(foodGroupLabel(cereals, "en")).toBe("Cereal and products");
    expect(foodGroupLabel(cereals, "vi")).toBe("Ngũ cốc và sản phẩm chế biến");
  });
});

describe("foodGroupOfCode", () => {
  it("reads the group from the leading digits of a food code", () => {
    expect(foodGroupOfCode("1001")).toBe(1);
    expect(foodGroupOfCode("9011")).toBe(9);
    expect(foodGroupOfCode("10001")).toBe(10);
    expect(foodGroupOfCode("14016")).toBe(14);
  });
});
