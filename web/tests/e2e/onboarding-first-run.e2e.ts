import { test, expect } from "@playwright/test";
import {
  E2E_ROUTINE_YAML,
  readLastOpenedUrl,
  readStubbedClipboard,
  resetAppState,
  stubClipboardAndWindowOpen,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding first-run happy path", () => {
  test("welcome → wizard → handoff Stage 1 → Stage 2 → Today with name + new routine", async ({
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

    // Stage 1 arrives.
    await expect(
      page.getByRole("heading", { name: /ready to build your routine/i })
    ).toBeVisible({ timeout: 10_000 });

    // Tap Stage-1 button.
    await page
      .getByRole("button", { name: /copy prompt & open gpt/i })
      .click();

    // Stage 2 heading.
    await expect(
      page.getByRole("heading", { name: /paste your routine/i })
    ).toBeVisible();

    // Clipboard assertions: D10 line present, no parenthetical.
    const copied = await readStubbedClipboard(page);
    expect(copied).toContain("- Primary goal: Build muscle");
    expect(copied).toContain("- Distinct training days desired: 3");
    expect(copied).not.toContain("Distinct training days desired: 3 (");
    expect(copied).toContain("- Available equipment: Barbell, Dumbbells");
    expect(copied).toContain("- Supersets: Yes — use them where they fit");

    // window.open URL check.
    const openedUrl = await readLastOpenedUrl(page);
    expect(openedUrl ?? "").toContain("chatgpt.com");

    // Paste YAML + Import.
    await page.getByRole("textbox", { name: /yaml/i }).fill(E2E_ROUTINE_YAML);
    await page.getByRole("button", { name: /import routine/i }).click();

    // Today — personalized greeting + new active routine.
    await expect(
      page.getByRole("heading", { name: "Hi, Alvaro." })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/E2E Test Routine|Upper|Lower/)).toBeVisible();
  });
});
