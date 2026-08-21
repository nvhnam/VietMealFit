import { describe, expect, it } from "vitest";
import { foodDisplayNames } from "@/features/vietsearch/display-name";

const banhMy = { nameVi: "Bánh mỳ", nameEn: "French bread" };
// The 2007 table leaves the English column blank for these; see
// scripts/fix-food-names-en.mjs.
const caThuDao = { nameVi: "Cá thu đao", nameEn: null };

describe("foodDisplayNames", () => {
  it("leads with English for an English reader", () => {
    expect(foodDisplayNames(banhMy, "en")).toEqual({
      primary: "French bread",
      secondary: "Bánh mỳ",
    });
  });

  it("leads with Vietnamese for a Vietnamese reader", () => {
    expect(foodDisplayNames(banhMy, "vi")).toEqual({
      primary: "Bánh mỳ",
      secondary: "French bread",
    });
  });

  it("falls back to the Vietnamese name when the source has no English one", () => {
    // Never a blank and never a placeholder: the Vietnamese name is the only
    // one guaranteed to exist for every row.
    expect(foodDisplayNames(caThuDao, "en")).toEqual({
      primary: "Cá thu đao",
      secondary: null,
    });
  });

  it("shows no second line for a Vietnamese reader when English is missing", () => {
    expect(foodDisplayNames(caThuDao, "vi")).toEqual({
      primary: "Cá thu đao",
      secondary: null,
    });
  });

  it("treats a blank or whitespace English name as absent", () => {
    expect(foodDisplayNames({ nameVi: "Quả cóc", nameEn: "" }, "en").primary).toBe("Quả cóc");
    expect(foodDisplayNames({ nameVi: "Quả cóc", nameEn: "   " }, "en").primary).toBe("Quả cóc");
    expect(foodDisplayNames({ nameVi: "Quả cóc", nameEn: "  " }, "vi").secondary).toBeNull();
  });

  it("does not repeat a name that is the same in both languages", () => {
    const same = { nameVi: "Pate", nameEn: "Pate" };
    expect(foodDisplayNames(same, "en").secondary).toBeNull();
    expect(foodDisplayNames(same, "vi").secondary).toBeNull();
  });

  it("keeps the selected name stable between the picker and the result card", () => {
    // Both call sites go through this function precisely so they cannot drift.
    for (const language of ["en", "vi"] as const) {
      const picked = foodDisplayNames(banhMy, language);
      expect(foodDisplayNames(banhMy, language)).toEqual(picked);
    }
  });
});
