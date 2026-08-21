import type { Language } from "@/features/i18n/constants";

export type BilingualFoodName = {
  nameVi: string;
  nameEn: string | null;
};

export type DisplayNames = {
  /** The name to lead with, in the reader's language. */
  primary: string;
  /** The other language's name, or null when there is nothing extra to add. */
  secondary: string | null;
};

/**
 * Picks which of a food's two names to lead with.
 *
 * The Vietnamese name is the only one guaranteed to exist: the 2007 composition
 * table leaves the English column blank for a handful of foods (see
 * scripts/fix-food-names-en.mjs), so `nameEn` is genuinely null for those and
 * English readers fall back to the Vietnamese name rather than a blank or a
 * placeholder.
 *
 * Both names are worth showing when they differ — a Vietnamese food dictionary
 * read in English still wants "Bánh mỳ" next to "French bread" — so the second
 * one is returned rather than discarded, and suppressed only when it would
 * repeat the first.
 */
export function foodDisplayNames(item: BilingualFoodName, language: Language): DisplayNames {
  const english = item.nameEn?.trim() ? item.nameEn : null;
  const primary = language === "en" ? (english ?? item.nameVi) : item.nameVi;
  const other = language === "en" ? item.nameVi : english;
  return {
    primary,
    secondary: other && other !== primary ? other : null,
  };
}
