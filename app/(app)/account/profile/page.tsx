import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { ProfileProgress } from "@/features/profile/components/profile-progress";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/account/sign-in");
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <ProfileForm />
      <ProfileProgress />
    </div>
  );
}
