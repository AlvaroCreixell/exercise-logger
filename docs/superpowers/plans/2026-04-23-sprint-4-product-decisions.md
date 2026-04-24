# Sprint 4 — Product Decisions, Copy, And Strict YAML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close audit findings F7 (orphan `/history/exercise/:exerciseId` route), F8 ("Replace active routine" copy mismatch), F9 (YAML validation more lenient than the contract), and F13 (`ExercisePicker` confusing duplicate-extra UX). Plus ship a small but coherent feature: an "+ Add extra set" affordance on each block of `ExerciseCard`, motivated by the D3 decision tradeoff.

**Architecture:** All work in one PR on a single `sprint-4/...` branch. Five concerns:

1. **D1 — link the orphan route.** `SessionDetailExerciseCard` exposes the exercise name as a link to `/history/exercise/:exerciseId`. The screen already exists and gracefully falls back to the snapshot ID when the live catalog entry is missing. No new route work — just an in-app affordance.
2. **D2 — copy fix.** `RoutineImportScreen` button label changes from `"Replace active routine"` → `"Import and activate routine"`. Pure text. No service changes.
3. **D3 (a) — picker affordance.** `ExercisePicker` keeps its current click-through behavior (the dual-card "extras at the end of the routine" workflow stays — some users add a separate burnout card intentionally), but the badge changes from `"In workout"` → `"Add again"` to remove the misleading "disabled" cue.
4. **D3 (b) — `Add extra set` button on `ExerciseCard`.** The new in-place expansion: each block in a routine exercise card gets a small `"+ Add extra set"` button below its SetRows. Tapping adds an unlogged extra row at `setIndex = block.count + N`. Local component state is `pending`, derived `loggedExtras` from `loggedSets` is the source of truth on rehydrate. Persisted via existing `logSet` slot upsert (Dexie unique-index already accommodates `setIndex >= block.count`). Progression is unaffected: Sprint 2 already tightened `allSetsLogged` to `===`, so over-logging never unlocks a +5%.
5. **D4 — strict YAML validation.** `validateAndNormalizeRoutine` stops coercing non-string `notes`, stops blank-filling cardio fields, and rejects non-positive `exactValue` / range bounds. The bundled `web/data/routines/full-body-3day.yaml` is the canonical "must pass" baseline. `routine-yaml-contract.md` and `workout-routine-gpt.instructions.md` are updated to specify the strict shape so the GPT-generated YAML stays compatible.

**Tech Stack:** React 19, Vite 7, TypeScript 5, Vitest 4, Playwright, react-router 7, sonner. No new runtime dependencies.

**Decisions resolved (per the user's D1–D4 answers):**
- D1 — ship the link.
- D2 — rename only.
- D3 — keep dual-card workflow; rename badge to "Add again"; ADD `+ Add extra set` button on each block in `ExerciseCard`.
- D4 — strict; update GPT instructions and contract doc to align; bundled routine is the regression baseline.

---

## Audit Finding Recap

| F# | Description | Sprint 4 task(s) |
|---|---|---|
| F7 | `/history/exercise/:exerciseId` is orphaned (no in-app link). Comment at `app/App.tsx:183-184` notes this. | Task 2 |
| F8 | `RoutineImportScreen.tsx:133` says "Replace active routine"; service just imports + activates. Routines accumulate. | Task 3 |
| F9 | `routine-service.ts:455` coerces `notes` via `String()`. `:472-484` blank-fills cardio. `:724-733` accepts non-positive `exactValue`. `:705-722` doesn't enforce positivity on range bounds. | Tasks 6–8 |
| F13 | `ExercisePicker.tsx:74` calls `onPick` even when the exercise is already in the workout; the badge `"In workout"` reads like a disabled state. | Tasks 4–5 |

---

## File Structure

- **Modify** `web/src/features/history/SessionDetailExerciseCard.tsx` — accept new `exerciseId: string` prop; render the exercise name as a `<Link>` to `/history/exercise/:exerciseId`. (Task 2)
- **Modify** `web/src/features/history/SessionDetailScreen.tsx` — pass `exerciseId` from each `SessionExercise` to its `<SessionDetailExerciseCard>`. (Task 2)
- **Modify** `web/src/app/App.tsx` — remove the orphan-route comment at lines 183-184 (now reachable). (Task 2)
- **Modify** `web/tests/unit/features/history/SessionDetailExerciseCard.test.tsx` — wrap renders in `MemoryRouter`; add a navigation-link test. (Task 2)
- **Modify** `web/src/features/settings/RoutineImportScreen.tsx:133` — copy change. (Task 3)
- **Modify** `web/src/features/workout/ExercisePicker.tsx:86-90` — badge text `"In workout"` → `"Add again"`. (Task 4)
- **Modify** `web/src/features/workout/ExerciseCard.tsx` — render extra-set rows beyond `block.count`; add `"+ Add extra set"` button per block; new local state `extraTapsByBlock`. (Task 5)
- **Modify** `web/tests/unit/features/workout/ExerciseCard.test.tsx` (or create if missing) — tests for tap, render-with-logged-extras, multiple-block independence. (Task 5)
- **Modify** `web/src/services/routine-service.ts` — strict notes / cardio / set-block bounds. (Task 7)
- **Modify** `web/tests/unit/services/routine-service.test.ts` — add a `describe("strict — Sprint 4", ...)` block. (Task 7)
- **Add** `web/tests/unit/services/routine-service-bundled.test.ts` (or extend an existing test) — assert the bundled `full-body-3day.yaml` validates under strict rules. (Task 6/7)
- **Modify** `docs/custom-gpt/routine-yaml-contract.md` — note the strict rules. (Task 8)
- **Modify** `docs/custom-gpt/workout-routine-gpt.instructions.md` — add strict requirements to the YAML rules section so the GPT generates conforming output. (Task 8)
- **Add** `web/tests/e2e/exercise-history-link.spec.ts` — Playwright scenario for D1 navigation. (Task 9 optional)
- **Update** `docs/superpowers/plans/2026-04-23-sprint-4-product-decisions.md` and `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md` — Exit Criteria ticks at sprint close. (Task 10)

---

## Working Directory Assumption

All `npm` and `git` commands run from `C:/Users/creix/VSC Projects/exercise_logger/web` unless explicitly noted. Repo root is `C:/Users/creix/VSC Projects/exercise_logger`.

---

## Task 1: Sprint Branch + Baseline

**Files:** None modified.

- [ ] **Step 1: Verify clean state on `main` and create the sprint branch**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
git checkout main
git pull
git status --short
git log --oneline -5
```

Expected: clean, recent log shows `01a7ed3 feat: logged-set display correctness + sheet UX (sprint 3) (#24)` near the top, plus the Sprint 4 plan doc may show as untracked. Both fine.

```bash
git checkout -b sprint-4/product-decisions
```

- [ ] **Step 2: Capture baseline test counts**

```bash
npm test 2>&1 | tail -5
```

Expected: `Test Files 100 passed (100)` / `Tests 938 passed (938)` (matches Sprint 3 close).

- [ ] **Step 3: No commit in this task.**

---

## Task 2: D1 — Wire The Orphan Exercise History Route

**Files:**
- Modify: `web/src/features/history/SessionDetailExerciseCard.tsx`
- Modify: `web/src/features/history/SessionDetailScreen.tsx`
- Modify: `web/src/app/App.tsx`
- Modify: `web/tests/unit/features/history/SessionDetailExerciseCard.test.tsx`

The `/history/exercise/:exerciseId` route exists and is implemented (`ExerciseHistoryScreen.tsx`). It just has no in-app entry point. We add a tap-to-navigate from the exercise name on each `SessionDetailExerciseCard`.

- [ ] **Step 1: Read `SessionDetailScreen.tsx` to understand current card construction**

```bash
cat "C:/Users/creix/VSC Projects/exercise_logger/web/src/features/history/SessionDetailScreen.tsx" | head -100
```

Locate the loop or render that constructs `<SessionDetailExerciseCard>`. Confirm each `SessionExercise` has its `exerciseId` available — pass it through.

- [ ] **Step 2: Write the failing test**

In `web/tests/unit/features/history/SessionDetailExerciseCard.test.tsx`, add a navigation test inside the existing describe (or a new sibling describe):

```tsx
import { MemoryRouter } from "react-router";

// ... existing imports

describe("SessionDetailExerciseCard exercise-history link", () => {
  it("renders the exercise name as a link to /history/exercise/:exerciseId", () => {
    render(
      <MemoryRouter>
        <SessionDetailExerciseCard
          exerciseName="Barbell Squat"
          exerciseId="barbell-back-squat"
          loggedSets={[]}
          units="kg"
          onSetTap={vi.fn()}
        />
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /barbell squat/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/history/exercise/barbell-back-squat");
  });
});
```

You will also need to **wrap every existing render call** in this test file with `<MemoryRouter>` because the new `<Link>` requires a router context. The existing render helpers expand to e.g.:

```tsx
render(
  <MemoryRouter>
    <SessionDetailExerciseCard ... />
  </MemoryRouter>
);
```

- [ ] **Step 3: Run; confirm new test fails (component does not yet take `exerciseId` or render a link), existing tests fail (no MemoryRouter)**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test -- tests/unit/features/history/SessionDetailExerciseCard.test.tsx 2>&1 | tail -20
```

Expected: multiple FAIL lines. The new "renders … as a link" test fails because the component renders a `<p>`, not a link. Other tests may fail because `<Link>` will be added in the next step and requires `<MemoryRouter>`.

- [ ] **Step 4: Update `SessionDetailExerciseCard.tsx`**

Replace the entire contents of `web/src/features/history/SessionDetailExerciseCard.tsx` with:

```tsx
import { Link } from "react-router";
import { Card, CardContent } from "@/shared/ui/card";
import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { formatLoggedSet } from "@/shared/lib/formatLoggedSet";

interface SessionDetailExerciseCardProps {
  /** Display name (snapshot from session). */
  exerciseName: string;
  /** Exercise catalog ID. Drives the link to per-exercise history. */
  exerciseId: string;
  loggedSets: LoggedSet[];
  units: UnitSystem;
  onSetTap: (blockIndex: number, setIndex: number) => void;
}

export function SessionDetailExerciseCard({
  exerciseName,
  exerciseId,
  loggedSets,
  units,
  onSetTap,
}: SessionDetailExerciseCardProps) {
  return (
    <Card className="py-0">
      <CardContent className="space-y-3 px-4 py-4">
        <Link
          to={`/history/exercise/${exerciseId}`}
          className="inline-block text-sm font-semibold text-foreground hover:text-sage-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded-sm"
        >
          {exerciseName}
        </Link>
        {loggedSets.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {loggedSets.map((set) => (
              <li key={set.id}>
                <button
                  type="button"
                  onClick={() => onSetTap(set.blockIndex, set.setIndex)}
                  className="inline-flex items-center rounded-[var(--radius-pill)] bg-sage-soft px-2.5 py-1 text-xs font-medium tabular-nums text-sage-deep transition-colors hover:bg-sage-soft/70 focus-visible:ring-2 focus-visible:ring-sage/40 outline-none"
                >
                  {formatLoggedSet(set, units)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

Note: kept the same visual weight (`text-sm font-semibold text-foreground`); added a hover/focus state to convey link affordance.

- [ ] **Step 5: Update `SessionDetailScreen.tsx` to pass `exerciseId`**

Find every `<SessionDetailExerciseCard ... />` invocation in `web/src/features/history/SessionDetailScreen.tsx`. Add `exerciseId={se.exerciseId}` (where `se` is the surrounding `SessionExercise`). The exact prop access depends on the variable name used in the loop — adapt to the existing code.

Example shape:

```tsx
<SessionDetailExerciseCard
  exerciseName={se.exerciseNameSnapshot}
  exerciseId={se.exerciseId}
  loggedSets={...}
  units={...}
  onSetTap={...}
/>
```

- [ ] **Step 6: Remove the orphan-route comment in `App.tsx`**

In `web/src/app/App.tsx` around lines 183-184, remove this comment block:

```tsx
{/* Orphan route: no in-app link drives here. Kept for the planned
    exercise-history-navigation feature; remove if abandoned. */}
```

The `<Route path="/history/exercise/:exerciseId" ... />` line itself stays.

- [ ] **Step 7: Run the affected tests**

```bash
npm test -- tests/unit/features/history/SessionDetailExerciseCard.test.tsx 2>&1 | tail -10
npm test 2>&1 | tail -5
```

Expected: SessionDetailExerciseCard tests all pass. Full suite still 938 + however many new tests this task added (1 — the link test).

- [ ] **Step 8: Commit**

```bash
git add src/features/history/SessionDetailExerciseCard.tsx src/features/history/SessionDetailScreen.tsx src/app/App.tsx tests/unit/features/history/SessionDetailExerciseCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(history): link exercise name to /history/exercise/:exerciseId (closes F7)

The per-exercise history screen has been implemented but unreachable
from the UI since first ship. Now tapping the exercise name on the
session-detail card navigates to its history. Falls back to the
snapshot exerciseId if the live catalog entry is missing
(invariant 5 — history survives catalog drift).

Removes the "orphan route" comment in App.tsx.

Closes audit finding F7. Part of sprint-4/product-decisions.
EOF
)"
```

---

## Task 3: D2 — Rename "Replace Active Routine" → "Import And Activate Routine"

**Files:**
- Modify: `web/src/features/settings/RoutineImportScreen.tsx`
- Optionally modify: any test that asserted on the old text.

- [ ] **Step 1: Find the old copy and any test references**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
grep -rn "Replace active routine" src/ tests/ 2>&1 | head -20
```

Expected: a hit at `src/features/settings/RoutineImportScreen.tsx:133` and possibly hits in tests (e2e: `cardio-extra-distance.spec.ts`, `session-detail-non-weight.spec.ts`, perhaps a unit test or two).

- [ ] **Step 2: Update the source**

Edit `web/src/features/settings/RoutineImportScreen.tsx:133` from:

```tsx
        {importing ? "Importing…" : "Replace active routine"}
```

to:

```tsx
        {importing ? "Importing…" : "Import and activate routine"}
```

- [ ] **Step 3: Update test references**

For each test that asserted on `/replace active routine/i` (or similar), update to `/import and activate routine/i`. Most are likely Playwright specs targeting the import-routine button; a regex or exact match either way is fine to update.

Specifically check these e2e specs (Sprint 3 added them and they likely hit this button):
- `web/tests/e2e/cardio-extra-distance.spec.ts`
- `web/tests/e2e/session-detail-non-weight.spec.ts`

- [ ] **Step 4: Run lint, unit, e2e to confirm no test relies on the old wording**

```bash
npm test 2>&1 | tail -5
npm run test:e2e 2>&1 | tail -10
```

Expected: all pass. If an e2e fails because it didn't match the new text, update the spec.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/RoutineImportScreen.tsx tests/
git commit -m "$(cat <<'EOF'
fix(settings): rename routine-import button to match behavior (closes F8)

"Replace active routine" implied the previous routine would be
removed. importAndActivateRoutine actually adds the routine and
sets it active without deleting prior routines. New label
"Import and activate routine" matches the actual semantics.

Updates Playwright fixtures that targeted the old text.

Closes audit finding F8. Part of sprint-4/product-decisions.
EOF
)"
```

---

## Task 4: D3 (a) — `ExercisePicker` Badge Copy "In Workout" → "Add Again"

**Files:**
- Modify: `web/src/features/workout/ExercisePicker.tsx:86-90`
- Optionally modify: tests that asserted on the badge text.

The picker keeps its current click-through behavior: tapping an already-present exercise still calls `onPick(ex.id)` and adds a new `origin="extra"` SessionExercise with the same exerciseId. The user has confirmed this dual-card workflow is intentional ("somebody might add at the end of the routine for extra sets" — that's a real use case for a separate burnout card visually distinct from the prescribed exercise). The badge change is purely cosmetic: clearer affordance, no behavior change.

- [ ] **Step 1: Update the badge text**

In `web/src/features/workout/ExercisePicker.tsx`, find lines 86-90:

```tsx
                  {inWorkout ? (
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      In workout
                    </Badge>
                  ) : (
                    <Plus size={16} aria-hidden />
                  )}
```

Change `In workout` to `Add again`:

```tsx
                  {inWorkout ? (
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      Add again
                    </Badge>
                  ) : (
                    <Plus size={16} aria-hidden />
                  )}
```

No other changes — the click-through behavior at line 74-77 stays.

- [ ] **Step 2: Find and update test references**

```bash
grep -rn '"In workout"' src/ tests/ 2>&1 | head -10
grep -rn "In workout" tests/e2e/ 2>&1 | head -10
```

For each match, update to "Add again".

- [ ] **Step 3: Run gates**

```bash
npm test 2>&1 | tail -5
npm run test:e2e 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/workout/ExercisePicker.tsx
# plus any test-fixture updates from Step 2
git commit -m "$(cat <<'EOF'
fix(workout): ExercisePicker badge "Add again" instead of "In workout"

The "In workout" badge read like a disabled-state cue, but tapping
the row still added the exercise as a separate extra card (the
intentional dual-card workflow for end-of-routine burnout sets).
Renaming to "Add again" makes the affordance honest without
removing the workflow.

The in-place expansion path (within the existing exercise card) is
added in the next commit via "+ Add extra set" button on
ExerciseCard.

Part of sprint-4/product-decisions (F13).
EOF
)"
```

---

## Task 5: D3 (b) — `+ Add Extra Set` Button On `ExerciseCard`

**Files:**
- Modify: `web/src/features/workout/ExerciseCard.tsx`
- Modify or create: `web/tests/unit/features/workout/ExerciseCard.test.tsx`

The substantive D3 work. Each block in a routine `ExerciseCard` gets a `"+ Add extra set"` button below its SetRows. Tapping renders an additional empty SetRow at `setIndex = block.count + N`. Once logged, the extra set persists via `logSet`'s slot upsert (Dexie compound index `[sessionExerciseId+blockIndex+setIndex]` already accommodates `setIndex >= block.count`). Progression is unaffected: Sprint 2's `allSetsLogged === expectedCount` means over-logging never unlocks a +5%.

State design:
- Local `extraTaps: Record<number, number>` for the in-session counter (lost on navigation; fine — it merges with logged extras on rehydrate).
- Derived `loggedExtras: Record<number, number>` from `loggedSets` (max `setIndex - block.count + 1`, clamped to ≥ 0). Source of truth on reload.
- Total extras rendered per block = `Math.max(loggedExtras[bi] ?? 0, extraTaps[bi] ?? 0)`.

Extras inherit the parent block's `blockSignature` (already computed by `logSet`'s denormalization) but get NO tag — they're not "top" or "amrap" sets, just burnout work. The continuous numbering across blocks (`runningIndex`) keeps incrementing through the extras.

- [ ] **Step 1: Locate or create the test file**

```bash
ls "C:/Users/creix/VSC Projects/exercise_logger/web/tests/unit/features/workout/" | grep ExerciseCard
```

If exists, read first to learn fixture patterns. If not, create.

- [ ] **Step 2: Write failing tests**

If creating: full file at `web/tests/unit/features/workout/ExerciseCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseCard } from "@/features/workout/ExerciseCard";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";

function makeSE(overrides: Partial<SessionExercise> = {}): SessionExercise {
  const block: SetBlock = { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 };
  return {
    id: "se1",
    sessionId: "s1",
    routineEntryId: "entry-1",
    exerciseId: "barbell-back-squat",
    exerciseNameSnapshot: "Barbell Back Squat",
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel: "",
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: null,
    setBlocksSnapshot: [block],
    createdAt: "2026-04-23T10:00:00.000Z",
    unitOverride: null,
    ...overrides,
  };
}

function makeLoggedSet(
  blockIndex: number,
  setIndex: number,
  overrides: Partial<LoggedSet> = {},
): LoggedSet {
  return {
    id: `ls-${blockIndex}-${setIndex}`,
    sessionId: "s1",
    sessionExerciseId: "se1",
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex,
    tag: null,
    performedWeightKg: 80,
    performedReps: 10,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-23T10:00:00.000Z",
    updatedAt: "2026-04-23T10:00:00.000Z",
    ...overrides,
  };
}

describe("ExerciseCard — Add extra set (Sprint 4 D3b)", () => {
  it("renders an '+ Add extra set' button for each block on a routine card", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSE()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole("button", { name: /add extra set/i });
    expect(buttons).toHaveLength(1); // single-block exercise
  });

  it("does NOT render the button for an extras-origin exercise (origin=extra has no blocks)", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSE({ origin: "extra", setBlocksSnapshot: [] })}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={null}
        onSetTap={vi.fn()}
      />
    );
    expect(screen.queryByRole("button", { name: /add extra set/i })).toBeNull();
  });

  it("tapping '+ Add extra set' renders an additional empty SetRow below the prescribed rows", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseCard
        sessionExercise={makeSE()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />
    );
    // Block prescribes 3 sets → 3 empty SetRows initially.
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: /add extra set/i }));
    // Now 4 SetRows (3 prescribed + 1 extra)
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(4);
  });

  it("rehydrates extras from loggedSets — a logged set at setIndex=block.count renders as the 4th SetRow without tapping", () => {
    const se = makeSE();
    const logged = [makeLoggedSet(0, 3)]; // setIndex=3, block.count=3 → overrun=1
    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={logged}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />
    );
    // Should render 4 SetRows (3 prescribed + 1 logged extra) without any tap.
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(4);
  });

  it("clicking an extra row calls onSetTap with (blockIndex, setIndex=block.count + 0)", async () => {
    const user = userEvent.setup();
    const onSetTap = vi.fn();
    render(
      <ExerciseCard
        sessionExercise={makeSE()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={onSetTap}
      />
    );
    await user.click(screen.getByRole("button", { name: /add extra set/i }));
    // The new 4th set row was added at blockIndex=0, setIndex=3 (block.count=3).
    // The Set 4 button corresponds to that new extra row.
    await user.click(screen.getByRole("button", { name: /^Set 4/ }));
    expect(onSetTap).toHaveBeenCalledWith(0, 3);
  });

  it("tapping '+ Add extra set' twice adds two extras (counter is per-block, additive)", async () => {
    const user = userEvent.setup();
    render(
      <ExerciseCard
        sessionExercise={makeSE()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />
    );
    const button = screen.getByRole("button", { name: /add extra set/i });
    await user.click(button);
    await user.click(button);
    expect(screen.getAllByRole("button", { name: /^Set \d+/ })).toHaveLength(5);
  });

  it("two-block exercise gets two independent + Add extra set buttons", () => {
    const blockA: SetBlock = { targetKind: "reps", minValue: 6, maxValue: 8, count: 2, tag: "top" };
    const blockB: SetBlock = { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 };
    render(
      <ExerciseCard
        sessionExercise={makeSE({ setBlocksSnapshot: [blockA, blockB] })}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={vi.fn()}
      />
    );
    expect(screen.getAllByRole("button", { name: /add extra set/i })).toHaveLength(2);
  });
});
```

If extending an existing test file: append the describe; reuse existing helpers if they have compatible signatures.

- [ ] **Step 3: Run; confirm all 7 tests fail (button doesn't exist; rendering loop doesn't account for extras)**

```bash
npm test -- tests/unit/features/workout/ExerciseCard.test.tsx 2>&1 | tail -25
```

Expected: 7 failures (the button isn't rendered; SetRow counts don't increase past `block.count`).

- [ ] **Step 4: Update `ExerciseCard.tsx`**

Replace the relevant section of `web/src/features/workout/ExerciseCard.tsx`. The full updated file body (preserving everything outside the changes — header, hint strip, extra-origin branch — verbatim from the current file):

Add `useState` to the React import:

```tsx
import { useState } from "react";
```

Add the state and helper inside the component body, just after the existing destructuring of `se`/`blocks`/`isExtra` (around line 53):

```tsx
  // Sprint 4 (D3b): per-block in-session "Add extra set" tap counter.
  // Source of truth on rehydrate is loggedSets (extras logged in a prior
  // mount restore via loggedExtras below). The local counter only needs
  // to remember unconsumed taps in the current session.
  const [extraTaps, setExtraTaps] = useState<Record<number, number>>({});

  // Logged-driven extras: for each block, the highest setIndex among its
  // loggedSets, minus block.count + 1 (clamped to >= 0).
  const loggedExtras: Record<number, number> = {};
  for (const ls of loggedSets) {
    const block = blocks[ls.blockIndex];
    if (!block) continue;
    const overrun = ls.setIndex - block.count + 1;
    if (overrun > 0) {
      loggedExtras[ls.blockIndex] = Math.max(loggedExtras[ls.blockIndex] ?? 0, overrun);
    }
  }

  function getExtraCount(bi: number): number {
    return Math.max(loggedExtras[bi] ?? 0, extraTaps[bi] ?? 0);
  }

  function addExtraSet(bi: number) {
    setExtraTaps((prev) => ({ ...prev, [bi]: getExtraCount(bi) + 1 }));
  }
```

Replace the existing block-rendering loop (around lines 121-147) with one that also renders the extras and the button. The new shape:

```tsx
        {/* Set rows — continuous numbering across blocks; extras render after each block's prescribed rows. */}
        {blocks.length > 0 && (
          <div className="space-y-1.5">
            {(() => {
              const rows: React.ReactNode[] = [];
              let runningIndex = 0;
              blocks.forEach((block, bi) => {
                const extras = getExtraCount(bi);
                const total = block.count + extras;
                for (let si = 0; si < total; si++) {
                  runningIndex += 1;
                  const setKey = `${bi}:${si}`;
                  const logged = setLookup.get(setKey);
                  rows.push(
                    <SetRow
                      key={setKey}
                      setNumber={runningIndex}
                      loggedSet={logged}
                      units={units}
                      // Extras are not "top" sets; only prescribed rows in a top-tagged block carry the badge.
                      isTopBlock={block.tag === "top" && si < block.count}
                      lastHint={si < block.count ? emptyHintForBlock(bi) : undefined}
                      onClick={() => onSetTap(bi, si)}
                    />,
                  );
                }
                // "+ Add extra set" button below this block.
                rows.push(
                  <button
                    key={`add-extra-${bi}`}
                    type="button"
                    onClick={() => addExtraSet(bi)}
                    className="ml-9 self-start text-[11px] font-semibold uppercase tracking-widest text-ink-3 hover:text-sage-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40 rounded-sm py-1"
                  >
                    + Add extra set
                  </button>,
                );
              });
              return rows;
            })()}
          </div>
        )}
```

Notes on the spec:
- Extras are NOT marked as `isTopBlock` even when the parent block is tagged "top" — extras are burnout sets, not the prescribed top set. The `si < block.count` gate enforces this.
- `lastHint` (the "Tap to log · last X" hint) only applies to prescribed rows; extras get no hint because they're net-new slots beyond what the routine prescribed.
- The button uses small uppercase styling consistent with existing meta text in the card. It sits indented 9 units (matches the SetRow's content offset for visual alignment under the set numbers).
- `ml-9` chosen to align with the existing SetRow content; adjust to taste during implementation if it looks off in the dev server.

Leave the extras-origin branch (lines 156-185) UNTOUCHED. Extras-origin exercises (`origin === "extra"`) use a different rendering path (single flat list, no blocks); the `+ Add extra set` button is only meaningful for routine-origin cards with blocks.

- [ ] **Step 5: Run the new tests; confirm all 7 pass**

```bash
npm test -- tests/unit/features/workout/ExerciseCard.test.tsx 2>&1 | tail -15
```

Expected: 7 of 7 pass.

- [ ] **Step 6: Run the full unit + integration suite to catch regressions**

```bash
npm test 2>&1 | tail -10
```

Expected: total goes up by ~7. No existing test broken. If a snapshot test breaks because of the new button, update the snapshot — the addition is intentional.

- [ ] **Step 7: Commit**

```bash
git add src/features/workout/ExerciseCard.tsx tests/unit/features/workout/ExerciseCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(workout): + Add extra set button on each block (closes F13)

ExerciseCard now renders a small "+ Add extra set" button below each
block's SetRows. Tapping adds an unlogged extra row at
setIndex = block.count + N. Extras persist via the existing logSet
slot upsert (Dexie's [sessionExerciseId+blockIndex+setIndex]
compound index already accommodates setIndex >= block.count).

Rehydration: loggedExtras is derived from loggedSets each render so
that extras logged in a prior mount restore correctly. The local
extraTaps counter only tracks unconsumed taps in the current
session — it merges with loggedExtras via Math.max so a tap is
never lost mid-session and never double-counted after a log.

Extras inherit the parent block's blockSignature (via logSet's
denormalization) but get NO tag — they're burnout sets, not
prescribed top/amrap. Progression is unaffected: Sprint 2's strict
allSetsLogged === expectedCount means over-logging never unlocks a
+5% suggestion.

The dual-card workflow via ExercisePicker remains unchanged (Task 4
relabeled the picker badge to "Add again"); both paths coexist for
users who prefer either in-place expansion or a separate burnout
card at the end of the routine.

Closes audit finding F13. Part of sprint-4/product-decisions.
EOF
)"
```

---

## Task 6: D4 Prep — Bundled Routine Strict-Validation Baseline

**Files:**
- Add: `web/tests/unit/services/routine-service-bundled.test.ts` (or extend an existing test).

The bundled `web/data/routines/full-body-3day.yaml` is the canonical "must pass" baseline for the strict validator. Writing a test that imports it and asserts `validateAndNormalizeRoutine` accepts it gives us a regression net for Task 7. If the bundled YAML fails strict validation, we know the validator is too aggressive AND/OR the bundled YAML itself needs updating.

- [ ] **Step 1: Write the bundled-validates test**

Create `web/tests/unit/services/routine-service-bundled.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeAll } from "vitest";
import { validateAndNormalizeRoutine } from "@/services/routine-service";
import { loadEmbeddedCatalog } from "@/services/catalog-service";
import bundledYaml from "../../../data/routines/full-body-3day.yaml?raw";

describe("routine-service — bundled YAML baseline", () => {
  let exerciseLookup: Map<string, ReturnType<typeof loadEmbeddedCatalog>[number]>;

  beforeAll(() => {
    const exercises = loadEmbeddedCatalog();
    exerciseLookup = new Map(exercises.map((e) => [e.id, e]));
  });

  it("validates the bundled full-body-3day.yaml under current rules", async () => {
    const result = await validateAndNormalizeRoutine(bundledYaml, exerciseLookup);
    if (!result.ok) {
      // Surface every error path so failures are diagnosable.
      const messages = result.errors
        .map((e) => `  - ${e.path}: ${e.message}`)
        .join("\n");
      throw new Error(`bundled YAML failed validation:\n${messages}`);
    }
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test against today's lenient validator**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm test -- tests/unit/services/routine-service-bundled.test.ts 2>&1 | tail -10
```

Expected: PASS (today's validator accepts the bundled YAML — no strict rules yet). This is the safety net for Task 7.

- [ ] **Step 3: Read the bundled YAML to identify any potential strict-rule conflicts**

```bash
cat "C:/Users/creix/VSC Projects/exercise_logger/web/data/routines/full-body-3day.yaml" | head -80
```

Look for:
- Any `notes:` entries containing non-string values (numbers, nulls)? Probably none — the bundled routine was hand-curated.
- Any `cardio:` section with missing `name`/`detail`/`notes`?
- Any set block with `exactValue: 0` or negative? Or range with non-positive bounds?

If any potential conflict exists, note it for Task 7 — the strict validator should still accept the bundled routine, OR the bundled YAML must be updated alongside.

- [ ] **Step 4: Commit the baseline test**

```bash
git add tests/unit/services/routine-service-bundled.test.ts
git commit -m "$(cat <<'EOF'
test(routine): assert bundled full-body-3day.yaml validates

Baseline regression test: the bundled routine must always pass
validateAndNormalizeRoutine. Sprint 4 introduces strict rules in
the next commit; this test catches any strict rule that
accidentally rejects today's hand-curated bundled YAML.

If this test fails after a strict-rule change, either the rule is
over-aggressive or the bundled YAML needs updating to match the
new contract. Either way, the failure surfaces every path.error
inline for diagnosis.

Part of sprint-4/product-decisions (D4 prep).
EOF
)"
```

---

## Task 7: D4 — Strict YAML Validator

**Files:**
- Modify: `web/src/services/routine-service.ts`
- Modify: `web/tests/unit/services/routine-service.test.ts`

Implement the four strict rules. Each rule gets a paired positive/negative test.

### Rules to enforce

1. **`notes`** must be an array OF STRINGS. Reject elements that aren't strings (no `String(x)` coercion).
2. **`cardio.notes`** must be a string. No `""` blank fallback.
3. **`cardio.options[].name`** and **`cardio.options[].detail`** must be strings. No `""` blank fallback.
4. **Range bounds** (`minValue`, `maxValue`) and **exact targets** (`exactValue`) must be finite POSITIVE numbers.

- [ ] **Step 1: Write failing tests**

Append to `web/tests/unit/services/routine-service.test.ts` a new describe block. The exact location depends on the file's structure — append at the end, as a sibling of existing top-level describes.

```ts
describe("validateAndNormalizeRoutine — strict (Sprint 4 D4)", () => {
  let exerciseLookup: Map<string, Exercise>;

  beforeAll(() => {
    // Provide a minimal catalog with the IDs the test fixtures use.
    exerciseLookup = new Map([
      ["barbell-back-squat", {
        id: "barbell-back-squat",
        name: "Barbell Back Squat",
        type: "weight" as const,
        equipment: "barbell" as const,
        muscleGroups: ["Legs"],
      }],
    ]);
  });

  function baseValidYaml(): string {
    return `
version: 1
name: Test
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: Day A
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [8, 12], count: 3 }
`;
  }

  it("rejects notes containing a non-string element (no String() coercion)", async () => {
    const yaml = baseValidYaml() + `
notes:
  - "First note"
  - 42
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) =>
      e.path.startsWith("notes[1]") && /must be a string/i.test(e.message)
    )).toBe(true);
  });

  it("accepts notes containing only strings", async () => {
    const yaml = baseValidYaml() + `
notes:
  - "First note"
  - "Second note"
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(true);
  });

  it("rejects cardio with non-string notes (no '' fallback)", async () => {
    const yaml = baseValidYaml() + `
cardio:
  notes: 42
  options: []
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) =>
      e.path === "cardio.notes" && /must be a string/i.test(e.message)
    )).toBe(true);
  });

  it("rejects cardio option with missing name (no '' fallback)", async () => {
    const yaml = baseValidYaml() + `
cardio:
  notes: "Optional"
  options:
    - { detail: "20 min" }
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) =>
      /cardio\.options\[0\]\.name/.test(e.path) && /must be a string/i.test(e.message)
    )).toBe(true);
  });

  it("rejects cardio option with missing detail (no '' fallback)", async () => {
    const yaml = baseValidYaml() + `
cardio:
  notes: "Optional"
  options:
    - { name: "Walk" }
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) =>
      /cardio\.options\[0\]\.detail/.test(e.path) && /must be a string/i.test(e.message)
    )).toBe(true);
  });

  it("accepts cardio with full string fields", async () => {
    const yaml = baseValidYaml() + `
cardio:
  notes: "After lifting"
  options:
    - { name: "Walk", detail: "20-30 min" }
    - { name: "Bike", detail: "15-20 min" }
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(true);
  });

  it("rejects exactValue of zero (must be positive)", async () => {
    const yaml = `
version: 1
name: Test
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: Day A
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { duration: 0, count: 1 }
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => /positive/i.test(e.message))).toBe(true);
  });

  it("rejects negative exactValue", async () => {
    const yaml = `
version: 1
name: Test
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: Day A
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { distance: -1000, count: 1 }
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => /positive/i.test(e.message))).toBe(true);
  });

  it("rejects range with zero or negative minValue", async () => {
    const yaml = `
version: 1
name: Test
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: Day A
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [0, 8], count: 1 }
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => /positive/i.test(e.message))).toBe(true);
  });

  it("accepts a positive range", async () => {
    const yaml = baseValidYaml(); // already uses { reps: [8, 12], count: 3 }
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(true);
  });

  it("accepts a positive exact target", async () => {
    const yaml = `
version: 1
name: Test
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: Day A
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: 8, count: 3 }
`;
    const result = await validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run; confirm 8 of 11 fail (the negative cases), 3 pass (the positive cases)**

```bash
npm test -- tests/unit/services/routine-service.test.ts -t "strict \\(Sprint 4 D4\\)" 2>&1 | tail -30
```

Expected: 8 failures.

- [ ] **Step 3: Apply Rule 1 — strict notes**

In `web/src/services/routine-service.ts`, find the notes block (currently around lines 451-462):

```ts
  let notes: string[] = [];
  if (raw.notes !== undefined && raw.notes !== null) {
    if (Array.isArray(raw.notes)) {
      notes = raw.notes.map((n: unknown) => String(n));
    } else {
      errors.push({
        path: "notes",
        message: "notes must be an array of strings",
      });
    }
  }
```

Replace with:

```ts
  let notes: string[] = [];
  if (raw.notes !== undefined && raw.notes !== null) {
    if (Array.isArray(raw.notes)) {
      const rawNotes = raw.notes as unknown[];
      for (let i = 0; i < rawNotes.length; i++) {
        if (typeof rawNotes[i] !== "string") {
          errors.push({
            path: `notes[${i}]`,
            message: "notes element must be a string",
          });
        } else {
          notes.push(rawNotes[i] as string);
        }
      }
    } else {
      errors.push({
        path: "notes",
        message: "notes must be an array of strings",
      });
    }
  }
```

- [ ] **Step 4: Apply Rules 2 + 3 — strict cardio**

In the same file, find the cardio block (around lines 464-493). Replace the entire block with:

```ts
  let cardio: RoutineCardio | null = null;
  if (raw.cardio !== undefined && raw.cardio !== null) {
    if (typeof raw.cardio === "object" && !Array.isArray(raw.cardio)) {
      const rawCardio = raw.cardio as {
        notes?: unknown;
        options?: unknown;
      };

      // cardio.notes must be a string (no "" fallback).
      let cardioNotes = "";
      if (typeof rawCardio.notes !== "string") {
        errors.push({
          path: "cardio.notes",
          message: "cardio.notes must be a string",
        });
      } else {
        cardioNotes = rawCardio.notes;
      }

      const cardioOptions: RoutineCardioOption[] = [];
      if (rawCardio.options !== undefined) {
        if (!Array.isArray(rawCardio.options)) {
          errors.push({
            path: "cardio.options",
            message: "cardio.options must be an array",
          });
        } else {
          for (let oi = 0; oi < rawCardio.options.length; oi++) {
            const opt = rawCardio.options[oi];
            const optPath = `cardio.options[${oi}]`;
            if (typeof opt !== "object" || opt === null) {
              errors.push({ path: optPath, message: "must be an object" });
              continue;
            }
            const o = opt as { name?: unknown; detail?: unknown };
            const nameOk = typeof o.name === "string";
            const detailOk = typeof o.detail === "string";
            if (!nameOk) {
              errors.push({
                path: `${optPath}.name`,
                message: "must be a string",
              });
            }
            if (!detailOk) {
              errors.push({
                path: `${optPath}.detail`,
                message: "must be a string",
              });
            }
            if (nameOk && detailOk) {
              cardioOptions.push({
                name: o.name as string,
                detail: o.detail as string,
              });
            }
          }
        }
      }

      cardio = { notes: cardioNotes, options: cardioOptions };
    } else {
      errors.push({
        path: "cardio",
        message: "cardio must be an object with notes and options",
      });
    }
  }
```

- [ ] **Step 5: Apply Rule 4 — positivity for set-block targets**

Find the target-value handling in `validateExerciseEntry` or its set-block helper (currently around lines 696-733). The branches handle range and exact value. Update both:

For the **range** branch (currently around lines 696-723), find:

```ts
      } else if (min >= max) {
        errors.push({
          path: `${path}.${targetKey}`,
          message: `Range min (${min}) must be less than max (${max})`,
        });
        valid = false;
      } else {
        minValue = min;
        maxValue = max;
      }
```

Replace with:

```ts
      } else if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
        errors.push({
          path: `${path}.${targetKey}`,
          message: `${targetKey} range bounds must be finite positive numbers, got [${min}, ${max}]`,
        });
        valid = false;
      } else if (min >= max) {
        errors.push({
          path: `${path}.${targetKey}`,
          message: `Range min (${min}) must be less than max (${max})`,
        });
        valid = false;
      } else {
        minValue = min;
        maxValue = max;
      }
```

For the **exact** branch (currently around lines 724-727), find:

```ts
    } else if (typeof targetValue === "number") {
      // Exact value
      exactValue = targetValue;
    } else {
```

Replace with:

```ts
    } else if (typeof targetValue === "number") {
      if (!Number.isFinite(targetValue) || targetValue <= 0) {
        errors.push({
          path: `${path}.${targetKey}`,
          message: `${targetKey} must be a finite positive number, got ${targetValue}`,
        });
        valid = false;
      } else {
        exactValue = targetValue;
      }
    } else {
```

- [ ] **Step 6: Run the new strict tests**

```bash
npm test -- tests/unit/services/routine-service.test.ts -t "strict \\(Sprint 4 D4\\)" 2>&1 | tail -15
```

Expected: 11 of 11 pass.

- [ ] **Step 7: Run the bundled-baseline test from Task 6**

```bash
npm test -- tests/unit/services/routine-service-bundled.test.ts 2>&1 | tail -10
```

Expected: PASS. If FAIL, the strict validator rejected the bundled YAML — read the error paths surfaced by the test, decide whether to soften the specific strict rule OR fix the bundled YAML. Most likely the bundled YAML is fine; if it isn't, fix it in the same commit.

- [ ] **Step 8: Run the full routine-service test file to catch regressions**

```bash
npm test -- tests/unit/services/routine-service.test.ts 2>&1 | tail -10
```

Expected: all pass. If any pre-existing test fails because it asserted leniency (e.g. accepted a non-string note), that test was codifying the bug — update the assertion to expect the strict-mode error.

- [ ] **Step 9: Run the full unit suite**

```bash
npm test 2>&1 | tail -10
```

Expected: total +11 (the 11 new strict tests). No regressions.

- [ ] **Step 10: Commit**

```bash
git add src/services/routine-service.ts tests/unit/services/routine-service.test.ts
# Plus any bundled-YAML adjustment if Step 7 required it.
git commit -m "$(cat <<'EOF'
fix(routine): strict YAML validation (closes F9)

validateAndNormalizeRoutine now enforces:
- notes must be an array OF STRINGS (no String() coercion of
  non-string elements)
- cardio.notes must be a string (no "" blank fallback)
- cardio.options[].name and .detail must be strings (no "" fallback)
- range bounds and exact targets must be finite positive numbers

The lenient coercions silently produced odd downstream behavior
(notes rendering as "[object Object]"; zero-duration set blocks
breaking the keypad). Strict matches the contract docs and
matches the backup validator hardened in Sprint 2.

The bundled full-body-3day.yaml continues to validate (regression
test in routine-service-bundled.test.ts proves it). The GPT
instructions doc is updated in the next commit so generated YAML
keeps conforming.

Closes audit finding F9. Part of sprint-4/product-decisions.
EOF
)"
```

---

## Task 8: D4 Doc Sync — Contract + GPT Instructions

**Files:**
- Modify: `docs/custom-gpt/routine-yaml-contract.md`
- Modify: `docs/custom-gpt/workout-routine-gpt.instructions.md`

Both docs must reflect the strict rules so a user copy-pasting the contract OR running the GPT both get conforming YAML.

- [ ] **Step 1: Update `routine-yaml-contract.md`**

Open `docs/custom-gpt/routine-yaml-contract.md`. Make the following targeted edits:

In the **`### `notes`** section (around lines 180-186), change the explanatory text from:

```markdown
notes:
  - "Rotation is continuous."
  - "Rest after both exercises in a superset round."
```

to:

```markdown
notes:
  - "Rotation is continuous."
  - "Rest after both exercises in a superset round."
```

(Same content; we just want to add a strict-rule line below this block. After this code fence, add:)

```markdown
Each element of `notes` must be a string. Numbers, nulls, or other types are rejected.
```

In the **`### `cardio`** section (around lines 169-178), after the example code fence, add:

```markdown
`cardio.notes` must be a string. Each `cardio.options[]` entry must include both `name` and `detail` as strings. Missing or non-string fields are rejected.
```

In the **`## Set Block Rules`** section, in the bullet list of rules (around line 138), update the existing range/exact items and add positivity:

Current:
```markdown
- a range must be `[min, max]`
- range values must be numbers
- `min` must be less than `max`
- exact values must be numbers
- `count` is required
- `count` must be an integer `>= 1`
- `tag` is optional
- valid `tag` values are `top` and `amrap`
```

Replace with:

```markdown
- a range must be `[min, max]`
- range values must be finite positive numbers (`> 0`)
- `min` must be less than `max`
- exact values must be finite positive numbers (`> 0`)
- `count` is required
- `count` must be an integer `>= 1`
- `tag` is optional
- valid `tag` values are `top` and `amrap`
```

In the **`## Common Failure Cases`** section (lines 188-204), add three new bullets at the bottom:

```markdown
- `notes` element is not a string
- `cardio.notes` or any `cardio.options[].name` / `.detail` is not a string
- range bound or exact value is zero, negative, or non-finite
```

- [ ] **Step 2: Update `workout-routine-gpt.instructions.md`**

Open `docs/custom-gpt/workout-routine-gpt.instructions.md`. In the **`## YAML Rules`** section (around lines 56-76), add the following bullets near the related items:

After the line `- Use a range as `[min, max]` and ensure `min < max`.` (around line 68), add:

```markdown
- Range bounds must be finite positive numbers (`> 0`).
```

After `- Use an exact target as a number, for example `reps: 8` or `distance: 2000`.` (around line 69), add:

```markdown
- Exact targets must be finite positive numbers (`> 0`).
```

In the same section, after `- `instance_label`, `type_override`, `equipment_override`, and `notes` are optional.` (around line 72), add:

```markdown
- Top-level `notes` (when present) must be an array of strings — no numbers, nulls, or objects.
- `cardio.notes` (when `cardio` is present) must be a string. Each `cardio.options[]` entry must include both `name` and `detail` as strings.
```

In the **`## Self-Check Before Final Answer`** section (around lines 99-112), in the bullet list of self-checks, add:

```markdown
- every `notes` entry, when present, is a string
- every `cardio.notes`, `cardio.options[].name`, and `cardio.options[].detail` is a string when `cardio` is present
- every range bound and exact target is a finite positive number
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add docs/custom-gpt/routine-yaml-contract.md docs/custom-gpt/workout-routine-gpt.instructions.md
git commit -m "$(cat <<'EOF'
docs(custom-gpt): align contract + GPT instructions with strict validator

Both docs now specify the strict rules introduced in the previous
commit (Task 7):
- notes elements must be strings (no coercion)
- cardio.notes / .name / .detail must be strings (no "" fallback)
- range bounds and exact targets must be finite positive numbers

The GPT will now generate YAML that conforms to the strict
validator, and the contract doc accurately describes what
validateAndNormalizeRoutine accepts.

Part of sprint-4/product-decisions (D4 doc sync).
EOF
)"
```

---

## Task 9: Optional E2E — Exercise History Link

**Files:**
- Add: `web/tests/e2e/exercise-history-link.spec.ts`

Light Playwright scenario covering D1 end-to-end. Optional — the unit test in Task 2 already proves the link renders with the right href. Skip if e2e helper friction is high; the unit test is sufficient for sprint close.

- [ ] **Step 1: Read existing e2e patterns from Sprint 3 specs**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
cat tests/e2e/session-detail-non-weight.spec.ts
```

Reuse the helpers (`resetAppState`, `skipOnboardingIfShown`, the SPA-only navigation pattern, the YAML-import flow with `rest_superset_sec`).

- [ ] **Step 2: Write the scenario**

Create `web/tests/e2e/exercise-history-link.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { resetAppState, skipOnboardingIfShown } from "./helpers/onboarding-helpers";

test.describe("Exercise history link from session detail (D1 / F7)", () => {
  test("tapping the exercise name on a session-detail card navigates to /history/exercise/:exerciseId", async ({ page }) => {
    await resetAppState(page);
    await page.goto("/exercise-logger/");
    await skipOnboardingIfShown(page);

    // Adapt: import a routine, start a session, log a set, finish.
    // Reuse the same YAML stub and step pattern from session-detail-non-weight.spec.ts.
    // After finishing, navigate to History → tap the just-finished session.
    // Then tap the exercise name and assert the URL changed to /history/exercise/<slug>.

    // Final assertion:
    // await expect(page).toHaveURL(/\/history\/exercise\/[a-z-]+$/);
    // await expect(page.getByRole("heading", { level: 1 })).toContainText(/squat/i);

    // Implementation note: copy the seed/finish flow from
    // session-detail-non-weight.spec.ts; the only new bit is the link tap and
    // the URL/heading assertion.
  });
});
```

The implementer adapts the seed-and-finish steps from the Sprint 3 sibling spec.

- [ ] **Step 3: Run**

```bash
npm run test:e2e -- exercise-history-link 2>&1 | tail -10
```

If pass: commit. If hits 30 min of helper friction: STOP, skip the e2e (Task 2's unit test covers the link contract), report as deferred.

- [ ] **Step 4 (if pass): Commit**

```bash
git add tests/e2e/exercise-history-link.spec.ts
git commit -m "test(e2e): exercise history navigation from session detail (covers F7)"
```

---

## Task 10: Full Sprint Gate

**Files:** None modified.

- [ ] **Step 1: Three consecutive `npm test` runs**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
for i in 1 2 3; do
  echo "=== run $i ==="
  npm test 2>&1 | tail -5
done
```

Expected: all green. Total ~970 (938 baseline + ~32 from Tasks 2, 5, 6, 7).

- [ ] **Step 2: Lint, typecheck, build, e2e**

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

Expected: each exits 0. E2E: 22 (or 23 if Task 9 shipped).

- [ ] **Step 3: No commit.**

---

## Task 11: PR, CI, Merge

**Files:**
- Modify: `docs/superpowers/plans/2026-04-23-sprint-4-product-decisions.md` — tick Exit Criteria.
- Modify: `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md` — tick Sprint 4 in the Rollup.

- [x] **Step 1: Push the branch**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
git push -u origin sprint-4/product-decisions
```

- [x] **Step 2: Open the PR**

```bash
gh pr create --title "feat: product decisions + strict YAML (sprint 4)" --body "$(cat <<'EOF'
## Summary

Sprint 4 of the [v2 Post-Audit Hardening Roadmap](../blob/main/docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md). Closes audit findings F7 (orphan exercise-history route), F8 ("Replace active routine" copy mismatch), F9 (lenient YAML validation), and F13 (`ExercisePicker` confusing duplicate UX).

### D1 — exercise history link (F7)

`SessionDetailExerciseCard` now renders the exercise name as a link to `/history/exercise/:exerciseId`. The screen has been implemented since first ship; this just adds the in-app entry point. Falls back to the snapshot exerciseId when the live catalog entry is missing (invariant 5).

### D2 — copy fix (F8)

`RoutineImportScreen` button label: `"Replace active routine"` → `"Import and activate routine"`. Behavior unchanged — `importAndActivateRoutine` adds the routine and activates it without deleting prior routines.

### D3 — picker badge + `+ Add extra set` button (F13)

Two coordinated changes:

1. `ExercisePicker` badge for already-present exercises: `"In workout"` → `"Add again"`. Click-through behavior preserved — tapping still adds a separate `origin="extra"` SessionExercise (the dual-card "burnout at end of routine" workflow that some users prefer).
2. `ExerciseCard` now renders a `+ Add extra set` button below each block. Tapping adds an unlogged extra row at `setIndex = block.count + N`. Persists via existing `logSet` slot upsert. Rehydrates from `loggedSets` so extras logged in a prior mount restore correctly. Extras inherit the parent block's signature (for fallback matching) but get NO tag — they're burnout sets, not prescribed top/amrap. Progression is unaffected (Sprint 2's strict `allSetsLogged` means over-logging never unlocks +5%).

### D4 — strict YAML validation (F9) + doc sync

`validateAndNormalizeRoutine` now enforces:
- `notes` elements must be strings (no `String()` coercion).
- `cardio.notes` / `cardio.options[].name` / `cardio.options[].detail` must be strings (no `""` blank fallback).
- Range bounds and exact targets must be finite positive numbers.

The bundled `full-body-3day.yaml` continues to validate (regression test added). `routine-yaml-contract.md` and `workout-routine-gpt.instructions.md` are updated in lockstep so future GPT-generated YAML conforms to the strict shape.

## Evidence

- ~32 new unit/integration tests across `SessionDetailExerciseCard`, `ExerciseCard`, `routine-service`, and the bundled-baseline test.
- 1 new Playwright scenario (Task 9, if shipped).
- 3/3 `npm test` consecutive runs green; lint, typecheck, build, e2e all pass.

## Test plan

- [ ] CI run 1 green on this PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [x] **Step 3: Wait for CI**

```bash
gh pr checks --watch
```

- [x] **Step 4: Tick Exit Criteria in both plan docs**

Edit `docs/superpowers/plans/2026-04-23-sprint-4-product-decisions.md` Exit Criteria: tick all items.

Edit `docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md`:
- Sprint 4 Exit Criteria — tick all.
- Rollup section — tick:
  - "Routine import copy matches behavior."
  - "`/history/exercise/:exerciseId` is reachable from UI (or the route was removed, per D1b)."
  - "`ExercisePicker` handles duplicates per the chosen product decision."
  - "YAML validation matches the contract it advertises (or the contract doc matches the permissive behavior, per D4b)."

- [x] **Step 5: Commit doc updates and push**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add docs/superpowers/plans/2026-04-23-v2-post-audit-hardening-roadmap.md docs/superpowers/plans/2026-04-23-sprint-4-product-decisions.md
git commit -m "$(cat <<'EOF'
docs: mark sprint 4 exit criteria complete

CI green on sprint-4/product-decisions. F7, F8, F9, F13 closed.
EOF
)"
git push
```

- [x] **Step 6: Merge**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
gh pr merge --squash --delete-branch
```

- [x] **Step 7: Cleanup local**

```bash
git checkout main
git pull
git remote prune origin
```

---

## Exit Criteria

- [x] D1 — `SessionDetailExerciseCard` exercise name links to `/history/exercise/:exerciseId`; orphan-route comment removed; SessionDetailScreen passes `exerciseId` through.
- [x] D2 — `RoutineImportScreen` button reads "Import and activate routine".
- [x] D3a — `ExercisePicker` badge reads "Add again"; click-through behavior preserved.
- [x] D3b — `ExerciseCard` renders `+ Add extra set` button per block; rehydrates extras from loggedSets; extras inherit parent block signature with NO tag; progression unaffected.
- [x] D4 — `validateAndNormalizeRoutine` enforces 4 strict rules with paired tests; bundled YAML still validates; `routine-yaml-contract.md` and `workout-routine-gpt.instructions.md` updated.
- [x] All Tasks 2–8 commits in chronological order; one commit per task.
- [x] Full gate green: 3 consecutive `npm test`, lint, typecheck, build, e2e.
- [x] CI green on PR.
- [x] Roadmap Sprint 4 ticked.
- [x] PR merged, branch deleted.

---

## Risks And Contingencies

### Risk 1: Bundled YAML fails strict validation in Task 7

If the bundled `full-body-3day.yaml` happens to use a non-string note, blank cardio detail, or any non-positive bound, Task 7 Step 7 will fail. Mitigation: the bundled-baseline test in Task 6 surfaces every offending path. Either fix the YAML in the same commit OR soften the specific rule (with a documented rationale). Soften only if the YAML pattern is genuinely common across user-provided routines; otherwise fix the YAML.

### Risk 2: Pre-existing `routine-service.test.ts` tests assert leniency

If an existing test passed a non-string note expecting the old `String()` coercion to succeed, the strict rule change will fail it. Update the assertion to expect the strict-mode error. The behavior change is intentional.

### Risk 3: `+ Add extra set` button visual placement looks odd

The `ml-9 self-start` styling in Task 5 is a guess. If it looks misaligned in the dev server, adjust during the implementation step. Do not block on perfect pixel alignment — visual polish can land in a follow-up.

### Risk 4: GPT-generated YAML continues using non-conforming shapes after Task 8

The instructions doc + contract doc updates assume the GPT will read them and adjust output. If a user reports a failed import after Sprint 4 ships, the fix is to either (a) tighten the GPT instructions further (the prompt may need stronger emphasis), or (b) add a pre-import normalization step that catches common GPT mistakes. Not in scope for this sprint.

### Risk 5: `MemoryRouter` wrapping in `SessionDetailExerciseCard.test.tsx` breaks existing tests

Sprint 3 added 5 new tests + an existing 8 that don't use `<Link>`. After Task 2 wraps everything in `<MemoryRouter>`, those existing tests should still pass because the dependency is just context — but if any test asserts on outer-DOM structure that the router context affects, update it.

### Risk 6: D3b "Add extra set" overlap with D3a "Add again"

User-facing risk: a user might tap `+ Add extra set` once on a card AND also use the picker's "Add again" once for the same exercise, ending up with N+1 SetRows in the original card AND a new burnout card. This is the intended dual-affordance, not a bug — but document it in the PR description so reviewers don't flag it as a UX regression.

---

## Self-Review Checklist (plan author)

- [x] **Spec coverage.** D1 → Task 2. D2 → Task 3. D3a → Task 4. D3b → Task 5. D4 → Tasks 6, 7, 8. Plus Task 1 (branch), Task 9 (optional e2e), Task 10 (gate), Task 11 (PR + merge).
- [x] **Placeholder scan.** Every code block is verbatim. Task 9's e2e seed/finish steps reference Sprint 3's spec directly (the implementer reads + adapts that file rather than re-deriving from scratch).
- [x] **Type consistency.** `extraTaps`, `loggedExtras`, `getExtraCount`, `addExtraSet` are named consistently in Task 5. The new `exerciseId` prop on `SessionDetailExerciseCard` is consistently passed by `SessionDetailScreen` (Task 2 Step 5). The `RoutineCardio`, `RoutineCardioOption` types match `domain/types.ts` shapes referenced in Task 7.
- [x] **Source scope.** Modifies `services/`, `features/`, `app/`, `tests/`, two custom-gpt docs. No domain types changed. No Dexie schema bump. No package.json.
- [x] **No new dependencies.** Hand-rolled validators, react-router `<Link>` already in use, sonner toast already in use.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-sprint-4-product-decisions.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
