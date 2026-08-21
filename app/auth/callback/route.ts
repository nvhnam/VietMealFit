import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Landing point for every link Supabase emails (confirm signup, magic link,
 * recovery). Previously absent entirely, which meant even a valid confirmation
 * link had nowhere to land and no way to turn into a session.
 *
 * Handles both shapes Supabase can send, because which one arrives depends on
 * project config we do not control from here:
 *  - `?code=...`        PKCE. @supabase/ssr defaults to this flow, so it is the
 *                       expected case; must be traded for a session server-side.
 *  - `?token_hash=&type=` the token-hash flow, used when the email template is
 *                       customised away from the default {{ .ConfirmationURL }}.
 * Supabase also appends `?error=&error_code=` here when *it* rejected the token
 * (expired, already used) — forwarded to sign-in so the user sees a real message
 * and a way out, instead of silently landing on the homepage.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const siteUrl = await getSiteUrl();

  const signInWithError = (code: string) =>
    NextResponse.redirect(
      new URL(`/account/sign-in?authError=${encodeURIComponent(code)}`, siteUrl),
    );

  const supabaseError = params.get("error_code") ?? params.get("error");
  if (supabaseError) return signInWithError(supabaseError);

  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return signInWithError(error.code ?? "exchange_failed");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return signInWithError(error.code ?? "verify_failed");
  } else {
    return signInWithError("missing_token");
  }

  // The layout renders signed-in/signed-out chrome, so its cached copy is stale
  // the moment the session cookie above is written.
  revalidatePath("/", "layout");

  // Same-origin paths only. A bare "//evil.com" is a protocol-relative URL, not
  // a path, so checking for a leading "/" alone would leave an open redirect.
  const requestedNext = params.get("next") ?? "/";
  const next =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";

  return NextResponse.redirect(new URL(next, siteUrl));
}
