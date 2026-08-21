import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { getServerLanguage } from "@/features/i18n/get-server-language";
import { en } from "@/features/i18n/messages/en";
import { vi } from "@/features/i18n/messages/vi";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_code?: string }>;
}) {
  // Supabase falls back to the project's "Site URL" (this page) when it has no
  // valid redirect_to to honour, appending its failure as query params. Nothing
  // here can act on them, so hand them to the one page that can.
  const { error, error_code: errorCode } = await searchParams;
  const authError = errorCode ?? error;
  if (authError) {
    redirect(`/account/sign-in?authError=${encodeURIComponent(authError)}`);
  }

  const language = await getServerLanguage();
  const t = language === "vi" ? vi : en;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex justify-end p-4">
        <LanguageToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t.common.appName}</h1>
        <p className="max-w-xl text-lg text-muted-foreground">{t.landing.tagline}</p>
        <Link href="/vietmeal" className={buttonVariants({ size: "lg" })}>
          {t.landing.getStarted}
        </Link>
      </div>
    </div>
  );
}
