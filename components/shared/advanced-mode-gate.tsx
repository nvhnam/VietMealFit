import Link from "next/link";
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
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">
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
