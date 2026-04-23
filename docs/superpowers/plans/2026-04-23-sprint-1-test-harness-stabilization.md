# Sprint 1 — Test Harness Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Root-cause the two intermittently failing unit tests — `AppRoutes.test.tsx` (lazy-route Suspense race) and `useRoutineLaunchQueue.test.tsx` (`act(...)` warning) — so that `npm test` passes three consecutive runs with zero flag overrides.

**Architecture:** Test-side fixes only. For `useRoutineLaunchQueue`, wrap the consumer invocation in React's `act(...)` and replace the `setTimeout(0)` microtask flush with `waitFor`. For `AppRoutes`, pre-warm the lazy route modules in `beforeAll` so `React.lazy`'s internal `import()` resolves synchronously from the ESM module cache, and pass an explicit `{ timeout: 4000 }` to `findBy*` / `waitFor` as defense-in-depth. No source changes. No Vitest config changes. No `package.json` changes.

**Tech Stack:** Vitest 4.1, `@testing-library/react` 16.3, React 19.2, `react-router` 7, `jsdom` 29, `fake-indexeddb` 6.2.

---

## Root Cause Analysis

### `useRoutineLaunchQueue.test.tsx`

The test exercises `useRoutineLaunchQueue` by:
1. Mounting a `<Consumer />` that calls the hook inside a `<MemoryRouter>`.
2. Stubbing `globalThis.launchQueue` with a `setConsumer` that captures the callback.
3. Invoking the captured consumer: `await consumer!({ files: [fakeHandle] })`.
4. Awaiting `new Promise((r) => setTimeout(r, 0))` as a "React flush."
5. Asserting `capturedPath === "/settings/import"`.

Inside the consumer, `navigate("/settings/import", { state: { launchYaml: text } })` runs. `navigate` updates router context, which schedules a React re-render. Under React 19's concurrent rendering model, that re-render is not guaranteed to flush by the time a macrotask (`setTimeout(0)`) settles. The navigation update also happens outside an `act(...)` wrapper, so React logs a warning and — depending on scheduler timing — the assertion may run before `LocationProbe` has re-rendered at the new route.

Symptom: intermittent failure with `expect(capturedPath).toBe("/settings/import")` receiving `""` or `"/"`, plus an `act(...)` warning on stderr.

Fix: wrap the consumer invocation in `act(async () => { ... })` so React flushes all resulting state updates before `act` resolves, and replace the flimsy `setTimeout(0)` flush with `waitFor(() => expect(capturedPath).toBe(...))`. The `waitFor` also shields us from any future scheduler change that introduces a new await between state write and render.

### `AppRoutes.test.tsx`

The test renders `<AppRoutes>` inside a `<MemoryRouter initialEntries={["/"]}>`, then awaits `screen.findByRole("heading", { name: /what should we call you/i })`.

Rendering `<AppRoutes>` kicks off three serial async gates before any feature screen mounts:

1. **`useAppInit()`** (`web/src/shared/hooks/useAppInit.ts`) runs an effect that awaits `initializeSettings(db)`, `loadEmbeddedCatalog()`, `seedCatalog(db, ...)`, and — on a fresh install — `validateAndNormalizeRoutine(defaultRoutineYaml, ...)` (which dynamically imports the `yaml` package), `importRoutine(db, ...)`, and `setActiveRoutine(db, ...)`. Until this completes and `setReady(true)` fires, `<AppRoutes>` renders `<LoadingState fullscreen />`.
2. **`useSettings()`** (`web/src/shared/hooks/useSettings.ts`) runs a Dexie live query on `db.settings.get("user")`. Until it resolves, `<AppRoutes>` renders `<LoadingState fullscreen />`.
3. **`React.lazy`** for `OnboardingWelcomeScreen`: the first-run gate redirects `/` → `/onboarding`, which mounts a `<Suspense fallback={<LoadingState fullscreen />}>` whose child is `React.lazy(() => import("@/features/onboarding/OnboardingWelcomeScreen"))`. The dynamic import has to be fetched, evaluated, and its default export resolved before the heading renders.

`findByRole` uses React Testing Library's default timeout of **1000ms** (not Vitest's `testTimeout`). Under full-suite parallelism, where multiple test workers share CPU and the jsdom environment, the three serial gates can exceed 1000ms and the `findByRole` times out while the fallback `<LoadingState>` is still visible.

Symptom: intermittent failure with `TestingLibraryElementError: Unable to find an accessible element with the role "heading" and name ...`.

Fix: pre-warm the lazy modules that this suite uses in a `beforeAll`, so when `React.lazy`'s factory eventually runs, its `import(...)` returns an already-resolved promise from the ESM cache. This removes gate 3 entirely. Then pass `{ timeout: 4000 }` to each `findBy*` / `waitFor` call in the suite as a bound on gates 1 and 2 — well under Vitest's 5000ms per-test limit, well above the observed async cost.

### Why not raise `testTimeout`?

Raising `testTimeout` (what the audit's `--testTimeout=5000` flag does) bumps the *per-test* ceiling, which happens to mask the RTL-level `findBy*` flake because a longer-running test sometimes dodges the race. It does not fix the root cause. It also silently tolerates future regressions: the next time someone adds another async gate to `useAppInit`, we won't see the flake until after deploy. We fix the actual root causes instead.

---

## File Structure

Test files only. No source changes. No Vitest config changes.

- **Modify** `web/tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx` — wrap consumer call in `act`; replace `setTimeout(0)` with `waitFor`.
- **Modify** `web/tests/unit/app/AppRoutes.test.tsx` — add `beforeAll` module pre-warm; pass explicit `{ timeout: 4000 }` to `findByRole` and `waitFor` calls.
- **Update** `docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md` — mark Exit Criteria complete on merge.
- **Update** `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md` — tick Sprint 1 in the roadmap's Rollup section on merge.

---

## Working Directory Assumption

All `npm` and `git` commands assume the current working directory is `web/` unless otherwise noted. The repo root is `C:\Users\creix\VSC Projects\exercise_logger`. From the repo root, the work tree is:

```
exercise_logger/
├── docs/
│   └── superpowers/plans/  ← this plan lives here
└── web/                    ← cd here before running npm/git commands
    ├── package.json
    ├── vite.config.ts      ← also hosts vitest config under `test:` key
    └── tests/
```

---

## Task 1: Establish Baseline Flake Rate

**Files:** None modified. Diagnostic only.

- [ ] **Step 1: `cd` into `web/` and verify clean worktree**

Run:
```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
git status
```

Expected: branch info, with only `docs/custom-gpt/workout-routine-gpt.instructions.md` and `docs/repo-full-scope-analysis-2026-04-23.md` listed as modified/untracked (matches the session-start snapshot). If other changes are present, stash or ask the user before proceeding.

- [ ] **Step 2: Create a feature branch for Sprint 1**

Run:
```bash
git checkout -b sprint-1/test-harness-stabilization
```

Expected: `Switched to a new branch 'sprint-1/test-harness-stabilization'`.

- [ ] **Step 3: Run the `AppRoutes` test 20 times to observe the flake**

Run:
```bash
for i in $(seq 1 20); do
  echo "=== run $i ===";
  npm test -- tests/unit/app/AppRoutes.test.tsx --reporter=dot 2>&1 | tail -3;
done
```

Expected: at least one run shows `FAIL` with `Unable to find an accessible element with the role "heading"` or a timeout message. If all 20 pass, the flake is not reliably reproducing on this machine today — proceed anyway with the fix; the flake is documented in the audit and has been observed in CI.

Record the failure count (e.g. "3 of 20 failed") in the commit message for Step 7 below.

- [ ] **Step 4: Run the `useRoutineLaunchQueue` test 20 times**

Run:
```bash
for i in $(seq 1 20); do
  echo "=== run $i ===";
  npm test -- tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx --reporter=dot 2>&1 | tail -5;
done
```

Expected: at least one run shows either a `FAIL` on `expect(capturedPath).toBe("/settings/import")` or an `act(...)` warning on stderr even when the assertion passes. Record the warning/failure count.

- [ ] **Step 5: Run the full suite once to capture baseline reporter output**

Run:
```bash
npm test 2>&1 | tee /tmp/sprint1-baseline.log | tail -30
```

Expected: output shows `Test Files  N passed` or `N passed | M failed`. Note the final test/file counts (e.g. `98 test files | 880 tests`) — we will verify these are unchanged at Step 6 of Task 5.

- [ ] **Step 6: No commit in this task**

No files were modified. Task 1 is diagnostic.

---

## Task 2: Fix `useRoutineLaunchQueue` Test

**Files:**
- Modify: `web/tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx`

- [ ] **Step 1: Open the test file and confirm its current shape**

Run:
```bash
git diff HEAD -- tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx
```

Expected: empty diff (file is clean). If not, stash or reset before proceeding.

- [ ] **Step 2: Apply the fix — import `act` and `waitFor`, wrap consumer call, replace microtask flush**

Replace the contents of `web/tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx` with:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { useRoutineLaunchQueue } from "@/shared/hooks/useRoutineLaunchQueue";

function Consumer() {
  useRoutineLaunchQueue();
  return null;
}

function LocationProbe({ onLoc }: { onLoc: (pathname: string, state: unknown) => void }) {
  const loc = useLocation();
  onLoc(loc.pathname, loc.state);
  return null;
}

describe("useRoutineLaunchQueue", () => {
  const originalLaunchQueue = (globalThis as { launchQueue?: unknown }).launchQueue;

  afterEach(() => {
    (globalThis as { launchQueue?: unknown }).launchQueue = originalLaunchQueue;
    vi.restoreAllMocks();
  });

  it("is a no-op when launchQueue is absent", () => {
    delete (globalThis as { launchQueue?: unknown }).launchQueue;
    render(
      <MemoryRouter>
        <Consumer />
      </MemoryRouter>,
    );
    // Nothing to assert: the hook must not throw.
    expect(true).toBe(true);
  });

  it("navigates to /settings/import with launchYaml state when a file is handed in", async () => {
    type LaunchConsumer = (params: { files: readonly unknown[] }) => Promise<void> | void;
    let consumer: LaunchConsumer | null = null;
    (globalThis as { launchQueue?: { setConsumer: (c: LaunchConsumer) => void } }).launchQueue = {
      setConsumer: (c) => { consumer = c; },
    };

    const fakeText = "version: 1\nname: Test\n";
    const fakeFile = { text: async () => fakeText };
    const fakeHandle = {
      kind: "file" as const,
      getFile: async () => fakeFile,
    };

    let capturedPath = "";
    let capturedState: unknown = null;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Consumer />
        <Routes>
          <Route path="*" element={<LocationProbe onLoc={(p, s) => { capturedPath = p; capturedState = s; }} />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(consumer).not.toBeNull();

    // Wrap the consumer invocation in `act` so React flushes the navigate()
    // state update before we assert. Replaces a prior `setTimeout(0)` flush
    // that was not reliable under React 19 concurrent rendering.
    await act(async () => {
      await consumer!({ files: [fakeHandle] });
    });

    // `waitFor` guards against any remaining scheduler churn and makes the
    // assertion deterministic even if LocationProbe re-renders in multiple
    // passes.
    await waitFor(() => {
      expect(capturedPath).toBe("/settings/import");
    });
    expect(capturedState).toEqual({ launchYaml: fakeText });
  });
});
```

Key changes from the original:
- Added `act` and `waitFor` to the `@testing-library/react` import.
- Replaced the inner `type Consumer` alias with `LaunchConsumer` so the outer `Consumer` component name is not shadowed (a latent readability issue worth tidying while we are in this file).
- Wrapped `await consumer!({ files: [fakeHandle] })` in `await act(async () => { ... })`.
- Replaced `await new Promise((r) => setTimeout(r, 0))` with `await waitFor(() => expect(capturedPath).toBe(...))`.

- [ ] **Step 3: Run the single test 20 times to confirm determinism**

Run:
```bash
for i in $(seq 1 20); do
  echo "=== run $i ===";
  npm test -- tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx --reporter=dot 2>&1 | tail -5;
done
```

Expected: 20 out of 20 passes. Zero `act(...)` warnings on stderr. If any run fails or warns, stop — the fix is incomplete. Re-read the Root Cause section, check whether `navigate` is routed through a path the `waitFor` does not observe, and fix before proceeding.

- [ ] **Step 4: Run the full suite once to confirm no regression**

Run:
```bash
npm test 2>&1 | tail -10
```

Expected: `Test Files  N passed` with the same counts captured in Task 1 Step 5 (reporter output varies slightly across vitest versions; focus on "0 failed" and unchanged total).

- [ ] **Step 5: Commit**

Run:
```bash
git add tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx
git commit -m "$(cat <<'EOF'
test(hooks): eliminate useRoutineLaunchQueue act() flake

Wrap the captured launchQueue consumer invocation in React's `act` so
the navigate() state update flushes before assertions. Replace the
prior `setTimeout(0)` microtask flush with `waitFor`, which is
deterministic under React 19 concurrent rendering.

Baseline (before fix): [N]/20 runs failed or emitted act() warnings.
After fix: 20/20 runs pass, zero warnings.

Part of sprint-1/test-harness-stabilization.
EOF
)"
```

Replace `[N]` with the failure count from Task 1 Step 4. Expected: commit created with that SHA.

---

## Task 3: Fix `AppRoutes` Test

**Files:**
- Modify: `web/tests/unit/app/AppRoutes.test.tsx`

- [ ] **Step 1: Confirm clean state on the file**

Run:
```bash
git diff HEAD -- tests/unit/app/AppRoutes.test.tsx
```

Expected: empty diff.

- [ ] **Step 2: Apply the fix — pre-warm lazy chunks, add explicit timeouts**

Replace the contents of `web/tests/unit/app/AppRoutes.test.tsx` with:

```tsx
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

// Mock the PWA register hook before importing App (transitive via SWUpdatePrompt).
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(async () => {}),
  }),
}));

import { AppRoutes } from "@/app/App";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import type { Settings } from "@/domain/types";

// Pre-warm the lazy route modules this suite drives. React.lazy() calls
// import() at first render; if the chunk has not been evaluated yet, the
// <Suspense> fallback ("Loading...") can outlast React Testing Library's
// default 1000ms findBy* timeout under full-suite parallelism. Awaiting
// these imports once up-front populates the ESM module cache, so the
// subsequent React.lazy() factory resolves synchronously.
//
// See docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md
// for the investigation.
beforeAll(async () => {
  await Promise.all([
    import("@/features/onboarding/OnboardingWelcomeScreen"),
    import("@/features/today/TodayScreen"),
  ]);
});

/** Timeout used for all findBy*/waitFor calls in this suite. 4000ms is
 * comfortably below Vitest's 5000ms per-test limit and well above the
 * observed async cost of useAppInit + useSettings on slow workers. */
const WAIT_TIMEOUT = 4000;

async function seedSettings(overrides: Partial<Settings> = {}) {
  const db = new ExerciseLoggerDB();
  await initializeSettings(db);
  await db.settings.clear();
  await db.settings.put({
    id: "user",
    activeRoutineId: null,
    units: "kg",
    userName: null,
    onboardingCompletedAt: null,
    onboardingSkippedAt: null,
    lastGeneratedPrompt: null,
    lastGeneratedPromptAt: null,
    onboardingBannerDismissedAt: null,
    ...overrides,
  });
  await db.close();
}

describe("AppRoutes first-run gate", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("fresh install at / redirects to /onboarding (welcome screen)", async () => {
    await seedSettings();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    // Welcome screen hero heading.
    expect(
      await screen.findByRole(
        "heading",
        { name: /what should we call you/i },
        { timeout: WAIT_TIMEOUT }
      )
    ).toBeInTheDocument();
  });

  it("completed user at / stays on Today (no redirect)", async () => {
    await seedSettings({ onboardingCompletedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    // Today's greeting surfaces.
    await waitFor(
      () => {
        expect(
          screen.queryByRole("heading", { name: /what should we call you/i })
        ).not.toBeInTheDocument();
      },
      { timeout: WAIT_TIMEOUT }
    );
  });

  it("skipped user at / stays on Today", async () => {
    await seedSettings({ onboardingSkippedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    await waitFor(
      () => {
        expect(
          screen.queryByRole("heading", { name: /what should we call you/i })
        ).not.toBeInTheDocument();
      },
      { timeout: WAIT_TIMEOUT }
    );
  });

  it("skipped user at /onboarding redirects to /", async () => {
    await seedSettings({ onboardingSkippedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    await waitFor(
      () => {
        expect(
          screen.queryByRole("heading", { name: /what should we call you/i })
        ).not.toBeInTheDocument();
      },
      { timeout: WAIT_TIMEOUT }
    );
  });

  it("completed user at /onboarding redirects to /", async () => {
    await seedSettings({ onboardingCompletedAt: new Date().toISOString() });
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <AppRoutes />
      </MemoryRouter>
    );
    await waitFor(
      () => {
        expect(
          screen.queryByRole("heading", { name: /what should we call you/i })
        ).not.toBeInTheDocument();
      },
      { timeout: WAIT_TIMEOUT }
    );
  });
});
```

Key changes from the original:
- Added `beforeAll` import from `vitest`.
- Added a `beforeAll` block that pre-warms two lazy route modules (`OnboardingWelcomeScreen`, `TodayScreen`).
- Introduced a `WAIT_TIMEOUT = 4000` constant.
- Passed `{ timeout: WAIT_TIMEOUT }` to `findByRole` and `waitFor` in every test case.
- Preserved the mock of `virtual:pwa-register/react`, the `seedSettings` helper, and the `sessionStorage.clear()` in `beforeEach` — no behavior change there.

- [ ] **Step 3: Run the single test file 20 times to confirm determinism**

Run:
```bash
for i in $(seq 1 20); do
  echo "=== run $i ===";
  npm test -- tests/unit/app/AppRoutes.test.tsx --reporter=dot 2>&1 | tail -5;
done
```

Expected: 20 out of 20 passes. If any run fails with a timeout, the 4000ms bound was exceeded — investigate whether a new async gate was added to `useAppInit` recently (e.g. new catalog seed step) and either extend the timeout or pre-warm an additional module. Do NOT raise `WAIT_TIMEOUT` past 4500ms; at that point the root cause is elsewhere.

- [ ] **Step 4: Run the full suite once to confirm no regression**

Run:
```bash
npm test 2>&1 | tail -10
```

Expected: `Test Files  N passed | 0 failed` with unchanged total counts.

- [ ] **Step 5: Commit**

Run:
```bash
git add tests/unit/app/AppRoutes.test.tsx
git commit -m "$(cat <<'EOF'
test(app): stabilize AppRoutes first-run gate suite

Pre-warm the lazy OnboardingWelcomeScreen and TodayScreen modules in a
beforeAll so React.lazy()'s factory resolves synchronously from the ESM
cache. Without this, the <Suspense> fallback could outlast React Testing
Library's default 1000ms findBy* timeout under full-suite parallelism.
Also pass an explicit 4000ms timeout to all findByRole/waitFor calls as
a bound on the remaining useAppInit + useSettings async gates.

Baseline (before fix): [N]/20 runs failed with "Unable to find an
accessible element with the role 'heading'".
After fix: 20/20 runs pass.

Part of sprint-1/test-harness-stabilization.
EOF
)"
```

Replace `[N]` with the failure count from Task 1 Step 3.

---

## Task 4: Loop Verification — Both Tests Together 20x

Fixing the two tests in isolation is not sufficient. We need to confirm the two fixes compose under full-suite parallelism, because the suspected root cause on `AppRoutes` is worker-contention during full runs.

**Files:** None modified.

- [ ] **Step 1: Run the full suite 5 times, recording any failures**

Run:
```bash
for i in $(seq 1 5); do
  echo "=== full-suite run $i ===";
  npm test --silent 2>&1 | tail -5;
done
```

Expected: every run ends with `0 failed`. If any run shows a failure in either fixed test file, the fix did not hold under parallel load — gather the failure message and return to Task 2 Step 3 or Task 3 Step 3 to extend the fix (e.g. pre-warm another module, or investigate whether another test is mutating shared state like `globalThis.launchQueue`).

- [ ] **Step 2: Run the two fixed files concurrently in a loop**

This exercises the specific interleaving where both test files contend for the event loop.

Run:
```bash
for i in $(seq 1 10); do
  echo "=== pair run $i ===";
  npm test -- \
    tests/unit/app/AppRoutes.test.tsx \
    tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx \
    --reporter=dot 2>&1 | tail -5;
done
```

Expected: 10 out of 10 clean runs. No failures, no `act(...)` warnings.

- [ ] **Step 3: No commit in this task**

Diagnostic-only task. The verification evidence goes into Task 6's PR description.

---

## Task 5: Full Suite Three-Consecutive-Runs Gate

This is the Sprint 1 Exit Criterion: `npm test` passes three consecutive runs with zero flag overrides.

**Files:** None modified.

- [ ] **Step 1: Run `npm test` three times back to back and tee the output**

Run:
```bash
for i in 1 2 3; do
  echo "=== run $i ==="
  npm test 2>&1 | tee "/tmp/sprint1-run-$i.log" | tail -5
done
```

Expected: each of the three runs ends with `Test Files  N passed | 0 failed` and the same totals we captured in Task 1 Step 5.

- [ ] **Step 2: Diff the three logs to confirm identical shapes**

Run:
```bash
diff /tmp/sprint1-run-1.log /tmp/sprint1-run-2.log | head -30
diff /tmp/sprint1-run-2.log /tmp/sprint1-run-3.log | head -30
```

Expected: only numeric-duration lines differ (e.g., "Duration 12.34s" vs "Duration 12.51s"). If any test name or status differs, the suite is still non-deterministic — return to the relevant task.

- [ ] **Step 3: Run `npm run lint` and `npm run typecheck`**

Run:
```bash
npm run lint
```

Expected: exit code 0; no ESLint errors. If errors surface in the modified test files, fix them. Common source: unused imports (we added `beforeAll` but if the linter disagrees on import order, re-run `--fix`).

Run:
```bash
npm run typecheck
```

Expected: exit code 0; no TypeScript errors. If errors surface from the `LaunchConsumer` type rename in Task 2 Step 2, confirm the type is declared inside the test function where it is used (it is) and has no external consumers (it does not).

- [ ] **Step 4: Run `npm run build`**

Run:
```bash
npm run build
```

Expected: exit code 0. This runs `tsc -b` followed by `vite build`. Since we did not touch source, the only way this fails is if the tsconfig includes test files — which it does not (verify with `cat tsconfig.app.json` if curious). Still, a passing build is required by the sprint's Exit Criteria.

- [ ] **Step 5: Run `npm run test:e2e` as a final gate**

Run:
```bash
npm run test:e2e
```

Expected: exit code 0. 20 Playwright tests pass. This step also functions as a regression check against the source we did not change — if any E2E fails, investigate before merging (it should not, because this sprint's changes are test-only).

- [ ] **Step 6: No commit in this task**

All gates passed; no source changes in this task. Evidence rolls into the PR body in Task 6.

---

## Task 6: Open PR, Confirm CI, Merge

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md` — tick Exit Criteria in the roadmap link.
- Modify: `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md` — mark Sprint 1 complete in the Rollup checklist.

- [ ] **Step 1: Push the branch**

Run:
```bash
git push -u origin sprint-1/test-harness-stabilization
```

Expected: `* [new branch] sprint-1/test-harness-stabilization -> sprint-1/test-harness-stabilization` and a PR creation hint.

- [ ] **Step 2: Open the PR**

Run:
```bash
gh pr create --title "test: stabilize npm test (sprint 1)" --body "$(cat <<'EOF'
## Summary

Sprint 1 of the [v2 Post-Audit Hardening Roadmap](../blob/main/docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md). Roots out two intermittent unit-test failures so `npm test` passes three consecutive runs with no flag overrides.

- **`useRoutineLaunchQueue` act flake.** The captured launchQueue consumer's `navigate()` call updated router state outside an `act(...)` wrapper. Wrapped the consumer invocation in `act(async () => { ... })` and replaced the `setTimeout(0)` microtask flush with `waitFor`.
- **`AppRoutes` Suspense race.** `React.lazy(() => import("@/features/onboarding/OnboardingWelcomeScreen"))` could outlast React Testing Library's default 1000ms `findBy*` timeout under full-suite parallelism. Pre-warmed the lazy module in a `beforeAll` so the subsequent `React.lazy` factory resolves synchronously from the ESM cache. Passed explicit `{ timeout: 4000 }` to all `findByRole`/`waitFor` as defense-in-depth against the remaining `useAppInit`/`useSettings` async gates.

No source changes. No Vitest config change. No `package.json` change. No new dependencies.

## Evidence

- `tests/unit/shared/hooks/useRoutineLaunchQueue.test.tsx`: 20/20 clean runs, zero `act(...)` warnings.
- `tests/unit/app/AppRoutes.test.tsx`: 20/20 clean runs.
- Both files together: 10/10 clean pair runs.
- `npm test`: 3/3 clean consecutive full-suite runs.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`: all pass.

## Test plan

- [ ] CI run 1 green on this PR.
- [ ] CI run 2 green (manual re-run of `test` job).
- [ ] CI run 3 green (manual re-run of `test` job).
- [ ] Local `npm test` three consecutive runs green on a fresh clone.

Closes the Sprint 1 row in the roadmap Rollup.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. Visit it in the browser.

- [ ] **Step 3: Wait for CI run 1 to complete**

Run:
```bash
gh pr checks --watch
```

Expected: all checks green. If any fail:
- If a deployment check fails because the preview environment can't be reached, that is orthogonal to this PR — coordinate with the user.
- If the `test` job fails, this sprint's fix did not hold on CI. Pull the failing test's output (`gh run view --log-failed`), identify whether it is one of the two targeted tests or a different flake, and return to Task 3 or Task 4.

- [ ] **Step 4: Trigger two more CI runs to confirm three-consecutive-green**

Get the latest run ID:
```bash
LATEST_RUN=$(gh run list --branch sprint-1/test-harness-stabilization --limit 1 --json databaseId --jq '.[0].databaseId')
echo "Latest run: $LATEST_RUN"
```

Re-run twice:
```bash
gh run rerun "$LATEST_RUN"
# Wait for completion, then:
gh pr checks --watch
```

Repeat once more for the third consecutive run. Expected: three consecutive green CI results on the same commit.

- [ ] **Step 5: Update the roadmap and plan checkboxes**

In `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md`, under "Sprint 1 — Test Harness Stabilization" → "Exit Criteria", mark all four checkboxes complete. Also tick the corresponding Sprint 1 items in the "Rollup" section of that file (specifically, the `npm test passes three consecutive CI runs without any timeout overrides` line).

In this file (`docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md`), mark the Self-Review and Exit Criteria sections at the bottom complete.

- [ ] **Step 6: Commit the doc updates**

Run:
```bash
git add docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md
git commit -m "$(cat <<'EOF'
docs: mark sprint 1 exit criteria complete

Three consecutive CI runs green on sprint-1/test-harness-stabilization
after pre-warming lazy route modules and wrapping navigate() state
updates in act().
EOF
)"
git push
```

Expected: commit pushed; CI re-runs green on the new commit as well (fourth consecutive green, gravy).

- [ ] **Step 7: Merge the PR**

Run:
```bash
gh pr merge --squash --delete-branch
```

Expected: PR merged; branch deleted locally and on origin.

- [ ] **Step 8: Clean up local branch references**

Run:
```bash
git checkout main
git pull
git remote prune origin
```

Expected: on `main` with Sprint 1's squash commit at `HEAD`.

---

## Exit Criteria

- [x] Both flaky tests pass 20 consecutive local runs each.
- [x] The pair runs 10 consecutive times together.
- [x] `npm test` passes three consecutive local runs with no flag overrides.
- [x] `npm test` passes one CI run on the PR branch (3-run requirement relaxed by user).
- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e` all pass.
- [x] No source-code files in `web/src/**` were modified.
- [x] No Vitest config changes (no `testTimeout` bump).
- [x] Roadmap Sprint 1 Exit Criteria ticked and referenced in the merge commit.
- [x] PR merged, branch deleted.

---

## Risks And Contingencies

### Risk 1: `AppRoutes` 20x loop still flakes after pre-warm + 4000ms

The suite has a second async source we did not anticipate. Diagnose:
```bash
npm test -- tests/unit/app/AppRoutes.test.tsx --reporter=verbose 2>&1 | grep -E "(FAIL|TIMEOUT|warn)"
```
Likely culprits:
1. `useAppInit` added another async step (e.g. a new catalog seed, a new default-routine import) that pushes total init time past 4000ms. Fix: increase `WAIT_TIMEOUT` to 5000ms (still within Vitest's `testTimeout`), OR move the DB seed into the test harness so `useAppInit`'s work is amortized.
2. A sibling suite mutates `globalThis` or IndexedDB state mid-test. Fix: ensure each test seeds fresh state (it does) and that `fake-indexeddb` resets per test (it does via the `fake-indexeddb/auto` import).

### Risk 2: `useRoutineLaunchQueue` 20x loop warns on `act` even after the wrap

The fix assumes the only `navigate`-driven re-render is captured inside `await consumer!(...)`. If there is a follow-up effect — say a post-navigate listener that calls `setState` — it may fire outside the wrapped `act`. Diagnose by searching for other effects triggered by route changes in the hook's dependency tree. If found, widen the `act` wrapper to cover the subsequent effect or await an explicit post-navigate signal.

### Risk 3: CI's hardware is slower than the dev machine

CI runners may take longer on `useAppInit` than local. If 4000ms is tight on CI but fine locally, widen to 5000ms. Do NOT widen beyond Vitest's `testTimeout` (5000ms) — that would force a `testTimeout` raise, which this sprint explicitly avoids. If CI consistently exceeds 5000ms for this single test, the right move is to mock `useAppInit` (Risk 1 fix option 2), not to pad timeouts further.

### Risk 4: Another test elsewhere in the suite is also flaky

The baseline in Task 1 Step 5 may reveal a third flaky test we didn't know about. If Task 5 Step 1 reveals a failure in a test NOT in scope for this sprint, scope check:
- If it is clearly a related CI-stability issue (e.g. another Suspense race), extend this sprint to cover it.
- If it is a different concern (e.g. timezone-sensitive assertion), file a follow-up issue and proceed. Sprint 1 is not a grab-bag.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage.** The Sprint 1 spec (roadmap section) requires fixing F4 and verifying `npm test` passes three consecutive runs with no flags. Task 2 fixes `useRoutineLaunchQueue`. Task 3 fixes `AppRoutes`. Task 5 Step 1 runs the three-consecutive-runs gate. Task 6 verifies on CI. No spec item is unmet.
- [x] **Placeholder scan.** No TBDs, no "add appropriate error handling," no "similar to Task N." All code blocks contain the exact content to paste.
- [x] **Type consistency.** The test file exports `AppRoutes` (matching the source at `web/src/app/App.tsx:126`). `Settings` type imported from `@/domain/types` matches `seedSettings` usage. The `LaunchConsumer` type rename in Task 2 is scoped to the test and does not leak. `WAIT_TIMEOUT = 4000` is used uniformly in Task 3.
- [x] **No source code changes.** Every modified path starts with `tests/` or `docs/`.
- [x] **Commands are exact.** All commands use `npm test -- <path>` (the double-dash separator that `npm` requires to pass flags through to the script). All `seq 1 N` loops use POSIX syntax compatible with Git Bash on Windows.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-sprint-1-test-harness-stabilization.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**

**If Subagent-Driven chosen:** REQUIRED SUB-SKILL — `superpowers:subagent-driven-development`. Fresh subagent per task + two-stage review between tasks.

**If Inline Execution chosen:** REQUIRED SUB-SKILL — `superpowers:executing-plans`. Batch execution with checkpoints for review.
