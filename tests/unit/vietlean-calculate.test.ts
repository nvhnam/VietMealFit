import { describe, expect, it } from "vitest";
import { calculateVietLean, type LeanPhase } from "@/features/vietlean/calculate";

describe("calculateVietLean", () => {
  it("computes exact values for bulking at 70kg", () => {
    const result = calculateVietLean(70, "bulking");
    expect(result).toEqual({ calorieTarget: 2520, proteinG: 154, fatG: 70, carbG: 319 });
  });

  it("computes exact values for lean at 70kg", () => {
    const result = calculateVietLean(70, "lean");
    expect(result).toEqual({ calorieTarget: 2170, proteinG: 154, fatG: 63, carbG: 247 });
  });

  it("computes exact values for cutting at 70kg", () => {
    const result = calculateVietLean(70, "cutting");
    expect(result).toEqual({ calorieTarget: 1820, proteinG: 168, fatG: 56, carbG: 161 });
  });

  it("rejects non-positive weight", () => {
    expect(() => calculateVietLean(0, "lean")).toThrow();
    expect(() => calculateVietLean(-10, "lean")).toThrow();
  });

  it("rejects non-finite weight", () => {
    expect(() => calculateVietLean(NaN, "lean")).toThrow();
    expect(() => calculateVietLean(Infinity, "lean")).toThrow();
  });

  it("cutting has the highest protein-per-kg of the three phases (muscle preservation in a deficit)", () => {
    const bulking = calculateVietLean(80, "bulking");
    const lean = calculateVietLean(80, "lean");
    const cutting = calculateVietLean(80, "cutting");
    expect(cutting.proteinG).toBeGreaterThan(lean.proteinG);
    expect(cutting.proteinG).toBeGreaterThan(bulking.proteinG);
  });

  it("cutting has the lowest calorie target of the three phases", () => {
    const bulking = calculateVietLean(80, "bulking");
    const lean = calculateVietLean(80, "lean");
    const cutting = calculateVietLean(80, "cutting");
    expect(cutting.calorieTarget).toBeLessThan(lean.calorieTarget);
    expect(lean.calorieTarget).toBeLessThan(bulking.calorieTarget);
  });

  it("macros stay within a whole-gram rounding tolerance of the calorie target", () => {
    // Each macro is independently rounded to a whole gram, so the derived
    // total can drift from calorieTarget by a few kcal in either direction
    // (e.g. 90kg bulking: carbG rounds 409.5 -> 410, landing 2 kcal over) —
    // that's expected, whole-gram-macro rounding, not a bug. What must never
    // happen is a *large* drift, which would indicate the allocation logic
    // itself is wrong rather than just rounded.
    const phases: LeanPhase[] = ["bulking", "lean", "cutting"];
    for (const phase of phases) {
      for (const weightKg of [40, 55, 70, 90, 120, 200]) {
        const r = calculateVietLean(weightKg, phase);
        const derivedKcal = r.proteinG * 4 + r.fatG * 9 + r.carbG * 4;
        expect(Math.abs(derivedKcal - r.calorieTarget)).toBeLessThanOrEqual(5);
        expect(r.calorieTarget).toBeGreaterThan(0);
        expect(r.proteinG).toBeGreaterThan(0);
        expect(r.fatG).toBeGreaterThan(0);
        expect(r.carbG).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("scales roughly linearly with body weight", () => {
    const at70 = calculateVietLean(70, "lean");
    const at140 = calculateVietLean(140, "lean");
    // Rounding means it won't be exactly 2x, but should be very close.
    expect(at140.calorieTarget).toBeGreaterThan(at70.calorieTarget * 1.95);
    expect(at140.calorieTarget).toBeLessThan(at70.calorieTarget * 2.05);
  });
});
