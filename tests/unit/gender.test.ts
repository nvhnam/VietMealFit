import { describe, expect, it } from "vitest";
import {
  GENDER_UNSPECIFIED,
  genderToWire,
  isGender,
  normalizeGender,
} from "@/features/shared/gender";

describe("normalizeGender", () => {
  it("treats an absent or blank answer as unspecified", () => {
    expect(normalizeGender(null)).toBe(GENDER_UNSPECIFIED);
    expect(normalizeGender(undefined)).toBe(GENDER_UNSPECIFIED);
    expect(normalizeGender("")).toBe(GENDER_UNSPECIFIED);
    expect(normalizeGender("   ")).toBe(GENDER_UNSPECIFIED);
  });

  it("maps the spellings the old free-text field allowed onto the closed vocabulary", () => {
    for (const stored of ["male", "Male", "MALE", " male ", "m", "Nam", "nam"]) {
      expect(normalizeGender(stored)).toBe("male");
    }
    for (const stored of ["female", "Female", "f", "Nữ", "nữ", "nu"]) {
      expect(normalizeGender(stored)).toBe("female");
    }
  });

  it("preserves an unrecognised stored value instead of discarding it", () => {
    // Rewriting someone's existing answer to "unspecified" just because it is
    // not in our list would be silent data loss — the form lists it as an
    // extra option instead.
    expect(normalizeGender("other")).toBe("other");
    expect(normalizeGender("non-binary")).toBe("non-binary");
  });

  it("trims a preserved value so it round-trips without whitespace drift", () => {
    expect(normalizeGender("  other  ")).toBe("other");
  });
});

describe("genderToWire", () => {
  it("sends unspecified as null, matching what the nullable column already meant", () => {
    expect(genderToWire(GENDER_UNSPECIFIED)).toBeNull();
  });

  it("sends a real selection through unchanged", () => {
    expect(genderToWire("male")).toBe("male");
    expect(genderToWire("female")).toBe("female");
    expect(genderToWire("other")).toBe("other");
  });
});

describe("isGender", () => {
  it("accepts only the closed vocabulary", () => {
    expect(isGender("male")).toBe(true);
    expect(isGender("female")).toBe(true);
    expect(isGender("other")).toBe(false);
    expect(isGender(GENDER_UNSPECIFIED)).toBe(false);
  });
});
