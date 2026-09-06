import Link from "next/link";
import { Suspense } from "react";
import { Leaf } from "lucide-react";
import { ExperienceModeProvider } from "@/features/experience-mode";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";
import { getServerLanguage } from "@/features/i18n/get-server-language";
import { en } from "@/features/i18n/messages/en";
import { vi } from "@/features/i18n/messages/vi";
import { AppNav } from "@/components/shared/app-nav";
import { ExperienceModeToggle } from "@/components/shared/experience-mode-toggle";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ExperienceModeQuerySync } from "@/components/shared/experience-mode-query-sync";
import { VietAskDock } from "@/features/vietask/components/vietask-dock";
import { AccountMenu } from "@/components/shared/account-menu";
import { Skeleton } from "@/components/ui/skeleton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const initialMode = await getServerExperienceMode();
  const language = await getServerLanguage();
  const t = language === "vi" ? vi : en;

  return (
    <ExperienceModeProvider initialMode={initialMode}>
      <Suspense fallback={null}>
        <ExperienceModeQuerySync />
      </Suspense>
      <a
        href="#main-content"
        className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        {t.common.skipToMainContent}
      </a>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        {/* Phone: the controls below are shrink-0 and eat ~259px of a 375px bar,
            which left <AppNav> a 40px sliver for 633px of links. Wrapping the nav
            onto its own full-width row gives it the whole viewport; from sm: up
            everything returns to the original single 14-unit row. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:h-14 sm:flex-nowrap sm:gap-4 sm:py-0">
          <Link href="/" className="order-1 flex shrink-0 items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Leaf className="size-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">{t.common.appName}</span>
          </Link>
          <AppNav />
          <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3">
            <LanguageToggle />
            <ExperienceModeToggle />
            <Suspense fallback={<Skeleton className="size-7 rounded-[min(var(--radius-md),12px)]" />}>
              <AccountMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-border/80 px-4 py-4 text-center text-xs text-muted-foreground">
        {t.common.footerDisclaimer}
      </footer>
      <VietAskDock />
    </ExperienceModeProvider>
  );
}
