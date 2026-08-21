"use client";

import { useActionState } from "react";
import { resendConfirmationAction, type AuthActionState } from "@/features/auth/actions";
import { useI18n } from "@/features/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { error: null };

/**
 * Shown when the user arrives from a Supabase email link that failed. Before
 * this, those redirects dropped the user on a page with no indication anything
 * had gone wrong — the error was in the query string and nothing read it.
 */
export function AuthLinkError({ code }: { code: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(resendConfirmationAction, initialState);

  // Three distinct situations reach this component, and telling a user their
  // link is broken when they never clicked one would just confuse them:
  //  - they tried to sign in on an account that was never confirmed
  //  - otp_expired — covers both halves of Supabase's single-use token
  //    contract: past its expiry window, and already redeemed (including by an
  //    email scanner that fetched the link before the user did)
  //  - anything else the callback could not complete
  const notConfirmed = code === "email_not_confirmed";
  const isExpired = code === "otp_expired" || code === "access_denied";

  const title = notConfirmed ? t.auth.notConfirmedTitle : t.auth.linkInvalidTitle;
  const body = notConfirmed
    ? t.auth.notConfirmedBody
    : isExpired
      ? t.auth.linkExpiredBody
      : t.auth.linkGenericBody;

  return (
    <div className="mx-auto mb-4 max-w-sm rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <h2 className="text-sm font-semibold text-destructive">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>

      {state.message ? (
        <p className="mt-3 text-sm font-medium text-foreground">{state.message}</p>
      ) : (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <Label htmlFor="resend-email" className="sr-only">
            {t.auth.email}
          </Label>
          <Input
            id="resend-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder={t.auth.email}
          />
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? t.auth.resendPending : t.auth.resendButton}
          </Button>
        </form>
      )}
    </div>
  );
}
