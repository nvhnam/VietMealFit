import { test, expect } from "@playwright/test";

// Basic mode is the paper's original experience surface (plan §1.1): only
// VietMeal + VietFit, no VietAsk dock, no advanced-only nav links. This spec
// exercises the actual paper-evaluated core end to end through a real
// browser, signed in as a real (pre-confirmed) Supabase test user.
test.describe("Basic mode happy path", () => {
  test("nav shows only VietMeal + VietFit, no VietAsk dock", async ({ page }) => {
    await page.goto("/vietmeal?mode=basic");
    const nav = page.getByRole("navigation", { name: "Modules" });
    await expect(nav.getByRole("link", { name: "VietMeal" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "VietFit" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "VietLean" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "VietSearch" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "VietMeet" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "VietSmart" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open VietAsk" })).toHaveCount(0);
  });

  test("generates a meal plan and renders the week view", async ({ page }) => {
    await page.goto("/vietmeal?mode=basic");
    await page.getByLabel("Weight (kg)").fill("68");
    await page.getByRole("button", { name: /generate plan/i }).click();

    // Real generation: real tRPC mutation, real DB insert, real re-render.
    await expect(page.getByRole("tab", { name: "Mon" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/kcal ·/).first()).toBeVisible();
  });

  test("generates an exercise plan and renders the week view", async ({ page }) => {
    await page.goto("/vietfit?mode=basic");
    await page.getByLabel("Height (cm)").fill("175");
    await page.getByLabel("Weight (kg)").fill("70");
    await page.getByRole("button", { name: /generate schedule/i }).click();

    await expect(page.getByRole("tab", { name: "Mon" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/sets ×/).first()).toBeVisible();
  });
});
