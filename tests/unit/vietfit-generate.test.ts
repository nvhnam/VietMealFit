import { describe, expect, it } from "vitest";
import {
  generateWeekSchedule,
  NoEligibleExercisesError,
  type ExerciseForGeneration,
} from "@/features/vietfit/generate";

function exercise(
  overrides: Partial<ExerciseForGeneration> & Pick<ExerciseForGeneration, "id" | "difficulty">,
): ExerciseForGeneration {
  return { name: overrides.id, muscleGroups: [], limitationTags: [], ...overrides };
}

describe("generateWeekSchedule", () => {
  it("schedules the expected number of training days per experience level", () => {
    const exercises: ExerciseForGeneration[] = [exercise({ id: "e1", difficulty: "beginner" })];
    const beginner = generateWeekSchedule(exercises, { experienceLevel: "beginner" });
    const intermediate = generateWeekSchedule(exercises, { experienceLevel: "intermediate" });
    const advanced = generateWeekSchedule(exercises, { experienceLevel: "advanced" });

    expect(new Set(beginner.map((s) => s.day)).size).toBe(3); // Mon/Wed/Fri
    expect(new Set(intermediate.map((s) => s.day)).size).toBe(4); // Mon/Tue/Thu/Fri
    expect(new Set(advanced.map((s) => s.day)).size).toBe(5); // Mon-Fri

    expect(beginner).toHaveLength(3 * 5);
    expect(intermediate).toHaveLength(4 * 5);
    expect(advanced).toHaveLength(5 * 5);
  });

  it("training days are spaced out, not clustered, for beginners", () => {
    const exercises: ExerciseForGeneration[] = [exercise({ id: "e1", difficulty: "beginner" })];
    const slots = generateWeekSchedule(exercises, { experienceLevel: "beginner" });
    const days = [...new Set(slots.map((s) => s.day))].sort((a, b) => a - b);
    expect(days).toEqual([0, 2, 4]); // Mon, Wed, Fri
  });

  it("never assigns an exercise tagged with one of the user's physical limitations (safety rule, no fallback)", () => {
    const exercises: ExerciseForGeneration[] = [
      exercise({ id: "safe", difficulty: "beginner" }),
      exercise({ id: "knee-risky", difficulty: "beginner", limitationTags: ["knee_pain"] }),
    ];
    const slots = generateWeekSchedule(exercises, { limitations: ["knee_pain"] });
    expect(new Set(slots.map((s) => s.exerciseId))).toEqual(new Set(["safe"]));
  });

  it("limitation matching is case-insensitive", () => {
    const exercises: ExerciseForGeneration[] = [
      exercise({ id: "safe", difficulty: "beginner" }),
      exercise({ id: "risky", difficulty: "beginner", limitationTags: ["Knee_Pain"] }),
    ];
    const slots = generateWeekSchedule(exercises, { limitations: ["KNEE_PAIN"] });
    expect(new Set(slots.map((s) => s.exerciseId))).toEqual(new Set(["safe"]));
  });

  it("throws NoEligibleExercisesError rather than silently serving an unsafe exercise", () => {
    const exercises: ExerciseForGeneration[] = [
      exercise({ id: "risky1", difficulty: "beginner", limitationTags: ["shoulder_injury"] }),
      exercise({ id: "risky2", difficulty: "beginner", limitationTags: ["shoulder_injury"] }),
    ];
    expect(() => generateWeekSchedule(exercises, { limitations: ["shoulder_injury"] })).toThrow(
      NoEligibleExercisesError,
    );
  });

  it("falls back to the limitation-safe pool when no exercise matches the requested difficulty", () => {
    const exercises: ExerciseForGeneration[] = [exercise({ id: "adv1", difficulty: "advanced" })];
    // Beginner asked for, but only an advanced exercise exists — must fall
    // back rather than throw, since difficulty is a soft preference.
    const slots = generateWeekSchedule(exercises, { experienceLevel: "beginner" });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.exerciseId === "adv1")).toBe(true);
  });

  it("does not include exercises above the requested difficulty when easier ones are available", () => {
    const exercises: ExerciseForGeneration[] = [
      exercise({ id: "beg1", difficulty: "beginner" }),
      exercise({ id: "adv1", difficulty: "advanced" }),
    ];
    const slots = generateWeekSchedule(exercises, { experienceLevel: "beginner" });
    expect(new Set(slots.map((s) => s.exerciseId))).toEqual(new Set(["beg1"]));
  });

  it("prioritizes exercises matching the preferred cardio query by name", () => {
    const exercises: ExerciseForGeneration[] = [
      exercise({ id: "jump-rope", difficulty: "beginner", name: "Jump Rope" }),
      exercise({ id: "squat", difficulty: "beginner", name: "Squat" }),
    ];
    const slots = generateWeekSchedule(exercises, { preferredCardioQuery: "jump rope" });
    const mondaySlots = slots.filter((s) => s.day === 0).sort((a, b) => a.order - b.order);
    expect(mondaySlots[0].exerciseId).toBe("jump-rope");
  });

  it("falls back to any cardio-tagged exercise when no name matches the preferred query", () => {
    const exercises: ExerciseForGeneration[] = [
      exercise({ id: "burpee", difficulty: "beginner", name: "Burpee", muscleGroups: ["cardio"] }),
      exercise({ id: "squat", difficulty: "beginner", name: "Squat", muscleGroups: ["legs"] }),
    ];
    const slots = generateWeekSchedule(exercises, { preferredCardioQuery: "nonexistent exercise name" });
    const mondaySlots = slots.filter((s) => s.day === 0).sort((a, b) => a.order - b.order);
    expect(mondaySlots[0].exerciseId).toBe("burpee");
  });

  it("throws for an entirely empty exercise pool", () => {
    expect(() => generateWeekSchedule([], {})).toThrow(NoEligibleExercisesError);
  });
});
