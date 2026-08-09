import { describe, expect, it } from "vitest";
import {
  buildUserProfileContext,
  buildVietAskSystemPrompt,
  type VietAskProfileInput,
} from "@/server/ai/system-prompt";

function profile(overrides: Partial<VietAskProfileInput> = {}): VietAskProfileInput {
  return {
    age: null,
    gender: null,
    heightCm: null,
    weightKg: null,
    experienceLevel: null,
    dietaryPreference: null,
    allergies: null,
    fitnessGoals: null,
    calorieGoal: null,
    ...overrides,
  };
}

describe("buildUserProfileContext", () => {
  it("returns an empty string for an anonymous user (no profile)", () => {
    expect(buildUserProfileContext(null)).toBe("");
    expect(buildUserProfileContext(undefined)).toBe("");
  });

  it("returns an empty string for a profile with nothing filled in", () => {
    expect(buildUserProfileContext(profile())).toBe("");
  });

  it("includes only the fields that are actually set", () => {
    const context = buildUserProfileContext(profile({ allergies: ["peanut", "shellfish"] }));
    expect(context).toContain("allergies: peanut, shellfish");
    expect(context).not.toMatch(/age \d/);
    expect(context).not.toContain("experience level:");
  });

  it("computes BMI from height/weight and matches features/shared/bmi's categorization", () => {
    // 70kg at 175cm -> BMI 22.9, Normal (same thresholds as bmi.test.ts)
    const context = buildUserProfileContext(profile({ heightCm: "175", weightKg: "70" }));
    expect(context).toContain("175cm/70kg");
    expect(context).toContain("BMI 22.9");
    expect(context).toContain("Normal");
  });

  it("omits BMI when only one of height/weight is present", () => {
    const context = buildUserProfileContext(profile({ heightCm: "175" }));
    expect(context).not.toContain("BMI");
  });

  it("includes an explicit allergy-safety instruction whenever any fact is present", () => {
    const context = buildUserProfileContext(profile({ age: 30 }));
    expect(context).toContain("Never suggest a food or ingredient conflicting with their listed allergies");
  });

  it("instructs the model to trust the live conversation over a stale stored profile", () => {
    const context = buildUserProfileContext(profile({ age: 30 }));
    expect(context).toContain("trust the conversation over the stored profile");
  });

  it("assembles every field together when fully populated", () => {
    const context = buildUserProfileContext(
      profile({
        age: 28,
        gender: "male",
        heightCm: "175",
        weightKg: "70",
        experienceLevel: "intermediate",
        dietaryPreference: "vegan",
        allergies: ["peanut"],
        fitnessGoals: ["muscle_gain", "weight_loss"],
        calorieGoal: 2400,
      }),
    );
    expect(context).toContain("age 28");
    expect(context).toContain("male");
    expect(context).toContain("BMI 22.9");
    expect(context).toContain("experience level: intermediate");
    expect(context).toContain("dietary preference: vegan");
    expect(context).toContain("allergies: peanut");
    expect(context).toContain("fitness goals: muscle_gain, weight_loss");
    expect(context).toContain("calorie goal: 2400 kcal/day");
  });
});

describe("buildVietAskSystemPrompt", () => {
  it("is unchanged in shape when no user context is passed (anonymous users)", () => {
    const prompt = buildVietAskSystemPrompt("en");
    expect(prompt).toContain("You are VietAsk");
    expect(prompt).toContain("Always respond in English");
    expect(prompt).not.toContain("Signed-in user's profile");
  });

  it("splices the user context between the base prompt and the language directive", () => {
    const context = buildUserProfileContext(profile({ allergies: ["peanut"] }));
    const prompt = buildVietAskSystemPrompt("vi", context);
    const baseIndex = prompt.indexOf("You are VietAsk");
    const contextIndex = prompt.indexOf("Signed-in user's profile");
    const languageIndex = prompt.indexOf("Always respond in Vietnamese");
    expect(baseIndex).toBeGreaterThanOrEqual(0);
    expect(contextIndex).toBeGreaterThan(baseIndex);
    expect(languageIndex).toBeGreaterThan(contextIndex);
  });
});
