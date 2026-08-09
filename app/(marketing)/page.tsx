import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { getServerLanguage } from "@/features/i18n/get-server-language";
import { en } from "@/features/i18n/messages/en";
import { vi } from "@/features/i18n/messages/vi";

export default async function LandingPage() {
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
