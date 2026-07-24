export {
  ADVANCED_ONLY_MODULES,
  DEFAULT_EXPERIENCE_MODE,
  EXPERIENCE_MODE_COOKIE,
  isExperienceMode,
  type ExperienceMode,
} from "./constants";
export { ExperienceModeProvider, useExperienceMode } from "./experience-mode-provider";

// NOTE: getServerExperienceMode is intentionally NOT re-exported here. It pulls
// in "server-only" + "next/headers", and this barrel is also imported by client
// components (useExperienceMode) — bundling them together breaks the client build.
// Import it directly: `@/features/experience-mode/get-server-experience-mode`.
