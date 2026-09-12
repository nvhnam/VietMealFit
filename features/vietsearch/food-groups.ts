import type { Language } from "@/features/i18n/constants";
import FOOD_GROUP_DATA from "@/data/seed/food_groups_2007.json";

export type FoodGroup = {
  group: number;
  en: string;
  vi: string;
};

/**
 * The 14 food groups of the Vietnamese food composition table (Bảng thành phần
 * thực phẩm Việt Nam, NXB Y học 2007), in the book's order and wording:
 * Vietnamese as in its table of contents, English as on its group title pages.
 *
 * The list lives in data/seed/food_groups_2007.json so the seed scripts and the
 * app read the same names. A food's group is never stored for this purpose — it
 * is the leading digits of the food code, the numbering the book itself uses.
 */
export const FOOD_GROUPS: readonly FoodGroup[] = FOOD_GROUP_DATA.groups;

/** 1001 -> 1, 14016 -> 14. */
export function foodGroupOfCode(foodCode: string): number {
  return Math.floor(Number(foodCode) / 1000);
}

export function foodGroupLabel(group: FoodGroup, language: Language): string {
  return language === "en" ? group.en : group.vi;
}
