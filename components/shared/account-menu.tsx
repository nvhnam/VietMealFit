import { createClient } from "@/lib/supabase/server";
import { getServerLanguage } from "@/features/i18n/get-server-language";
import { en } from "@/features/i18n/messages/en";
import { vi } from "@/features/i18n/messages/vi";
import { AccountMenuContent } from "./account-menu-content";

export async function AccountMenu() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const language = await getServerLanguage();
  const t = language === "vi" ? vi : en;

  return (
    <AccountMenuContent
      signedIn={!!user}
      email={user?.email ?? null}
      labels={{
        menu: t.auth.accountMenuLabel,
        profile: t.auth.profileLink,
        signIn: t.auth.signInButton,
        signOut: t.auth.signOut,
      }}
    />
  );
}
