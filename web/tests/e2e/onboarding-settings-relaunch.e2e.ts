import { test, expect } from "@playwright/test";
import {
  completeQuestionnaire,
  mockAnthropicRoutine,
  resetAppState,
  seedLlmApiKey,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding relaunch from Settings", () => {
  test("skipped user → Settings → Create a personalized routine → mocked generation", async ({
    page,
  }) => {
    await resetAppState(page);
    await mockAnthropicRoutine(page);

    // Fresh install lands on the welcome screen; take the real "Use starter routine"
    // path so onboardingSkippedAt is set via the app itself. We cannot use
    // a seeded-settings helper here because resetAppState's addInitScript
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

    // Tap "Create a personalized routine" — navigates straight to the
    // questionnaire, no confirm dialog.
    await page
      .getByRole("button", { name: /create a personalized routine/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /What's your main goal/i })
    ).toBeVisible({ timeout: 10_000 });

    // Seed the API key while the app origin is loaded, before the
    // questionnaire's final Next fires the navigation to
    // /onboarding/generate — so the generate screen starts already keyed.
    await seedLlmApiKey(page);

    await completeQuestionnaire(page);

    // Generate → preview → accept.
    await expect(page.getByText("E2E Test Plan")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /use this routine/i }).click();

    // Today: default "Hello." because this user didn't set a name.
    await expect(page.getByRole("heading", { name: "Hello." })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/E2E Test Plan/)).toBeVisible();
  });
});
