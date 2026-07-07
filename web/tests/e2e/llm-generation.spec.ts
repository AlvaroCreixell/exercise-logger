import { test, expect } from "@playwright/test";
import {
  completeQuestionnaire,
  mockAnthropicRoutine,
  resetAppState,
  seedLlmApiKey,
  MOCK_GENERATED_ROUTINE,
} from "./helpers/onboarding-helpers";

test.describe("LLM routine generation", () => {
  test("full flow: questionnaire → generate → preview → activate → Today", async ({
    page,
  }) => {
    await resetAppState(page);
    await mockAnthropicRoutine(page);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("button", { name: /build personalized routine/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /What's your main goal/i })
    ).toBeVisible({ timeout: 10_000 });

    // Seed the API key while the app origin is loaded, before the
    // questionnaire's final Next fires the navigation to
    // /onboarding/generate — so the generate screen starts already keyed.
    await seedLlmApiKey(page);

    await completeQuestionnaire(page);

    // On /onboarding/generate, already keyed → straight to generating → preview.
    await expect(page.getByText("E2E Test Plan")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /use this routine/i }).click();
    await expect(page).toHaveURL(/exercise-logger\/?$/);
    await expect(page.getByText("Full Body")).toBeVisible();
  });

  test("no key → key card appears, manual import escape hatch works", async ({
    page,
  }) => {
    await resetAppState(page);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("button", { name: /build personalized routine/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /What's your main goal/i })
    ).toBeVisible({ timeout: 10_000 });

    await completeQuestionnaire(page);

    await expect(
      page.getByText(/needs your Anthropic API key/i)
    ).toBeVisible({ timeout: 10_000 });
    await page
      .getByRole("link", { name: /import routine yaml manually/i })
      .click();
    await expect(page).toHaveURL(/settings\/import/);
  });

  test("invalid catalog id → repair loop exhausts → validation errors shown", async ({
    page,
  }) => {
    const bad = structuredClone(MOCK_GENERATED_ROUTINE);
    bad.days[0]!.entries[0]!.exercise!.exercise_id = "not-a-real-exercise";

    await resetAppState(page);
    await mockAnthropicRoutine(page, bad);

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("button", { name: /build personalized routine/i })
      .click();
    await expect(
      page.getByRole("heading", { name: /What's your main goal/i })
    ).toBeVisible({ timeout: 10_000 });

    await seedLlmApiKey(page);
    await completeQuestionnaire(page);

    await expect(
      page.getByText(/didn't pass validation|not-a-real-exercise/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
