import { test, expect } from "@playwright/test";
import {
  resetAppState,
  skipOnboardingIfShown,
} from "./helpers/onboarding-helpers";

/**
 * A minimal single-day routine containing one barbell weight exercise.
 * Used to seed a session that can be finished and inspected in history.
 */
const WEIGHT_ROUTINE_YAML = `version: 1
name: "Link E2E Routine"
rest_default_sec: 60
rest_superset_sec: 30
day_order: [A]

days:
  A:
    label: "Strength Day"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [5, 8], count: 1 }
`;

test.describe("Exercise history link — D1 end-to-end (F7 closure)", () => {
  test("clicking exercise name on session-detail card navigates to /history/exercise/:exerciseId and renders the screen", async ({
    page,
  }) => {
    // ── Step A: Fresh DB so this test is self-contained ─────────────────────
    // resetAppState registers an addInitScript that deletes ExerciseLoggerDB
    // before every full page load. page.goto is called exactly once (at "/")
    // so the script runs only once; all subsequent navigation is SPA-only
    // (React Router link clicks) and does NOT trigger addInitScript again.
    await resetAppState(page);

    // ── Step B: Boot the app, skip onboarding ───────────────────────────────
    await page.goto("/");
    await expect(page.getByText("Loading...")).toBeHidden({ timeout: 10_000 });
    await skipOnboardingIfShown(page);

    // ── Step C: Import a weight routine via Settings → Import ────────────────
    // Use SPA navigation so addInitScript does NOT fire and wipe the DB.
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: /settings/i })
      .click();

    await expect(
      page.getByText(/import routine.*yaml/i)
    ).toBeVisible({ timeout: 5_000 });
    await page.getByText(/import routine.*yaml/i).click();

    await expect(
      page.getByRole("heading", { name: /import routine/i })
    ).toBeVisible({ timeout: 5_000 });

    await page.locator("#routine-yaml-paste").fill(WEIGHT_ROUTINE_YAML);

    const importButton = page.getByRole("button", {
      name: /import and activate routine/i,
    });
    await expect(importButton).toBeEnabled({ timeout: 5_000 });
    await importButton.click();

    // After successful import the app navigates back to /settings via
    // React Router (SPA navigation — DB stays intact).
    await expect(page).toHaveURL(/\/settings$/, { timeout: 12_000 });

    // ── Step D: Navigate to Today and start the workout ─────────────────────
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: /today/i })
      .click();
    await expect(page.getByText(/start workout/i)).toBeVisible({
      timeout: 8_000,
    });
    await page.getByText(/start workout/i).click();

    // Wait for the workout screen to render.
    await expect(
      page.getByRole("button", { name: /finish workout/i })
    ).toBeVisible({ timeout: 5_000 });

    // ── Step E: Log a set ────────────────────────────────────────────────────
    // Open the SetLogSheet for the first (and only) set.
    const firstSetRow = page.getByRole("button", { name: /^Set 1:/ }).first();
    await expect(firstSetRow).toBeVisible({ timeout: 5_000 });
    await firstSetRow.click();

    // Numeric keypad should appear (weight exercise).
    const keypad = page.getByRole("group", { name: /numeric keypad/i });
    await expect(keypad).toBeVisible({ timeout: 3_000 });

    // For a first-session weight exercise the sheet pre-fills weight="0" and
    // reps from block.minValue (5). Both fields have valid values, so we can
    // save immediately without additional input.
    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Sheet closes.
    await expect(keypad).toBeHidden({ timeout: 3_000 });

    // ── Step F: Finish the workout ───────────────────────────────────────────
    // When all sets are logged the footer button reads "Finish workout ✓";
    // when sets are still pending it reads "Finish workout". The regex matches
    // both variants by not anchoring on the end of the string.
    await page.getByRole("button", { name: /finish workout/i }).click();

    const dialogFinish = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /finish workout/i });
    await expect(dialogFinish).toBeVisible({ timeout: 3_000 });
    await dialogFinish.click();

    // Celebration screen appears briefly, then auto-navigates to Today.
    await expect(page.getByText(/Well done/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/exercise-logger\/?$/, { timeout: 5_000 });

    // ── Step G: Open History → tap the finished session ─────────────────────
    await page.getByRole("link", { name: /history/i }).click();

    const sessionLink = page.locator("a[href*='/history/']").first();
    await expect(sessionLink).toBeVisible({ timeout: 5_000 });
    await sessionLink.click();

    // Wait for session detail to render (exercise card visible).
    await expect(
      page.getByText(/Barbell Back Squat/i)
    ).toBeVisible({ timeout: 5_000 });

    // ── Step H: Click the exercise name link ─────────────────────────────────
    // SessionDetailExerciseCard renders the exercise name as a React Router
    // <Link to="/history/exercise/:exerciseId">. Clicking it navigates via
    // SPA routing — no full page load, DB stays intact.
    const exerciseLink = page.getByRole("link", { name: /Barbell Back Squat/i });
    await expect(exerciseLink).toBeVisible({ timeout: 5_000 });
    await exerciseLink.click();

    // ── Step I: Assert URL changed to /history/exercise/:exerciseId ──────────
    await expect(page).toHaveURL(
      /\/exercise-logger\/history\/exercise\/barbell-back-squat$/,
      { timeout: 8_000 }
    );

    // ── Step J: Assert the destination screen renders ─────────────────────────
    // ExerciseHistoryScreen renders an <h1> with the exercise name (looked up
    // from Dexie) and at least one session group (the session we just logged).
    await expect(
      page.getByRole("heading", { level: 1, name: /Barbell Back Squat/i })
    ).toBeVisible({ timeout: 5_000 });

    // The session group section header shows the date, day label, and routine
    // name snapshot — "Strength Day" from our YAML is enough to confirm a group
    // rendered.
    await expect(page.getByText(/Strength Day/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
