import { describe, expect, it } from "vitest";
import { filterSafeRecipeCandidates, computeCalorieMacroTarget } from "@/server/ai/vietask-tools";
import { calculateVietLean } from "@/features/vietlean/calculate";
import type { CalorieMacroTargetDefaults } from "@/server/ai/vietask-tools";

type Candidate = { id: string; dietTags: string[]; allergenTags: string[] };

function candidate(overrides: Partial<Candidate> & Pick<Candidate, "id">): Candidate {
  return { dietTags: [], allergenTags: [], ...overrides };
}

describe("filterSafeRecipeCandidates", () => {
  it("hard-excludes an allergen match even when it's the only candidate for the requested diet (safety rule, no fallback)", () => {
    const candidates = [
      candidate({ id: "peanut-vegan", dietTags: ["vegan"], allergenTags: ["peanut"] }),
      candidate({ id: "meat-safe", dietTags: ["anything"], allergenTags: [] }),
    ];
    const result = filterSafeRecipeCandidates(candidates, ["peanut"], "vegan");
    expect(result.map((r) => r.id)).toEqual(["meat-safe"]);
  });

  it("falls back to the allergen-safe pool when the diet-filtered pool is empty", () => {
    const candidates = [
      candidate({ id: "meat1", dietTags: ["anything"], allergenTags: [] }),
      candidate({ id: "meat2", dietTags: ["anything"], allergenTags: [] }),
    ];
    // No candidate is tagged "vegan" — must fall back rather than return [].
    const result = filterSafeRecipeCandidates(candidates, [], "vegan");
    expect(result.map((r) => r.id).sort()).toEqual(["meat1", "meat2"]);
  });

  it("returns an empty array (not a throw) when nothing is allergen-safe", () => {
    const candidates = [
      candidate({ id: "peanut1", allergenTags: ["peanut"] }),
      candidate({ id: "peanut2", allergenTags: ["peanut"] }),
    ];
    const result = filterSafeRecipeCandidates(candidates, ["peanut"], null);
    expect(result).toEqual([]);
  });

  it("allergen matching is case-insensitive", () => {
    const candidates = [candidate({ id: "risky", allergenTags: ["Peanut"] })];
    const result = filterSafeRecipeCandidates(candidates, ["PEANUT"], null);
    expect(result).toEqual([]);
  });

  it("treats a null/omitted dietary preference as no filter", () => {
    const candidates = [
      candidate({ id: "a", dietTags: ["vegan"] }),
      candidate({ id: "b", dietTags: ["anything"] }),
    ];
    const result = filterSafeRecipeCandidates(candidates, [], null);
    expect(result.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });
});

const FULL_PROFILE: CalorieMacroTargetDefaults = {
  gender: "male",
  age: 30,
  heightCm: 175,
  weightKg: 70,
};

const EMPTY_PROFILE: CalorieMacroTargetDefaults = {
  gender: null,
  age: null,
  heightCm: null,
  weightKg: null,
};

describe("computeCalorieMacroTarget", () => {
  it("matches calculateVietLean exactly (the whole point: chat can't disagree with VietLean's own page)", () => {
    const result = computeCalorieMacroTarget(FULL_PROFILE, {
      activityLevel: "moderate",
      phase: "cutting",
    });
    expect(result).toEqual({
      found: true,
      sex: "male",
      age: 30,
      heightCm: 175,
      weightKg: 70,
      activityLevel: "moderate",
      phase: "cutting",
      ...calculateVietLean({
        sex: "male",
        age: 30,
        heightCm: 175,
        weightKg: 70,
        activityLevel: "moderate",
        phase: "cutting",
      }),
    });
  });

  it("prefers a value stated in conversation over the saved profile", () => {
    const result = computeCalorieMacroTarget(FULL_PROFILE, {
      weightKg: 95,
      activityLevel: "moderate",
      phase: "lean",
    });
    expect(result.found).toBe(true);
    if (result.found) expect(result.weightKg).toBe(95);
  });

  it("asks for every missing field rather than assuming any of them", () => {
    const result = computeCalorieMacroTarget(EMPTY_PROFILE, { phase: "bulking" });
    expect(result.found).toBe(false);
    if (!result.found) {
      for (const term of [/sex/i, /age/i, /height/i, /weight/i, /activity/i]) {
        expect(result.message).toMatch(term);
      }
    }
  });

  it("always asks for activity level — there is no profile column to fall back on", () => {
    const result = computeCalorieMacroTarget(FULL_PROFILE, { phase: "lean" });
    expect(result.found).toBe(false);
    if (!result.found) expect(result.message).toMatch(/activity/i);
  });

  it("treats a legacy free-text gender the equation can't use as unknown", () => {
    // Mifflin-St Jeor defines coefficients for two groups only, so guessing
    // one for a value outside them would invent the premise of the answer.
    const result = computeCalorieMacroTarget(
      { ...FULL_PROFILE, gender: "non-binary" },
      { activityLevel: "moderate", phase: "lean" },
    );
    expect(result.found).toBe(false);
    if (!result.found) expect(result.message).toMatch(/sex/i);
  });

  it("normalises a legacy spelling the old free-text field allowed", () => {
    const result = computeCalorieMacroTarget(
      { ...FULL_PROFILE, gender: "Nam" },
      { activityLevel: "moderate", phase: "lean" },
    );
    expect(result.found).toBe(true);
    if (result.found) expect(result.sex).toBe("male");
  });

  it("reports unusable measurements rather than throwing (defensive backstop for bad profile-sourced values)", () => {
    const bad = { ...FULL_PROFILE, weightKg: 0 };
    expect(() =>
      computeCalorieMacroTarget(bad, { activityLevel: "moderate", phase: "lean" }),
    ).not.toThrow();
    // 0 is falsy but not null — it reaches calculateVietLean and is rejected there.
    expect(
      computeCalorieMacroTarget({ ...FULL_PROFILE, weightKg: NaN }, {
        activityLevel: "moderate",
        phase: "lean",
      }).found,
    ).toBe(false);
  });

  it("produces different, internally consistent results per phase (no cross-phase confusion)", () => {
    const bulking = computeCalorieMacroTarget(FULL_PROFILE, {
      activityLevel: "moderate",
      phase: "bulking",
    });
    const cutting = computeCalorieMacroTarget(FULL_PROFILE, {
      activityLevel: "moderate",
      phase: "cutting",
    });
    expect(bulking.found && cutting.found).toBe(true);
    if (bulking.found && cutting.found) {
      expect(bulking.calorieTarget).toBeGreaterThan(cutting.calorieTarget);
    }
  });
});
