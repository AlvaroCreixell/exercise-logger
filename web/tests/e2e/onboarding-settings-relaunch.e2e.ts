import { test, expect } from "@playwright/test";
import {
  E2E_ROUTINE_YAML,
  resetAppState,
  stubClipboardAndWindowOpen,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding relaunch from Settings", () => {
  test("skipped user → Settings → Create a personalized routine → import", async ({
    page,
  }) => {
    await resetAppState(page);
    await stubClipboardAndWindowOpen(page);

    // Fresh install lands on the welcome screen; take the real "Use starter routine"
    // path so onboardingSkippedAt is set via the app itself. We cannot use
    // the seedSkippedUser helper here because resetAppState's addInitScript
    // fires on every navigation and would wipe the DB on reload.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /use starter routine/i }).click();

    // The gate at "/" may race with useLiveQuery after Use starter routine bounces
    // through location.pathname === "/". Wait until the DB has persisted
    // onboardingSkippedAt, then land on Today via the nav link.
    await expect
      .poll(
        async () =>
          await page.evaluate(
            () =>
              new Promise<string | null>((resolve) => {
                const req = indexedDB.open("ExerciseLoggerDB");
                req.onsuccess = () => {
                  const db = req.result;
                  const tx = db.transaction("settings", "readonly");
                  const g = tx.objectStore("settings").get("user");
                  g.onsuccess = () => {
                    const cur = g.result as
                      | { onboardingSkippedAt?: string | null }
                      | undefined;
                    resolve(cur?.onboardingSkippedAt ?? null);
                  };
                  g.onerror = () => resolve(null);
                };
              })
          ),
        { timeout: 10_000 }
      )
      .not.toBeNull();

    // Land on Today via the Today nav link (bypasses the /-gate race — the
    // nav target is "/exercise-logger" which React Router treats as "/",
    // but by now useLiveQuery has the fresh settings so the gate no-ops).
    await page.getByRole("link", { name: "Today" }).click();
    await expect(
      page.getByRole("heading", { name: "Hello." })
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to Settings.
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(
      page.getByRole("heading", { name: /settings/i })
    ).toBeVisible();

    // Tap "Create a personalized routine".
    await page
      .getByRole("button", { name: /create a personalized routine/i })
      .click();

    // Wizard step 1 — Goal (ChipRow >5 → buttons).
    await expect(
      page.getByRole("heading", { name: /What's your main goal/i })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /^Build muscle$/i }).click();

    // Step 2 — Experience (ChipWithDescription — label click).
    await page.locator('label[for="experience-Beginner"]').click();

    // Step 3 — Restrictions: skip.
    await page.getByRole("button", { name: /all clear — skip/i }).click();

    // Step 4 — DaysPerWeek: 2.
    await page.locator('label[for="days-per-week-2"]').click();

    // Step 5 — SessionLength: 30 min.
    await page.locator('label[for="session-length-30"]').click();

    // Step 6 — DistinctDays: 1.
    await page.locator('label[for="distinct-days-1"]').click();

    // Step 7 — Equipment: Bodyweight only (ChipMulti exclusive), then Next.
    await page.getByRole("button", { name: /^bodyweight only$/i }).click();
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 8 — Priorities: skip.
    await page
      .getByRole("button", { name: /keep it balanced — skip/i })
      .click();

    // Step 9 — FavoritesAvoid: blank, Next.
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 10 — Supersets: "No supersets" (value "No").
    await page.locator('label[for="supersets-No"]').click();

    // Step 11 — Cardio: "No cardio" (value "No").
    await page.locator('label[for="cardio-No"]').click();

    // Single-screen handoff arrives.
    await expect(
      page.getByRole("heading", { name: /copy your prompt/i })
    ).toBeVisible({ timeout: 10_000 });

    // Paste YAML and import (no separate Stage 1 button).
    await page.getByRole("textbox", { name: /^yaml$/i }).fill(E2E_ROUTINE_YAML);
    await page.getByRole("button", { name: /import routine/i }).click();

    // Today: default "Hello." because this user didn't set a name.
    await expect(page.getByRole("heading", { name: "Hello." })).toBeVisible({
      timeout: 10_000,
    });
  });
});
