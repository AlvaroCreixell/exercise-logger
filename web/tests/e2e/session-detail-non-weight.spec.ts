import { test, expect } from "@playwright/test";
import {
  resetAppState,
  skipOnboardingIfShown,
} from "./helpers/onboarding-helpers";

/**
 * A minimal single-day routine containing only a bodyweight exercise
 * (Push-Up). The exercise type is inferred from the catalog entry
 * (Type = "Bodyweight"), so no type_override is needed.
 */
const BODYWEIGHT_ROUTINE_YAML = `version: 1
name: "Bodyweight E2E Routine"
rest_default_sec: 60
rest_superset_sec: 30
day_order: [A]

days:
  A:
    label: "Push Day"
    entries:
      - exercise_id: push-up
        sets:
          - { reps: [8, 15], count: 3 }
`;

test.describe("Session detail — non-weight set rendering (F3)", () => {
  test("a bodyweight reps-only set shows '12 reps' on session detail (was '—')", async ({
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

    // ── Step C: Import a bodyweight routine via Settings → Import ────────────
    // Use SPA navigation so addInitScript does NOT fire and wipe the DB.
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: /settings/i })
      .click();

    // Wait for Settings to render, then tap the "Import routine (YAML)" row.
    await expect(
      page.getByText(/import routine.*yaml/i)
    ).toBeVisible({ timeout: 5_000 });
    await page.getByText(/import routine.*yaml/i).click();

    // Import screen renders (no full page load).
    await expect(
      page.getByRole("heading", { name: /import routine/i })
    ).toBeVisible({ timeout: 5_000 });

    await page
      .locator("#routine-yaml-paste")
      .fill(BODYWEIGHT_ROUTINE_YAML);

    await page
      .getByRole("button", { name: /replace active routine/i })
      .click();

    // After successful import the app navigates back to /settings via
    // React Router (SPA navigation — DB stays intact).
    await expect(page).toHaveURL(/\/settings$/, { timeout: 8_000 });

    // ── Step D: Navigate to Today and start the workout ─────────────────────
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: /today/i })
      .click();
    await expect(page.getByText(/start workout/i)).toBeVisible({
      timeout: 8_000,
    });
    await page.getByText(/start workout/i).click();

    // ── Step E: Log a bodyweight reps-only set (reps = 12, no weight) ────────
    // The workout screen shows Push-Up as the only exercise.
    await expect(page.getByText(/finish workout/i)).toBeVisible({
      timeout: 5_000,
    });

    // Open the SetLogSheet for the first set.
    const firstSetRow = page.getByRole("button", { name: /^Set 1:/ }).first();
    await expect(firstSetRow).toBeVisible({ timeout: 5_000 });
    await firstSetRow.click();

    // For a bodyweight exercise the sheet opens with "Reps" as the active
    // field and pre-fills the block minValue (8). Clear it and enter 12.
    const keypad = page.getByRole("group", { name: /numeric keypad/i });
    await expect(keypad).toBeVisible({ timeout: 3_000 });

    // The reps ValueBox is already active — backspace to clear the prefill
    // (minValue = 8 is a single digit).
    const backspaceBtn = keypad.getByRole("button", { name: /backspace/i });
    await backspaceBtn.click();

    // Type 1 then 2 → "12".
    await keypad.getByRole("button", { name: /^1$/ }).click();
    await keypad.getByRole("button", { name: /^2$/ }).click();

    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Sheet closes; the set row should no longer say "empty".
    await expect(keypad).toBeHidden({ timeout: 3_000 });
    await expect(
      page.getByRole("button", { name: /^Set 1: (?!empty\b)/ }).first()
    ).toBeVisible();

    // ── Step F: Finish the workout ───────────────────────────────────────────
    await page.getByRole("button", { name: /^finish workout$/i }).click();

    const dialogFinish = page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^finish workout$/i });
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

    // Wait for session detail to load (the exercise card header is visible).
    await expect(page.getByText(/Push-Up/i)).toBeVisible({ timeout: 5_000 });

    // ── Step H: Assert the pill reads "12 reps" ──────────────────────────────
    // SessionDetailExerciseCard renders each LoggedSet as a <button> whose
    // text is formatLoggedSet(set, units). For a reps-only bodyweight set
    // with performedReps=12, this must be "12 reps" (not "—").
    const pill = page.getByRole("button", { name: /^12 reps$/ });
    await expect(pill).toBeVisible({ timeout: 5_000 });

    // ── Step I: Confirm "—" is not rendered as a pill label ─────────────────
    // Pre-Sprint-3 bug: formatPillContent returned "—" for non-weight sets.
    // The fixed formatter returns the actual value. Any pill with text "—"
    // would be a regression.
    const dashPill = page.getByRole("button", { name: "—" });
    await expect(dashPill).toHaveCount(0);
  });
});
