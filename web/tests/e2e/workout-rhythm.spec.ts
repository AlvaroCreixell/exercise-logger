import { test, expect, type Page } from "@playwright/test";
import {
  resetAppState,
  skipOnboardingIfShown,
} from "./helpers/onboarding-helpers";

/**
 * One day: a standalone bench block (2 sets) plus a squat/row superset
 * (2 sets each). Exercise IDs are from the bundled catalog.
 */
const RHYTHM_ROUTINE_YAML = `version: 1
name: "Rhythm E2E Routine"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]

days:
  A:
    label: "Rhythm Day"
    entries:
      - exercise_id: barbell-bench-press
        sets:
          - { reps: [6, 10], count: 2 }
      - superset:
          - exercise_id: barbell-back-squat
            sets:
              - { reps: [6, 10], count: 2 }
          - exercise_id: barbell-row
            sets:
              - { reps: [6, 10], count: 2 }
`;

/** Import the rhythm routine via Settings (SPA navigation) and start Day A. */
async function importRoutineAndStartWorkout(page: Page): Promise<void> {
  await resetAppState(page);
  await page.goto("/");
  await expect(page.getByText("Loading...")).toBeHidden({ timeout: 10_000 });
  await skipOnboardingIfShown(page);

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: /settings/i })
    .click();
  await expect(page.getByText(/import routine.*yaml/i)).toBeVisible({
    timeout: 5_000,
  });
  await page.getByText(/import routine.*yaml/i).click();
  await expect(
    page.getByRole("heading", { name: /import routine/i })
  ).toBeVisible({ timeout: 5_000 });
  await page.locator("#routine-yaml-paste").fill(RHYTHM_ROUTINE_YAML);
  const importButton = page.getByRole("button", {
    name: /import and activate routine/i,
  });
  await expect(importButton).toBeEnabled({ timeout: 5_000 });
  await importButton.click();
  await expect(page).toHaveURL(/\/settings$/, { timeout: 12_000 });

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: /today/i })
    .click();
  await expect(page.getByText(/start workout/i)).toBeVisible({
    timeout: 8_000,
  });
  await page.getByText(/start workout/i).click();
  await expect(page).toHaveURL(/\/workout$/, { timeout: 8_000 });
}

/** Log the given empty set row (by locator) with reps=8 via the sheet. */
async function logRepsViaSheet(
  page: Page,
  rowButton: ReturnType<Page["getByRole"]>
): Promise<void> {
  await rowButton.click();
  await expect(page.getByRole("dialog").getByRole("heading")).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole("button", { name: "Reps value" }).click();
  await page
    .getByRole("group", { name: "Numeric keypad" })
    .getByRole("button", { name: "8" })
    .click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5_000 });
}

test.describe("Workout rhythm — rest timer, superset flow, cancel, extra sets", () => {
  test("rest timer after a normal set; superset timer only after B1; contextual extra set", async ({
    page,
  }) => {
    await importRoutineAndStartWorkout(page);

    // Round rail renders with A1 up next before any logging.
    await expect(
      page.getByText(/alternate a then b before resting/i)
    ).toBeVisible({ timeout: 8_000 });
    await expect(page.getByLabel("A1 up next")).toBeVisible();

    // No extra-set control anywhere while all blocks are incomplete.
    await expect(
      page.getByRole("button", { name: /^add extra set/i })
    ).toHaveCount(0);

    // 1. Log bench set 1 — default rest timer appears (90s → 1:3x/1:29).
    await logRepsViaSheet(
      page,
      page.getByRole("button", { name: /^Set 1: empty, tap to log/i }).first()
    );
    await expect(page.getByText("Rest — Barbell Bench Press")).toBeVisible({
      timeout: 5_000,
    });

    // Skip clears it.
    await page.getByRole("button", { name: /skip/i }).click();
    await expect(page.getByText("Rest — Barbell Bench Press")).toBeHidden();

    // 2. Superset A1 (squat, side A) — no timer yet.
    const sideA = page.locator('[data-superset-side="A"]');
    const sideB = page.locator('[data-superset-side="B"]');
    await logRepsViaSheet(
      page,
      sideA.getByRole("button", { name: /^Set 1: empty, tap to log/i })
    );
    await expect(page.getByText(/^Rest — /)).toHaveCount(0);

    // 3. Superset B1 (row, side B) — round 1 completes, superset timer starts.
    await logRepsViaSheet(
      page,
      sideB.getByRole("button", { name: /^Set 1: empty, tap to log/i })
    );
    await expect(page.getByText("Rest — Superset round 1")).toBeVisible({
      timeout: 5_000,
    });
    // Rail now points at A2.
    await expect(page.getByLabel("A2 up next")).toBeVisible();
    await expect(page.getByLabel("A1 complete")).toBeVisible();
    await expect(page.getByLabel("B1 complete")).toBeVisible();

    // 4. Complete the bench block — its Extra set control appears (exactly one).
    await logRepsViaSheet(
      page,
      page.getByRole("button", { name: /^Set 2: empty, tap to log/i }).first()
    );
    await expect(
      page.getByRole("button", { name: /^add extra set$/i })
    ).toHaveCount(1, { timeout: 5_000 });
    await expect(page.getByText(/^Extra set$/)).toBeVisible();
  });

  test("set sheet cancel closes without saving", async ({ page }) => {
    await importRoutineAndStartWorkout(page);

    const firstRow = page
      .getByRole("button", { name: /^Set 1: empty, tap to log/i })
      .first();
    await firstRow.click();
    await expect(page.getByRole("dialog").getByRole("heading")).toBeVisible({
      timeout: 5_000,
    });

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /cancel/i })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 5_000 });

    // Slot is still empty and no rest timer started.
    await expect(
      page.getByRole("button", { name: /^Set 1: empty, tap to log/i }).first()
    ).toBeVisible();
    await expect(page.getByText(/^Rest — /)).toHaveCount(0);
  });
});
