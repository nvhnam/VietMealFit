import { describe, expect, it } from "vitest";
import { filterSafeRecipeCandidates, computeCalorieMacroTarget } from "@/server/ai/vietask-tools";
import { calculateVietLean } from "@/features/vietlean/calculate";

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

describe("computeCalorieMacroTarget", () => {
  it("matches calculateVietLean exactly for a known weight/phase (the whole point: chat can't disagree with VietLean's own page)", () => {
    const result = computeCalorieMacroTarget(70, "cutting");
    expect(result).toEqual({ found: true, weightKg: 70, phase: "cutting", ...calculateVietLean(70, "cutting") });
  });

  it("asks for weight rather than assuming one when weight is unknown (anonymous user, or no profile weight, or model didn't supply one)", () => {
    const result = computeCalorieMacroTarget(null, "bulking");
    expect(result.found).toBe(false);
    if (!result.found) expect(result.message).toMatch(/weight/i);
  });

  it("reports an invalid weight rather than throwing (defensive backstop for a bad profile-sourced value that bypassed the tool's own zod range check)", () => {
    expect(() => computeCalorieMacroTarget(0, "lean")).not.toThrow();
    expect(() => computeCalorieMacroTarget(-5, "lean")).not.toThrow();
    expect(() => computeCalorieMacroTarget(NaN, "lean")).not.toThrow();
    expect(computeCalorieMacroTarget(0, "lean").found).toBe(false);
    expect(computeCalorieMacroTarget(NaN, "lean").found).toBe(false);
  });

  it("produces different, internally consistent results per phase for the same weight (no cross-phase confusion)", () => {
    const bulking = computeCalorieMacroTarget(80, "bulking");
    const cutting = computeCalorieMacroTarget(80, "cutting");
    expect(bulking.found && cutting.found).toBe(true);
    if (bulking.found && cutting.found) {
      expect(bulking.calorieTarget).toBeGreaterThan(cutting.calorieTarget);
    }
  });
});
