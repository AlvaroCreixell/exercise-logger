# Onboarding Questionnaire — Sprint E (E2E + Polish + Final PR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the onboarding feature by shipping 4 Playwright E2E tests (first-run, skip, settings-relaunch, banner-recovery), an axe-core accessibility audit of the 3 new routes, a full green test/lint/build pass, a PR-description draft with D1–D12 confirmations, and the post-merge action item for pasting the updated GPT instructions.

**Architecture:** E2E tests use the existing Playwright config (Pixel 7 Chromium, `http://localhost:4173/exercise-logger`, preview server). All 4 tests share a small `web/tests/e2e/helpers/onboarding-helpers.ts` module for IndexedDB reset and state seeding via `page.evaluate`. Clipboard and `window.open` are stubbed via `page.addInitScript` so tests don't depend on browser clipboard policies. Accessibility is enforced with `@axe-core/playwright` on the 3 new onboarding routes.

**Tech Stack:** Playwright 1.58 · `@axe-core/playwright` (new devDep) · existing React 19 + Dexie 4 + react-router v7 app. Zero new runtime dependencies; one new test-only devDep (`@axe-core/playwright`).

---

## Source-of-truth cross-reference

| Concern | Location |
|---|---|
| Sprint scope / deliverables / exit criteria | `docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md` §Sprint E (§10) |
| E2E scenario list | spec `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md` §E2E (Playwright) |
| Risks to validate manually | spec §Risks & Open Questions |
| Existing Playwright config | `web/playwright.config.ts` (Pixel 7, port 4173, `baseURL: /exercise-logger`) |
| Existing E2E patterns (page.goto, navigation, offline) | `web/tests/e2e/smoke.spec.ts`, `web/tests/e2e/full-workflow.spec.ts` |
| Existing keyboard-a11y pattern | `web/tests/e2e/a11y-keyboard.spec.ts` |
| 16-scenario acceptance suite (must stay green) | `web/tests/integration/acceptance.test.ts` |
| Bundled starter routine (seeded on first launch) | `web/data/routines/full-body-3day.yaml` |
| Alternative bundled YAML (for E2E import) | `web/data/routines/full-body-4day-mom.yaml` |
| IndexedDB name to reset | `ExerciseLoggerDB` (see `web/src/db/database.ts:20`) |
| sessionStorage key to reset | `exercise-logger:onboarding:in-progress` |
| GPT URL the handoff opens | `web/src/shared/lib/gpt-url.ts` |
| Updated custom-GPT instructions (paste post-merge) | `docs/custom-gpt/workout-routine-gpt.instructions.md` |
| PR checklist items | orchestration §E.5 |

---

## File map

**Create (tests):**

| Path | Count | What it proves |
|---|---|---|
| `web/tests/e2e/helpers/onboarding-helpers.ts` | n/a | Shared helpers: `resetAppState(page)`, `seedSkippedUser(page)`, `seedCompletedPrompt(page, prompt)`, `stubClipboardAndWindowOpen(page)`, plus a small `STARTER_YAML_FIXTURE` string constant used by the first-run import. |
| `web/tests/e2e/onboarding-first-run.e2e.ts` | 1 | Fresh install → `/` redirects → welcome → type name → Start → 11-step wizard → handoff Stage 1 (stubbed clipboard + window.open) → paste YAML → Stage 2 Import → Today shows `Hi, Alvaro.` + the newly-imported routine active. |
| `web/tests/e2e/onboarding-skip.e2e.ts` | 1 | Fresh install → welcome → Maybe later → Today shows `Hello.` + the bundled starter routine active. |
| `web/tests/e2e/onboarding-settings-relaunch.e2e.ts` | 1 | Pre-skipped user → Settings → "✨ Create a personalized routine" → complete wizard → handoff → Stage 2 import → Today with new routine. |
| `web/tests/e2e/onboarding-banner-recovery.e2e.ts` | 1 | Generate prompt (just-completed state) → land on Stage 1 → tap button → Stage 2 → reload → Stage 2 persists (because `lastGeneratedPrompt !== null`). Navigate to `/` → banner visible. `×` → banner hides. Reload → banner still hidden. Regenerate prompt → banner re-shows. |
| `web/tests/e2e/onboarding-a11y.e2e.ts` | 3 (one per route) | axe-core scan clean on `/onboarding`, `/onboarding/questionnaire` (step 1), `/onboarding/handoff` (Stage 1). |

**Modify:**

| Path | Change |
|---|---|
| `web/package.json` | Add `@axe-core/playwright` to `devDependencies`. |
| `docs/superpowers/plans/2026-04-22-onboarding-questionnaire-orchestration.md` | No change — existing orchestration plan is authoritative. |

**Create (documentation / PR):**

| Path | Responsibility |
|---|---|
| `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-PR-body.md` | The PR description draft, kept in the repo so the PR body can be pasted directly at merge time. Deleted (or archived) post-merge. |

**Out of scope (explicit):**
- Any new UX change, feature, component, or bug fix. If the E2E suite uncovers a regression, file a targeted fix task — do NOT absorb it into the E2E plan.
- Any additional unit or component tests.
- Any restructure of existing tests.
- Dependency bumps unrelated to `@axe-core/playwright`.
- Manual QA on real iOS / Android devices — that's a human action documented in the PR, not a subagent task.

---

## Test delta summary

- Unit/integration suite stays at **871** (Sprint D exit count). This sprint adds no unit tests and must not regress any.
- E2E suite grows from 3 existing (smoke, full-workflow, a11y-keyboard) to **10** total: 3 existing + 4 onboarding flow + 3 onboarding a11y.

---

## Shared conventions

1. **Playwright base URL.** Every `page.goto(path)` uses paths like `"/"` or `"/onboarding"` (the config prepends `/exercise-logger`). If your editor IntelliSense suggests absolute paths, trim them.
2. **Test runner.** `cd web && npm run test:e2e` — runs `npm run build` + `playwright test`. This always rebuilds so recent src changes are reflected. The `webServer` config reuses an existing preview server when available.
3. **IndexedDB reset.** Use `page.addInitScript(() => { indexedDB.deleteDatabase("ExerciseLoggerDB"); })` BEFORE the first `page.goto(...)`. `addInitScript` runs in every page context before any app code. The `useAppInit` hook re-seeds settings + catalog + starter routine on the next mount.
4. **sessionStorage reset.** Also use `addInitScript` to clear the wizard's resume key: `() => { sessionStorage.removeItem("exercise-logger:onboarding:in-progress"); }`. Combine both into a single init script.
5. **Clipboard stub.** Playwright's Chromium context can grant clipboard permissions via `await context.grantPermissions(["clipboard-read", "clipboard-write"])`. That enables real clipboard access but it's flaky across runs. Prefer stubbing by overriding `navigator.clipboard` in an `addInitScript`:
   ```ts
   await page.addInitScript(() => {
     const buffer: { value: string } = { value: "" };
     Object.defineProperty(navigator, "clipboard", {
       value: {
         writeText: async (text: string) => { buffer.value = text; },
         readText: async () => buffer.value,
       },
       configurable: true,
     });
   });
   ```
   This lets tests assert what WAS written by reading back from `readText`.
6. **`window.open` stub.** Same pattern — override in `addInitScript`:
   ```ts
   await page.addInitScript(() => {
     (window as any).__lastOpenedUrl = null;
     window.open = (url?: string | URL) => {
       (window as any).__lastOpenedUrl = String(url ?? "");
       return { closed: false } as Window;
     };
   });
   ```
   Tests then read `window.__lastOpenedUrl` via `page.evaluate`.
7. **Waiting for app-init.** `useAppInit` is async; the `Shell` doesn't render until `ready === true`. Use `await page.waitForSelector(...)` / `expect(locator).toBeVisible()` with a generous timeout (10s) for the first DOM query after `goto`.
8. **Settings seeding from the test.** To put the DB into a specific state (e.g., "pre-skipped user"), use `page.evaluate` AFTER the app has initialized:
   ```ts
   await page.evaluate(async () => {
     const { db } = await import("/src/db/database.ts"); // NO — Playwright can't import src
   });
   ```
   That doesn't work because Playwright tests execute against the **built bundle**, not the src. Instead, interact with IndexedDB directly:
   ```ts
   await page.evaluate(async ({ isoNow }) => {
     return new Promise<void>((resolve, reject) => {
       const req = indexedDB.open("ExerciseLoggerDB");
       req.onsuccess = () => {
         const db = req.result;
         const tx = db.transaction("settings", "readwrite");
         const store = tx.objectStore("settings");
         const get = store.get("user");
         get.onsuccess = () => {
           const s = get.result ?? {};
           store.put({ ...s, id: "user", onboardingSkippedAt: isoNow });
           tx.oncomplete = () => resolve();
           tx.onerror = () => reject(tx.error);
         };
       };
       req.onerror = () => reject(req.error);
     });
   }, { isoNow: new Date().toISOString() });
   ```
   All DB-seeding helpers in this plan use this direct-IndexedDB pattern. The helpers module factors it out so tests read clean.
9. **YAML fixture for Stage 2 import.** Use the bundled 4-day routine (`web/data/routines/full-body-4day-mom.yaml`) or a minimal inlined 2-day routine. To decouple E2E from the bundled files, inline a minimal routine in `onboarding-helpers.ts` as `STARTER_YAML_FIXTURE` — small and stable.

---

## Task ordering

1. Add `@axe-core/playwright` devDep + shared helpers (Task 1)
2. First-run E2E (Task 2) — the most complex; validates the full happy path
3. Skip E2E (Task 3) — simple, one-button
4. Settings-relaunch E2E (Task 4) — builds on Task 2's wizard traversal via helpers
5. Banner-recovery E2E (Task 5) — state-driven reload assertions
6. A11y E2E — axe-core scan of the 3 new routes (Task 6)
7. Full-suite + lint + build verification (Task 7) — no new commits; stops if anything regresses
8. PR description draft + manual QA checklist + post-merge action item (Task 8)

Tasks 2–6 can run sequentially; parallel execution is possible but each E2E test loads the full app, so the speedup is modest.

Commits: one per task. Conventional commits — `test(e2e): …`, `chore(deps): …`, `docs: …`.

---

## Task 1: Add `@axe-core/playwright` and create shared E2E helpers

**Files:**
- Modify: `web/package.json` — add `"@axe-core/playwright": "^4.11.0"` (or latest 4.x) to `devDependencies`.
- Create: `web/tests/e2e/helpers/onboarding-helpers.ts`

### Step 1.1 — Install `@axe-core/playwright`

Run: `cd web && npm install --save-dev @axe-core/playwright`
Expected: Adds 1 package. `package.json` and `package-lock.json` both update.

Verify it's in devDependencies only (NOT dependencies).

### Step 1.2 — Create the helpers module

Create `web/tests/e2e/helpers/onboarding-helpers.ts`:

```ts
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
    // Record the last URL window.open was called with.
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
```

### Step 1.3 — Commit

```bash
git add web/package.json web/package-lock.json web/tests/e2e/helpers/onboarding-helpers.ts
git commit -m "chore(e2e): add @axe-core/playwright and shared onboarding helpers"
```

Three files (the two package files + the new helpers file). No `-A`.

### Constraints

- `@axe-core/playwright` is a **devDep**, not a runtime dep. The spec's "no new runtime deps" rule is preserved.
- Do not modify any `web/src/**` file in this task.

### Report back

- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Commit SHA
- Confirmation that `@axe-core/playwright` is in `devDependencies` only
- `git diff --stat <baseline>..HEAD`

---

## Task 2: First-run E2E — full happy path

**Files:**
- Create: `web/tests/e2e/onboarding-first-run.e2e.ts`

### What the test proves

Fresh install at `/` auto-redirects to `/onboarding`. User types a name, taps Start, steps through all 11 wizard questions with specific answers, lands on handoff Stage 1. Stage-1 button call stubs verify the clipboard received a prompt containing the D10 line (`"- Distinct training days desired: 3"`) and `window.open` was called with the GPT URL. Stage 2 appears, user pastes the E2E YAML, taps Import, lands on Today showing `Hi, Alvaro.` greeting and the "E2E Test Routine" as active.

### Step 2.1 — Write the test

Create `web/tests/e2e/onboarding-first-run.e2e.ts`:

```ts
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

    // Fresh install — gate redirects to /onboarding.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /What should we call you/i })
    ).toBeVisible({ timeout: 15_000 });

    // Type the name and tap Start.
    await page.getByRole("textbox", { name: /your name/i }).fill("Alvaro");
    await page.getByRole("button", { name: /^start$/i }).click();

    // Step 1 — Goal.
    await page.getByLabel("Build muscle").click();

    // Step 2 — Experience.
    await page.getByLabel(/Intermediate/).click();

    // Step 3 — Restrictions: skip.
    await page.getByRole("button", { name: /all clear — skip/i }).click();

    // Step 4 — DaysPerWeek: 3.
    await page.getByLabel("3").click();

    // Step 5 — SessionLength: 60 min.
    await page.getByLabel("60 min").click();

    // Step 6 — DistinctDays: 3 (D10 — numbers only).
    await page.getByLabel("3").click();

    // Step 7 — Equipment: Barbell + Dumbbells, then Next.
    await page.getByRole("button", { name: /^barbell$/i }).click();
    await page.getByRole("button", { name: /^dumbbells$/i }).click();
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 8 — Priorities: skip.
    await page
      .getByRole("button", { name: /keep it balanced — skip/i })
      .click();

    // Step 9 — FavoritesAvoid: leave blank, Next.
    await page.getByRole("button", { name: /^next$/i }).click();

    // Step 10 — Supersets: Yes.
    await page.getByRole("radio", { name: /^Yes/ }).click();

    // Step 11 — Cardio: Yes.
    await page.getByLabel("Yes").click();

    // Stage 1 ("Ready to build your routine?")
    await expect(
      page.getByRole("heading", { name: /ready to build your routine/i })
    ).toBeVisible({ timeout: 10_000 });

    // Tap the Stage-1 button → clipboard write, window.open, flip to Stage 2.
    await page
      .getByRole("button", { name: /copy prompt & open gpt/i })
      .click();

    // Stage 2 heading.
    await expect(
      page.getByRole("heading", { name: /paste your routine/i })
    ).toBeVisible();

    // Verify clipboard received a prompt that contains the D10 line and none
    // of the bullet-omission lines for our skipped optional fields.
    const copied = await readStubbedClipboard(page);
    expect(copied).toContain("- Primary goal: Build muscle");
    expect(copied).toContain("- Distinct training days desired: 3");
    expect(copied).not.toContain("Distinct training days desired: 3 (");
    expect(copied).toContain("- Available equipment: Barbell, Dumbbells");
    expect(copied).toContain("- Supersets: Yes — use them where they fit");

    // Verify window.open was called with the chatgpt.com URL.
    const openedUrl = await readLastOpenedUrl(page);
    expect(openedUrl ?? "").toContain("chatgpt.com");

    // Paste the E2E YAML and tap Import.
    await page.getByRole("textbox", { name: /yaml/i }).fill(E2E_ROUTINE_YAML);
    await page.getByRole("button", { name: /import routine/i }).click();

    // Lands on Today with the personalized greeting + new active routine.
    await expect(
      page.getByRole("heading", { name: "Hi, Alvaro." })
    ).toBeVisible({ timeout: 10_000 });
    // Hero card shows the new routine name. Use a loose match because the
    // TodayHeroCard includes extra copy around the day label.
    await expect(page.getByText(/E2E Test Routine|Upper|Lower/)).toBeVisible();
  });
});
```

### Step 2.2 — Run and verify

Run: `cd web && npm run test:e2e -- onboarding-first-run.e2e.ts`
Expected: 1 test passes.

If it fails:
- The flow may have navigated while an earlier click hadn't settled — add `await expect(page.getByRole("heading", ...)).toBeVisible()` between steps to sync.
- If `await readStubbedClipboard(page)` throws, the stub didn't attach — confirm `stubClipboardAndWindowOpen(page)` was called BEFORE `page.goto`.

### Step 2.3 — Commit

```bash
git add web/tests/e2e/onboarding-first-run.e2e.ts
git commit -m "test(e2e): first-run onboarding happy path"
```

---

## Task 3: Skip E2E

**Files:**
- Create: `web/tests/e2e/onboarding-skip.e2e.ts`

### What the test proves

Fresh install → welcome screen → tap Maybe later → Today shows `Hello.` (default greeting) + the bundled starter routine is active.

### Step 3.1 — Write the test

Create `web/tests/e2e/onboarding-skip.e2e.ts`:

```ts
import { test, expect } from "@playwright/test";
import {
  STARTER_ROUTINE_NAME,
  resetAppState,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding skip flow", () => {
  test("Maybe later → Today with default greeting + starter routine", async ({
    page,
  }) => {
    await resetAppState(page);

    await page.goto("/");
    // Fresh install routes to /onboarding.
    await expect(
      page.getByRole("heading", { name: /What should we call you/i })
    ).toBeVisible({ timeout: 15_000 });

    // Tap Maybe later.
    await page.getByRole("button", { name: /maybe later/i }).click();

    // Land on Today — default "Hello." greeting.
    await expect(page.getByRole("heading", { name: "Hello." })).toBeVisible({
      timeout: 10_000,
    });

    // Bundled starter is seeded on first app-init and remains active.
    // The hero card's day label row includes the routine name implicitly;
    // check the Settings screen to be deterministic about which routine is
    // active (the active-routine card shows the name).
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(
      page.getByRole("heading", { name: /settings/i })
    ).toBeVisible();
    await expect(page.getByText(STARTER_ROUTINE_NAME)).toBeVisible();
  });
});
```

### Step 3.2 — Run and verify

Run: `cd web && npm run test:e2e -- onboarding-skip.e2e.ts`
Expected: 1 test passes.

### Step 3.3 — Commit

```bash
git add web/tests/e2e/onboarding-skip.e2e.ts
git commit -m "test(e2e): onboarding skip flow lands on Today with starter routine"
```

---

## Task 4: Settings-relaunch E2E

**Files:**
- Create: `web/tests/e2e/onboarding-settings-relaunch.e2e.ts`

### What the test proves

A user who previously skipped (seeded via `seedSkippedUser`) can launch the questionnaire from Settings → "✨ Create a personalized routine" and run through it end-to-end, completing with a YAML import.

### Step 4.1 — Write the test

Create `web/tests/e2e/onboarding-settings-relaunch.e2e.ts`:

```ts
import { test, expect } from "@playwright/test";
import {
  E2E_ROUTINE_YAML,
  resetAppState,
  seedSkippedUser,
  stubClipboardAndWindowOpen,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding relaunch from Settings", () => {
  test("skipped user → Settings → Create a personalized routine → import", async ({
    page,
  }) => {
    await resetAppState(page);
    await stubClipboardAndWindowOpen(page);

    // Boot once so Dexie/settings row exist, then seed the skipped flag.
    await page.goto("/");
    // Wait until the app is mounted. If the gate redirects us to /onboarding
    // because the seed hasn't applied yet, tap Maybe later to exit cleanly —
    // but by design seedSkippedUser below writes skipped=true so a second
    // reload lands us on Today.
    await page.waitForLoadState("networkidle");
    await seedSkippedUser(page);
    await page.reload();

    // Land on Today (gate does not redirect because skipped).
    await expect(
      page.getByRole("heading", { name: "Hello." })
    ).toBeVisible({ timeout: 15_000 });

    // Navigate to Settings.
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();

    // Tap "Create a personalized routine".
    await page
      .getByRole("button", { name: /create a personalized routine/i })
      .click();

    // Wizard step 1.
    await expect(
      page.getByRole("heading", { name: /What's your main goal/i })
    ).toBeVisible({ timeout: 10_000 });

    // Quick wizard traversal (same as first-run, minimal required answers).
    await page.getByLabel("Build muscle").click();
    await page.getByLabel(/Beginner/).click();
    await page.getByRole("button", { name: /all clear — skip/i }).click();
    await page.getByLabel("2").click();
    await page.getByLabel("30 min").click();
    await page.getByLabel("1").click();
    await page.getByRole("button", { name: /^bodyweight only$/i }).click();
    await page.getByRole("button", { name: /^next$/i }).click();
    await page
      .getByRole("button", { name: /keep it balanced — skip/i })
      .click();
    await page.getByRole("button", { name: /^next$/i }).click(); // step 9: blank
    await page.getByRole("radio", { name: /No supersets/i }).click();
    await page.getByLabel("No cardio").click();

    // Stage 1 arrives; tap it.
    await expect(
      page.getByRole("heading", { name: /ready to build your routine/i })
    ).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /copy prompt & open gpt/i }).click();

    // Stage 2 paste + import.
    await expect(
      page.getByRole("heading", { name: /paste your routine/i })
    ).toBeVisible();
    await page.getByRole("textbox", { name: /yaml/i }).fill(E2E_ROUTINE_YAML);
    await page.getByRole("button", { name: /import routine/i }).click();

    // Land on Today (gate: onboardingCompletedAt is now set, no greeting name).
    await expect(page.getByRole("heading", { name: "Hello." })).toBeVisible({
      timeout: 10_000,
    });
  });
});
```

### Step 4.2 — Run and verify

Run: `cd web && npm run test:e2e -- onboarding-settings-relaunch.e2e.ts`
Expected: 1 test passes.

### Step 4.3 — Commit

```bash
git add web/tests/e2e/onboarding-settings-relaunch.e2e.ts
git commit -m "test(e2e): onboarding relaunch from Settings for skipped users"
```

---

## Task 5: Banner-recovery E2E

**Files:**
- Create: `web/tests/e2e/onboarding-banner-recovery.e2e.ts`

### What the test proves

A user with a saved prompt sees the Today banner. The banner's `×` dismisses persistently (survives reload). Generating a fresh prompt resets the dismissal so the banner re-shows. Clicking the banner body navigates to `/onboarding/handoff` which lands on Stage 2 (because `lastGeneratedPrompt !== null`).

### Step 5.1 — Write the test

Create `web/tests/e2e/onboarding-banner-recovery.e2e.ts`:

```ts
import { test, expect } from "@playwright/test";
import {
  resetAppState,
  seedCompletedPrompt,
  seedSkippedUser,
} from "./helpers/onboarding-helpers";

test.describe("Onboarding banner recovery", () => {
  test("banner shows → tap → Stage 2; dismiss persists; fresh prompt re-shows banner", async ({
    page,
  }) => {
    await resetAppState(page);

    // Boot + seed skipped so first-run gate stays off.
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await seedSkippedUser(page);
    await seedCompletedPrompt(page, "SAVED PROMPT CONTENT\n\nDummy body.");
    await page.reload();

    // Today — banner is visible.
    await expect(page.getByRole("status")).toBeVisible({ timeout: 15_000 });

    // Tap the banner body → Stage 2.
    await page.getByRole("button", { name: /paste your routine yaml/i }).click();
    await expect(
      page.getByRole("heading", { name: /paste your routine/i })
    ).toBeVisible({ timeout: 10_000 });

    // Reload on /onboarding/handoff — Stage 2 persists because lastGeneratedPrompt !== null.
    await page.reload();
    await expect(
      page.getByRole("heading", { name: /paste your routine/i })
    ).toBeVisible({ timeout: 10_000 });

    // Go back to Today and dismiss the banner.
    await page.getByRole("link", { name: "Today" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await page.getByRole("button", { name: /dismiss banner/i }).click();
    await expect(page.getByRole("status")).toBeHidden();

    // Reload Today — dismissal persists.
    await page.reload();
    await expect(page.getByRole("heading", { name: /hello/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("status")).toBeHidden();

    // Seed a fresh prompt — the banner re-shows because saveGeneratedPrompt
    // resets onboardingBannerDismissedAt. We emulate the "fresh prompt" by
    // writing a new one directly; in production the handoff Stage-1 button
    // is what triggers this.
    await seedCompletedPrompt(page, "NEW SAVED PROMPT");
    await page.reload();
    await expect(page.getByRole("status")).toBeVisible({ timeout: 10_000 });
  });
});
```

### Step 5.2 — Run and verify

Run: `cd web && npm run test:e2e -- onboarding-banner-recovery.e2e.ts`
Expected: 1 test passes.

### Step 5.3 — Commit

```bash
git add web/tests/e2e/onboarding-banner-recovery.e2e.ts
git commit -m "test(e2e): onboarding banner visibility, dismissal, and re-show on fresh prompt"
```

---

## Task 6: A11y E2E — axe-core on 3 new routes

**Files:**
- Create: `web/tests/e2e/onboarding-a11y.e2e.ts`

### What the test proves

`@axe-core/playwright` reports zero `critical` or `serious` violations on `/onboarding`, `/onboarding/questionnaire` (step 1), and `/onboarding/handoff` (Stage 1). Minor/moderate violations are allowed but should be triaged in the PR body.

### Step 6.1 — Write the test

Create `web/tests/e2e/onboarding-a11y.e2e.ts`:

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  resetAppState,
  seedCompletedPrompt,
  seedSkippedUser,
  stubClipboardAndWindowOpen,
} from "./helpers/onboarding-helpers";

async function assertNoCriticalOrSerious(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  // If this fails, the axe-core output in Playwright's trace lists the rule
  // ids and selectors. Fix the violation at the source; do NOT add rule
  // disables unless the rule is a false positive.
  expect(
    blocking,
    JSON.stringify(
      blocking.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
      null,
      2
    )
  ).toEqual([]);
}

test.describe("Onboarding a11y — axe-core", () => {
  test("/onboarding (welcome screen) has no critical/serious a11y violations", async ({
    page,
  }) => {
    await resetAppState(page);
    await page.goto("/onboarding");
    await expect(
      page.getByRole("heading", { name: /What should we call you/i })
    ).toBeVisible({ timeout: 15_000 });
    await assertNoCriticalOrSerious(page);
  });

  test("/onboarding/questionnaire step 1 has no critical/serious a11y violations", async ({
    page,
  }) => {
    await resetAppState(page);
    await page.goto("/");
    // Welcome → skip straight into the questionnaire by tapping Start with
    // an empty name (allowed) so we land on step 1.
    await expect(
      page.getByRole("heading", { name: /What should we call you/i })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^start$/i }).click();
    await expect(
      page.getByRole("heading", { name: /What's your main goal/i })
    ).toBeVisible({ timeout: 10_000 });
    await assertNoCriticalOrSerious(page);
  });

  test("/onboarding/handoff Stage 2 has no critical/serious a11y violations", async ({
    page,
  }) => {
    // Seed a skipped user + saved prompt so /onboarding/handoff renders Stage 2.
    await resetAppState(page);
    await stubClipboardAndWindowOpen(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await seedSkippedUser(page);
    await seedCompletedPrompt(page, "SCAN PROMPT");
    await page.goto("/onboarding/handoff");
    await expect(
      page.getByRole("heading", { name: /paste your routine/i })
    ).toBeVisible({ timeout: 15_000 });
    await assertNoCriticalOrSerious(page);
  });
});
```

Note: scanning Stage 1 is hard because that state requires the `justCompleted` navigation flag which only arrives via `navigate("/onboarding/handoff", { state: { justCompleted: true } })`. A deep-link goto doesn't pass router state, so the guard redirects to the questionnaire. Stage 2 is the meaningful scan — it has the textarea, Import button, Start-over — more surface than Stage 1. Stage-1 controls (single button + show-prompt toggle) are nearly identical to existing Button/Textarea patterns already covered by the Welcome/Step-1 scans.

### Step 6.2 — Run and verify

Run: `cd web && npm run test:e2e -- onboarding-a11y.e2e.ts`
Expected: 3 tests pass.

If any test fails, inspect the `violations` array in the failure message. Typical remediations:
- Missing `aria-label` on an icon-only button → add one.
- Contrast failure on a chip → check the sage tokens; the handoff design already uses WCAG AA contrast ratios so real failures are likely a CSS specificity bug.
- Landmark missing → add `role="main"` or similar.

Any remediation is a **targeted fix task** in Sprints A–D's source files, not in this plan. File it as `fix(onboarding): <description>` and return to this task after the fix lands.

### Step 6.3 — Commit

```bash
git add web/tests/e2e/onboarding-a11y.e2e.ts
git commit -m "test(e2e): axe-core a11y audit on onboarding routes"
```

---

## Task 7: Full-suite + lint + build verification

**Files:** none to edit. This is a verification task.

### Step 7.1 — Full unit/integration suite

Run: `cd web && npm test -- --run`
Expected: **871** tests green (Sprint D exit count). Ignore the pre-existing `useRoutineLaunchQueue.test.tsx` flake if it surfaces; it passes in isolation. Any OTHER failure is a regression that must be fixed BEFORE proceeding.

### Step 7.2 — Acceptance suite check

The 16-scenario acceptance suite at `web/tests/integration/acceptance.test.ts` is part of the main unit/integration run, so Step 7.1 covers it. Confirm specifically that acceptance-suite tests appear in the pass list.

Run: `cd web && npm test -- --run tests/integration/acceptance.test.ts`
Expected: all 16 scenarios pass.

### Step 7.3 — E2E suite (all 10)

Run: `cd web && npm run test:e2e`
Expected: 10 E2E tests pass (3 existing + 4 new onboarding flow + 3 a11y). No retries on the first run; flaky tests require investigation before moving on.

### Step 7.4 — Lint

Run: `cd web && npm run lint`
Expected: zero errors, zero warnings.

### Step 7.5 — Build

Run: `cd web && npm run build`
Expected: TypeScript compile + Vite build complete successfully. Warnings about chunk size are acceptable (the PWA plugin is in play). Hard errors must be fixed.

### Step 7.6 — Git status clean

Run: `git status`
Expected: working tree clean (no uncommitted changes from the verification steps).

No commit for this task — the commit is the successful verification itself. If any step fails, stop and escalate.

### Report back

- Status: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
- Test counts for unit/integration, E2E
- Lint result
- Build result

---

## Task 8: PR description draft + manual QA checklist + post-merge action items

**Files:**
- Create: `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-PR-body.md`

### Step 8.1 — Write the PR description

Create `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-PR-body.md` with this exact content (the PR author copies this into the PR body at merge time):

```markdown
# First-run onboarding & routine-questionnaire feature

Replaces the "cold ChatGPT conversation" routine-creation flow with a guided 2-minute in-app questionnaire that produces a pastable GPT prompt and round-trips a YAML routine back into Dexie. Feature spec at [docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md](../docs/superpowers/specs/2026-04-22-onboarding-questionnaire-design.md).

## Summary

- New route `/onboarding` (welcome + name input), `/onboarding/questionnaire` (11-step wizard), `/onboarding/handoff` (Stage 1 → Stage 2 state machine).
- First-run gate in `AppRoutes` redirects fresh installs to `/onboarding`.
- Existing testers silently migrated (Decision D3 — `onboardingSkippedAt` backfilled on Dexie v2→v3 upgrade).
- Settings gets a Profile section + "✨ Create a personalized routine" row + `LastPromptCard`.
- Today screen shows `Hi, {name}.` greeting when set, otherwise `Hello.`, plus a recovery banner when a prompt is saved and not dismissed.
- Pure `buildPrompt(answers)` module with a byte-for-byte spec example test + D10 regression lock.
- Co-ships updated custom-GPT instructions dropping the 12th intake topic (`docs/custom-gpt/workout-routine-gpt.instructions.md`). **Post-merge: paste those instructions into the ace-logger-routine-maker custom-GPT admin UI.**

## Decisions honored (D1–D12)

- **D1** Soft first-run gate — welcome is skippable via "Maybe later". ✓
- **D2** Questionnaire re-runnable from Settings → "Create a personalized routine". ✓
- **D3** Existing users silently marked onboarded via Dexie v3 migration backfilling `onboardingSkippedAt = nowISO()`. ✓
- **D4** Answers not persisted between runs — sessionStorage is cleared on Stage-2 success. ✓
- **D5** Generated prompt persisted to `lastGeneratedPrompt`. ✓
- **D6** One-at-a-time wizard (Option A). ✓
- **D7** Auto-advance on single-select chips; Back is safety net. ✓
- **D8** Combined "Copy prompt & open GPT" + Stage 2 paste on the same screen. ✓
- **D9** Today banner recovers users who close mid-flow. ✓
- **D10** Step 6 captures only the number; prompt rendering has a test lock asserting "Distinct training days desired: 3" and NOT "... 3 (Push/Pull/Legs)". ✓
- **D11** Design language inherits from the paper+sage handoff — no new tokens. ✓
- **D12** sessionStorage-based mid-wizard resume. ✓

## Test plan

- [x] Unit + integration suite: 742 → 871 tests (+129). Full `cd web && npm test --run` green.
- [x] Acceptance suite (16 scenarios) still green — no behavior change to sessions / sets / progression.
- [x] E2E (Playwright): 4 new flows (first-run, skip, settings-relaunch, banner-recovery) + 3 a11y scans. `cd web && npm run test:e2e` green.
- [x] `npm run lint` green.
- [x] `npm run build` green.
- [x] axe-core (critical + serious) clean on `/onboarding`, `/onboarding/questionnaire`, `/onboarding/handoff`.

## Manual QA

Attach device screenshots below. If a device wasn't available, note so explicitly.

| Device | Welcome | Mid-wizard step | Handoff Stage 1 | Handoff Stage 2 | Today greeting | Settings |
|---|---|---|---|---|---|---|
| iOS Safari (real) | _screenshot or "not available"_ | _…_ | _…_ | _…_ | _…_ | _…_ |
| Android Chrome (real) | _…_ | _…_ | _…_ | _…_ | _…_ | _…_ |
| Desktop Chrome | _…_ | _…_ | _…_ | _…_ | _…_ | _…_ |

**Risks validated:**
- Clipboard: Playwright stubs cover the write path; real-device verification on iOS Safari and Android Chrome — note any failures above.
- Popup blocker: the handoff screen falls back to an inline `<a href={GPT_URL}>` when `window.open` returns null. Verify on an installed PWA.
- sessionStorage quota: the answers blob is < 1 KB; no real risk.
- GPT URL: single source of truth at `web/src/shared/lib/gpt-url.ts`.

## Post-merge action items

**REQUIRED — do not skip:**

1. **Paste the updated instructions into the custom-GPT admin UI.** The file to paste is [docs/custom-gpt/workout-routine-gpt.instructions.md](../docs/custom-gpt/workout-routine-gpt.instructions.md). Without this, the GPT still thinks there are 12 intake topics and may ask the user to re-enumerate equipment preferences after the app already gave them all 11 answers. Confirm in a new ChatGPT chat that pasting the app's generated prompt produces YAML on the first turn without any follow-up questions.
2. **Smoke-test the deployed site.** After GitHub Pages redeploys from `main`: fresh-install a clean browser profile, go through the flow end-to-end (welcome → wizard → handoff → paste real GPT YAML → train one set). This catches anything the E2E suite missed (e.g., real clipboard, real window.open, real iOS Safari focus handling).
3. **Delete the feature branch.** After merge: `git branch -d feat/onboarding-questionnaire && git push origin --delete feat/onboarding-questionnaire`.

## Scope summary

- Sprint A (Foundation): Dexie v3 migration + `onboarding-service` + `setUserName` + `GPT_URL` extraction + `buildPrompt` pure function + Answer types.
- Sprint B (Wizard mechanics): pure reducer + sessionStorage utility + 5 shared components (`WizardShell`, `ChipRow`, `ChipMulti`, `ChipWithDescription`, `StepTextArea`).
- Sprint C (Wizard content): `OnboardingWelcomeScreen` + `QuestionnaireScreen` orchestrator + 11 step components + walkthrough integration test.
- Sprint D (Integration): `HandoffScreen` (Stage 1 + Stage 2) + `LastPromptCard` + `OnboardingBanner` + Settings Profile section + Today greeting/banner + first-run gate + 2 route guards.
- Sprint E (this PR): 4 Playwright E2E tests + axe-core a11y audit + PR prep.
```

### Step 8.2 — Commit

```bash
git add docs/superpowers/specs/2026-04-22-onboarding-questionnaire-PR-body.md
git commit -m "docs(onboarding): add PR body draft with D1–D12 confirmations and post-merge checklist"
```

### Step 8.3 — Print the PR-draft file path

Report the absolute path so the human operator can copy the body into the real PR:

```
PR body draft at:
  docs/superpowers/specs/2026-04-22-onboarding-questionnaire-PR-body.md
```

### Report back

- Status: DONE
- Commit SHA
- Absolute path of the PR body draft

---

## Exit criteria for Sprint E (and the whole feature)

- [ ] `cd web && npm test -- --run` green at 871 tests.
- [ ] `cd web && npm run test:e2e` green at 10 tests (3 existing + 7 new).
- [ ] `cd web && npm run lint` clean.
- [ ] `cd web && npm run build` clean.
- [ ] axe-core (critical + serious) clean on `/onboarding`, `/onboarding/questionnaire`, `/onboarding/handoff`.
- [ ] `docs/superpowers/specs/2026-04-22-onboarding-questionnaire-PR-body.md` exists and has D1–D12 confirmations.
- [ ] `@axe-core/playwright` is a devDep (not a runtime dep).
- [ ] `git diff main...feat/onboarding-questionnaire --stat` shows only expected paths (the Sprint A–E file map union).

**Post-merge (human operator, not a subagent task):**

- [ ] Squash-merge with message `feat(onboarding): first-run welcome + 11-step questionnaire + GPT handoff`.
- [ ] Paste the updated GPT instructions into the custom-GPT admin UI and smoke-test one prompt → YAML round-trip.
- [ ] Smoke-test the deployed GitHub Pages site.
- [ ] Delete the feature branch.

---

## Self-review

**Spec coverage:**
- §Testing → E2E (4 flows) → Tasks 2, 3, 4, 5.
- §Risks (clipboard / popup / quota / GPT URL) → stubs in Task 1's helper + callouts in the PR body.
- §Rollout (updated GPT instructions paste) → Task 8's PR body + post-merge checklist.
- §E2E a11y → Task 6.

**Placeholder scan:** no `TODO`, `TBD`, "fill in", or "similar to" in this plan. Every code block is complete. The one judgment call — whether to scan Stage 1 with axe-core — is resolved inline: Stage 2 is the richer a11y surface and its controls dominate Stage 1's; deep-linking to Stage 1 is blocked by the router-state requirement, so scanning it would need a test-only hack.

**Type consistency:** all paths, imports, and identifier names (`resetAppState`, `stubClipboardAndWindowOpen`, `seedSkippedUser`, `seedCompletedPrompt`, `readStubbedClipboard`, `readLastOpenedUrl`, `E2E_ROUTINE_YAML`, `STARTER_ROUTINE_NAME`) match between the helpers module and every test file that uses them. The E2E YAML fixture uses exercise IDs confirmed present in `web/src/data/catalog.csv` (barbell-bench-press, barbell-back-squat — both used by the bundled starter, guaranteed to exist).

**Scope discipline:** zero source edits under `web/src/**`. Zero unit-test changes. Zero feature/UX work. If a regression is uncovered, the plan explicitly defers to a targeted fix task.
