import { SignInForm } from "@/features/auth/components/sign-in-form";
import { AuthLinkError } from "@/features/auth/components/auth-link-error";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const { authError } = await searchParams;

  return (
    <>
      {authError && <AuthLinkError code={authError} />}
      <SignInForm />
    </>
  );
}
