import { UNSPECIFIED } from "@/features/shared/vocabularies";

/**
 * Shared closed vocabulary for the gender field, used by the profile form and
 * VietFit's generate form. Both previously exposed a bare free-text input, so
 * the `profiles.gender` column accumulated whatever users typed — "Male", "M",
 * "nam", "Nữ", blank — which made the stored attribute unusable for any
 * sex-stratified analysis and fed inconsistent tokens into VietAsk's prompt.
 *
 * Values stay in English regardless of UI language, matching the convention
 * already documented for experienceLevel/goal/limitations: the label is
 * translated, the stored value is not.
 */
export const GENDER_VALUES = ["male", "female"] as const;

export type Gender = (typeof GENDER_VALUES)[number];

/**
 * UI-only sentinel for "not answered". It goes to the wire as null, which is
 * what the nullable column has always meant — the field was never required and
 * making it so now would be a behaviour change, not a formatting one.
 *
 * Re-exported from the shared sentinel so the profile form's several nullable
 * selects can't end up using two different magic strings.
 */
export const GENDER_UNSPECIFIED = UNSPECIFIED;

export function isGender(value: string): value is Gender {
  return (GENDER_VALUES as readonly string[]).includes(value);
}

/**
 * Maps a stored value onto a select option. Deliberately tolerant of the
 * spellings the old free-text field allowed (including Vietnamese), so an
 * existing answer lands on a real option and gets cleaned up on next save
 * instead of being stranded.
 *
 * Anything still unrecognised is returned verbatim rather than discarded —
 * silently rewriting a user's stored answer to "unspecified" because it is not
 * in our list would be data loss. The form surfaces it as an extra option.
 */
export function normalizeGender(stored: string | null | undefined): string {
  const trimmed = (stored ?? "").trim();
  if (!trimmed) return GENDER_UNSPECIFIED;

  const lower = trimmed.toLowerCase();
  if (["male", "m", "nam"].includes(lower)) return "male";
  if (["female", "f", "nữ", "nu", "nu~"].includes(lower)) return "female";

  return trimmed;
}

/** Select value → what the API should store. */
export function genderToWire(selectValue: string): string | null {
  return selectValue === GENDER_UNSPECIFIED ? null : selectValue;
}
