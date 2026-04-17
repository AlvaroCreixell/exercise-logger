import { test, expect } from "@playwright/test";

// ERRATA P7-D: Use Playwright's configured baseURL instead of hardcoding port.
// page.goto("/") uses the baseURL from playwright.config.ts.

test.describe("Exercise Logger E2E Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for IndexedDB initialization to complete (Loading... disappears)
    await expect(page.getByText("Loading...")).toBeHidden({ timeout: 10000 });
  });

  test("app loads and shows the Today screen", async ({ page }) => {
    // The Today screen should be visible
    await expect(page.getByText(/today/i).first()).toBeVisible();
  });

  test("navigating to Settings shows the settings screen", async ({
    page,
  }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: /settings/i }).click();
    await expect(page.getByText(/routines/i).first()).toBeVisible();
    await expect(page.getByText(/preferences/i).first()).toBeVisible();
    await expect(page.getByText(/data/i).first()).toBeVisible();
  });

  test("bundled routine is auto-seeded and active", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: /settings/i }).click();

    // The bundled routine should already be present and active
    await expect(
      page.getByText("Full Body 3-Day Rotation", { exact: true })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Active")).toBeVisible();
  });

  test("full workflow: start -> log -> finish -> history -> export", async ({
    page,
  }) => {
    // Bundled routine is auto-seeded and active on fresh launch.
    // Step 1: Start a workout from Today
    await expect(page.getByText(/start workout/i)).toBeVisible({
      timeout: 10000,
    });
    await page.getByText(/start workout/i).click();

    // Step 2: Should be on the Workout screen with exercises
    await expect(page.getByText(/finish workout/i)).toBeVisible({
      timeout: 5000,
    });

    // Step 3: Log a set — hard assertions, no .catch guards.
    const setSlot = page.locator('[data-testid="set-slot"]').first();
    await expect(setSlot).toBeVisible({ timeout: 5000 });
    await setSlot.click();

    const weightInput = page.locator('input[name="weight"]').first();
    await expect(weightInput).toBeVisible({ timeout: 3000 });
    await weightInput.fill("60");

    const repsInput = page.locator('input[name="reps"]').first();
    await expect(repsInput).toBeVisible();
    await repsInput.fill("10");

    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Sheet should close; the logged set should appear (success toast or slot update).
    await expect(page.locator('[data-testid="set-slot"]').first()).toBeVisible();

    // Step 4: Finish the workout (confirm dialog is an AlertDialog primitive).
    await page.getByRole("button", { name: /^finish workout$/i }).click();
    // Confirm dialog shows its own "Finish Workout" button inside role=alertdialog.
    const dialogFinish = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^finish workout$/i });
    await expect(dialogFinish).toBeVisible({ timeout: 3000 });
    await dialogFinish.click();

    // Step 5: History should list the finished session.
    await page.getByRole("link", { name: /history/i }).click();
    await expect(
      page.getByText(/full body 3-day rotation/i).first()
    ).toBeVisible({ timeout: 5000 });

    // Step 6: Export download round-trips end-to-end.
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: /settings/i })
      .click();

    const exportButton = page.getByRole("button", { name: /export data/i });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();

    const downloadPromise = page.waitForEvent("download", { timeout: 10000 });
    await exportButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /exercise-logger-backup.*\.json/
    );
  });

  test("workout screen shows empty state when no session", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /workout/i }).click();
    await expect(page.getByText(/no active workout/i)).toBeVisible();
  });

  test("history screen shows empty state when no history", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /history/i }).click();
    await expect(
      page.getByRole("heading", { name: "No History Yet" })
    ).toBeVisible();
  });
});
