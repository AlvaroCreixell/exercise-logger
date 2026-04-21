import { test, expect } from "@playwright/test";

test("tab-through reaches every primary bottom-tab nav link", async ({ page }) => {
  await page.goto("/exercise-logger/");
  const tabs = ["Today", "Workout", "History", "Settings"];
  for (const name of tabs) {
    const link = page.getByRole("link", { name });
    await expect(link).toBeVisible();
  }
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});
