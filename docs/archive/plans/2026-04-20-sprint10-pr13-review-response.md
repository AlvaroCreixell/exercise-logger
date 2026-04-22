# Sprint 10 PR #13 Review Response Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address the actionable review comments on PR #13 (Sprint 10 — Workout screen redesign) from Codex and CodeRabbit: stop rounding displayed weights, hide the progress chip for extra exercises, tighten the E2E save-set assertion, sync the elapsed timer immediately, and tighten one SessionProgress test. Leave a clean PR that is ready to merge.

**Architecture:** All fixes are small, localized edits inside `web/src/features/workout/`. Each fix is driven by a failing test first (TDD). No new abstractions, no prop/type changes, no token changes. The existing worktree at `C:/Users/creix/VSC Projects/exercise_logger-sprint10-workout` on branch `sprint-10-workout` is the execution surface — do not do this work on `main`.

**Tech Stack:** React 19 + Vite + TypeScript, Vitest + RTL for unit tests, Playwright for E2E. Unit conversion helpers live in `web/src/domain/unit-conversion.ts` and are already precision-safe — the bug is only that two display sites wrap them in `Math.round(...)`.

---

## Context & scope

### In-scope fixes on `sprint-10-workout`

Six fixes originating from PR #13 review comments:

| ID | File | Reviewer(s) | Severity |
|----|------|-------------|----------|
| T1 | `web/src/features/workout/SetRow.tsx` | Codex (P2) + CodeRabbit (Major) | Data-accuracy regression |
| T2 | `web/src/features/workout/ExerciseCard.tsx` (`formatHintValue`) | CodeRabbit (Major) | Data-accuracy regression |
| T3 | `web/src/features/workout/ExerciseCard.tsx` (header chip) | Codex (P2) + CodeRabbit (Minor) | Misleading UI on extras |
| T4 | `web/tests/e2e/full-workflow.spec.ts` | CodeRabbit (Minor) | Weak E2E assertion |
| D1 | `web/src/features/workout/WorkoutScreen.tsx` (elapsed sync) | CodeRabbit (Minor) | ~1s initial-render delay on elapsed counter |
| D2 | `web/tests/unit/features/workout/SessionProgress.test.tsx` | CodeRabbit (Nitpick) | Test name doesn't match assertion |

### Pushback (out of scope for this plan — handled in follow-up #2 below)

- **S1** — CodeRabbit wants `./SetRow` / `./SessionHeader` / `./lib/formatSetTarget` relative imports rewritten as `@/features/workout/...`. Pushback: CLAUDE.md says `@/` *maps to* `web/src/` (a path-alias capability), not that all imports must use the alias. The repo-wide convention uses relative paths for same-folder siblings (AppShell, HistoryScreen, every feature's test suite). Rewriting three imports would introduce inconsistency, not fix it. We will respond & resolve on the PR after these fixes land.

### Related follow-up work (tracked here so nothing slips — not implemented by this plan)

1. **After this plan lands and re-review passes, merge PR #13** into `main`.
2. **Respond on PR #13** to the three CodeRabbit nitpicks (path-alias S1 + the two alias suggestions) with the pushback reasoning above, then resolve those threads.
3. **PR #14 (Sprint 8 retrospective) — land two fixes on `main`:**
   - `web/src/features/history/SessionDetailExerciseCard.tsx` — `formatPillContent` uses `Math.round(toDisplayWeight(...))` on set pills. Same invariant violation as T1/T2. (Codex P1.)
   - `web/src/features/history/lib/sessionStats.ts` — `formatShortDuration` floors minutes while the stats tile rounds; pick nearest-minute rounding in both. (Codex P2.)
   Then close PR #14 **unmerged** with a comment pointing at the fix commit.
4. **Close PR #8** (`feat/hero-muscle-summary`) — superseded by Sprint 7's `features/today/lib/muscleGroups.ts` + `deriveDayMuscleGroups`. Delete the `feat/hero-muscle-summary` branch on origin and locally.
5. **After #3 and #4 land, delete stale remote branches:**
   - `origin/review/sprint-8`
   - `origin/review-base/sprint-8`
   - `origin/feat/hero-muscle-summary`
   - `origin/sprint-9-settings` (PR #12 was already merged)
   - `origin/sprint-10-workout` (after PR #13 merges)
6. **Clean up untracked files in the main worktree** — decide per file whether to commit, move, or delete:
   - `docs/claude_design_handoffs/screenshots/image.png`
   - `docs/superpowers/plans/2026-04-19-sprint9-settings-import.md`
   - `docs/superpowers/plans/2026-04-20-sprint9-pr12-review-response.md`
   - `docs/superpowers/plans/2026-04-20-sprint10-workout-screen.md`

---

## File structure

All modifications — no new files.

**Source files touched:**

- `web/src/features/workout/SetRow.tsx` — remove `Math.round` in `formatLoggedValue` (T1).
- `web/src/features/workout/ExerciseCard.tsx` — remove `Math.round` in `formatHintValue` (T2); gate the `N/M` header chip on `totalPrescribed > 0` (T3).
- `web/src/features/workout/WorkoutScreen.tsx` — sync `elapsedSec` on effect entry (D1).

**Tests touched:**

- `web/tests/unit/features/workout/SetRow.test.tsx` — add fractional-weight test (T1).
- `web/tests/unit/features/workout/ExerciseCard.test.tsx` — add fractional-weight hint test (T2); add "no chip for extras" test and assert existing routine chip still renders (T3).
- `web/tests/e2e/full-workflow.spec.ts` — strengthen post-save assertion (T4).
- `web/tests/unit/features/workout/WorkoutScreen.test.tsx` — add "elapsed syncs on session load" test (D1).
- `web/tests/unit/features/workout/SessionProgress.test.tsx` — assert `tabular-nums` class to match test name (D2).

**Docs touched:**

- `CLAUDE.md` — bump the Vitest count in the Commands section to reflect the new tests (one bump at the end).

---

## Preflight

- [ ] **Step 0.1: Confirm worktree**

Run from repo root:
```bash
git worktree list
```
Expected output contains:
```
C:/Users/creix/VSC Projects/exercise_logger-sprint10-workout  ... [sprint-10-workout]
```

- [ ] **Step 0.2: Switch into the sprint-10 worktree for all subsequent work**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger-sprint10-workout"
git status
```
Expected: `On branch sprint-10-workout`, working tree clean.

- [ ] **Step 0.3: Baseline test run**

```bash
cd web && npm test -- --run
```
Expected: all tests pass (Sprint 10's current baseline is 654; actual count may drift slightly). Note the exact pass count — we will update `CLAUDE.md` at the end.

---

## Task 1 (T1): Preserve fractional weight in SetRow display

**Files:**
- Modify: `web/src/features/workout/SetRow.tsx:29-34`
- Test: `web/tests/unit/features/workout/SetRow.test.tsx`

**Why:** `formatLoggedValue` wraps `toDisplayWeight` in `Math.round`, so a logged `70.5 kg` renders as `71` and lb conversions lose decimals. CLAUDE.md invariant #12: "`toCanonicalKg` and `toDisplayWeight` do not round — user input is stored and displayed with full precision."

- [ ] **Step 1.1: Write the failing test**

Add this test to `web/tests/unit/features/workout/SetRow.test.tsx`, inside the existing `describe("SetRow — logged state", …)` block:

```tsx
  it("renders fractional kg without rounding (70.5, not 71)", () => {
    render(
      <SetRow
        setNumber={1}
        loggedSet={makeLoggedSet({ performedWeightKg: 70.5, performedReps: 5 })}
        units="kg"
        isTopBlock={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("70.5")).toBeVisible();
    expect(screen.queryByText("71")).toBeNull();
  });

  it("renders fractional lbs conversion without rounding", () => {
    // 45 kg = 99.2075… lbs → must not become "99"
    render(
      <SetRow
        setNumber={1}
        loggedSet={makeLoggedSet({ performedWeightKg: 45, performedReps: 5 })}
        units="lbs"
        isTopBlock={false}
        onClick={() => {}}
      />,
    );
    // At minimum, the primary label contains a decimal point (i.e. is not the integer "99").
    const primary = screen.getByText(/^99(\.\d+)?$/);
    expect(primary.textContent).toContain(".");
  });
```

- [ ] **Step 1.2: Run the new tests and confirm they fail**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetRow.test.tsx
```
Expected: both new tests FAIL — first expects `70.5`, sees `71`; second expects a decimal, sees integer.

- [ ] **Step 1.3: Apply the fix**

In `web/src/features/workout/SetRow.tsx`, replace lines 29-35 (the `if (ls.performedWeightKg != null && ls.performedReps != null)` branch):

```tsx
  if (ls.performedWeightKg != null && ls.performedReps != null) {
    return {
      primary: `${toDisplayWeight(ls.performedWeightKg, units)}`,
      unit: units,
      secondary: `${ls.performedReps}`,
    };
  }
```

(Change is the single line: drop `Math.round(` and the trailing `)`.)

- [ ] **Step 1.4: Re-run SetRow tests**

```bash
cd web && npm test -- --run tests/unit/features/workout/SetRow.test.tsx
```
Expected: all SetRow tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add web/src/features/workout/SetRow.tsx web/tests/unit/features/workout/SetRow.test.tsx
git commit -m "fix(workout): preserve fractional weight precision in SetRow display

Math.round on toDisplayWeight violated the CLAUDE.md invariant that
user-logged values are displayed with full precision. Drops the round
and adds regression tests for kg fractional values and lbs conversion."
```

---

## Task 2 (T2): Preserve fractional weight in ExerciseCard hint/LAST strip

**Files:**
- Modify: `web/src/features/workout/ExerciseCard.tsx:28-30` (`formatHintValue`)
- Test: `web/tests/unit/features/workout/ExerciseCard.test.tsx`

**Why:** `formatHintValue` is used for (a) the LAST strip and (b) empty-row "Tap to log · last {hint}". Both sites round with `Math.round`, so `70.5×5` renders as `71×5`. Same invariant violation as T1.

- [ ] **Step 2.1: Write the failing test**

Add a new `describe` block at the bottom of `web/tests/unit/features/workout/ExerciseCard.test.tsx`:

```tsx
describe("ExerciseCard — LAST strip / hint formatting", () => {
  it("renders fractional LAST weight without rounding (70.5, not 71)", () => {
    const se = makeSessionExercise();
    const historyData = {
      lastTime: [
        {
          sets: [
            { weightKg: 70.5, reps: 5, durationSec: null, distanceM: null },
          ],
        },
      ],
      // Unused fields in the formatter path — keep as any-shaped placeholders.
    } as unknown as ExerciseHistoryData;
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={historyData}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText(/LAST 70\.5×5/)).toBeVisible();
    expect(screen.queryByText(/LAST 71×5/)).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run the new test and confirm it fails**

```bash
cd web && npm test -- --run tests/unit/features/workout/ExerciseCard.test.tsx
```
Expected: new test FAILS — sees `LAST 71×5`.

- [ ] **Step 2.3: Apply the fix**

In `web/src/features/workout/ExerciseCard.tsx`, replace line 29 inside `formatHintValue`:

```tsx
  if (set.weightKg != null && set.reps != null) {
    return `${toDisplayWeight(set.weightKg, units)}×${set.reps}`;
  }
```

(Single line: drop `Math.round(` and its closing `)`.)

- [ ] **Step 2.4: Re-run ExerciseCard tests**

```bash
cd web && npm test -- --run tests/unit/features/workout/ExerciseCard.test.tsx
```
Expected: all tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add web/src/features/workout/ExerciseCard.tsx web/tests/unit/features/workout/ExerciseCard.test.tsx
git commit -m "fix(workout): preserve fractional weight in LAST strip and empty-row hint

Same rounding violation as SetRow — formatHintValue wrapped
toDisplayWeight in Math.round. Drop the round and add a LAST strip
regression test."
```

---

## Task 3 (T3): Hide N/M progress chip for extra exercises

**Files:**
- Modify: `web/src/features/workout/ExerciseCard.tsx:94-99` (the header chip span)
- Test: `web/tests/unit/features/workout/ExerciseCard.test.tsx`

**Why:** Extras have no prescribed `setBlocksSnapshot`, so `totalPrescribed === 0` and the chip renders `0/0` even after the user logs extra sets. The chip is semantically meaningless for extras (there is no prescription). Gate the render on `totalPrescribed > 0`.

We are explicitly picking CodeRabbit's "hide" over Codex's "count extras". Reason: "X of Y sets logged" with no Y is not a progress fraction; a running counter for extras is a different UI affordance and out of scope for a review-response fix.

- [ ] **Step 3.1: Write the failing test**

Add these tests at the end of the existing `describe("ExerciseCard — header", …)` block in `web/tests/unit/features/workout/ExerciseCard.test.tsx` (after the "renders the progress chip N/M" test):

```tsx
  it("does not render the N/M chip for extra exercises (no prescribed blocks)", () => {
    const extraSe = makeSessionExercise({
      id: "se-extra",
      origin: "extra",
      setBlocksSnapshot: [],
    });
    const extraLogged = makeLoggedSet({
      id: "ls-extra-1",
      sessionExerciseId: "se-extra",
      origin: "extra",
      blockIndex: 0,
      setIndex: 0,
    });
    render(
      <ExerciseCard
        sessionExercise={extraSe}
        loggedSets={[extraLogged]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.queryByLabelText(/of \d+ sets logged/i)).toBeNull();
    expect(screen.queryByText("0/0")).toBeNull();
    expect(screen.queryByText("1/0")).toBeNull();
  });

  it("still renders the chip for routine exercises with prescribed blocks", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />,
    );
    expect(screen.getByText("0/3")).toBeVisible();
  });
```

- [ ] **Step 3.2: Run the new tests and confirm the first one fails**

```bash
cd web && npm test -- --run tests/unit/features/workout/ExerciseCard.test.tsx
```
Expected: first new test FAILS (chip is visible for extras); second passes (routine chip already renders).

- [ ] **Step 3.3: Apply the fix**

In `web/src/features/workout/ExerciseCard.tsx`, wrap the existing chip span (currently lines 94-99) in a `totalPrescribed > 0` guard. Replace:

```tsx
          <span
            aria-label={`${totalLogged} of ${totalPrescribed} sets logged`}
            className="shrink-0 text-xs font-semibold text-ink-3 tabular-nums"
          >
            {totalLogged}/{totalPrescribed}
          </span>
```

with:

```tsx
          {totalPrescribed > 0 && (
            <span
              aria-label={`${totalLogged} of ${totalPrescribed} sets logged`}
              className="shrink-0 text-xs font-semibold text-ink-3 tabular-nums"
            >
              {totalLogged}/{totalPrescribed}
            </span>
          )}
```

- [ ] **Step 3.4: Re-run ExerciseCard tests**

```bash
cd web && npm test -- --run tests/unit/features/workout/ExerciseCard.test.tsx
```
Expected: all tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add web/src/features/workout/ExerciseCard.tsx web/tests/unit/features/workout/ExerciseCard.test.tsx
git commit -m "fix(workout): hide N/M progress chip for extras with no prescription

Extras have totalPrescribed=0, so the chip rendered a meaningless 0/0.
Gate the span on totalPrescribed>0. Adds regression tests for both the
extra (hidden) and routine (still shown) paths."
```

---

## Task 4 (T4): Strengthen E2E assertion after saving a set

**Files:**
- Modify: `web/tests/e2e/full-workflow.spec.ts:69-70`

**Why:** The current assertion `page.getByRole("button", { name: /^Set 1:/ }).first()` matches both the empty-state label (`"Set 1: empty, tap to log"`) and the logged label (`"Set 1: 60kg × 10"`). A regression that silently fails to save would still pass this check. Tighten it to (1) sheet closed and (2) the row's name is not the empty-state label.

SetRow's accessible names (verified in source): logged → `Set {n}: {primary}{unit} × {secondary}`; empty → `Set {n}: empty, tap to log...`. Excluding `empty` is a reliable signal.

- [ ] **Step 4.1: Apply the fix to the E2E spec**

In `web/tests/e2e/full-workflow.spec.ts`, replace line 70:

```ts
    // Sheet should close; the logged set should appear (success toast or slot update).
    await expect(page.getByRole("button", { name: /^Set 1:/ }).first()).toBeVisible();
```

with:

```ts
    // Sheet should close and the Set 1 row should reflect the logged state (no longer "empty").
    await expect(weightInput).toBeHidden({ timeout: 3000 });
    await expect(
      page.getByRole("button", { name: /^Set 1: (?!empty\b)/ }).first(),
    ).toBeVisible();
```

Note: `weightInput` is already declared earlier in the same test (line 57). No new locator needed.

- [ ] **Step 4.2: Run the E2E suite**

```bash
cd web && npm run test:e2e
```
Expected: 9/9 specs pass.

If this is too heavy locally, as a fast alternative run a targeted playwright invocation after starting preview manually:

```bash
cd web && npm run preview &
npx playwright test tests/e2e/full-workflow.spec.ts --project="Pixel 7"
```

- [ ] **Step 4.3: Commit**

```bash
git add web/tests/e2e/full-workflow.spec.ts
git commit -m "test(e2e): tighten post-save assertion to require non-empty Set 1 label

Previous assertion matched both empty and logged Set 1 states, so a
silent save failure would still pass. Now asserts the sheet closed and
the button name is not the empty-state label."
```

---

## Task 5 (D1): Sync elapsed seconds immediately when `startedAt` becomes available

**Files:**
- Modify: `web/src/features/workout/WorkoutScreen.tsx:50-56`
- Test: `web/tests/unit/features/workout/WorkoutScreen.test.tsx`

**Why:** `useState` initializer only runs on first mount. If `useActiveSession()` resolves to `undefined` on first render (the usual case with `useLiveQuery`), then later returns a session, `elapsedSec` sits at `0` until the first interval tick (~1s). Cheap one-line fix: recompute on effect entry.

- [ ] **Step 5.1: Write the failing test**

Read the existing `WorkoutScreen.test.tsx` to confirm the `seedRoutineAndExercises`, `renderWorkout`, and `startSessionWithCatalog` helpers are available; they already are (lines 1-60 and below). At the bottom of the file, add a new test:

```tsx
describe("WorkoutScreen — elapsed timer sync", () => {
  it("shows non-zero elapsed immediately after the active session loads", async () => {
    const routine = await seedRoutineAndExercises();
    // Start the session 30 seconds in the past so there is a measurable elapsed value.
    const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();
    await startSessionWithCatalog(db, routine.id, routine.nextDayId);
    const active = await db.sessions.where("status").equals("active").first();
    if (!active) throw new Error("expected an active session to seed");
    await db.sessions.update(active.id, { startedAt: thirtySecondsAgo });

    renderWorkout();

    // The header elapsed text is in the form "MM:SS ELAPSED" (per SessionHeader).
    // Before the fix, this would be "0:00 ELAPSED" for up to ~1s. With the fix
    // it should read a non-zero value on the very first render pass.
    await waitFor(() => {
      const elapsed = screen.getByText(/\bELAPSED\b/i);
      expect(elapsed.textContent).not.toMatch(/\b0:0?0\b/);
    });
  });
});
```

- [ ] **Step 5.2: Run the test and confirm it fails (flakily, timing-dependent)**

```bash
cd web && npm test -- --run tests/unit/features/workout/WorkoutScreen.test.tsx
```
Expected: the new test FAILS with the elapsed text reading `0:00 ELAPSED` (or flakes on timing — if it passes without the fix due to scheduler timing, move straight to Step 5.3; the fix is trivially correct by inspection).

- [ ] **Step 5.3: Apply the fix**

In `web/src/features/workout/WorkoutScreen.tsx`, replace the existing `useEffect` at lines 50-56:

```tsx
  useEffect(() => {
    if (!startedAt) return;
    setElapsedSec(computeElapsedSec(startedAt));
    const id = window.setInterval(() => {
      setElapsedSec(computeElapsedSec(startedAt));
    }, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
```

(Single added line: `setElapsedSec(computeElapsedSec(startedAt));` before the interval is created.)

- [ ] **Step 5.4: Re-run WorkoutScreen tests**

```bash
cd web && npm test -- --run tests/unit/features/workout/WorkoutScreen.test.tsx
```
Expected: all tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add web/src/features/workout/WorkoutScreen.tsx web/tests/unit/features/workout/WorkoutScreen.test.tsx
git commit -m "fix(workout): sync elapsed seconds on session load, not on first tick

useState's initializer only runs at first mount, so a late-arriving
activeSession left elapsedSec at 0 for up to ~1s. Compute once on
effect entry before scheduling the interval."
```

---

## Task 6 (D2): Tighten the SessionProgress "tabular-nums" test

**Files:**
- Modify: `web/tests/unit/features/workout/SessionProgress.test.tsx:8-11`

**Why:** The test's `it` name promises `"renders N/M counter with tabular numerals"` but only asserts the text. Removing the `tabular-nums` class from `SessionProgress` would not break this test. Add the class assertion so the test matches its name.

- [ ] **Step 6.1: Update the assertion**

In `web/tests/unit/features/workout/SessionProgress.test.tsx`, replace lines 8-11 (the first `it(...)` body) with:

```tsx
  it("renders N/M counter with tabular numerals", () => {
    render(<SessionProgress totalSets={20} loggedSets={2} />);
    const counter = screen.getByText("2/20");
    expect(counter).toBeVisible();
    expect(counter).toHaveClass("tabular-nums");
  });
```

- [ ] **Step 6.2: Run the test**

```bash
cd web && npm test -- --run tests/unit/features/workout/SessionProgress.test.tsx
```
Expected: all tests pass. (The `2/20` span in `SessionProgress.tsx:22-27` already has `tabular-nums` in its className.)

- [ ] **Step 6.3: Commit**

```bash
git add web/tests/unit/features/workout/SessionProgress.test.tsx
git commit -m "test(workout): assert tabular-nums class to match test name

The test was named \"renders N/M counter with tabular numerals\" but
only asserted the text. Also check the class so the guarantee is real."
```

---

## Task 7: Update CLAUDE.md Vitest count

**Files:**
- Modify: `CLAUDE.md` (Commands section)

**Why:** We added new tests in T1, T2, T3, and D1. Keep the documented Vitest count in sync.

- [ ] **Step 7.1: Get the new count**

```bash
cd web && npm test -- --run 2>&1 | tail -20
```
Read the "Tests  XXX passed" line from vitest's summary. Note the exact number.

- [ ] **Step 7.2: Update `CLAUDE.md`**

Open `CLAUDE.md` in the repo root, find the Commands section (look for `npm test              # 654 unit+integration tests (Vitest)` or whatever the current count is), and replace `654` with the new count from Step 7.1.

- [ ] **Step 7.3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: bump Vitest count for PR #13 review-response tests"
```

---

## Task 8: Verify, push, request re-review

- [ ] **Step 8.1: Full test + lint + build sweep**

```bash
cd web && npm test -- --run && npm run lint && npm run build && npm run test:e2e
```
Expected: all green.

- [ ] **Step 8.2: Push to origin**

```bash
git push origin sprint-10-workout
```

- [ ] **Step 8.3: On PR #13, after the CI run finishes, add a comment listing which threads this addresses and leaving the S1 pushback note.** Draft:

```
Addressed:
- T1/T2 (rounding on SetRow + ExerciseCard): dropped Math.round, added regression tests for 70.5 kg and lbs conversion.
- T3 (N/M chip on extras): gated on totalPrescribed>0 per CodeRabbit's fix, added tests for both hidden-on-extra and still-visible-on-routine paths.
- T4 (E2E save assertion): now asserts sheet hidden + Set 1 name not matching /^Set 1: empty/.
- D1 (elapsed sync): call setElapsedSec once on effect entry.
- D2 (tabular-nums test): assert the class.

Pushing back on:
- S1 (use @/ alias for same-folder imports of SetRow/SessionHeader/formatSetTarget): CLAUDE.md documents @/ as a mapping capability, not a mandate. Every other feature (today/, history/, settings/) uses relative `./Sibling` imports for same-folder modules; rewriting three would be inconsistent with the rest of the repo. Leaving as-is and resolving this thread.
```

- [ ] **Step 8.4: Resolve the S1 thread on GitHub once the comment is posted.**

---

## Self-review checklist — completed while writing

- **Spec coverage:** Every inline review comment on PR #13 that I classified as TODO or DEFER maps to a task above (T1 / T2 / T3 / T4 / D1 / D2). The three nitpicks I classified as SKIP are documented in the pushback section with reasoning and are handled in Step 8.3, not with code. ✓
- **Placeholder scan:** No "TBD", "implement later", "add error handling", or similar. Every code step shows the actual code. ✓
- **Type consistency:** Function/prop names (`formatLoggedValue`, `formatHintValue`, `totalPrescribed`, `totalLogged`, `elapsedSec`, `startedAt`, `computeElapsedSec`, `toDisplayWeight`) are used consistently across tasks and match the source files I read. The test-helper names (`makeSessionExercise`, `makeLoggedSet`, `seedRoutineAndExercises`, `renderWorkout`, `startSessionWithCatalog`) match the existing test files. ✓
