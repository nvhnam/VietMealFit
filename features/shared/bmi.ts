export type BmiCategory = "Underweight" | "Normal" | "Overweight" | "Obese";

export function computeBmi(heightCm: number, weightKg: number): number {
  return weightKg / (heightCm / 100) ** 2;
}

// Standard WHO BMI categories — shared by VietMeal and VietFit, which each
// showed this independently rather than duplicating the thresholds.
export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function bmiBadgeVariant(bmi: number): "secondary" | "default" | "destructive" {
  if (bmi < 18.5) return "secondary";
  if (bmi < 25) return "default";
  return "destructive";
}
