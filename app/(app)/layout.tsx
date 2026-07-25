import Link from "next/link";
import { Suspense } from "react";
import { ExperienceModeProvider } from "@/features/experience-mode";
import { getServerExperienceMode } from "@/features/experience-mode/get-server-experience-mode";
import { AppNav } from "@/components/shared/app-nav";
import { ExperienceModeToggle } from "@/components/shared/experience-mode-toggle";
import { ExperienceModeQuerySync } from "@/components/shared/experience-mode-query-sync";
import { VietAskDock } from "@/features/vietask/components/vietask-dock";
import { AccountMenu } from "@/components/shared/account-menu";
import { Skeleton } from "@/components/ui/skeleton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const initialMode = await getServerExperienceMode();

  return (
    <ExperienceModeProvider initialMode={initialMode}>
      <Suspense fallback={null}>
        <ExperienceModeQuerySync />
      </Suspense>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            VietMealFit
          </Link>
          <AppNav />
          <div className="flex items-center gap-2">
            <ExperienceModeToggle />
            <Suspense fallback={<Skeleton className="h-8 w-20" />}>
              <AccountMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
        VietMealFit provides general fitness and nutrition information only — it is not medical
        advice. Consult a qualified professional before making significant diet or exercise
        changes.
      </footer>
      <VietAskDock />
    </ExperienceModeProvider>
  );
}
