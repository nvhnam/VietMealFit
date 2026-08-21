import type { Gender } from "@/features/shared/gender";

/**
 * VietLean calorie/macro calculator.
 *
 * Calorie targets come from Mifflin-St Jeor BMR × an activity factor, then a
 * per-phase adjustment. This replaced an earlier bodyweight-ratio approach
 * (a flat kcal/kg, chosen to keep the input surface to weight + phase alone).
 * That method is common in coaching, but it is sex-blind by construction:
 * Mifflin-St Jeor's sex term differs by 166 kcal/day at identical age, height
 * and weight, so a single kcal/kg figure is systematically low for men and
 * high for women. For a 60kg/165cm/30y pair at moderate activity it lands
 * ~11% under a man's maintenance and ~1% over a woman's — a sex-dependent
 * bias in the headline number the module exists to produce.
 *
 * Mifflin MD, St Jeor ST, et al. "A new predictive equation for resting energy
 * expenditure in healthy individuals." Am J Clin Nutr. 1990;51(2):241-7.
 *
 * Macros keep the earlier bodyweight-ratio treatment, which is correct
 * practice and not a shortcut — protein and fat needs scale with body mass,
 * not with total energy intake:
 *  - Cutting uses the highest protein ratio (g/kg) to help preserve muscle
 *    in a calorie deficit — well-established practice, not unique to this app.
 *  - Fat is held roughly constant across phases (~0.8-1.0 g/kg) since it's
 *    primarily about hormonal health, not the lever being adjusted.
 *  - Carbs absorb whatever calories remain after protein/fat are set.
 */
export type LeanPhase = "bulking" | "lean" | "cutting";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

/** Standard Harris-Benedict/Mifflin activity multipliers. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_VALUES = Object.keys(ACTIVITY_FACTORS) as ActivityLevel[];

/**
 * Phase adjustment applied to maintenance. Conventional ranges (a ~10-20%
 * surplus for a lean bulk, a ~15-25% deficit for a cut) taken at the
 * conservative end — this is general guidance, not a supervised protocol.
 */
const PHASE_PARAMS: Record<
  LeanPhase,
  { tdeeMultiplier: number; proteinGPerKg: number; fatGPerKg: number }
> = {
  bulking: { tdeeMultiplier: 1.1, proteinGPerKg: 2.2, fatGPerKg: 1.0 },
  lean: { tdeeMultiplier: 1.0, proteinGPerKg: 2.2, fatGPerKg: 0.9 },
  cutting: { tdeeMultiplier: 0.8, proteinGPerKg: 2.4, fatGPerKg: 0.8 },
};

export type VietLeanInput = {
  /**
   * Mifflin-St Jeor is defined on biological sex and publishes coefficients
   * for two groups only, so this is deliberately narrower than the profile's
   * gender field — which is free to carry values this equation cannot use.
   */
  sex: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  phase: LeanPhase;
};

export type VietLeanResult = {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  /** True when the BMR floor below raised the target above the phase figure. */
  flooredAtBmr: boolean;
};

/** Mifflin-St Jeor resting energy expenditure, kcal/day. */
export function mifflinStJeorBmr(input: {
  sex: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return input.sex === "male" ? base + 5 : base - 161;
}

function requirePositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}

export function calculateVietLean(input: VietLeanInput): VietLeanResult {
  requirePositive(input.weightKg, "weightKg");
  requirePositive(input.heightCm, "heightCm");
  requirePositive(input.age, "age");

  const { tdeeMultiplier, proteinGPerKg, fatGPerKg } = PHASE_PARAMS[input.phase];

  const bmr = mifflinStJeorBmr(input);
  const tdee = bmr * ACTIVITY_FACTORS[input.activityLevel];
  const phaseTarget = tdee * tdeeMultiplier;

  // Never advise eating below resting metabolic rate. Without this, a cut for
  // a small, older, sedentary person lands under 900 kcal/day — arithmetically
  // consistent, but not something a general-audience tool should put on screen.
  const flooredAtBmr = phaseTarget < bmr;
  const calorieTarget = Math.round(flooredAtBmr ? bmr : phaseTarget);

  const proteinG = Math.round(input.weightKg * proteinGPerKg);
  const fatG = Math.round(input.weightKg * fatGPerKg);

  const remainingKcal = Math.max(0, calorieTarget - proteinG * 4 - fatG * 9);
  const carbG = Math.round(remainingKcal / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorieTarget,
    proteinG,
    fatG,
    carbG,
    flooredAtBmr,
  };
}
