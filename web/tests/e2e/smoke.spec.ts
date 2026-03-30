import { test, expect } from "@playwright/test";

test("app loads and shows heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Exercise Logger")).toBeVisible();
});
