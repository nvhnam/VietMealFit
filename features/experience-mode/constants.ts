export type ExperienceMode = "basic" | "advanced";

export const EXPERIENCE_MODE_COOKIE = "vmf_experience_mode";
export const DEFAULT_EXPERIENCE_MODE: ExperienceMode = "advanced";

export function isExperienceMode(value: unknown): value is ExperienceMode {
  return value === "basic" || value === "advanced";
}

/** Modules gated behind Advanced mode per plan §1.1 — hidden from nav and route-guarded in Basic mode. */
export const ADVANCED_ONLY_MODULES = [
  "vietlean",
  "vietsearch",
  "vietmeet",
  "vietsmart",
] as const;
