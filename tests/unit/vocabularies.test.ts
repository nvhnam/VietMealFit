import { describe, expect, it } from "vitest";
import {
  ALLERGEN_VALUES,
  DIET_VALUES,
  EXPERIENCE_VALUES,
  GOAL_VALUES,
  UNSPECIFIED,
  normalizeChoice,
  partitionKnown,
} from "@/features/shared/vocabularies";

describe("partitionKnown", () => {
  it("separates vocabulary values from leftovers of the old free-text field", () => {
    const result = partitionKnown(["peanut", "durian", "dairy"], ALLERGEN_VALUES);
    expect(result.known).toEqual(["peanut", "dairy"]);
    expect(result.legacy).toEqual(["durian"]);
  });

  it("folds the casing the old free-text field allowed onto the canonical value", () => {
    const result = partitionKnown(["Peanut", "SHELLFISH"], ALLERGEN_VALUES);
    expect(result.known).toEqual(["peanut", "shellfish"]);
    expect(result.legacy).toEqual([]);
  });

  it("never drops an unrecognised value — the form must be able to show it", () => {
    // Silently discarding these would mean a user loses a stored allergy just
    // by opening their profile and pressing Save.
    const result = partitionKnown(["durian", "msg"], ALLERGEN_VALUES);
    expect(result.legacy).toEqual(["durian", "msg"]);
  });

  it("ignores blank and whitespace-only entries", () => {
    const result = partitionKnown(["", "   ", "egg"], ALLERGEN_VALUES);
    expect(result.known).toEqual(["egg"]);
    expect(result.legacy).toEqual([]);
  });

  it("trims surrounding whitespace so a value round-trips cleanly", () => {
    expect(partitionKnown(["  soy  "], ALLERGEN_VALUES).known).toEqual(["soy"]);
    expect(partitionKnown(["  durian  "], ALLERGEN_VALUES).legacy).toEqual(["durian"]);
  });

  it("de-duplicates values that differ only by casing", () => {
    const result = partitionKnown(["egg", "Egg", "EGG"], ALLERGEN_VALUES);
    expect(result.known).toEqual(["egg"]);
  });

  it("works for fitness goals too", () => {
    const result = partitionKnown(["muscle_gain", "get abs"], GOAL_VALUES);
    expect(result.known).toEqual(["muscle_gain"]);
    expect(result.legacy).toEqual(["get abs"]);
  });
});

describe("normalizeChoice", () => {
  it("treats null, undefined and blank as unspecified", () => {
    for (const stored of [null, undefined, "", "  "]) {
      expect(normalizeChoice(stored, EXPERIENCE_VALUES)).toBe(UNSPECIFIED);
    }
  });

  it("folds casing onto the canonical value", () => {
    expect(normalizeChoice("Beginner", EXPERIENCE_VALUES)).toBe("beginner");
    expect(normalizeChoice("  ADVANCED ", EXPERIENCE_VALUES)).toBe("advanced");
    expect(normalizeChoice("Keto", DIET_VALUES)).toBe("keto");
  });

  it("returns an unrecognised value verbatim rather than discarding it", () => {
    expect(normalizeChoice("expert", EXPERIENCE_VALUES)).toBe("expert");
    expect(normalizeChoice("carnivore", DIET_VALUES)).toBe("carnivore");
  });
});

describe("vocabularies", () => {
  it("keeps every value lowercase, since matching folds case to compare", () => {
    for (const list of [ALLERGEN_VALUES, DIET_VALUES, EXPERIENCE_VALUES, GOAL_VALUES]) {
      for (const value of list) expect(value).toBe(value.toLowerCase());
    }
  });

  it("does not collide with the unspecified sentinel", () => {
    for (const list of [ALLERGEN_VALUES, DIET_VALUES, EXPERIENCE_VALUES, GOAL_VALUES]) {
      expect(list as readonly string[]).not.toContain(UNSPECIFIED);
    }
  });
});
