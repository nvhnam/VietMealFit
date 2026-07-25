import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";

export async function AccountMenu() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Link href="/account/sign-in" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
      <Link href="/account/profile" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Profile
      </Link>
      <form action={signOutAction}>
        <Button type="submit" variant="outline" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}
