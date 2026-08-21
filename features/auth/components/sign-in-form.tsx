"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction, type AuthActionState } from "@/features/auth/actions";
import { AuthLinkError } from "@/features/auth/components/auth-link-error";
import { useI18n } from "@/features/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const initialState: AuthActionState = { error: null };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const { t } = useI18n();

  return (
    <>
      {state.code === "email_not_confirmed" && <AuthLinkError code={state.code} />}
      <Card className="mx-auto max-w-sm p-6">
        <h1 className="mb-4 text-xl font-semibold">{t.auth.signInHeading}</h1>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? t.auth.signingIn : t.auth.signInButton}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t.auth.noAccount}{" "}
          <Link href="/account/sign-up" className="text-primary underline-offset-4 hover:underline">
            {t.auth.signUpButton}
          </Link>
        </p>
      </Card>
    </>
  );
}
