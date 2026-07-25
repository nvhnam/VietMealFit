import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component / Route Handler / Server Action client — reads the
 * session from request cookies. Server Components can't write cookies, so
 * the setAll() call is wrapped in a try/catch: it silently no-ops there
 * (fine, since middleware.ts is what actually refreshes the session).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — no-op, middleware handles refresh.
          }
        },
      },
    },
  );
}
