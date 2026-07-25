import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { ExperienceMode } from "@/features/experience-mode";

/**
 * Route guard for the four Advanced-only modules (plan §1.1: VietLean,
 * VietSearch, VietMeet, VietSmart). Nav already hides these links in Basic
 * mode; this catches direct navigation / stale bookmarks. `mode` is passed
 * in by the page (via getServerExperienceMode(searchParams.mode)) since only
 * page.tsx — not this shared component — has access to searchParams.
 */
export function AdvancedModeGate({
  mode,
  children,
}: {
  mode: ExperienceMode;
  children: React.ReactNode;
}) {
  if (mode !== "advanced") {
    return (
      <Card className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm text-muted-foreground">
          This module is only available in Advanced mode.
        </p>
        <Link href="?mode=advanced" className={buttonVariants()}>
          Switch to Advanced mode
        </Link>
      </Card>
    );
  }

  return <>{children}</>;
}
