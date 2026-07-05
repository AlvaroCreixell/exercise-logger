import { test, expect } from "@playwright/test";
import {
  resetAppState,
  stubClipboardAndWindowOpen,
} from "./helpers/onboarding-helpers";

const SHARED_MESSAGE = `Here's your routine!

\`\`\`yaml
version: 1
name: "Shared Routine"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]

days:
  A:
    label: "Full Body"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 10], count: 3 }
\`\`\`

Enjoy your training!`;

test.describe("Share-to-import — Android share sheet path", () => {
  test("shared ChatGPT message lands on import prefilled with clean YAML and imports", async ({
    page,
  }) => {
    await resetAppState(page);

    // Simulate the share sheet: Android opens the share_target action URL
    // with the shared text in the query string. baseURL has no trailing
    // slash, so leading-slash paths resolve to the host root — spell out the
    // app base explicitly.
    await page.goto(
      `/exercise-logger/share-target?text=${encodeURIComponent(SHARED_MESSAGE)}`,
    );

    // Redirects to the import screen with the fenced block unwrapped.
    await expect(page).toHaveURL(/\/settings\/import$/, { timeout: 15_000 });
    const textarea = page.locator("#routine-yaml-paste");
    await expect(textarea).toBeVisible({ timeout: 10_000 });
    const value = await textarea.inputValue();
    expect(value).toContain('name: "Shared Routine"');
    expect(value).not.toContain("```");
    expect(value).not.toContain("Enjoy your training");

    // Import activates the routine.
    const importButton = page.getByRole("button", {
      name: /import and activate routine/i,
    });
    await expect(importButton).toBeEnabled({ timeout: 10_000 });
    await importButton.click();
    await expect(page).toHaveURL(/\/settings$/, { timeout: 12_000 });
    await expect(page.getByText(/imported and activated/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("Paste from clipboard fills the textarea with unwrapped YAML", async ({
    page,
  }) => {
    await resetAppState(page);
    await stubClipboardAndWindowOpen(page);

    await page.goto("/exercise-logger/settings/import");
    await expect(page.locator("#routine-yaml-paste")).toBeVisible({
      timeout: 15_000,
    });

    // Preload the stubbed clipboard with a fenced ChatGPT-style message.
    await page.evaluate(async (text) => {
      await navigator.clipboard.writeText(text);
    }, SHARED_MESSAGE);

    await page.getByRole("button", { name: /paste from clipboard/i }).click();
    const value = await page.locator("#routine-yaml-paste").inputValue();
    expect(value).toContain('name: "Shared Routine"');
    expect(value).not.toContain("```");
  });
});
