import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: path.resolve(__dirname, "../../.env.local") });

const USER_ID_FILE = path.resolve(__dirname, ".auth/user-id.txt");

export default async function globalTeardown() {
  if (!fs.existsSync(USER_ID_FILE)) return;
  const userId = fs.readFileSync(USER_ID_FILE, "utf-8").trim();

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Rows this user's E2E runs created — delete before deleting the auth user
  // itself (profiles.id has no FK *to* auth.users enforced at the Postgres
  // level in this schema, so nothing cascades automatically from that).
  const postgres = (await import("postgres")).default;
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: "require" });
  await sql`delete from meal_plans where user_id = ${userId}`;
  await sql`delete from exercise_plans where user_id = ${userId}`;
  await sql`delete from profiles where id = ${userId}`;
  await sql.end({ timeout: 5 });

  await admin.auth.admin.deleteUser(userId).catch(() => {});

  fs.rmSync(path.dirname(USER_ID_FILE), { recursive: true, force: true });
}
