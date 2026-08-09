export type Language = "en" | "vi";

export const LANGUAGE_COOKIE = "vmf_language";
export const DEFAULT_LANGUAGE: Language = "en";

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "vi";
}
