import { test, expect } from "@playwright/test";
import { resetAppState } from "./helpers/onboarding-helpers";

test.describe("Cold install activation — starter routine to first logged set", () => {
  test("welcome → use starter → Today → start workout → log first set", async ({
    page,
  }) => {
    await resetAppState(page);
    const start = Date.now();

    // 1. Cold install lands on welcome with no nav.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("navigation", { name: /main navigation/i })
    ).toBeHidden();
    await expect(page.getByText(/Full Body 3-Day Rotation/)).toBeVisible();

    // 2. Use starter routine.
    await page.getByRole("button", { name: /use starter routine/i }).click();

    // 3. Today shows active routine context + start CTA.
    await expect(page.getByRole("heading", { name: /Hello\./i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByText(/Active routine: Full Body 3-Day Rotation/i)
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: /main navigation/i })
    ).toBeVisible();

    // 4. Start workout.
    await page.getByRole("button", { name: /start workout/i }).click();
    await expect(page).toHaveURL(/\/workout$/);

    // 5. Log first set.
    //
    // The starter routine Day A begins with "Barbell Back Squat" — a weight+reps
    // exercise. The first set row renders as an empty-state button:
    //   aria-label="Set 1: empty, tap to log"
    //
    // Clicking it opens the SetLogSheet (bottom sheet). On a cold first session,
    // the weight field is pre-filled as "0" and the reps field is empty.
    // activeField defaults to "weight".
    //
    // Strategy: focus the Reps ValueBox (aria-label "Reps value"), enter "8"
    // via the Numeric keypad, then click Save.  This produces a logged set that
    // the row re-renders as aria-label "Set 1: 8 …".

    // Open the log sheet for Set 1.
    // Multiple exercises on the workout screen each have a "Set 1: empty, tap to log"
    // button. We want the very first one (barbell-back-squat, the first exercise in
    // Day A of the starter routine).
    await page
      .getByRole("button", { name: /^Set 1: empty, tap to log/i })
      .first()
      .click();

    // Wait for the sheet to be visible (exercise name appears in the sheet header).
    await expect(
      page.getByRole("dialog").getByRole("heading")
    ).toBeVisible({ timeout: 5_000 });

    // Focus the Reps field so keypad drives reps not weight.
    await page.getByRole("button", { name: "Reps value" }).click();

    // Enter "8" on the numeric keypad (scoped to keypad group to avoid
    // accidentally matching a stale "8" elsewhere in the page).
    const keypad = page.getByRole("group", { name: "Numeric keypad" });
    await keypad.getByRole("button", { name: "8" }).click();

    // Save the set.
    await page.getByRole("button", { name: "Save" }).click();

    // Sheet should close; assert the row now shows the logged value.
    // weight=0 + reps=8 → formatLoggedSetParts produces primary="0", unit="kg",
    // secondary="8". SetRow aria-label: "Set 1: 0kg × 8".
    // Use .first() to avoid strict-mode violation (same label could exist on other
    // exercise cards for the same exercise if weights happen to match).
    await expect(
      page.getByRole("button", { name: /^Set 1: 0kg/i }).first()
    ).toBeVisible({ timeout: 5_000 });

    // 6. Telemetry — wall-clock time logged but NOT asserted in CI.
    const elapsedMs = Date.now() - start;
    console.log(`[activation] cold install → first logged set: ${elapsedMs}ms`);
  });
});
