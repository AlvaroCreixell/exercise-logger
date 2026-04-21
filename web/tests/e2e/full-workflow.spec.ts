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
    await expect(page.getByText(/routine/i).first()).toBeVisible();
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

    // Step 3: Log a set via the Sprint 11 keypad — weight 60, reps 10.
    const firstSetRow = page.getByRole("button", { name: /^Set 1:/ }).first();
    await expect(firstSetRow).toBeVisible({ timeout: 5000 });
    await firstSetRow.click();

    // Keypad is visible, weight ValueBox is active by default.
    const keypad = page.getByRole("group", { name: /numeric keypad/i });
    await expect(keypad).toBeVisible({ timeout: 3000 });

    // Type "60" for weight.
    await keypad.getByRole("button", { name: /^6$/ }).click();
    await keypad.getByRole("button", { name: /^0$/ }).click();

    // Switch to reps and type "10".
    await page.getByRole("button", { name: /reps value/i }).click();
    await keypad.getByRole("button", { name: /^1$/ }).click();
    await keypad.getByRole("button", { name: /^0$/ }).click();

    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Sheet should close and the Set 1 row should reflect the logged state.
    await expect(keypad).toBeHidden({ timeout: 3000 });
    await expect(
      page.getByRole("button", { name: /^Set 1: (?!empty\b)/ }).first(),
    ).toBeVisible();

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
    // Session row links to /history/{id} — the finished session should be listed.
    await expect(
      page.locator("a[href*='/history/']").first()
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
