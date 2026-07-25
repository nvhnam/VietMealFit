import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/** Per D2: an account is required to generate/persist plans, not just to browse. */
export function SignInRequired({ what }: { what: string }) {
  return (
    <Card className="mx-auto max-w-md p-6 text-center">
      <p className="mb-4 text-sm text-muted-foreground">Sign in to {what}.</p>
      <Link href="/account/sign-in" className={buttonVariants()}>
        Sign in
      </Link>
    </Card>
  );
}
