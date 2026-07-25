/**
 * VietLean calorie/macro calculator (plan §1.4). Deliberately minimal input
 * surface — weight + phase only, matching the paper's own module scope — so
 * this uses a bodyweight-ratio approach (common in strength/physique
 * coaching) rather than a full TDEE formula, which would need age/height/
 * gender/activity level the module was never scoped to collect.
 *
 * Multipliers, not lab-derived, chosen as reasonable/defensible starting
 * points:
 *  - Cutting uses the highest protein ratio (g/kg) to help preserve muscle
 *    in a calorie deficit — well-established practice, not unique to this app.
 *  - Fat is held roughly constant across phases (~0.8-1.0 g/kg) since it's
 *    primarily about hormonal health, not the lever being adjusted.
 *  - Carbs absorb whatever calories remain after protein/fat are set.
 */
export type LeanPhase = "bulking" | "lean" | "cutting";

const PHASE_PARAMS: Record<LeanPhase, { kcalPerKg: number; proteinGPerKg: number; fatGPerKg: number }> = {
  bulking: { kcalPerKg: 36, proteinGPerKg: 2.2, fatGPerKg: 1.0 },
  lean: { kcalPerKg: 31, proteinGPerKg: 2.2, fatGPerKg: 0.9 },
  cutting: { kcalPerKg: 26, proteinGPerKg: 2.4, fatGPerKg: 0.8 },
};

export type VietLeanResult = {
  calorieTarget: number;
  proteinG: number;
  fatG: number;
  carbG: number;
};

export function calculateVietLean(weightKg: number, phase: LeanPhase): VietLeanResult {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error("weightKg must be a positive number");
  }

  const { kcalPerKg, proteinGPerKg, fatGPerKg } = PHASE_PARAMS[phase];

  const calorieTarget = Math.round(weightKg * kcalPerKg);
  const proteinG = Math.round(weightKg * proteinGPerKg);
  const fatG = Math.round(weightKg * fatGPerKg);

  const proteinKcal = proteinG * 4;
  const fatKcal = fatG * 9;
  const remainingKcal = Math.max(0, calorieTarget - proteinKcal - fatKcal);
  const carbG = Math.round(remainingKcal / 4);

  return { calorieTarget, proteinG, fatG, carbG };
}
