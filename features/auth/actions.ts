"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthCallbackUrl } from "@/lib/site-url";
import { getServerLanguage } from "@/features/i18n/get-server-language";
import { en } from "@/features/i18n/messages/en";
import { vi } from "@/features/i18n/messages/vi";

export type AuthActionState = { error: string | null; message?: string; code?: string };

async function messages() {
  return (await getServerLanguage()) === "vi" ? vi : en;
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // The code matters, not just the message: an unconfirmed account is the one
  // sign-in failure the user can fix themselves, so the form offers a resend.
  if (error) return { error: error.message, code: error.code };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const t = await messages();

  if (!displayName.trim()) {
    return { error: t.auth.displayNameRequired };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      // Without this, Supabase builds the emailed link's redirect_to from the
      // project's dashboard "Site URL" — which defaults to http://localhost:3000
      // and therefore stranded every production signup on localhost.
      emailRedirectTo: await getAuthCallbackUrl(),
    },
  });

  if (error) return { error: error.message };

  // Email confirmation may be required (project-config dependent) — signUp()
  // only returns a session immediately when confirmation is off.
  if (!data.session) {
    return { error: null, message: t.auth.checkEmailToConfirm };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Issues a fresh confirmation email. Confirmation tokens are single-use and
 * expire, so a user whose link died has no other way back into their own
 * account — signing up again just collides with the existing unconfirmed row.
 */
export async function resendConfirmationAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const t = await messages();

  if (!email) return { error: t.auth.resendEmailRequired };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: await getAuthCallbackUrl() },
  });

  // Rate limiting is the one failure worth showing verbatim — it is temporary
  // and tells the user to wait rather than retry. Every other error is reported
  // as success on purpose: distinguishing "no such account" from "already
  // confirmed" from "sent" would turn this form into an email-enumeration oracle.
  if (error && error.code === "over_email_send_rate_limit") {
    return { error: error.message };
  }

  return { error: null, message: t.auth.resendSent };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
