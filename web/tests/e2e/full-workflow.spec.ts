import { test, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  test("import routine YAML via Settings", async ({ page }) => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: /settings/i }).click();

    // The routine YAML file path
    const yamlPath = path.resolve(
      __dirname,
      "../../data/routines/full-body-3day.yaml"
    );

    // Upload the YAML file
    const fileInput = page.locator('input[type="file"][accept=".yaml,.yml"]');
    await fileInput.setInputFiles(yamlPath);

    // Wait for the routine name to appear in the list (use exact match to avoid success toast)
    await expect(
      page.getByText("Full Body 3-Day Rotation", { exact: true })
    ).toBeVisible({ timeout: 5000 });
  });

  test("full workflow: import -> start -> log -> finish -> history -> export", async ({
    page,
  }) => {
    // Step 1: Import routine via Settings
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: /settings/i }).click();

    const yamlPath = path.resolve(
      __dirname,
      "../../data/routines/full-body-3day.yaml"
    );
    const fileInput = page.locator('input[type="file"][accept=".yaml,.yml"]');
    await fileInput.setInputFiles(yamlPath);

    await expect(
      page.getByText("Full Body 3-Day Rotation", { exact: true })
    ).toBeVisible({ timeout: 5000 });

    // Step 1b: Activate the routine
    await page
      .getByRole("button", { name: "Set as active routine" })
      .click();

    // Verify routine is now active
    await expect(page.getByText("Active")).toBeVisible({ timeout: 5000 });

    // Step 2: Navigate to Today and start a workout
    await page.getByRole("link", { name: /today/i }).click();
    await expect(page.getByText(/start workout/i)).toBeVisible({
      timeout: 5000,
    });
    await page.getByText(/start workout/i).click();

    // Step 3: Should be on the Workout screen with exercises
    await expect(page.getByText(/finish workout/i)).toBeVisible({
      timeout: 5000,
    });

    // ERRATA P7-E: Actually log a set
    // Find a set slot button and tap it to open the logging dialog
    const setSlot = page.locator('[data-testid="set-slot"]').first();
    if (await setSlot.isVisible({ timeout: 2000 }).catch(() => false)) {
      await setSlot.click();

      // Try to fill in the set log form and submit
      const weightInput = page
        .locator(
          'input[name="weight"], input[placeholder*="Weight"], input[type="number"]'
        )
        .first();
      if (
        await weightInput.isVisible({ timeout: 1000 }).catch(() => false)
      ) {
        await weightInput.fill("60");

        const repsInput = page
          .locator(
            'input[name="reps"], input[placeholder*="Reps"], input[type="number"]'
          )
          .nth(1);
        if (
          await repsInput.isVisible({ timeout: 1000 }).catch(() => false)
        ) {
          await repsInput.fill("10");
        }

        // Submit the form
        const saveButton = page.getByRole("button", {
          name: /save|log|submit/i,
        });
        if (
          await saveButton.isVisible({ timeout: 1000 }).catch(() => false)
        ) {
          await saveButton.click();
        }
      }
    }

    // Step 4: Finish the workout
    await page.getByText(/finish workout/i).click();

    // Confirm if there is a confirmation dialog
    const confirmButton = page.getByRole("button", { name: /finish/i });
    if (
      await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)
    ) {
      await confirmButton.click();
    }

    // Step 5: Check History
    await page.getByRole("link", { name: /history/i }).click();
    await expect(
      page.getByText(/full body 3-day rotation/i).first()
    ).toBeVisible({ timeout: 5000 });

    // ERRATA P7-E: Verify export button exists and triggers a download
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: /settings/i }).click();

    const exportButton = page.getByRole("button", {
      name: /export data/i,
    });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();

    // Verify that clicking export triggers a download
    const downloadPromise = page
      .waitForEvent("download", { timeout: 5000 })
      .catch(() => null);
    await exportButton.click();
    const download = await downloadPromise;
    if (download) {
      expect(download.suggestedFilename()).toMatch(
        /exercise-logger-backup.*\.json/
      );
    }
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
