import Link from "next/link";
import { UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getServerLanguage } from "@/features/i18n/get-server-language";
import { en } from "@/features/i18n/messages/en";
import { vi } from "@/features/i18n/messages/vi";

/** Per D2: an account is required to generate/persist plans, not just to browse. */
export async function SignInRequired({ what }: { what: "vietmeal-plan" | "vietfit-plan" }) {
  const language = await getServerLanguage();
  const t = language === "vi" ? vi : en;
  const whatText = what === "vietmeal-plan" ? t.vietmeal.signInAction : t.vietfit.signInAction;

  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UserRound className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">{t.app.signInToAction(whatText)}</p>
      <Link href="/account/sign-in" className={buttonVariants()}>
        {t.auth.signInButton}
      </Link>
    </Card>
  );
}
