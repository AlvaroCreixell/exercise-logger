import { test, expect } from "@playwright/test";
import {
  completeQuestionnaire,
  mockAnthropicRoutine,
  resetAppState,
  seedLlmApiKey,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding first-run happy path", () => {
  test("welcome → wizard → generate → preview → Today with name + new routine", async ({
    page,
  }) => {
    await resetAppState(page);
    await mockAnthropicRoutine(page);

    // Fresh install — first-run gate redirects to /onboarding.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });

    // Type name + Build personalized routine.
    await page.getByLabel(/your name/i).fill("Alvaro");
    await page.getByRole("button", { name: /build personalized routine/i }).click();

    // Step 1 — Goal. GoalStep uses ChipRow >5 → aria-pressed buttons.
    await expect(
      page.getByRole("heading", { name: /What's your main goal/i })
    ).toBeVisible({ timeout: 10_000 });

    // Seed the API key while the app origin is loaded, before the
    // questionnaire's final Next fires the navigation to
    // /onboarding/generate — so the generate screen starts already keyed.
    await seedLlmApiKey(page);

    await completeQuestionnaire(page);

    // Generate → preview.
    await expect(page.getByText("E2E Test Plan")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /use this routine/i }).click();

    // Today.
    await expect(
      page.getByRole("heading", { name: "Hi, Alvaro." })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/E2E Test Plan/)).toBeVisible();
  });
});
