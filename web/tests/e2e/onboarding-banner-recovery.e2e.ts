import { test, expect } from "@playwright/test";

test.describe("Onboarding banner recovery", () => {
  test("banner shows for in-progress wizard state → tap resumes questionnaire; dismiss persists", async ({
    page,
  }) => {
    // Guard: unlike the shared `resetAppState` helper, this test's recovery
    // signal is the wizard's sessionStorage state (not a Dexie field), and
    // this test deliberately navigates away from the chrome-free onboarding
    // routes back to Today via `page.goto()` — a real navigation that would
    // re-run any init script. So we can't reuse `resetAppState` (it
    // unconditionally deletes the DB *and* clears the wizard sessionStorage
    // key on every navigation, which would wipe both the settings we rely on
    // and the in-progress answers we're trying to recover). Instead: wipe
    // once on the very first load, then no-op on every subsequent navigation
    // once a "booted" flag is set.
    const BOOT_FLAG = "e2e:banner-recovery:booted";
    await page.addInitScript(
      (flag) => {
        if (sessionStorage.getItem(flag) === "1") return;
        try {
          indexedDB.deleteDatabase("ExerciseLoggerDB");
        } catch {
          /* ignore */
        }
        try {
          sessionStorage.removeItem("exercise-logger:onboarding:in-progress");
        } catch {
          /* ignore */
        }
      },
      BOOT_FLAG
    );

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });

    // Lock: subsequent navigations must not wipe our state.
    await page.evaluate((flag) => sessionStorage.setItem(flag, "1"), BOOT_FLAG);

    await page.getByRole("button", { name: /use starter routine/i }).click();
    await expect(page.getByRole("heading", { name: /hello/i })).toBeVisible({
      timeout: 10_000,
    });

    // No wizard state yet → no banner.
    await expect(page.getByRole("status")).toBeHidden();

    // Start (but don't finish) the personalized-routine wizard — this writes
    // in-progress wizard state to sessionStorage.
    await page.getByRole("link", { name: "Settings" }).click();
    await page
      .getByRole("button", { name: /create a personalized routine/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /What's your main goal/i })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /^Build muscle$/i }).click();
    await expect(
      page.getByRole("heading", { name: /how experienced/i })
    ).toBeVisible({ timeout: 5_000 });

    // Back to Today. Onboarding routes render under a chrome-free layout, so
    // there's no nav link to use — navigate explicitly.
    await page.goto("/exercise-logger/");
    await expect(page.getByRole("status")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/finish setting up your routine/i)
    ).toBeVisible();

    // Tap the banner → resumes the questionnaire at the saved step.
    await page
      .getByRole("button", { name: /finish setting up your routine/i })
      .click();
    await expect(page).toHaveURL(/\/onboarding\/questionnaire/);
    await expect(
      page.getByRole("heading", { name: /how experienced/i })
    ).toBeVisible({ timeout: 10_000 });

    // Back to Today, dismiss.
    await page.goto("/exercise-logger/");
    await expect(page.getByRole("status")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /dismiss banner/i }).click();
    await expect(page.getByRole("status")).toBeHidden();

    // Dismissal persists across reload.
    await page.goto("/exercise-logger/");
    await expect(page.getByRole("heading", { name: /hello/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("status")).toBeHidden();
  });
});
