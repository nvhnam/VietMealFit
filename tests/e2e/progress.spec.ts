import { test, expect, type Page } from "@playwright/test";

async function generateAndWait(page: Page, module: "vietmeal" | "vietfit", button: RegExp) {
  const generated = page.waitForResponse((r) => r.url().includes(`${module}.generate`), { timeout: 60_000 });
  await page.getByRole("button", { name: button }).click();
  expect((await generated).ok()).toBe(true);
  await page.waitForResponse((r) => r.url().includes(`${module}.getCurrentPlan`), { timeout: 60_000 });
  await expect(page.getByRole("tab", { name: "Mon" })).toBeVisible();
}

// Ticks live on the server, not in the experience-mode cookie: a meal or
// exercise ticked in Basic mode must show on the profile page in Advanced.
test.describe("Ticked plan items on the profile page", () => {
  // Each test generates a plan, ticks it, and loads another page.
  test.describe.configure({ timeout: 120_000 });

  test("a meal ticked in Basic mode is listed under today in Advanced mode", async ({ page }) => {
    await page.goto("/vietmeal?mode=basic");
    await page.getByLabel("Weight (kg)").fill("68");
    // An earlier spec may have left a plan on screen already, so wait for the
    // new plan to be generated and refetched before ticking anything.
    await generateAndWait(page, "vietmeal", /generate plan/i);

    // Scoped to a plan row: the generate form above has its own checkboxes.
    const firstMeal = page.locator("div.rounded-lg.border", { hasText: "kcal ·" }).first().getByRole("checkbox");
    await firstMeal.click();
    await expect(firstMeal).toBeChecked({ timeout: 30_000 });

    await page.goto("/account/profile?mode=advanced");
    await expect(page.getByRole("heading", { name: "Your progress" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /^Today · / })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/kcal ·/).first()).toBeVisible();
  });

  test("an exercise ticked in Basic mode is listed under today on the VietFit tab", async ({ page }) => {
    await page.goto("/vietfit?mode=basic");
    await page.getByLabel("Height (cm)").fill("175");
    await page.getByLabel("Weight (kg)").fill("70");
    // An earlier spec may have left a plan on screen already, so wait for the
    // new plan to be generated and refetched before ticking anything.
    await generateAndWait(page, "vietfit", /generate schedule/i);

    // Monday is a training day at every experience level, so it has rows.
    const firstExercise = page.locator("div.rounded-lg.border", { hasText: "sets ×" }).first().getByRole("checkbox");
    await firstExercise.click();
    await expect(firstExercise).toBeChecked({ timeout: 30_000 });

    await page.goto("/account/profile?mode=advanced");
    await page.getByRole("tab", { name: "VietFit" }).click();
    await expect(page.getByRole("heading", { name: /^Today · / })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/sets ×/).first()).toBeVisible();
  });
});
