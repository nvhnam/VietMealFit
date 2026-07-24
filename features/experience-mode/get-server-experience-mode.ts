import "server-only";
import { cookies } from "next/headers";
import {
  DEFAULT_EXPERIENCE_MODE,
  EXPERIENCE_MODE_COOKIE,
  isExperienceMode,
  type ExperienceMode,
} from "./constants";

/**
 * Server-side initial value for ExperienceModeProvider. An explicit `?mode=`
 * query param (deep-link, plan §1.1) wins over the cookie for that request,
 * but is NOT persisted here — persisting a query-param override is a client
 * concern (call setMode) so a plain revisit without the param falls back to
 * the user's saved preference instead of silently sticking.
 */
export async function getServerExperienceMode(
  searchParamMode?: string | string[],
): Promise<ExperienceMode> {
  const paramValue = Array.isArray(searchParamMode) ? searchParamMode[0] : searchParamMode;
  if (isExperienceMode(paramValue)) {
    return paramValue;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(EXPERIENCE_MODE_COOKIE)?.value;
  if (isExperienceMode(cookieValue)) {
    return cookieValue;
  }

  return DEFAULT_EXPERIENCE_MODE;
}
