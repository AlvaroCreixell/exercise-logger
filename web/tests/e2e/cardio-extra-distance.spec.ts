import { test, expect } from "@playwright/test";
import {
  resetAppState,
  skipOnboardingIfShown,
} from "./helpers/onboarding-helpers";

/**
 * A minimal single-day routine with one weight exercise.
 * The cardio exercise (Rowing machine) is added as an extra mid-session,
 * not from the routine — this exercises the cardio-extra code path.
 */
const WEIGHT_ROUTINE_YAML = `version: 1
name: "Cardio E2E Routine"
rest_default_sec: 60
rest_superset_sec: 30
day_order: [A]

days:
  A:
    label: "Workout Day"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [5, 8], count: 3 }
`;

test.describe("Cardio extra — distance-only logging (F5)", () => {
  test("user can save a cardio extra with only distance entered (no duration required)", async ({
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

    await page
      .locator("#routine-yaml-paste")
      .fill(WEIGHT_ROUTINE_YAML);

    // Wait for button to be enabled before clicking.
    const importButton = page.getByRole("button", { name: /import and activate routine/i });
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

    // Wait for the workout screen to render (Finish Workout button visible).
    await expect(page.getByRole("button", { name: /finish workout/i })).toBeVisible({
      timeout: 5_000,
    });

    // ── Step E: Tap "+ Exercise" to open ExercisePicker ─────────────────────
    // WorkoutFooter renders the button with text "Add exercise".
    await page.getByRole("button", { name: /add exercise/i }).click();

    // ExercisePicker sheet opens — verify it is visible.
    await expect(
      page.getByRole("heading", { name: /pick an exercise/i })
    ).toBeVisible({ timeout: 5_000 });

    // ── Step F: Search for and pick "Rowing machine" (type=Cardio) ──────────
    // The picker has a search input with aria-label "Search exercises".
    await page
      .getByLabel("Search exercises")
      .fill("Rowing");

    // ExercisePicker renders each exercise as a button with aria-label = ex.name.
    // "Rowing machine" is the exact display name in catalog.csv (slug: rowing-machine).
    await page
      .getByRole("button", { name: /^Rowing machine$/i })
      .click();

    // After picking, ExercisePicker closes and addExtraExercise runs. The
    // Rowing machine card appears in the workout screen — the user must then
    // tap the empty set row to open the SetLogSheet.
    // Wait for the picker to fully close and the Rowing machine heading to appear.
    await expect(page.getByRole("heading", { name: /^Rowing machine$/i })).toBeVisible({
      timeout: 5_000,
    });

    // The workout screen now has two cards: Barbell Back Squat (3 sets) and
    // Rowing machine (1 extra slot). Routine rows always carry a hint suffix
    // (history or the prescription, e.g. "…tap to log, 5–8 reps"), so the
    // EXACT label "Set 1: empty, tap to log" matches only the extra's row.
    const rowingSetRow = page.getByRole("button", {
      name: /^Set 1: empty, tap to log$/,
    });
    await expect(rowingSetRow).toBeVisible({ timeout: 3_000 });
    await rowingSetRow.click();

    // ── Step G: Verify the SetLogSheet opens for "Rowing machine" ───────────
    // The sheet title is the exercise name snapshot.
    await expect(
      page.getByRole("dialog").getByText(/Rowing machine/i)
    ).toBeVisible({ timeout: 5_000 });

    // Both duration AND distance fields are visible for cardio extras
    // (isCardioExtra = true in SetLogSheet).
    await expect(page.locator("#duration")).toBeVisible({ timeout: 3_000 });
    await expect(page.locator("#distance")).toBeVisible({ timeout: 3_000 });

    // ── Step H: Enter distance = 1000, leave duration empty ─────────────────
    // The distance field is a native <Input> (not keypad-driven).
    const distanceInput = page.locator("#distance");
    await distanceInput.fill("1000");

    // Duration is intentionally left empty (blank) to verify the F5 fix.

    // ── Step I: Tap Save ─────────────────────────────────────────────────────
    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // ── Step J: Assert the validator toast does NOT appear ───────────────────
    // Pre-F5-fix: the validator required duration for cardio extras and would
    // toast "Enter at least duration or distance to save." when only distance
    // was provided. Post-fix: distance alone is sufficient.
    const errorToast = page.getByText(/Enter at least/);
    await expect(errorToast).toHaveCount(0);

    // ── Step K: Assert the SetLogSheet closed ────────────────────────────────
    // On successful save, onOpenChange(false) is called and the sheet hides.
    await expect(page.locator("#distance")).toBeHidden({ timeout: 3_000 });

    // ── Step L: Assert the set is rendered on the workout card with "1000m" ──
    // SetRow renders the logged set as an aria-labeled button.
    // formatLoggedSetParts: performedDistanceM=1000 → primary="1000", unit="m"
    // aria-label = "Set 1: 1000m"
    const setRow = page.getByRole("button", { name: /Set 1: 1000m/ });
    await expect(setRow).toBeVisible({ timeout: 5_000 });
  });
});
