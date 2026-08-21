import { describe, expect, it } from "vitest";
import {
  ACTIVITY_FACTORS,
  calculateVietLean,
  mifflinStJeorBmr,
  type ActivityLevel,
  type LeanPhase,
  type VietLeanInput,
} from "@/features/vietlean/calculate";

function input(overrides: Partial<VietLeanInput> = {}): VietLeanInput {
  return {
    sex: "male",
    age: 30,
    heightCm: 175,
    weightKg: 70,
    activityLevel: "moderate",
    phase: "lean",
    ...overrides,
  };
}

describe("mifflinStJeorBmr", () => {
  it("matches the published equation for men (10W + 6.25H - 5A + 5)", () => {
    // 10(70) + 6.25(175) - 5(30) + 5 = 700 + 1093.75 - 150 + 5
    expect(mifflinStJeorBmr({ sex: "male", age: 30, heightCm: 175, weightKg: 70 })).toBeCloseTo(
      1648.75,
      2,
    );
  });

  it("matches the published equation for women (10W + 6.25H - 5A - 161)", () => {
    expect(mifflinStJeorBmr({ sex: "female", age: 30, heightCm: 175, weightKg: 70 })).toBeCloseTo(
      1482.75,
      2,
    );
  });

  it("differs by exactly 166 kcal between sexes at identical age/height/weight", () => {
    // This constant is the whole reason the module now collects sex — the
    // previous bodyweight-ratio target could not express it at all.
    const male = mifflinStJeorBmr({ sex: "male", age: 42, heightCm: 160, weightKg: 58 });
    const female = mifflinStJeorBmr({ sex: "female", age: 42, heightCm: 160, weightKg: 58 });
    expect(male - female).toBeCloseTo(166, 6);
  });
});

describe("calculateVietLean", () => {
  it("derives the calorie target from BMR x activity x phase", () => {
    const result = calculateVietLean(input({ activityLevel: "moderate", phase: "lean" }));
    expect(result.bmr).toBe(1649);
    expect(result.tdee).toBe(Math.round(1648.75 * ACTIVITY_FACTORS.moderate));
    expect(result.calorieTarget).toBe(result.tdee);
  });

  it("gives a woman a lower target than a man with otherwise identical inputs", () => {
    const male = calculateVietLean(input({ sex: "male" }));
    const female = calculateVietLean(input({ sex: "female" }));
    expect(female.calorieTarget).toBeLessThan(male.calorieTarget);
    // 166 kcal of BMR, scaled by the activity factor.
    // +/-1 kcal: the two targets are rounded independently, so the gap between
    // them can land a unit either side of the exact scaled difference.
    const expectedGap = 166 * ACTIVITY_FACTORS.moderate;
    expect(Math.abs(male.calorieTarget - female.calorieTarget - expectedGap)).toBeLessThanOrEqual(1);
  });

  it("orders the phases cutting < lean < bulking", () => {
    const bulking = calculateVietLean(input({ phase: "bulking" }));
    const lean = calculateVietLean(input({ phase: "lean" }));
    const cutting = calculateVietLean(input({ phase: "cutting" }));
    expect(cutting.calorieTarget).toBeLessThan(lean.calorieTarget);
    expect(lean.calorieTarget).toBeLessThan(bulking.calorieTarget);
  });

  it("keeps cutting at the highest protein-per-kg (muscle preservation in a deficit)", () => {
    const bulking = calculateVietLean(input({ weightKg: 80, phase: "bulking" }));
    const lean = calculateVietLean(input({ weightKg: 80, phase: "lean" }));
    const cutting = calculateVietLean(input({ weightKg: 80, phase: "cutting" }));
    expect(cutting.proteinG).toBeGreaterThan(lean.proteinG);
    expect(cutting.proteinG).toBeGreaterThan(bulking.proteinG);
  });

  it("raises the target to BMR rather than advising a sub-resting intake", () => {
    // Small, older, sedentary, cutting — the combination that drove the raw
    // phase figure under resting metabolic rate.
    const result = calculateVietLean(
      input({ sex: "female", age: 65, heightCm: 150, weightKg: 45, activityLevel: "sedentary", phase: "cutting" }),
    );
    expect(result.flooredAtBmr).toBe(true);
    expect(result.calorieTarget).toBe(result.bmr);
  });

  it("does not floor an ordinary cut", () => {
    const result = calculateVietLean(input({ phase: "cutting", activityLevel: "moderate" }));
    expect(result.flooredAtBmr).toBe(false);
    expect(result.calorieTarget).toBeGreaterThan(result.bmr);
  });

  it("increases the target monotonically with activity level", () => {
    const levels: ActivityLevel[] = ["sedentary", "light", "moderate", "active", "very_active"];
    const targets = levels.map((activityLevel) => calculateVietLean(input({ activityLevel })).calorieTarget);
    for (let i = 1; i < targets.length; i += 1) {
      expect(targets[i]).toBeGreaterThan(targets[i - 1]);
    }
  });

  it("rejects non-positive or non-finite measurements", () => {
    expect(() => calculateVietLean(input({ weightKg: 0 }))).toThrow();
    expect(() => calculateVietLean(input({ weightKg: -10 }))).toThrow();
    expect(() => calculateVietLean(input({ heightCm: 0 }))).toThrow();
    expect(() => calculateVietLean(input({ age: 0 }))).toThrow();
    expect(() => calculateVietLean(input({ weightKg: NaN }))).toThrow();
    expect(() => calculateVietLean(input({ heightCm: Infinity }))).toThrow();
  });

  it("macros stay within a whole-gram rounding tolerance of the calorie target", () => {
    // Each macro is independently rounded to a whole gram, so the derived
    // total can drift from calorieTarget by a few kcal in either direction —
    // that's expected, whole-gram-macro rounding, not a bug. What must never
    // happen is a *large* drift, which would indicate the allocation logic
    // itself is wrong rather than just rounded.
    const phases: LeanPhase[] = ["bulking", "lean", "cutting"];
    for (const phase of phases) {
      for (const weightKg of [40, 55, 70, 90, 120, 200]) {
        const r = calculateVietLean(input({ phase, weightKg }));
        const derivedKcal = r.proteinG * 4 + r.fatG * 9 + r.carbG * 4;
        expect(Math.abs(derivedKcal - r.calorieTarget)).toBeLessThanOrEqual(5);
        expect(r.calorieTarget).toBeGreaterThan(0);
        expect(r.proteinG).toBeGreaterThan(0);
        expect(r.fatG).toBeGreaterThan(0);
        expect(r.carbG).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
