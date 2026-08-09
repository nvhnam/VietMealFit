import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, isLanguage, type Language } from "./constants";

/** Server-side initial value for LanguageProvider and the root <html lang>. */
export async function getServerLanguage(): Promise<Language> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LANGUAGE_COOKIE)?.value;
  if (isLanguage(cookieValue)) {
    return cookieValue;
  }
  return DEFAULT_LANGUAGE;
}
