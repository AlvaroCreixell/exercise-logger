# In-Session Weight Carryover — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user opens set N+1 of the same exercise+block and set N already has a logged weight for this session, prefill the sheet with set N's weight instead of the progression engine's suggestion. Matches the stated requirement in `docs/notes.md`: "if I actually used 135lbs on set 1, then set 2 should keep the 135lbs."

**Architecture:** Add a new prefill priority tier in `SetLogSheet.tsx` between "existing logged set" (edit) and "progression suggestion / last-time" (new slot). Carryover only affects `performedWeightKg` — reps/duration/distance keep today's priority order. The new tier reads from a new prop `blockSetsInSession: LoggedSet[]`, supplied by the two wrapper components that own the logged-set cache.

**Scope — weight only.** Reps carryover is debatable ("I hit 12 on set 1, so default set 2 to 12?") and is explicitly out of scope. Add a follow-up plan if that behavior is wanted.

**Tech Stack:** Vitest + React Testing Library + `@testing-library/user-event`. No DB — SetLogSheet is pure UI and all the state it needs arrives via props.

---

## File Structure

**New files:**
- `web/tests/unit/features/workout/SetLogSheet.test.tsx` — new test file. Covers prefill priority across all tiers (existing set, carryover, suggestion, defaults). We owed this anyway; no existing tests exercise the sheet's prefill logic.

**Modified files:**
- `web/src/features/workout/SetLogSheet.tsx` — add `blockSetsInSession?: LoggedSet[]` prop (default `[]`); add new priority tier in the `useEffect` prefill.
- `web/src/features/workout/WorkoutScreen.tsx` — pass `setsByExercise.get(sheetExercise.id) ?? []` into `SetLogSheetWithHistory`, thread through to `SetLogSheet`.
- `web/src/features/history/SessionDetailScreen.tsx` — pass `exData.loggedSets` into `SetLogSheetWithHistoryForDetail`, thread through to `SetLogSheet`. History is edit-only so the new tier never fires here, but keeping the prop wired avoids an inconsistent interface.

**Conventions used (verified in repo):**
- Vitest auto-globals; tests still import `describe, it, expect, vi` explicitly (matches `ExerciseCard.test.tsx`).
- Path alias `@/` → `web/src/`.
- Helper factories are local to each test file (see `ExerciseCard.test.tsx`'s `makeSessionExercise` / `makeLoggedSet`).
- All commands run from `C:/Users/creix/VSC Projects/exercise_logger/web/`.

---

## Task 1: Scaffold `SetLogSheet.test.tsx` with helpers and a baseline prefill test

**Why first:** We need shared factories and a `renderSheet()` harness before writing priority-tier assertions. Baseline test locks in the current "defaults" path so we detect regressions while editing the effect.

**Files:**
- Create: `web/tests/unit/features/workout/SetLogSheet.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// web/tests/unit/features/workout/SetLogSheet.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SetLogSheet } from "@/features/workout/SetLogSheet";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { BlockSuggestion, BlockLastTime } from "@/services/progression-service";

function makeSessionExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
  return {
    id: "se-1",
    sessionId: "s-1",
    routineEntryId: "re-1",
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
    setBlocksSnapshot: [
      { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
    ],
    createdAt: "2026-04-16T12:00:00.000Z",
    unitOverride: null,
    ...overrides,
  };
}

function makeLoggedSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return {
    id: "ls-1",
    sessionId: "s-1",
    sessionExerciseId: "se-1",
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: 80,
    performedReps: 10,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-16T12:00:00.000Z",
    updatedAt: "2026-04-16T12:00:00.000Z",
    ...overrides,
  };
}

interface RenderOpts {
  sessionExercise?: SessionExercise;
  blockIndex?: number;
  setIndex?: number;
  existingSet?: LoggedSet;
  suggestion?: BlockSuggestion;
  lastTime?: BlockLastTime;
  blockSetsInSession?: LoggedSet[];
}

function renderSheet(opts: RenderOpts = {}) {
  return render(
    <SetLogSheet
      open={true}
      onOpenChange={vi.fn()}
      sessionExercise={opts.sessionExercise ?? makeSessionExercise()}
      blockIndex={opts.blockIndex ?? 0}
      setIndex={opts.setIndex ?? 0}
      existingSet={opts.existingSet}
      suggestion={opts.suggestion}
      lastTime={opts.lastTime}
      blockSetsInSession={opts.blockSetsInSession ?? []}
      units="kg"
      onSave={vi.fn()}
    />
  );
}

describe("SetLogSheet prefill", () => {
  it("defaults weight to '0' and reps to block minValue when no history is available", () => {
    renderSheet({ setIndex: 0 });
    const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
    const reps = screen.getByLabelText(/reps/i) as HTMLInputElement;
    expect(weight.value).toBe("0");
    expect(reps.value).toBe("8"); // minValue of the default STANDARD_BLOCK
  });
});
```

- [ ] **Step 2: Confirm the file compiles and the baseline fails as expected (blockSetsInSession prop not yet on SetLogSheet)**

Run: `npm test -- SetLogSheet.test.tsx`
Expected: TypeScript error OR test failure referencing `blockSetsInSession` — the prop doesn't exist yet. That's intentional; Task 2 adds it.

> **Note:** Vitest may print the TS error as a runtime render failure depending on config. Either way, this step sets up the red state for Task 2.

---

## Task 2: Add `blockSetsInSession` prop (default `[]`) and make the baseline test pass

**Why:** The carryover feature needs access to the other sets logged for this exercise+block. We add the prop first, wired to do nothing, so the baseline test from Task 1 goes green. Behavior change comes in Task 3.

**Files:**
- Modify: `web/src/features/workout/SetLogSheet.tsx` (props + component signature)

- [ ] **Step 1: Add the prop to the interface**

In `web/src/features/workout/SetLogSheet.tsx`, locate the `SetLogSheetProps` interface (lines 19-36) and add:

```tsx
interface SetLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionExercise: SessionExercise;
  blockIndex: number;
  setIndex: number;
  existingSet: LoggedSet | undefined;
  suggestion: BlockSuggestion | undefined;
  lastTime: BlockLastTime | undefined;
  /**
   * All sets already logged for this (sessionExercise, blockIndex) in the
   * current session, including the one being edited. Used for in-session
   * weight carryover on new slots. Default [] = carryover disabled.
   */
  blockSetsInSession?: LoggedSet[];
  units: UnitSystem;
  onSave: (input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}
```

- [ ] **Step 2: Accept the prop in the component destructure and default it**

In the same file, locate the component signature (lines 38-50) and add the prop (no behavior change yet):

```tsx
export function SetLogSheet({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  suggestion,
  lastTime,
  blockSetsInSession = [],
  units,
  onSave,
  onDelete,
}: SetLogSheetProps) {
```

- [ ] **Step 3: Run the baseline test and confirm it passes**

Run: `npm test -- SetLogSheet.test.tsx`
Expected: 1 test passes.

- [ ] **Step 4: Commit**

```bash
git add web/src/features/workout/SetLogSheet.tsx web/tests/unit/features/workout/SetLogSheet.test.tsx
git commit -m "test(workout): scaffold SetLogSheet.test.tsx and add blockSetsInSession prop"
```

---

## Task 3: Add the in-session weight carryover priority tier

**Why:** Per `docs/notes.md`, when opening a new slot, the last weight the user actually logged in this session for the same block should win over the progression engine's suggestion. This is the core behavior change.

**Files:**
- Test: `web/tests/unit/features/workout/SetLogSheet.test.tsx`
- Modify: `web/src/features/workout/SetLogSheet.tsx` (prefill `useEffect`, lines 74-115)

- [ ] **Step 1: Add the failing carryover test**

Append inside the existing `describe("SetLogSheet prefill", ...)` block:

```tsx
  it("prefills weight from the most recent in-session set for the same block, overriding the suggestion", () => {
    // Scenario from docs/notes.md: suggestion says 130, user actually used 135 on set 0.
    // Opening set 1 must show 135, not 130.
    const priorSet = makeLoggedSet({
      id: "ls-set0",
      setIndex: 0,
      blockIndex: 0,
      performedWeightKg: 135,
      performedReps: 12,
      loggedAt: "2026-04-16T12:05:00.000Z",
    });
    const suggestion: BlockSuggestion = {
      blockIndex: 0,
      suggestedWeightKg: 130,
      isProgression: true,
    };

    renderSheet({
      setIndex: 1,
      suggestion,
      blockSetsInSession: [priorSet],
    });

    const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
    expect(weight.value).toBe("135");
  });
```

> **Note on `BlockSuggestion` shape:** Imported at the top of the file from `@/services/progression-service`. The literal above matches the exported type. If the real shape differs, adapt the literal (field names only) — the test intent is "a suggestion of 130 exists but carryover wins."

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- SetLogSheet.test.tsx`
Expected: the new test FAILS with `expected "130" to be "135"` (the current code uses the suggestion).

- [ ] **Step 3: Apply the fix in `SetLogSheet.tsx`**

In `web/src/features/workout/SetLogSheet.tsx`, locate the prefill `useEffect` (lines 74-115). Replace the entire effect body with:

```tsx
  // Pre-fill on open
  useEffect(() => {
    if (!open) return;
    setShowWeightForBodyweight(false);

    if (existingSet) {
      // Priority 1: current logged value (edit mode)
      setWeight(
        existingSet.performedWeightKg != null
          ? String(toDisplayWeight(existingSet.performedWeightKg, units))
          : ""
      );
      setReps(existingSet.performedReps != null ? String(existingSet.performedReps) : "");
      setDuration(existingSet.performedDurationSec != null
        ? String(durationInMinutes ? Math.round(existingSet.performedDurationSec / 60 * 100) / 100 : existingSet.performedDurationSec)
        : "");
      setDistance(existingSet.performedDistanceM != null ? String(existingSet.performedDistanceM) : "");
      return;
    }

    // Priority 2: in-session weight carryover. Look for the most recent set
    // logged in this session for the same block with a non-null weight.
    // Weight only — reps/duration/distance still follow the suggestion /
    // last-time path below so range targets stay visible.
    const carryoverSet = blockSetsInSession
      .filter((ls) => ls.blockIndex === blockIndex && ls.performedWeightKg != null)
      .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0];

    const lastSet = lastTime?.sets[setIndex];
    const suggestedWeight = suggestion?.suggestedWeightKg;

    if (carryoverSet?.performedWeightKg != null) {
      setWeight(String(toDisplayWeight(carryoverSet.performedWeightKg, units)));
    } else if (suggestedWeight != null) {
      setWeight(String(toDisplayWeight(suggestedWeight, units)));
    } else if (lastSet?.weightKg != null) {
      setWeight(String(toDisplayWeight(lastSet.weightKg, units)));
    } else {
      setWeight(showWeight ? "0" : "");
    }

    setReps(lastSet?.reps != null ? String(lastSet.reps) : block?.minValue != null && targetKind === "reps" ? String(block.minValue) : "");
    setDuration(lastSet?.durationSec != null
      ? String(durationInMinutes ? Math.round(lastSet.durationSec / 60 * 100) / 100 : lastSet.durationSec)
      : "");
    setDistance(lastSet?.distanceM != null ? String(lastSet.distanceM) : "");
  }, [open, existingSet, suggestion, lastTime, blockSetsInSession, se, blockIndex, setIndex, units, block?.minValue, showWeight, targetKind, durationInMinutes]);
```

> **Why the structure changed:** The old code had three mutually-exclusive branches (`existingSet` / `suggestion||lastTime` / `defaults`). The new priority sequence (existingSet → carryover → suggestion → lastTime.weightKg → "0") doesn't fit neatly into nested if/else, so we linearize: handle existingSet and early-return, then fall through to a single non-edit branch that walks the weight-priority chain and prefills reps/duration/distance uniformly.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- SetLogSheet.test.tsx`
Expected: 2 tests PASS.

- [ ] **Step 5: Run the full suite to check nothing regressed**

Run: `npm test`
Expected: all tests pass. If the pre-existing lint warning about `durationInMinutes` in `useEffect` deps is gone (we added it to the array above), that's fine — it resolves itself.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/workout/SetLogSheet.tsx web/tests/unit/features/workout/SetLogSheet.test.tsx
git commit -m "feat(workout): carry over most recent in-session weight on new set slot"
```

---

## Task 4: Wire the new prop from the WorkoutScreen wrapper

**Why:** The core behavior is shipped, but the prop is still `undefined` in production. `setsByExercise` in `WorkoutScreen` already contains the data we need.

**Files:**
- Modify: `web/src/features/workout/WorkoutScreen.tsx` (lines 202-215 and 298-351)

- [ ] **Step 1: Pass `blockSetsInSession` from the outer render to `SetLogSheetWithHistory`**

In `web/src/features/workout/WorkoutScreen.tsx`, locate the block at lines 202-215 and add the new prop:

```tsx
      {/* Set Log Sheet */}
      {sheetExercise && (
        <SetLogSheetWithHistory
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          sessionExercise={sheetExercise}
          blockIndex={sheetBlockIndex}
          setIndex={sheetSetIndex}
          existingSet={sheetExistingSet}
          blockSetsInSession={setsByExercise.get(sheetExercise.id) ?? []}
          units={units}
          onSave={handleSave}
          onDelete={sheetExistingSet ? handleDeleteSet : undefined}
        />
      )}
```

- [ ] **Step 2: Accept the new prop in `SetLogSheetWithHistory` and forward it**

In the same file, locate `SetLogSheetWithHistory` (lines 298-351). Add to the props type and forward:

```tsx
function SetLogSheetWithHistory({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  blockSetsInSession,
  units: globalUnits,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionExercise: SessionExercise;
  blockIndex: number;
  setIndex: number;
  existingSet: LoggedSet | undefined;
  blockSetsInSession: LoggedSet[];
  units: "kg" | "lbs";
  onSave: (input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const effectiveUnits = getEffectiveUnit(sessionExercise.unitOverride, globalUnits);
  const isRoutine = sessionExercise.origin === "routine";
  const historyData = useExerciseHistory(
    isRoutine ? sessionExercise : undefined,
    effectiveUnits
  );

  const suggestion = historyData?.suggestions.find(
    (s) => s.blockIndex === blockIndex
  );
  const lastTime = historyData?.lastTime[blockIndex];

  return (
    <SetLogSheet
      open={open}
      onOpenChange={onOpenChange}
      sessionExercise={sessionExercise}
      blockIndex={blockIndex}
      setIndex={setIndex}
      existingSet={existingSet}
      suggestion={suggestion}
      lastTime={lastTime}
      blockSetsInSession={blockSetsInSession}
      units={effectiveUnits}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}
```

- [ ] **Step 3: Run typecheck to make sure nothing drifted**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/src/features/workout/WorkoutScreen.tsx
git commit -m "feat(workout): wire blockSetsInSession into SetLogSheet from WorkoutScreen"
```

---

## Task 5: Wire the new prop from the SessionDetailScreen wrapper

**Why:** Keep the interface symmetric. Carryover never fires in history (edit-only — `existingSet` is always set), but omitting the prop leaves us with a TS-default of `[]` which is fine, while passing the real data keeps the two wrappers parallel and avoids a "why does only one pass this?" question on future reads.

**Files:**
- Modify: `web/src/features/history/SessionDetailScreen.tsx` (sheet mount point and `SetLogSheetWithHistoryForDetail`)

- [ ] **Step 1: Pass `blockSetsInSession` from the outer render**

In `web/src/features/history/SessionDetailScreen.tsx`, locate the sheet mount block around lines 169-180 and add the prop. `exData.loggedSets` is already in scope in the parent:

```tsx
      {sheetExercise && (
        <SetLogSheetWithHistoryForDetail
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          sessionExercise={sheetExercise}
          blockIndex={sheetBlockIndex}
          setIndex={sheetSetIndex}
          existingSet={sheetExistingSet}
          blockSetsInSession={sheetExerciseSets}
          units={units}
          onSave={handleSave}
          onDelete={sheetExistingSet ? handleDeleteSet : undefined}
        />
      )}
```

> **Note on `sheetExerciseSets`:** This variable may not exist yet — the file holds the full session's logged sets and derives per-exercise slices at render time. Read the surrounding code: if there's an `exData` for the currently-open sheet, use `exData.loggedSets`. If `sheetExercise` is set but the per-exercise array isn't already plucked, do: `const sheetExerciseSets = exercisesWithSets.find((e) => e.sessionExercise.id === sheetExercise?.id)?.loggedSets ?? [];` just before the sheet mount. Use whichever matches the existing variable naming in that file.

- [ ] **Step 2: Accept and forward the prop inside `SetLogSheetWithHistoryForDetail`**

Locate `SetLogSheetWithHistoryForDetail` (lines 224-270 in the current file). Add to the props type and forward:

```tsx
function SetLogSheetWithHistoryForDetail({
  open,
  onOpenChange,
  sessionExercise,
  blockIndex,
  setIndex,
  existingSet,
  blockSetsInSession,
  units: globalUnits,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionExercise: SessionExercise;
  blockIndex: number;
  setIndex: number;
  existingSet: LoggedSet | undefined;
  blockSetsInSession: LoggedSet[];
  units: "kg" | "lbs";
  onSave: (input: {
    performedWeightKg: number | null;
    performedReps: number | null;
    performedDurationSec: number | null;
    performedDistanceM: number | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const effectiveUnits = getEffectiveUnit(sessionExercise.unitOverride, globalUnits);
  const historyData = useExerciseHistory(
    sessionExercise.origin === "routine" ? sessionExercise : undefined,
    effectiveUnits
  );
  return (
    <SetLogSheet
      open={open}
      onOpenChange={onOpenChange}
      sessionExercise={sessionExercise}
      blockIndex={blockIndex}
      setIndex={setIndex}
      existingSet={existingSet}
      suggestion={historyData?.suggestions.find((s) => s.blockIndex === blockIndex)}
      lastTime={historyData?.lastTime[blockIndex]}
      blockSetsInSession={blockSetsInSession}
      units={effectiveUnits}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add web/src/features/history/SessionDetailScreen.tsx
git commit -m "feat(history): wire blockSetsInSession into SetLogSheet from SessionDetailScreen"
```

---

## Task 6: Edge-case regression tests

**Why:** Task 3 introduced a non-trivial priority order. Lock it in with explicit tests for the cases that are easy to break later.

**Files:**
- Modify: `web/tests/unit/features/workout/SetLogSheet.test.tsx`

- [ ] **Step 1: Append the edge-case tests inside the existing `describe` block**

```tsx
  it("existingSet wins over carryover (edit mode)", () => {
    const priorSet = makeLoggedSet({
      id: "ls-set0",
      setIndex: 0,
      performedWeightKg: 135,
      loggedAt: "2026-04-16T12:05:00.000Z",
    });
    const existing = makeLoggedSet({
      id: "ls-set1",
      setIndex: 1,
      performedWeightKg: 140,
      performedReps: 8,
      loggedAt: "2026-04-16T12:06:00.000Z",
    });
    const suggestion: BlockSuggestion = {
      blockIndex: 0,
      suggestedWeightKg: 130,
      isProgression: true,
    };

    renderSheet({
      setIndex: 1,
      existingSet: existing,
      suggestion,
      blockSetsInSession: [priorSet, existing],
    });

    const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
    expect(weight.value).toBe("140");
  });

  it("picks the most recent carryover set by loggedAt, not by setIndex", () => {
    // User logged set 0 at 12:00 (weight 130), then went back and edited set 0
    // to 135 at 12:10. Opening set 1 should prefill 135 (most recent write),
    // even though setIndex didn't change.
    const earlier = makeLoggedSet({
      id: "ls-a",
      setIndex: 0,
      performedWeightKg: 130,
      loggedAt: "2026-04-16T12:00:00.000Z",
    });
    const later = makeLoggedSet({
      id: "ls-b",
      setIndex: 0,
      performedWeightKg: 135,
      loggedAt: "2026-04-16T12:10:00.000Z",
    });

    renderSheet({
      setIndex: 1,
      blockSetsInSession: [earlier, later],
    });

    const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
    expect(weight.value).toBe("135");
  });

  it("ignores carryover sets whose performedWeightKg is null", () => {
    // An empty save with only reps shouldn't override the suggestion.
    const nullWeightSet = makeLoggedSet({
      id: "ls-a",
      setIndex: 0,
      performedWeightKg: null,
      performedReps: 10,
      loggedAt: "2026-04-16T12:00:00.000Z",
    });
    const suggestion: BlockSuggestion = {
      blockIndex: 0,
      suggestedWeightKg: 130,
      isProgression: true,
    };

    renderSheet({
      setIndex: 1,
      suggestion,
      blockSetsInSession: [nullWeightSet],
    });

    const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
    expect(weight.value).toBe("130");
  });

  it("ignores carryover from other blocks (blockIndex mismatch)", () => {
    // Top-set block 0 was 140; back-off block 1 should not inherit from it.
    const topSet = makeLoggedSet({
      id: "ls-top",
      blockIndex: 0,
      setIndex: 0,
      performedWeightKg: 140,
      loggedAt: "2026-04-16T12:00:00.000Z",
    });
    const backOffSuggestion: BlockSuggestion = {
      blockIndex: 1,
      suggestedWeightKg: 100,
      isProgression: true,
    };
    const se = makeSessionExercise({
      setBlocksSnapshot: [
        { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" } as SetBlock,
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 } as SetBlock,
      ],
    });

    renderSheet({
      sessionExercise: se,
      blockIndex: 1,
      setIndex: 0,
      suggestion: backOffSuggestion,
      blockSetsInSession: [topSet],
    });

    const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
    expect(weight.value).toBe("100"); // suggestion for block 1, not 140 from block 0
  });

  it("falls through to suggestion when blockSetsInSession is empty", () => {
    const suggestion: BlockSuggestion = {
      blockIndex: 0,
      suggestedWeightKg: 125,
      isProgression: true,
    };

    renderSheet({
      setIndex: 0,
      suggestion,
      blockSetsInSession: [],
    });

    const weight = screen.getByLabelText(/weight/i) as HTMLInputElement;
    expect(weight.value).toBe("125");
  });
```

- [ ] **Step 2: Run the new tests and confirm they pass**

Run: `npm test -- SetLogSheet.test.tsx`
Expected: all tests PASS (1 baseline + 1 carryover + 5 edge cases = 7 total).

- [ ] **Step 3: Commit**

```bash
git add web/tests/unit/features/workout/SetLogSheet.test.tsx
git commit -m "test(workout): lock in SetLogSheet prefill priority with edge cases"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full suite, typecheck, and lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green. The pre-existing lint warning in `SetLogSheet.tsx` about `durationInMinutes` should now be resolved (Task 3 added it to the deps array). If a new warning appears, investigate before continuing.

- [ ] **Step 2: Manual smoke**

If a browser is available:
1. `npm run dev`
2. Start a workout with a routine block that has ≥ 2 sets and a progression suggestion (e.g., the plan has a "last time" + "+5%" on set 1).
3. On set 1, clear the prefilled suggestion and type a different weight (say `+5kg` over the suggestion). Save.
4. Open set 2 — confirm the weight defaults to what you just logged on set 1, **not** the progression suggestion.
5. Re-open set 1 (edit mode) — confirm it still shows your actual logged value (existingSet priority wins).
6. On a different block of the same exercise (top-set vs back-off), confirm carryover does **not** leak across blocks.
7. Bonus: navigate to the same session in History, open a set in the sheet, and confirm editing still works normally (the carryover tier is irrelevant here because `existingSet` is always set).

- [ ] **Step 3: Final commit if any housekeeping changes were made**

If the smoke turned up nothing, skip. Otherwise commit follow-ups.

---

## Self-Review Notes

**Spec coverage:**
- "if I actually used 135lbs on set 1, then set 2 should keep the 135lbs" → Task 3 Step 1 test (carryover overrides suggestion); Task 3 Step 3 implementation.
- "the default before logging should be 130lbs" (suggestion path) → Task 6 "falls through to suggestion when blockSetsInSession is empty" covers the no-carryover case.

**Out of scope (deliberately):**
- Reps/duration/distance carryover. The spec only mentions weight; adding more could surprise the user.
- Carryover across exercises in a superset (each exercise tracks its own `sessionExerciseId`).
- Showing a visible hint ("carried over from set 1") in the sheet. The weight just appears prefilled; no UI cue today. Add a follow-up plan if this feels confusing in use.
- Catching the `validateSetInput` throw from the set-service and surfacing it as a toast inside `SetLogSheet` — still Plan B/C territory from the prior bug-bash plan.

**Type consistency check:**
- `LoggedSet` factory fields match `web/src/domain/types.ts` (same discipline as the existing `ExerciseCard.test.tsx` factory).
- `BlockSuggestion` literal in Task 3 assumes `{ blockIndex, suggestedWeightKg, isProgression }`. If the real export has more required fields, adapt the literal — the test intent is only "a suggestion exists with a suggested weight".
- New prop name `blockSetsInSession` is consistent across SetLogSheet, both wrappers, and all tests.

**Placeholder scan:** None intended. Task 5 Step 1 has an inline instruction to read the surrounding file for the correct per-exercise-slice variable — that's a judgment call the executor must make, but all possible answers are enumerated.
