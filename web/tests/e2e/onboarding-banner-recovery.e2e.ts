import { test, expect } from "@playwright/test";
import {
  resetAppState,
  seedCompletedPrompt,
  seedSkippedUser,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding banner recovery", () => {
  test("banner shows → tap → Stage 2; dismiss persists; fresh prompt re-shows", async ({
    page,
  }) => {
    // Guard: `resetAppState` deletes the Dexie DB via an init script that
    // re-fires on every `page.reload()`. That would wipe the data we seed
    // for this test. Register a wrapper around `IDBFactory.deleteDatabase`
    // FIRST (init scripts run in registration order) so that, once we flag
    // the page as "booted", later reloads skip the deletion and our seeded
    // settings persist across reload.
    await page.addInitScript(() => {
      const realDelete = IDBFactory.prototype.deleteDatabase;
      IDBFactory.prototype.deleteDatabase = function (
        this: IDBFactory,
        name: string,
      ) {
        if (sessionStorage.getItem("e2e:banner-recovery:booted") === "1") {
          return {
            onsuccess: null,
            onerror: null,
            onblocked: null,
            onupgradeneeded: null,
          } as unknown as IDBOpenDBRequest;
        }
        return realDelete.call(this, name);
      };
    });
    await resetAppState(page);

    // Boot once. Waiting for the welcome heading confirms `useAppInit` has
    // finished (settings row created, starter routine activated) before we
    // overwrite the settings row below.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /What should we call you/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Lock the DB: subsequent reloads must NOT wipe our seeded state.
    await page.evaluate(() =>
      sessionStorage.setItem("e2e:banner-recovery:booted", "1"),
    );
    await seedSkippedUser(page);
    await seedCompletedPrompt(page, "SAVED PROMPT CONTENT\n\nDummy body.");

    // The first-run gate navigated us to /onboarding. After seeding
    // `onboardingSkippedAt`, navigate explicitly to the app root so the
    // gate lets us through to Today. Use the full base path because the
    // preview server only serves the app at `/exercise-logger/`.
    await page.goto("/exercise-logger/");

    // Today — banner visible.
    await expect(page.getByRole("status")).toBeVisible({ timeout: 15_000 });

    // Tap the banner body → Stage 2.
    await page
      .getByRole("button", { name: /paste your routine yaml/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /paste your routine/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Reload on Stage 2 — persists because lastGeneratedPrompt !== null.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /paste your routine/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Back to Today, dismiss the banner.
    await page.getByRole("link", { name: "Today" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page.getByRole("button", { name: /dismiss banner/i }).click();
    await expect(page.getByRole("status")).toBeHidden();

    // Dismissal persists across reload. We goto() the explicit base path
    // instead of reload() because the Today link resolves to a
    // no-trailing-slash URL the preview server doesn't serve directly.
    await page.goto("/exercise-logger/");
    await expect(page.getByRole("heading", { name: /hello/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("status")).toBeHidden();

    // Seed a fresh prompt — banner re-shows (seedCompletedPrompt resets the
    // onboardingBannerDismissedAt field as part of its write).
    await seedCompletedPrompt(page, "NEW SAVED PROMPT");
    await page.goto("/exercise-logger/");
    await expect(page.getByRole("status")).toBeVisible({ timeout: 10_000 });
  });
});
