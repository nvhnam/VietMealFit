"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEFAULT_EXPERIENCE_MODE,
  EXPERIENCE_MODE_COOKIE,
  type ExperienceMode,
} from "./constants";

type ExperienceModeContextValue = {
  mode: ExperienceMode;
  setMode: (mode: ExperienceMode) => void;
};

const ExperienceModeContext = createContext<ExperienceModeContextValue | null>(null);

/**
 * Persists to a cookie (not localStorage) so the initial server render already
 * knows the mode — avoids a flash of the wrong UI on first paint.
 * Phase 0 stub: session-only via cookie for every visitor. Phase 2 wires this
 * to `profiles.experience_mode` for logged-in users (plan §1.1).
 */
export function ExperienceModeProvider({
  initialMode,
  children,
}: {
  initialMode: ExperienceMode;
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<ExperienceMode>(initialMode ?? DEFAULT_EXPERIENCE_MODE);

  const setMode = useCallback((next: ExperienceMode) => {
    setModeState(next);
    document.cookie = `${EXPERIENCE_MODE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ExperienceModeContext.Provider value={value}>{children}</ExperienceModeContext.Provider>
  );
}

export function useExperienceMode(): ExperienceModeContextValue {
  const ctx = useContext(ExperienceModeContext);
  if (!ctx) {
    throw new Error("useExperienceMode must be used within an ExperienceModeProvider");
  }
  return ctx;
}
