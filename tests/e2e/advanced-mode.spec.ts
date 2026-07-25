import { test, expect } from "@playwright/test";

// Advanced mode unlocks VietLean, VietSearch, VietMeet, VietSmart, and the
// VietAsk dock (plan §1.1). This spec covers the modules the paper didn't
// have in a real, working form: the calculator, the nutrition dictionary,
// and the AI assistant dock's presence/open behavior.
test.describe("Advanced mode happy path", () => {
  test("nav shows all six modules and the VietAsk dock is present", async ({ page }) => {
    await page.goto("/vietlean?mode=advanced");
    const nav = page.getByRole("navigation", { name: "Modules" });
    for (const label of ["VietMeal", "VietFit", "VietLean", "VietSearch", "VietMeet", "VietSmart"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "Open VietAsk" })).toBeVisible();
  });

  test("VietLean calculates daily targets", async ({ page }) => {
    await page.goto("/vietlean?mode=advanced");
    await page.getByLabel("Weight (kg)").fill("70");
    await page.getByRole("button", { name: "Calculate" }).click();

    await expect(page.getByText("Daily targets")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("kcal")).toBeVisible();
  });

  test("VietSearch looks up an ingredient and shows nutrition facts", async ({ page }) => {
    await page.goto("/vietsearch?mode=advanced");
    await page.getByRole("button", { name: "Select an ingredient..." }).click();
    await page.getByPlaceholder("Search by Vietnamese or English name...").fill("a");

    const firstResult = page.getByRole("option").first();
    await expect(firstResult).toBeVisible({ timeout: 10_000 });
    await firstResult.click();

    await page.getByRole("button", { name: "Look up nutrition" }).click();
    await expect(page.getByText(/^Results for /)).toBeVisible({ timeout: 10_000 });
  });

  test("VietAsk dock opens and shows the chat panel", async ({ page }) => {
    await page.goto("/vietlean?mode=advanced");
    await page.getByRole("button", { name: "Open VietAsk" }).click();
    await expect(page.getByRole("heading", { name: "VietAsk" })).toBeVisible();
    await expect(page.getByPlaceholder("Ask VietAsk...")).toBeVisible();
  });
});
