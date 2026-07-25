import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: path.resolve(__dirname, "../../.env.local") });

export const E2E_TEST_EMAIL = "vmf.e2e.playwright@gmail.com";
export const E2E_TEST_PASSWORD = "PlaywrightE2E123!";
const USER_ID_FILE = path.resolve(__dirname, ".auth/user-id.txt");

/**
 * Creates one real, pre-confirmed Supabase test user (same admin-API
 * approach as the integration test suite) and signs in through the actual
 * UI sign-in form — not by injecting a session directly — so the saved
 * storageState reflects a real, browser-driven login. Reused across every
 * E2E spec via playwright.config.ts's `use.storageState`.
 */
export default async function globalSetup() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Clean up any leftover user from a previous interrupted run before recreating.
  const { data: existing } = await admin.auth.admin.listUsers();
  const stale = existing?.users.find((u) => u.email === E2E_TEST_EMAIL);
  if (stale) await admin.auth.admin.deleteUser(stale.id);

  const { data, error } = await admin.auth.admin.createUser({
    email: E2E_TEST_EMAIL,
    password: E2E_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Playwright E2E" },
  });
  if (error || !data.user) throw new Error(`E2E test user creation failed: ${error?.message}`);

  fs.mkdirSync(path.dirname(USER_ID_FILE), { recursive: true });
  fs.writeFileSync(USER_ID_FILE, data.user.id);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:3000/account/sign-in");
  await page.fill("#email", E2E_TEST_EMAIL);
  await page.fill("#password", E2E_TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 15_000 });

  await page.context().storageState({ path: path.resolve(__dirname, ".auth/user.json") });
  await browser.close();
}
