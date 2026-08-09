import { createClient } from "@/lib/supabase/server";
import { SignInRequired } from "@/components/shared/sign-in-required";
import { VietFitPageClient } from "@/features/vietfit/components/vietfit-page-client";

export default async function VietFitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <SignInRequired what="vietfit-plan" />;
  }

  return <VietFitPageClient />;
}
