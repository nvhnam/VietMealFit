export { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, isLanguage, type Language } from "./constants";
export { LanguageProvider, useI18n } from "./language-provider";
export type { Messages } from "./messages/en";

// NOTE: getServerLanguage is intentionally NOT re-exported here. It pulls in
// "server-only" + "next/headers", and this barrel is also imported by client
// components (useI18n) — bundling them together breaks the client build.
// Import it directly: `@/features/i18n/get-server-language`.
