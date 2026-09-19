import { describe, expect, it } from "vitest";
import { dailyTargets, dateFromKey, groupByLocalDay, localDateKey, sumMacros } from "@/features/profile/progress";
import { calculateVietLean, macroTargets } from "@/features/vietlean/calculate";

describe("localDateKey", () => {
  it("uses the local calendar day, not the UTC one", () => {
    // 23:30 local on 3 March is still 3 March for the viewer, whatever UTC says.
    expect(localDateKey(new Date(2026, 2, 3, 23, 30))).toBe("2026-03-03");
    expect(localDateKey(new Date(2026, 2, 4, 0, 5))).toBe("2026-03-04");
  });

  it("round-trips through dateFromKey", () => {
    expect(localDateKey(dateFromKey("2026-12-31"))).toBe("2026-12-31");
  });
});

describe("groupByLocalDay", () => {
  it("groups by local day, keeps input order, and puts undated rows in their own group", () => {
    const items = [
      { id: "a", completedAt: new Date(2026, 8, 19, 20, 0) },
      { id: "b", completedAt: new Date(2026, 8, 19, 7, 0) },
      { id: "c", completedAt: new Date(2026, 8, 17, 12, 0) },
      { id: "d", completedAt: null },
    ];
    const groups = groupByLocalDay(items);
    expect(groups.map((g) => g.key)).toEqual(["2026-09-19", "2026-09-17", null]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["d"]);
  });

  it("returns no groups for no items", () => {
    expect(groupByLocalDay([])).toEqual([]);
  });
});

describe("macroTargets", () => {
  it("is the same split calculateVietLean reports", () => {
    const result = calculateVietLean({
      sex: "female",
      age: 28,
      heightCm: 160,
      weightKg: 55,
      activityLevel: "light",
      phase: "cutting",
    });
    expect(macroTargets(55, result.calorieTarget, "cutting")).toEqual({
      proteinG: result.proteinG,
      fatG: result.fatG,
      carbG: result.carbG,
    });
  });
});

describe("dailyTargets", () => {
  it("uses the calorie goal and maintenance ratios for the weight", () => {
    // lean: 2.2 g/kg protein, 0.9 g/kg fat → 154 g, 63 g at 70 kg.
    // carbs: (2200 - 154*4 - 63*9) / 4 = (2200 - 616 - 567) / 4 = 254.25 → 254
    expect(dailyTargets({ calorieGoal: 2200, weightKg: "70.0" })).toEqual({
      calories: 2200,
      proteinG: 154,
      fatG: 63,
      carbG: 254,
    });
  });

  it("gives protein and fat but no carb target without a calorie goal", () => {
    expect(dailyTargets({ calorieGoal: null, weightKg: 70 })).toEqual({
      calories: null,
      proteinG: 154,
      fatG: 63,
      carbG: null,
    });
  });

  it("gives only the calorie target without a weight", () => {
    expect(dailyTargets({ calorieGoal: 1800, weightKg: null })).toEqual({
      calories: 1800,
      proteinG: null,
      fatG: null,
      carbG: null,
    });
  });

  it("treats a zero calorie goal as unset", () => {
    expect(dailyTargets({ calorieGoal: 0, weightKg: null }).calories).toBeNull();
  });
});

describe("sumMacros", () => {
  it("adds numeric-string macros from the DB and rounds the totals", () => {
    expect(
      sumMacros([
        { calories: 450, proteinG: "20.40", carbG: "55.25", fatG: "12.10" },
        { calories: 620, proteinG: "31.30", carbG: "70.50", fatG: "18.45" },
      ]),
    ).toEqual({ calories: 1070, proteinG: 52, carbG: 126, fatG: 31 });
  });
});
