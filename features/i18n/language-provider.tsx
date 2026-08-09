"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, type Language } from "./constants";
import { en, type Messages } from "./messages/en";
import { vi } from "./messages/vi";

const DICTIONARIES: Record<Language, Messages> = { en, vi };

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Messages;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Persists to a cookie (not localStorage) so the initial server render
 * already knows the language — avoids a flash of the wrong language on
 * first paint. Mirrors ExperienceModeProvider's reasoning.
 *
 * Unlike experience mode (purely client-gated), language also affects
 * Server Component output (<html lang>, any server-rendered text), so
 * setLanguage calls router.refresh() after writing the cookie to re-render
 * the RSC tree with the new value.
 */
export function LanguageProvider({
  initialLanguage,
  children,
}: {
  initialLanguage: Language;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>(initialLanguage ?? DEFAULT_LANGUAGE);

  const setLanguage = useCallback(
    (next: Language) => {
      setLanguageState(next);
      document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      router.refresh();
    },
    [router],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t: DICTIONARIES[language] }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return ctx;
}
