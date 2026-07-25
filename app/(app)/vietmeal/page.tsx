import { createClient } from "@/lib/supabase/server";
import { SignInRequired } from "@/components/shared/sign-in-required";
import { VietMealPageClient } from "@/features/vietmeal/components/vietmeal-page-client";

export default async function VietMealPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <SignInRequired what="generate a meal plan" />;
  }

  return <VietMealPageClient />;
}
