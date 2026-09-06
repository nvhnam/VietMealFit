"use client";

import { useRef } from "react";
import Link from "next/link";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { signOutAction } from "@/features/auth/actions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Collapses the account actions into a single icon trigger. On a phone the
 * header ran out of room long before the module links did — the profile and
 * sign-out buttons are `shrink-0`, so they squeezed <AppNav> down to nothing
 * and left VietLean/VietFit/... unreachable. The language and mode toggles
 * deliberately stay in the bar; only the account actions move in here.
 */
export function AccountMenuContent({
  signedIn,
  email,
  labels,
}: {
  signedIn: boolean;
  email: string | null;
  labels: { menu: string; profile: string; signIn: string; signOut: string };
}) {
  // The sign-out form is rendered outside the menu on purpose. Selecting an
  // item closes the popup, which unmounts everything inside it, so a submit
  // button living in the popup could be torn down mid-submit. Keeping the form
  // mounted next to the trigger and submitting it programmatically leaves the
  // existing server action untouched.
  const signOutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={labels.menu}
          className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
        >
          <UserRound className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        {/* Without an explicit width the popup inherits the trigger's width
            (w-(--anchor-width)) and collapses to the 8rem minimum. */}
        <DropdownMenuContent align="end" className="w-56">
          {signedIn ? (
            // The group is required, not cosmetic: DropdownMenuLabel renders
            // Base UI's Menu.GroupLabel, which throws if it cannot find a
            // surrounding Menu.Group. The popup only mounts when opened, so
            // that crash surfaces on first click rather than on page load.
            <DropdownMenuGroup>
              {email && (
                <>
                  <DropdownMenuLabel className="truncate" title={email}>
                    {email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem render={<Link href="/account/profile" />}>
                <UserRound aria-hidden="true" />
                {labels.profile}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOutForm.current?.requestSubmit()}>
                <LogOut aria-hidden="true" />
                {labels.signOut}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : (
            <DropdownMenuItem render={<Link href="/account/sign-in" />}>
              <LogIn aria-hidden="true" />
              {labels.signIn}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {signedIn && <form ref={signOutForm} action={signOutAction} className="hidden" />}
    </>
  );
}
