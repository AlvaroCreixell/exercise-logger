import { test, expect } from "@playwright/test";
import {
  STARTER_ROUTINE_NAME,
  resetAppState,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding skip flow", () => {
  test("Use starter routine → Today with default greeting + starter routine", async ({
    page,
  }) => {
    await resetAppState(page);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: /use starter routine/i }).click();

    // Lands on Today with default "Hello." greeting.
    await expect(page.getByRole("heading", { name: "Hello." })).toBeVisible({
      timeout: 10_000,
    });

    // Starter routine is active — verify via Settings.
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(
      page.getByRole("heading", { name: /settings/i })
    ).toBeVisible();
    await expect(page.getByText(STARTER_ROUTINE_NAME)).toBeVisible();
  });
});
