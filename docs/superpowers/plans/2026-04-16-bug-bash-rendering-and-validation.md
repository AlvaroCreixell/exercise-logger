# Bug Bash: Extra-Set Indices, Distance Rendering, Negative Input Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three small but real-data-impacting bugs identified in the 2026-04-16 audit:
1. Extra-exercise SetSlots use display index `i` instead of stored `loggedSet.setIndex` → after deleting a middle extra set, tapping a later set opens it as a new slot, overwriting/duplicating data.
2. `formatLastTime()` has no `distanceM` branch → distance-based blocks (rowing, sprints) render blank "Last:" / "Recent:" history.
3. `logSet` and `editSet` accept negative weights/reps/duration/distance with no validation → user reported in `docs/notes.md`.

**Architecture:** TDD throughout. Each bug ships as: (1) failing regression test, (2) minimal fix, (3) commit. Bugs 1 & 2 share a new component test file `ExerciseCard.test.tsx`. Bug 3 extends the existing `set-service.test.ts` and adds a small validator helper to `set-service.ts`.

**Tech Stack:** Vitest + React Testing Library + `@testing-library/user-event`, `fake-indexeddb` for service-layer tests, plain TypeScript helpers for validation.

---

## File Structure

**New files:**
- `web/tests/unit/features/workout/ExerciseCard.test.tsx` — regression coverage for Bugs 1 & 2 plus baseline rendering.

**Modified files:**
- `web/src/features/workout/ExerciseCard.tsx` — add `distanceM` branch to `formatLastTime`; pass `ls.setIndex` instead of render index `i` for extras.
- `web/src/services/set-service.ts` — add `validateSetInput()` helper; call from `logSet` and `editSet` before any DB write.
- `web/tests/unit/services/set-service.test.ts` — add validation rejection tests for both `logSet` and `editSet`.

**Conventions used (verified in repo):**
- Vitest is auto-globals (`describe`, `it`, `expect` available without import — but existing tests still import them; follow that pattern).
- Test files live under `web/tests/unit/<mirror of src path>/`. There is no existing `web/tests/unit/features/workout/` directory; this plan creates it.
- Path alias `@/` maps to `web/src/`.
- Service tests use `fake-indexeddb/auto` and create a fresh `ExerciseLoggerDB` per test (see existing `set-service.test.ts` pattern).
- All commands run from `C:/Users/creix/VSC Projects/exercise_logger/web/` unless noted.

---

## Task 1: Scaffold `ExerciseCard.test.tsx` with shared helpers

**Why first:** Bugs 1 & 2 both need the same `SessionExercise` / `LoggedSet` factory helpers and the same render harness. Building this once keeps later tasks short.

**Files:**
- Create: `web/tests/unit/features/workout/ExerciseCard.test.tsx`

- [ ] **Step 1: Create the directory and the test file with helpers and one trivial passing baseline test**

```tsx
// web/tests/unit/features/workout/ExerciseCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExerciseCard } from "@/features/workout/ExerciseCard";
import type { SessionExercise, LoggedSet, SetBlock } from "@/domain/types";
import type { ExerciseHistoryData, ExtraExerciseHistory } from "@/services/progression-service";

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
    performedReps: 8,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-16T12:00:00.000Z",
    updatedAt: "2026-04-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("ExerciseCard", () => {
  it("renders the exercise name", () => {
    render(
      <ExerciseCard
        sessionExercise={makeSessionExercise()}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );
    expect(screen.getByText("Barbell Back Squat")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to verify the file is wired up**

Run: `npm test -- ExerciseCard.test.tsx`
Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add web/tests/unit/features/workout/ExerciseCard.test.tsx
git commit -m "test(workout): scaffold ExerciseCard test file"
```

---

## Task 2: Bug 2 — distance values render in `formatLastTime`

**Why:** `formatLastTime` in `ExerciseCard.tsx:33-54` has branches for `weightKg`, `reps`, `durationSec` but **no** branch for `distanceM`. Distance-based blocks (rowing 2K sprints, etc.) currently render blank `Last:` text on routine cards and blank `Recent:` text on extras.

**Files:**
- Test: `web/tests/unit/features/workout/ExerciseCard.test.tsx`
- Modify: `web/src/features/workout/ExerciseCard.tsx:51-53`

- [ ] **Step 1: Add the failing regression test**

Append inside the existing `describe("ExerciseCard", ...)` block in `ExerciseCard.test.tsx`:

```tsx
  it("renders distance-only history under 'Last:' for routine blocks", () => {
    const distanceBlock: SetBlock = {
      targetKind: "distance",
      exactValue: 2000,
      count: 2,
    };
    const se = makeSessionExercise({
      exerciseNameSnapshot: "Rowing 2K Sprint",
      setBlocksSnapshot: [distanceBlock],
    });
    const historyData: ExerciseHistoryData = {
      lastTime: [
        {
          blockIndex: 0,
          blockLabel: "Set block 1",
          tag: null,
          sets: [
            { weightKg: null, reps: null, durationSec: null, distanceM: 2000 },
            { weightKg: null, reps: null, durationSec: null, distanceM: 2050 },
          ],
        },
      ],
      suggestions: [],
    };

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={historyData}
        extraHistory={undefined}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText(/Last:\s*2000m,\s*2050m/)).toBeVisible();
  });

  it("renders distance-only history under 'Recent:' for extra exercises", () => {
    const se = makeSessionExercise({
      origin: "extra",
      setBlocksSnapshot: [],
    });
    const extraHistory: ExtraExerciseHistory = {
      sessionDate: "2026-04-16T12:00:00.000Z",
      sets: [
        { weightKg: null, reps: null, durationSec: null, distanceM: 1500 },
      ],
    };

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={[]}
        units="kg"
        historyData={undefined}
        extraHistory={extraHistory}
        onSetTap={() => {}}
      />
    );

    expect(screen.getByText(/Recent:\s*1500m/)).toBeVisible();
  });
```

> **Note on imported types:** `ExerciseHistoryData` and `ExtraExerciseHistory` are already imported at the top of the test file from Task 1. If the structural literals above don't match their definitions, open `web/src/services/progression-service.ts`, find the exported types, and adapt the literal values — the test intent is only "pass an object of the expected shape that contains a `distanceM` value." Do NOT change `formatLastTime`'s public signature; the fix is internal.

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `npm test -- ExerciseCard.test.tsx`
Expected: both new distance tests FAIL with a "unable to find an element" message because `formatLastTime` returns `""` for distance-only sets.

- [ ] **Step 3: Apply the fix in `ExerciseCard.tsx`**

In `web/src/features/workout/ExerciseCard.tsx`, replace lines 51-53:

```tsx
  if (first.reps != null) return sets.map((s) => `${s.reps ?? "?"}r`).join(", ");
  if (first.durationSec != null) return sets.map((s) => `${s.durationSec ?? "?"}s`).join(", ");
  return "";
```

with:

```tsx
  if (first.reps != null) return sets.map((s) => `${s.reps ?? "?"}r`).join(", ");
  if (first.durationSec != null) return sets.map((s) => `${s.durationSec ?? "?"}s`).join(", ");
  if (first.distanceM != null) return sets.map((s) => `${s.distanceM ?? "?"}m`).join(", ");
  return "";
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm test -- ExerciseCard.test.tsx`
Expected: all tests PASS, including the two distance tests.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `npm test`
Expected: all 397+ tests pass (395 previously + 2 new).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/workout/ExerciseCard.tsx web/tests/unit/features/workout/ExerciseCard.test.tsx
git commit -m "fix(workout): render distance values in formatLastTime"
```

---

## Task 3: Bug 1 — extras pass `ls.setIndex` instead of render index

**Why:** In `ExerciseCard.tsx:192-199`, the `.map((ls, i) => ...)` over extra sets passes the render index `i` to both `setIndex` (display label) and `onSetTap(0, i)`. After the user logs three extras and deletes the middle one, the surviving sets render with `i = 0, 1` but their stored `setIndex` values are still `0, 2`. Tapping the second visible row calls `onSetTap(0, 1)` which doesn't match any existing `loggedSet`, so the `SetLogSheet` opens in "create" mode and writes a new row at `setIndex: 1` — duplicating slots and silently corrupting state.

**Fix:** Use `ls.setIndex` for the click handler. The visible label can keep using `i` so the user sees a clean "1, 2" sequence after deletion (we're not asking the UI to renumber stored data).

**Files:**
- Test: `web/tests/unit/features/workout/ExerciseCard.test.tsx`
- Modify: `web/src/features/workout/ExerciseCard.tsx:192-199`

- [ ] **Step 1: Add the failing regression test**

Append inside the existing `describe("ExerciseCard", ...)` block in `ExerciseCard.test.tsx`:

```tsx
  it("extras pass the stored loggedSet.setIndex to onSetTap (not the render index)", async () => {
    const user = userEvent.setup();
    const onSetTap = vi.fn();

    // Simulates the state after logging extras at setIndex 0, 1, 2 and then
    // deleting the one at setIndex 1. The remaining stored indices are 0 and 2.
    const loggedSets: LoggedSet[] = [
      makeLoggedSet({
        id: "ls-a",
        setIndex: 0,
        loggedAt: "2026-04-16T12:00:00.000Z",
      }),
      makeLoggedSet({
        id: "ls-c",
        setIndex: 2,
        loggedAt: "2026-04-16T12:02:00.000Z",
      }),
    ];
    const se = makeSessionExercise({
      origin: "extra",
      setBlocksSnapshot: [],
    });

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={loggedSets}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={onSetTap}
      />
    );

    // The two logged slots render in chronological order; the third (empty)
    // slot is the "add another extra" affordance. Find all set-slot elements
    // and click the SECOND logged one (index 1 in render order, but stored
    // setIndex is 2).
    const slots = screen.getAllByTestId("set-slot");
    // slots[0] = logged setIndex 0, slots[1] = logged setIndex 2,
    // slots[2] = empty new-set slot at loggedSets.length (= 2).
    expect(slots).toHaveLength(3);

    await user.click(slots[1]!);

    expect(onSetTap).toHaveBeenCalledWith(0, 2);
  });
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- ExerciseCard.test.tsx`
Expected: FAIL with `expected onSetTap to have been called with [0, 2], received [0, 1]` (or similar).

- [ ] **Step 3: Apply the fix in `ExerciseCard.tsx`**

In `web/src/features/workout/ExerciseCard.tsx`, replace lines 190-209:

```tsx
        {/* Extra exercise: single unstructured slot row */}
        {isExtra && (
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {[...loggedSets].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)).map((ls, i) => (
              <SetSlot
                key={ls.id}
                setIndex={i}
                loggedSet={ls}
                units={units}
                onClick={() => onSetTap(0, i)}
              />
            ))}
            {!readOnly && (
              <SetSlot
                setIndex={loggedSets.length}
                loggedSet={undefined}
                units={units}
                onClick={() => onSetTap(0, loggedSets.length)}
              />
            )}
          </div>
        )}
```

with:

```tsx
        {/* Extra exercise: single unstructured slot row.
            Display index `i` is used only for the visible "1, 2, 3" label;
            the stored `ls.setIndex` is what the click handler must use so
            taps after a middle-set delete still address the right row. */}
        {isExtra && (() => {
          const sorted = [...loggedSets].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
          const nextSetIndex = loggedSets.reduce((max, ls) => Math.max(max, ls.setIndex + 1), 0);
          return (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {sorted.map((ls, i) => (
                <SetSlot
                  key={ls.id}
                  setIndex={i}
                  loggedSet={ls}
                  units={units}
                  onClick={() => onSetTap(0, ls.setIndex)}
                />
              ))}
              {!readOnly && (
                <SetSlot
                  setIndex={sorted.length}
                  loggedSet={undefined}
                  units={units}
                  onClick={() => onSetTap(0, nextSetIndex)}
                />
              )}
            </div>
          );
        })()}
```

> **Why `nextSetIndex = max(setIndex) + 1` instead of `loggedSets.length`:** if a middle set was deleted, `loggedSets.length` (e.g., 2) collides with an existing stored `setIndex` (e.g., 2 from the surviving last extra). Using `max + 1` always picks an unused slot.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test -- ExerciseCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add a second regression test for the "new extra" slot**

Append to the same `describe` block:

```tsx
  it("the empty 'add extra' slot uses max(setIndex)+1, not loggedSets.length", async () => {
    const user = userEvent.setup();
    const onSetTap = vi.fn();

    // Two surviving extras at stored indices 0 and 2 (middle one deleted).
    // loggedSets.length = 2, but setIndex 2 is taken — the new slot must
    // open at setIndex 3.
    const loggedSets: LoggedSet[] = [
      makeLoggedSet({ id: "ls-a", setIndex: 0, loggedAt: "2026-04-16T12:00:00.000Z" }),
      makeLoggedSet({ id: "ls-c", setIndex: 2, loggedAt: "2026-04-16T12:02:00.000Z" }),
    ];
    const se = makeSessionExercise({ origin: "extra", setBlocksSnapshot: [] });

    render(
      <ExerciseCard
        sessionExercise={se}
        loggedSets={loggedSets}
        units="kg"
        historyData={undefined}
        extraHistory={undefined}
        onSetTap={onSetTap}
      />
    );

    const slots = screen.getAllByTestId("set-slot");
    // slots[2] is the empty add-new affordance.
    await user.click(slots[2]!);

    expect(onSetTap).toHaveBeenCalledWith(0, 3);
  });
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npm test -- ExerciseCard.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all tests pass (now ~399).

- [ ] **Step 8: Commit**

```bash
git add web/src/features/workout/ExerciseCard.tsx web/tests/unit/features/workout/ExerciseCard.test.tsx
git commit -m "fix(workout): use stored setIndex for extra-set taps after middle-set delete"
```

---

## Task 4: Bug 4 — reject negative weight/reps/duration/distance in `logSet` and `editSet`

**Why:** From `docs/notes.md`: *"Negative weights and negative reps (perhaps duration, distance too)... Should be limited to positive numbers."* Today, `set-service.ts` accepts any `number | null` and writes it straight to Dexie. The UI also has no `min=0`, but defense-in-depth says the service is the right enforcement point — the UI can still be tightened later.

**Validation rules:**
- `performedWeightKg`: `>= 0` or `null`. Zero is valid (bodyweight movements logged as "no added load").
- `performedReps`: `> 0` or `null`. Zero reps means "didn't do any" → use `null`.
- `performedDurationSec`: `> 0` or `null`. Same reasoning.
- `performedDistanceM`: `> 0` or `null`. Same reasoning.
- All four also reject `NaN` and non-finite values.

**Files:**
- Modify: `web/src/services/set-service.ts` — add `validateSetInput()` helper + call from `logSet` and `editSet`.
- Test: `web/tests/unit/services/set-service.test.ts` — add a `describe("input validation")` block.

- [ ] **Step 1: Add failing tests for `logSet` rejection**

Open `web/tests/unit/services/set-service.test.ts`. Find the end of the file. Append a new `describe` block at the bottom (outside any other `describe`):

```ts
// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("logSet input validation", () => {
  // Builds an active session with a single weight exercise, returning the
  // sessionExerciseId so each test can call logSet directly.
  async function setupActiveSession(): Promise<{ db: ExerciseLoggerDB; seId: string }> {
    const db = new ExerciseLoggerDB();
    await db.open();
    await initializeSettings(db);

    const exercise = makeExercise("barbell-back-squat");
    await db.exercises.add(exercise);

    const routine = makeRoutine([
      {
        kind: "exercise",
        entryId: "e-1",
        exerciseId: exercise.id,
        setBlocks: [STANDARD_BLOCK],
      },
    ]);
    await db.routines.add(routine);

    const session = await startSessionWithCatalog(db, routine, "A");
    return { db, seId: session.exercises[0]!.id };
  }

  it.each([
    ["negative weight", { performedWeightKg: -5, performedReps: 8, performedDurationSec: null, performedDistanceM: null }],
    ["negative reps", { performedWeightKg: 80, performedReps: -1, performedDurationSec: null, performedDistanceM: null }],
    ["zero reps", { performedWeightKg: 80, performedReps: 0, performedDurationSec: null, performedDistanceM: null }],
    ["negative duration", { performedWeightKg: null, performedReps: null, performedDurationSec: -10, performedDistanceM: null }],
    ["zero duration", { performedWeightKg: null, performedReps: null, performedDurationSec: 0, performedDistanceM: null }],
    ["negative distance", { performedWeightKg: null, performedReps: null, performedDurationSec: null, performedDistanceM: -100 }],
    ["zero distance", { performedWeightKg: null, performedReps: null, performedDurationSec: null, performedDistanceM: 0 }],
    ["NaN weight", { performedWeightKg: NaN, performedReps: 8, performedDurationSec: null, performedDistanceM: null }],
    ["Infinity reps", { performedWeightKg: 80, performedReps: Infinity, performedDurationSec: null, performedDistanceM: null }],
  ])("rejects %s", async (_label, input) => {
    const { db, seId } = await setupActiveSession();
    try {
      await expect(logSet(db, seId, 0, 0, input)).rejects.toThrow(/invalid|positive|finite/i);
      // Confirm nothing was written.
      const count = await db.loggedSets.count();
      expect(count).toBe(0);
    } finally {
      db.close();
    }
  });

  it("accepts zero weight (bodyweight semantics) with positive reps", async () => {
    const { db, seId } = await setupActiveSession();
    try {
      const ls = await logSet(db, seId, 0, 0, {
        performedWeightKg: 0,
        performedReps: 5,
        performedDurationSec: null,
        performedDistanceM: null,
      });
      expect(ls.performedWeightKg).toBe(0);
      expect(ls.performedReps).toBe(5);
    } finally {
      db.close();
    }
  });

  it("accepts all-null input (rare but legal — represents an empty save)", async () => {
    const { db, seId } = await setupActiveSession();
    try {
      const ls = await logSet(db, seId, 0, 0, {
        performedWeightKg: null,
        performedReps: null,
        performedDurationSec: null,
        performedDistanceM: null,
      });
      expect(ls.id).toBeDefined();
    } finally {
      db.close();
    }
  });
});

describe("editSet input validation", () => {
  it("rejects a negative weight on edit and leaves the row unchanged", async () => {
    const db = new ExerciseLoggerDB();
    await db.open();
    await initializeSettings(db);

    const exercise = makeExercise("barbell-back-squat");
    await db.exercises.add(exercise);
    const routine = makeRoutine([
      {
        kind: "exercise",
        entryId: "e-1",
        exerciseId: exercise.id,
        setBlocks: [STANDARD_BLOCK],
      },
    ]);
    await db.routines.add(routine);
    const session = await startSessionWithCatalog(db, routine, "A");
    const seId = session.exercises[0]!.id;

    const original = await logSet(db, seId, 0, 0, {
      performedWeightKg: 80,
      performedReps: 8,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    try {
      await expect(
        editSet(db, original.id, {
          performedWeightKg: -10,
          performedReps: 8,
          performedDurationSec: null,
          performedDistanceM: null,
        })
      ).rejects.toThrow(/invalid|positive|finite/i);

      const after = await db.loggedSets.get(original.id);
      expect(after?.performedWeightKg).toBe(80);
    } finally {
      db.close();
    }
  });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `npm test -- set-service.test.ts`
Expected: the new validation tests FAIL because no validation exists yet — `logSet` will accept the invalid input and either write a row or throw a different error.

- [ ] **Step 3: Add the `validateSetInput()` helper to `set-service.ts`**

Open `web/src/services/set-service.ts`. After the existing `SetLogInput` interface (ends at line 24) and before the `// Log set` divider comment, insert this new section:

```ts
// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/**
 * Validate a SetLogInput for plausible numeric ranges.
 *
 * Rules (per `docs/notes.md`):
 * - performedWeightKg: >= 0 or null (zero allowed for bodyweight movements
 *   logged as "no added load").
 * - performedReps, performedDurationSec, performedDistanceM: > 0 or null
 *   (zero is meaningless — use null to mean "not applicable").
 * - All numeric values must be finite (rejects NaN and ±Infinity).
 *
 * Throws a descriptive Error on the first failing field. Caller is
 * responsible for surfacing the message to the UI.
 */
function validateSetInput(input: SetLogInput): void {
  const checkNonNegative = (value: number | null, field: string) => {
    if (value === null) return;
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid ${field}: must be a finite number, got ${value}`);
    }
    if (value < 0) {
      throw new Error(`Invalid ${field}: must be >= 0, got ${value}`);
    }
  };
  const checkPositive = (value: number | null, field: string) => {
    if (value === null) return;
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid ${field}: must be a finite number, got ${value}`);
    }
    if (value <= 0) {
      throw new Error(`Invalid ${field}: must be positive, got ${value}`);
    }
  };

  checkNonNegative(input.performedWeightKg, "performedWeightKg");
  checkPositive(input.performedReps, "performedReps");
  checkPositive(input.performedDurationSec, "performedDurationSec");
  checkPositive(input.performedDistanceM, "performedDistanceM");
}
```

- [ ] **Step 4: Call the validator from `logSet`**

Still in `web/src/services/set-service.ts`, in the `logSet` function (around line 55-65), insert the validation call as the very first statement of the function body (before the `db.sessionExercises.get(...)` lookup):

```ts
export async function logSet(
  db: ExerciseLoggerDB,
  sessionExerciseId: string,
  blockIndex: number,
  setIndex: number,
  input: SetLogInput
): Promise<LoggedSet> {
  validateSetInput(input);

  const sessionExercise = await db.sessionExercises.get(sessionExerciseId);
  // ... rest unchanged
```

- [ ] **Step 5: Call the validator from `editSet`**

In the same file, in the `editSet` function (around line 185-195), insert the validation call as the first statement of the body (before the `db.loggedSets.get(...)` lookup):

```ts
export async function editSet(
  db: ExerciseLoggerDB,
  loggedSetId: string,
  input: SetLogInput
): Promise<LoggedSet> {
  validateSetInput(input);

  const existing = await db.loggedSets.get(loggedSetId);
  // ... rest unchanged
```

- [ ] **Step 6: Run the validation tests and confirm they pass**

Run: `npm test -- set-service.test.ts`
Expected: all set-service tests PASS, including the new validation block.

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: all tests pass (~410+).

- [ ] **Step 8: Run typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: typecheck clean. Lint may emit the one pre-existing warning in `SetLogSheet.tsx` (`react-hooks/exhaustive-deps` for `durationInMinutes`) — that's not introduced by this plan, leave it alone.

- [ ] **Step 9: Commit**

```bash
git add web/src/services/set-service.ts web/tests/unit/services/set-service.test.ts
git commit -m "feat(set-service): reject negative/zero/non-finite set inputs in logSet and editSet"
```

---

## Task 5: Final verification

- [ ] **Step 1: Run the full suite one more time end-to-end**

Run: `npm test && npm run typecheck && npm run lint`
Expected: all green; lint warning count unchanged from baseline (1 pre-existing).

- [ ] **Step 2: Manual smoke (optional but recommended)**

If a browser is available:
1. `npm run dev`
2. Start a workout that includes a routine entry with at least 3 sets (or use extras).
3. As an extra: log 3 sets, delete the middle one, tap the last one — confirm it opens in **edit** mode (shows existing values), not new-set mode.
4. In SetLogSheet, try to enter `-5` for weight and save — confirm the service throws and the UI surfaces an error rather than writing a `-5` row. (UI error surfacing is out-of-scope for this plan; the throw is what we shipped.)
5. Find a distance-based block in a routine (e.g., import `full-body-3day.yaml` if it has one, or temporarily author one) and confirm "Last:" shows the meter value after a finished session.

- [ ] **Step 3: Final commit if any housekeeping changes were made**

If steps above produced no further edits, skip. Otherwise:

```bash
git add -A
git commit -m "chore: post-bug-bash housekeeping"
```

---

## Self-Review Notes

**Spec coverage:**
- Bug 1 (extras index): Tasks 3 covers it with two regression tests (existing-set tap and new-set tap).
- Bug 2 (distance formatLastTime): Task 2 covers it with two regression tests (routine `Last:` and extras `Recent:`).
- Bug 4 (negative input validation): Task 4 covers `logSet` (table-driven across all four fields + NaN/Infinity) and `editSet` (smoke). Zero-weight bodyweight is explicitly preserved.

**Out of scope (deliberately):**
- UI surfacing of validation errors in `SetLogSheet`. The service throws; making the form catch and display the error is Plan B/C territory.
- HTML-level `min=0 step=...` constraints on the inputs. Same reasoning.
- Tests for the `addExtraExercise` path — it doesn't take user numeric input, so there's nothing new to validate there.

**Type consistency check:**
- `SessionExercise` factory in Task 1 uses every field from `web/src/domain/types.ts:166-208`, including `unitOverride: UnitSystem | null`.
- `LoggedSet` factory in Task 1 uses every field from `web/src/domain/types.ts:211-248`, including the `instanceLabel: string` discipline (`""` not `null`).
- `validateSetInput` uses the same `SetLogInput` interface that `logSet` and `editSet` already accept — no signature change.

**Placeholder scan:** None — every step contains the code or command to run, no "TODO" / "fill in" / "similar to above" handwaving.
