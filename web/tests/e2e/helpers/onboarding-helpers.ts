import type { Page } from "@playwright/test";

/** The bundled starter routine is seeded by useAppInit on first launch. */
export const STARTER_ROUTINE_NAME = "Full Body 3-Day Rotation";

/**
 * Delete the Dexie database and clear the wizard sessionStorage key BEFORE the
 * first page.goto in a test. Must be called before `page.goto(...)`.
 */
export async function resetAppState(page: Page): Promise<void> {
  await page.addInitScript(() => {
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
  });
}

/**
 * Install a stub `navigator.clipboard` and `window.open` before the app loads.
 * The stubbed clipboard is backed by a single in-memory string so tests can
 * read back what was written, and `window.open` records the URL it was
 * called with into `window.__lastOpenedUrl`.
 */
export async function stubClipboardAndWindowOpen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const buf: { v: string } = { v: "" };
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          buf.v = String(text);
        },
        readText: async () => buf.v,
      },
      configurable: true,
    });
    (window as unknown as { __lastOpenedUrl: string | null }).__lastOpenedUrl =
      null;
    window.open = (url?: string | URL) => {
      (window as unknown as { __lastOpenedUrl: string | null }).__lastOpenedUrl =
        url == null ? "" : String(url);
      return { closed: false } as Window;
    };
  });
}

/** Read back what the stubbed clipboard received. */
export async function readStubbedClipboard(page: Page): Promise<string> {
  return await page.evaluate(async () => navigator.clipboard.readText());
}

/** Read back the URL window.open was called with, or null. */
export async function readLastOpenedUrl(page: Page): Promise<string | null> {
  return await page.evaluate(
    () =>
      (window as unknown as { __lastOpenedUrl: string | null }).__lastOpenedUrl
  );
}

/**
 * Post-page.goto helper for tests that want to skip past the first-run
 * gate and land on Today. If the welcome screen is currently visible,
 * tap "Use starter routine" and wait until Today (or at least any non-welcome
 * content) has rendered. If the welcome screen isn't visible, this is a
 * no-op. Safe to call in every non-onboarding test's setup.
 */
export async function skipOnboardingIfShown(page: Page): Promise<void> {
  const welcomeHeading = page.getByRole("heading", {
    name: /your starter routine is ready/i,
  });
  // Wait for the app shell to finish initializing — either Loading goes away
  // and welcome appears, or Today renders directly (already skipped/completed).
  await page
    .getByText("Loading...")
    .waitFor({ state: "hidden", timeout: 10_000 })
    .catch(() => {
      /* Loading may never have been visible */
    });
  // NOTE: locator.isVisible() ignores its timeout option (returns immediately),
  // which raced the welcome render and randomly skipped the click. waitFor
  // actually waits.
  const welcomeShown = await welcomeHeading
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (welcomeShown) {
    await page.getByRole("button", { name: /use starter routine/i }).click();
    // Wait until the welcome screen is gone. The guard should redirect to /
    // once the skip flag propagates through useLiveQuery.
    await welcomeHeading.waitFor({ state: "hidden", timeout: 10_000 });
  }
}

/**
 * Walk all 11 questionnaire steps, starting from step 1 (Goal) and ending
 * once the final step's auto-advance navigates to `/onboarding/generate`.
 * Assumes the caller has already landed on step 1 — e.g. via the welcome
 * screen's "Build personalized routine" button, or Settings' "Create a
 * personalized routine" row.
 */
export async function completeQuestionnaire(page: Page): Promise<void> {
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

  // Step 7 — Equipment: Barbell + Dumbbells, then Next.
  await page.getByRole("button", { name: /^barbell$/i }).click();
  await page.getByRole("button", { name: /^dumbbells$/i }).click();
  await page.getByRole("button", { name: /^next$/i }).click();

  // Step 8 — Priorities: skip.
  await page.getByRole("button", { name: /keep it balanced — skip/i }).click();

  // Step 9 — FavoritesAvoid: leave both blank, tap Next.
  await page.getByRole("button", { name: /^next$/i }).click();

  // Step 10 — Supersets: Yes. ChipWithDescription → click the label.
  await page.locator('label[for="supersets-Yes"]').click();

  // Step 11 — Cardio: Yes. ChipRow ≤5 → click the label. Auto-advances to
  // /onboarding/generate since this is the last step.
  await page.locator('label[for="cardio-Yes"]').click();
}

/**
 * A schema-valid GeneratedRoutine payload using real catalog IDs. The
 * structured-outputs client parses the message's text content as JSON.
 */
export const MOCK_GENERATED_ROUTINE = {
  name: "E2E Test Plan",
  rest_default_sec: 90,
  rest_superset_sec: 60,
  days: [
    {
      id: "A",
      label: "Full Body",
      entries: [
        {
          kind: "exercise",
          exercise: {
            exercise_id: "barbell-back-squat",
            instance_label: null,
            notes: null,
            sets: [
              { target_kind: "reps", min_value: 5, max_value: 8, exact_value: null, count: 3, tag: null },
            ],
          },
        },
      ],
    },
  ],
  notes: [],
  cardio: null,
};

/** Intercept Anthropic's messages endpoint with a canned structured output. */
export async function mockAnthropicRoutine(
  page: Page,
  generated: unknown = MOCK_GENERATED_ROUTINE
): Promise<void> {
  await page.route("https://api.anthropic.com/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "msg_e2e_mock",
        type: "message",
        role: "assistant",
        model: "claude-haiku-4-5",
        content: [{ type: "text", text: JSON.stringify(generated) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    });
  });
}

/** Seed the API key straight into IndexedDB so tests skip the key card. */
export async function seedLlmApiKey(page: Page, key = "sk-ant-e2e-test"): Promise<void> {
  await page.evaluate(async (k) => {
    const openReq = indexedDB.open("ExerciseLoggerDB");
    await new Promise<void>((resolve, reject) => {
      openReq.onsuccess = () => {
        const idb = openReq.result;
        const tx = idb.transaction("settings", "readwrite");
        const store = tx.objectStore("settings");
        const getReq = store.get("user");
        getReq.onsuccess = () => {
          const record = getReq.result;
          if (record) {
            record.llmApiKey = k;
            store.put(record);
          }
        };
        tx.oncomplete = () => {
          idb.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      openReq.onerror = () => reject(openReq.error);
    });
  }, key);
}
