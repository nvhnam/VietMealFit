import { describe, expect, it } from "vitest";
import { bmiBadgeVariant, bmiCategory } from "@/features/shared/bmi";
import { recommendation } from "@/features/vietfit/components/vietfit-bmi-recommendation";

describe("bmiCategory", () => {
  it("classifies standard WHO BMI thresholds", () => {
    expect(bmiCategory(17)).toBe("Underweight");
    expect(bmiCategory(18.4)).toBe("Underweight");
    expect(bmiCategory(18.5)).toBe("Normal");
    expect(bmiCategory(22)).toBe("Normal");
    expect(bmiCategory(24.9)).toBe("Normal");
    expect(bmiCategory(25)).toBe("Overweight");
    expect(bmiCategory(29.9)).toBe("Overweight");
    expect(bmiCategory(30)).toBe("Obese");
    expect(bmiCategory(40)).toBe("Obese");
  });
});

describe("bmiBadgeVariant", () => {
  it("maps categories to a non-destructive-for-normal, destructive-for-risk badge scheme", () => {
    expect(bmiBadgeVariant(17)).toBe("secondary");
    expect(bmiBadgeVariant(22)).toBe("default");
    expect(bmiBadgeVariant(28)).toBe("destructive");
    expect(bmiBadgeVariant(35)).toBe("destructive");
  });

  it("agrees with bmiCategory at every threshold boundary", () => {
    for (const bmi of [17, 18.5, 22, 25, 29.9, 30, 40]) {
      const category = bmiCategory(bmi);
      const variant = bmiBadgeVariant(bmi);
      if (category === "Normal") expect(variant).toBe("default");
      else if (category === "Underweight") expect(variant).toBe("secondary");
      else expect(variant).toBe("destructive");
    }
  });
});

describe("VietFit recommendation copy", () => {
  it("gives different advice per BMI category", () => {
    const under = recommendation("Underweight", "muscle_gain");
    const normal = recommendation("Normal", "muscle_gain");
    const over = recommendation("Overweight", "muscle_gain");
    const obese = recommendation("Obese", "muscle_gain");

    expect(under).not.toBe(normal);
    expect(over).toBe(obese); // both share the "manage weight" branch
    expect(under).not.toBe(over);
  });

  it("formats the goal with spaces instead of underscores", () => {
    expect(recommendation("Normal", "weight_loss")).toContain("weight loss");
    expect(recommendation("Normal", "weight_loss")).not.toContain("weight_loss");
  });
});
