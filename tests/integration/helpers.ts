import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

// Real Supabase project (via .env.local, loaded by tests/setup.ts) — these
// integration tests exercise the actual tRPC routers + Postgres + Drizzle,
// not mocks, matching how this codebase has verified every router since
// Phase 2. Test users/rows are always created and cleaned up per-suite.
export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function createTestUser(label: string): Promise<User> {
  const email = `vmf.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@gmail.com`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: "TestPassword123!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createTestUser(${label}) failed: ${error?.message}`);
  return data.user;
}

export async function deleteTestUser(userId: string): Promise<void> {
  await adminClient.auth.admin.deleteUser(userId);
}

export function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | undefined)?.code;
}
