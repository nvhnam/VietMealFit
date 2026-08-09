"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionState } from "@/features/auth/actions";
import { useI18n } from "@/features/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const initialState: AuthActionState = { error: null };

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUpAction, initialState);
  const { t } = useI18n();

  return (
    <Card className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold">{t.auth.signUpHeading}</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="displayName">{t.auth.displayName}</Label>
          <Input id="displayName" name="displayName" required autoComplete="name" />
        </div>
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
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? t.auth.creatingAccount : t.auth.signUpButton}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        {t.auth.alreadyHaveAccount}{" "}
        <Link href="/account/sign-in" className="text-primary underline-offset-4 hover:underline">
          {t.auth.signInButton}
        </Link>
      </p>
    </Card>
  );
}
