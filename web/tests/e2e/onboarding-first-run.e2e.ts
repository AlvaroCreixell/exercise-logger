import { test, expect } from "@playwright/test";
import {
  E2E_ROUTINE_YAML,
  readStubbedClipboard,
  resetAppState,
  stubClipboardAndWindowOpen,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding first-run happy path", () => {
  test("welcome → wizard → handoff → Today with name + new routine", async ({
    page,
  }) => {
    await resetAppState(page);
    await stubClipboardAndWindowOpen(page);

    // Fresh install — first-run gate redirects to /onboarding.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /your starter routine is ready/i })
    ).toBeVisible({ timeout: 15_000 });

    // Type name + Build personalized routine.
    await page.getByLabel(/your name/i).fill("Alvaro");
    await page.getByRole("button", { name: /build personalized routine/i }).click();

    // Step 1 — Goal. GoalStep uses ChipRow >5 → aria-pressed buttons.
    await page.getByRole("button", { name: /^Build muscle$/i }).click();

    // Step 2 — Experience. ChipWithDescription → click the label element.
    await page.locator('label[for="experience-Intermediate"]').click();

    // Step 3 — Restrictions: skip.
    await page.getByRole("button", { name: /all clear — skip/i }).click();

    // Step 4 — DaysPerWeek: 3.
    await page.locator('label[for="days-per-week-3"]').click();

    // Step 5 — SessionLength: 60 min.
    await page.locator('label[for="session-length-60"]').click();

    // Step 6 — DistinctDays: 3 (D10 — numbers only).
    await page.locator('label[for="distinct-days-3"]').click();

    // Step 7 — Equipment: Barbell + Dumbbells, then Next. ChipMulti → buttons.
    await page.getByRole("button", { name: /^barbell$/i }).click();
    await page.getByRole("button", { name: /^dumbbells$/i }).click();
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 8 — Priorities: skip.
    await page
      .getByRole("button", { name: /keep it balanced — skip/i })
      .click();

    // Step 9 — FavoritesAvoid: leave both blank, tap Next.
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 10 — Supersets: Yes. ChipWithDescription → click the label.
    await page.locator('label[for="supersets-Yes"]').click();

    // Step 11 — Cardio: Yes. ChipRow ≤5 → click the label.
    await page.locator('label[for="cardio-Yes"]').click();

    // Handoff screen — single page now.
    await expect(
      page.getByRole("heading", { name: /copy your prompt/i })
    ).toBeVisible({ timeout: 10_000 });

    // The prompt is visible by default.
    const promptArea = page.getByRole("textbox", { name: /generated prompt/i });
    await expect(promptArea).toBeVisible();
    const promptText = await promptArea.inputValue();
    expect(promptText).toContain("- Distinct training days desired: 3");

    // Copy is its own action.
    await page.getByRole("button", { name: /^copy prompt$/i }).click();
    const copied = await readStubbedClipboard(page);
    expect(copied).toContain("- Distinct training days desired: 3");

    // Open GPT is a real anchor.
    const gptLink = page.getByRole("link", { name: /open gpt/i });
    await expect(gptLink).toHaveAttribute("href", /chatgpt\.com/);
    await expect(gptLink).toHaveAttribute("target", "_blank");

    // Paste YAML and import.
    await page.getByRole("textbox", { name: /^yaml$/i }).fill(E2E_ROUTINE_YAML);
    await page.getByRole("button", { name: /import routine/i }).click();

    // Today.
    await expect(
      page.getByRole("heading", { name: "Hi, Alvaro." })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/E2E Test Routine/)).toBeVisible();
  });
});
