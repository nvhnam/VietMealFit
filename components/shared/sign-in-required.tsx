import Link from "next/link";
import { UserRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/** Per D2: an account is required to generate/persist plans, not just to browse. */
export function SignInRequired({ what }: { what: string }) {
  return (
    <Card className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UserRound className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-muted-foreground">Sign in to {what}.</p>
      <Link href="/account/sign-in" className={buttonVariants()}>
        Sign in
      </Link>
    </Card>
  );
}
