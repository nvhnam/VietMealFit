/**
 * VietFit weekly exercise-schedule generation (plan §1.3). Rule-based, not
 * ML — same "template-based generation is in scope, auto-generation via ML
 * is not" boundary as VietMeal.
 *
 * Safety rule, same shape as VietMeal's allergy handling: a physical
 * limitation exclusion is never relaxed, even as a fallback. Experience-
 * level (difficulty) filtering is a soft preference that falls back to the
 * limitation-safe pool if honoring it would leave nothing to pick from.
 *
 * Training days aren't every day — a flat "exercise every day of the week"
 * plan would be bad general fitness guidance, not just an engineering
 * shortcut. Days-per-week and their spacing are simple, defensible
 * defaults, not derived from any specific training methodology.
 *
 * BMI (from the user's declared height/weight) is a further soft nudge,
 * same tier as preferredCardioQuery: it reorders the already-safe,
 * already-difficulty-filtered pool toward or away from cardio-tagged
 * exercises, it never excludes anything. Mirrors the advice already shown
 * on the BMI card (underweight -> favor strength work over cardio;
 * overweight/obese -> favor more cardio for a calorie deficit); "Normal"
 * applies no nudge.
 */
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type BmiCategory = "Underweight" | "Normal" | "Overweight" | "Obese";

export type ExerciseForGeneration = {
  id: string;
  name: string;
  nameVi?: string | null;
  nameEn?: string | null;
  difficulty: Difficulty;
  muscleGroups: string[];
  limitationTags: string[];
};

export type ExerciseSlot = { day: number; order: number; exerciseId: string };

// Message is a stable machine code, not English prose — the client renders
// localized text from the i18n dictionary instead (see NoEligibleRecipesError
// in features/vietmeal/generate.ts for the same pattern).
export class NoEligibleExercisesError extends Error {
  constructor() {
    super("NO_ELIGIBLE_EXERCISES");
    this.name = "NoEligibleExercisesError";
  }
}

const DIFFICULTY_RANK: Record<Difficulty, number> = { beginner: 1, intermediate: 2, advanced: 3 };

// Days-per-week by experience, and which weekday indices (0=Mon) they land
// on — spaced out rather than clustered, e.g. 3 days = Mon/Wed/Fri, not
// Mon/Tue/Wed.
const TRAINING_SCHEDULE: Record<Difficulty, number[]> = {
  beginner: [0, 2, 4], // Mon, Wed, Fri
  intermediate: [0, 1, 3, 4], // Mon, Tue, Thu, Fri
  advanced: [0, 1, 2, 3, 4], // Mon-Fri
};

const EXERCISES_PER_DAY = 5;

function isLimitationSafe(exercise: ExerciseForGeneration, limitations: string[]): boolean {
  if (limitations.length === 0) return true;
  const lower = new Set(limitations.map((l) => l.toLowerCase()));
  return !exercise.limitationTags.some((tag) => lower.has(tag.toLowerCase()));
}

function isCardioTagged(exercise: ExerciseForGeneration): boolean {
  return exercise.muscleGroups.some((m) => m.toLowerCase().includes("cardio"));
}

// Moves cardio-tagged (or non-cardio) exercises to the front, preserving
// relative order within each half — same "boost, don't exclude" shape as
// the preferredCardioQuery reorder below.
function boostByCardioLean(pool: ExerciseForGeneration[], lean: "toward" | "away"): ExerciseForGeneration[] {
  const cardio = pool.filter(isCardioTagged);
  const nonCardio = pool.filter((e) => !isCardioTagged(e));
  if (cardio.length === 0 || nonCardio.length === 0) return pool;
  return lean === "toward" ? [...cardio, ...nonCardio] : [...nonCardio, ...cardio];
}

export function generateWeekSchedule(
  exercises: ExerciseForGeneration[],
  opts: {
    experienceLevel?: Difficulty;
    limitations?: string[];
    preferredCardioQuery?: string;
    bmiCategory?: BmiCategory | null;
  },
): ExerciseSlot[] {
  const limitations = opts.limitations ?? [];
  const experienceLevel = opts.experienceLevel ?? "beginner";

  const safePool = exercises.filter((e) => isLimitationSafe(e, limitations));
  if (safePool.length === 0) throw new NoEligibleExercisesError();

  // Difficulty is a soft filter: fall back to the limitation-safe pool
  // (not the difficulty-matching one) if it would leave nothing to pick.
  const maxRank = DIFFICULTY_RANK[experienceLevel];
  const byDifficulty = safePool.filter((e) => DIFFICULTY_RANK[e.difficulty] <= maxRank);
  let pool = byDifficulty.length > 0 ? byDifficulty : safePool;

  // Applied before preferredCardioQuery, so an explicit cardio request
  // still wins top billing over the implicit BMI-derived lean.
  if (opts.bmiCategory === "Overweight" || opts.bmiCategory === "Obese") {
    pool = boostByCardioLean(pool, "toward");
  } else if (opts.bmiCategory === "Underweight") {
    pool = boostByCardioLean(pool, "away");
  }

  if (opts.preferredCardioQuery?.trim()) {
    const query = opts.preferredCardioQuery.trim().toLowerCase();
    // Name match first (the user's actual preference); checks name/nameVi/
    // nameEn so a Vietnamese-typed query (e.g. "nhảy dây") matches regardless
    // of UI language, not just the English name. If nothing matches by name,
    // fall back to "any cardio exercise" rather than ignoring the request outright.
    const nameMatches = pool.filter(
      (e) =>
        e.name.toLowerCase().includes(query) ||
        (e.nameVi?.toLowerCase().includes(query) ?? false) ||
        (e.nameEn?.toLowerCase().includes(query) ?? false),
    );
    const anyCardio = pool.filter((e) => e.muscleGroups.some((m) => m.toLowerCase().includes("cardio")));
    const preferred = nameMatches.length > 0 ? nameMatches : anyCardio;
    if (preferred.length > 0) {
      const rest = pool.filter((e) => !preferred.includes(e));
      pool = [...preferred, ...rest];
    }
  }

  const trainingDays = TRAINING_SCHEDULE[experienceLevel];
  const slots: ExerciseSlot[] = [];
  let cursor = 0;
  for (const day of trainingDays) {
    for (let order = 0; order < EXERCISES_PER_DAY; order++) {
      slots.push({ day, order, exerciseId: pool[cursor % pool.length].id });
      cursor++;
    }
  }

  return slots;
}
