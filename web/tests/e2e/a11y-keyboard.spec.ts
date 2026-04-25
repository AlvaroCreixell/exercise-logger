import { test, expect } from "@playwright/test";
import { resetAppState, skipOnboardingIfShown } from "./helpers/onboarding-helpers";

test.describe("Keyboard navigation", () => {
  test("bottom nav exposes all four tabs as keyboard-reachable links", async ({
    page,
  }) => {
    await resetAppState(page);
    await page.goto("/exercise-logger/");
    await skipOnboardingIfShown(page);
    const tabs = ["Today", "Workout", "History", "Settings"];
    for (const name of tabs) {
      const link = page.getByRole("link", { name });
      await expect(link).toBeVisible();
    }
    // Tab repeatedly and collect the accessible names of focused elements
    // until we land on the Settings link or exhaust a reasonable budget.
    const seen = new Set<string>();
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return "";
        return (
          el.getAttribute("aria-label") ??
          el.textContent?.trim() ??
          el.tagName.toLowerCase()
        );
      });
      if (active) seen.add(active);
      if (active.toLowerCase().includes("settings")) break;
    }
    // We don't pin the exact order — only that every nav label was reached.
    for (const name of tabs) {
      expect(Array.from(seen).some((s) => s.toLowerCase().includes(name.toLowerCase()))).toBe(true);
    }
  });

  test("settings screen is keyboard-reachable from the bottom nav", async ({
    page,
  }) => {
    await resetAppState(page);
    await page.goto("/exercise-logger/");
    await skipOnboardingIfShown(page);
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    // The Units toggle is a central Settings control — confirm keyboard focus
    // lands on one of the kg / lb pills via Tab.
    let focusedText = "";
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      focusedText = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el?.textContent?.trim() ?? "";
      });
      if (/^(kg|lb|lbs)$/i.test(focusedText)) break;
    }
    expect(focusedText).toMatch(/^(kg|lb|lbs)$/i);
  });

  test("import-routine textarea is keyboard-focusable", async ({ page }) => {
    await page.goto("/exercise-logger/settings/import");
    await expect(
      page.getByRole("heading", { name: /import routine/i }),
    ).toBeVisible();
    const ta = page.getByLabel(/paste yaml/i);
    await ta.focus();
    await ta.type("version: 1\n");
    expect(await ta.inputValue()).toContain("version: 1");
  });
});
