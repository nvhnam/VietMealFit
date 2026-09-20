import { describe, expect, it } from "vitest";
import {
  formatPortionMultiplier,
  isScaledPortion,
  parsePortionMultiplier,
  scaleRecipeMacros,
} from "@/features/vietmeal/portion";

const RECIPE = { calories: 400, proteinG: "20.00", carbG: "50.00", fatG: "10.00" };

describe("parsePortionMultiplier", () => {
  it("reads the numeric(4,2) string the driver returns", () => {
    expect(parsePortionMultiplier("1.25")).toBe(1.25);
  });

  it("falls back to 1 for rows written before the column existed", () => {
    for (const value of [null, undefined, "", "not-a-number", 0, -1, Number.NaN]) {
      expect(parsePortionMultiplier(value as never)).toBe(1);
    }
  });
});

describe("scaleRecipeMacros", () => {
  it("returns the recipe unchanged at x1", () => {
    expect(scaleRecipeMacros(RECIPE, "1.00")).toEqual({
      calories: 400,
      proteinG: 20,
      carbG: 50,
      fatG: 10,
    });
  });

  it("scales energy and every macro by the same multiplier", () => {
    expect(scaleRecipeMacros(RECIPE, "1.25")).toEqual({
      calories: 500,
      proteinG: 25,
      carbG: 62.5,
      fatG: 12.5,
    });
  });

  it("scales down as well as up", () => {
    expect(scaleRecipeMacros(RECIPE, "0.75")).toEqual({
      calories: 300,
      proteinG: 15,
      carbG: 37.5,
      fatG: 7.5,
    });
  });

  it("treats a missing multiplier as an unscaled serving", () => {
    expect(scaleRecipeMacros(RECIPE, null)).toEqual(scaleRecipeMacros(RECIPE, "1.00"));
  });

  it("keeps macros to one decimal so cards stay readable", () => {
    const scaled = scaleRecipeMacros({ ...RECIPE, proteinG: "25.20" }, "1.15");
    expect(scaled.proteinG).toBe(29);
    expect(Number.isInteger(scaled.calories)).toBe(true);
  });
});

describe("isScaledPortion", () => {
  it("is false at exactly 1 and for legacy rows", () => {
    expect(isScaledPortion("1.00")).toBe(false);
    expect(isScaledPortion(null)).toBe(false);
  });

  it("is true once the serving actually differs", () => {
    expect(isScaledPortion("1.05")).toBe(true);
    expect(isScaledPortion("0.75")).toBe(true);
  });
});

describe("formatPortionMultiplier", () => {
  it("trims trailing zeros", () => {
    expect(formatPortionMultiplier("1.50")).toBe("×1.5");
    expect(formatPortionMultiplier("1.00")).toBe("×1");
  });

  it("keeps two significant decimals", () => {
    expect(formatPortionMultiplier("1.25")).toBe("×1.25");
  });
});
