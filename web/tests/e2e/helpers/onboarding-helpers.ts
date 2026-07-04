import type { Page } from "@playwright/test";

/** The bundled starter routine is seeded by useAppInit on first launch. */
export const STARTER_ROUTINE_NAME = "Full Body 3-Day Rotation";

/**
 * A small but valid YAML routine used by the Stage-2 import in the first-run
 * and settings-relaunch E2Es. Import will activate this as the new routine,
 * so Today's hero card will show "E2E Test Routine" as the active routine
 * name — the test asserts on that.
 *
 * All exercise IDs are from the bundled catalog
 * (web/src/data/catalog.csv) — confirmed present.
 */
export const E2E_ROUTINE_YAML = `version: 1
name: "E2E Test Routine"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, B]

days:
  A:
    label: "Upper"
    entries:
      - exercise_id: barbell-bench-press
        sets:
          - { reps: [6, 10], count: 3 }
  B:
    label: "Lower"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 10], count: 3 }
`;

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
 * Seed `onboardingSkippedAt = nowISO()` directly into Dexie. Call AFTER the
 * app has booted (i.e., after page.goto and after waiting for initial render)
 * so the `settings` row exists.
 */
export async function seedSkippedUser(page: Page): Promise<void> {
  await page.evaluate(
    ({ iso }: { iso: string }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("ExerciseLoggerDB");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("settings", "readwrite");
          const store = tx.objectStore("settings");
          const g = store.get("user");
          g.onsuccess = () => {
            const cur = g.result as Record<string, unknown> | undefined;
            const next = {
              id: "user",
              activeRoutineId: cur?.activeRoutineId ?? null,
              units: cur?.units ?? "kg",
              userName: null,
              onboardingCompletedAt: null,
              onboardingSkippedAt: iso,
              lastGeneratedPrompt: null,
              lastGeneratedPromptAt: null,
              onboardingBannerDismissedAt: null,
            };
            store.put(next);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
        };
        req.onerror = () => reject(req.error);
      }),
    { iso: new Date().toISOString() }
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
 * Seed a completed prompt directly so Today's banner appears and
 * /onboarding/handoff lands on Stage 2 on reload.
 */
export async function seedCompletedPrompt(
  page: Page,
  prompt: string
): Promise<void> {
  await page.evaluate(
    ({ prompt, iso }: { prompt: string; iso: string }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("ExerciseLoggerDB");
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("settings", "readwrite");
          const store = tx.objectStore("settings");
          const g = store.get("user");
          g.onsuccess = () => {
            const cur = g.result as Record<string, unknown> | undefined;
            const next = {
              id: "user",
              activeRoutineId: cur?.activeRoutineId ?? null,
              units: cur?.units ?? "kg",
              userName: cur?.userName ?? null,
              onboardingCompletedAt: cur?.onboardingCompletedAt ?? null,
              onboardingSkippedAt: cur?.onboardingSkippedAt ?? iso,
              lastGeneratedPrompt: prompt,
              lastGeneratedPromptAt: iso,
              onboardingBannerDismissedAt: null,
            };
            store.put(next);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
        };
        req.onerror = () => reject(req.error);
      }),
    { prompt, iso: new Date().toISOString() }
  );
}
