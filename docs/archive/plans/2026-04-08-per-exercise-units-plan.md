# Per-Exercise Unit Selection & Weight Input Precision — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users log weight in the unit that matches each machine (kg or lbs per exercise card), and stop rounding user-entered weights to equipment increments.

**Architecture:** Add `unitOverride: UnitSystem | null` to `SessionExercise` (Dexie schema v2). Remove equipment-increment rounding from both `toCanonicalKg` (input) and `toDisplayWeight` (display) — rounding only survives in the progression engine. Add a kg/lbs toggle to each exercise card that writes to the session exercise record. Default the override from the most recent session.

**Tech Stack:** React 19 + Dexie 4 + TypeScript 5 + Vitest + fake-indexeddb

---

### Task 1: Remove equipment-increment rounding from both `toCanonicalKg` and `toDisplayWeight`

**Files:**
- Modify: `web/src/domain/unit-conversion.ts:99-128`
- Modify: `web/src/features/workout/SetLogSheet.tsx:112`
- Modify: `web/src/features/workout/SetSlot.tsx:29`
- Modify: `web/src/features/workout/ExerciseCard.tsx:39,46,141,147`
- Modify: `web/src/features/history/ExerciseHistoryScreen.tsx:94`
- Test: `web/tests/unit/domain/unit-conversion.test.ts`

**Why both?** If we only fix `toCanonicalKg` (input), the display path still rounds: user enters 7.5 lbs → stored as 3.40 kg → `toDisplayWeight(3.40, "machine", "lbs")` → rounds to 10 lbs. Set chips, pre-fill, last-time display, and history all show the wrong value. A reps-only edit would even overwrite the precise weight with the rounded one.

- [ ] **Step 1: Write failing tests for the new `toCanonicalKg` behavior**

In `web/tests/unit/domain/unit-conversion.test.ts`, replace the existing `describe("toCanonicalKg")` block (lines 165-193) with tests that verify no rounding and no equipment param:

```typescript
describe("toCanonicalKg", () => {
  it("returns kg value unchanged when displayUnits is kg", () => {
    expect(toCanonicalKg(7.5, "kg")).toBe(7.5);
  });

  it("converts lbs to kg without rounding when displayUnits is lbs", () => {
    // 7.5 lbs = 7.5 * 0.45359237 = 3.40194...
    expect(toCanonicalKg(7.5, "lbs")).toBeCloseTo(3.40194, 4);
  });

  it("preserves fractional kg values", () => {
    expect(toCanonicalKg(2.25, "kg")).toBe(2.25);
  });

  it("preserves fractional lbs values through conversion", () => {
    // 12.5 lbs = 12.5 * 0.45359237 = 5.66990...
    expect(toCanonicalKg(12.5, "lbs")).toBeCloseTo(5.66990, 4);
  });

  it("handles zero", () => {
    expect(toCanonicalKg(0, "kg")).toBe(0);
    expect(toCanonicalKg(0, "lbs")).toBe(0);
  });
});
```

- [ ] **Step 2: Write failing tests for the new `toDisplayWeight` behavior**

Replace the existing `describe("toDisplayWeight")` block (lines 144-163) with:

```typescript
describe("toDisplayWeight", () => {
  it("returns kg value with floating-point cleanup when units is kg", () => {
    expect(toDisplayWeight(7.5, "kg")).toBe(7.5);
  });

  it("converts kg to lbs with floating-point cleanup when units is lbs", () => {
    // 3.40194... kg → 7.5 lbs (exact within float precision)
    expect(toDisplayWeight(lbsToKg(7.5), "lbs")).toBeCloseTo(7.5, 2);
  });

  it("cleans floating-point noise to 2 decimal places", () => {
    // 0.1 + 0.2 = 0.30000000000000004 → should display as 0.3
    expect(toDisplayWeight(0.30000000000000004, "kg")).toBe(0.3);
  });

  it("does not round to equipment increments", () => {
    // 7.5 lbs on a machine should NOT round to 10
    // 7.5 lbs = 3.40194... kg
    const canonical = lbsToKg(7.5);
    expect(toDisplayWeight(canonical, "lbs")).toBeCloseTo(7.5, 1);
  });

  it("round-trips: toDisplayWeight(toCanonicalKg(x, units), units) ≈ x", () => {
    const input = 7.5;
    const canonical = toCanonicalKg(input, "lbs");
    const display = toDisplayWeight(canonical, "lbs");
    expect(display).toBeCloseTo(input, 1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd web && npx vitest run tests/unit/domain/unit-conversion.test.ts`
Expected: FAIL — both functions currently take equipment parameter and round.

- [ ] **Step 4: Update `toCanonicalKg` — remove equipment param and rounding**

In `web/src/domain/unit-conversion.ts`, replace the `toCanonicalKg` function (lines 111-128):

```typescript
/**
 * Convert a display value back to canonical kg.
 *
 * When displayUnits is "kg", the value is used as-is (already canonical).
 * When displayUnits is "lbs", the value is converted to kg via lbsToKg.
 *
 * No rounding is applied — the user's input is stored with full precision.
 * Rounding only happens in the progression engine (for suggestions).
 */
export function toCanonicalKg(
  displayValue: number,
  displayUnits: "kg" | "lbs"
): number {
  if (displayUnits === "kg") {
    return displayValue;
  }
  return lbsToKg(displayValue);
}
```

- [ ] **Step 5: Update `toDisplayWeight` — remove equipment param and rounding**

In `web/src/domain/unit-conversion.ts`, replace the `toDisplayWeight` function (lines 92-109):

```typescript
/**
 * Convert a canonical kg value to display units.
 *
 * When units is "kg", the value is returned as-is with floating-point cleanup.
 * When units is "lbs", the value is converted to lbs with floating-point cleanup.
 *
 * No equipment-increment rounding is applied. The user sees exactly what
 * they entered. Rounding only happens in the progression engine for suggestions.
 */
export function toDisplayWeight(
  canonicalKg: number,
  units: "kg" | "lbs"
): number {
  const raw = units === "kg" ? canonicalKg : kgToLbs(canonicalKg);
  return Math.round(raw * 100) / 100;
}
```

- [ ] **Step 6: Fix all callers of `toCanonicalKg` (now 2 params instead of 3)**

In `web/src/features/workout/SetLogSheet.tsx`, line 112, change:

```typescript
// OLD:
performedWeightKg: w != null ? toCanonicalKg(w, se.effectiveEquipment, units) : null,
// NEW:
performedWeightKg: w != null ? toCanonicalKg(w, units) : null,
```

- [ ] **Step 7: Fix all callers of `toDisplayWeight` (now 2 params instead of 3)**

Update every call site — remove the `equipment` argument:

In `web/src/features/workout/SetLogSheet.tsx` (3 sites):
```typescript
// Lines 74, 86, 88 — remove equipment arg:
toDisplayWeight(existingSet.performedWeightKg, units)
toDisplayWeight(suggestedWeight, units)
toDisplayWeight(lastSet.weightKg, units)
```

In `web/src/features/workout/SetSlot.tsx` (1 site):
```typescript
// Line 29:
const w = toDisplayWeight(ls.performedWeightKg, units);
```
Remove the `equipment` prop from `SetSlotProps` if it's only used for this call. Check whether `equipment` is used elsewhere in the component — if not, remove it from the interface and all callers.

In `web/src/features/workout/ExerciseCard.tsx` (4 sites):
```typescript
// Lines 39, 46: in formatLastTime
const w = toDisplayWeight(first.weightKg, units);
const sw = s.weightKg != null ? toDisplayWeight(s.weightKg, units) : "?";

// Lines 141, 147: suggestion display
{toDisplayWeight(suggestion.suggestedWeightKg, units)}{units}
```

The `formatLastTime` function signature loses its `equipment` param — update both the function and its callers.

In `web/src/features/history/ExerciseHistoryScreen.tsx` (1 site):
```typescript
// Line 94-98:
const w = toDisplayWeight(ls.performedWeightKg, units);
```

Remove the `entry.effectiveEquipment` argument.

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd web && npx vitest run tests/unit/domain/unit-conversion.test.ts`
Expected: PASS

- [ ] **Step 9: Run full test suite to check for regressions**

Run: `cd web && npm test`
Expected: All tests pass. Some tests may break if they call `toDisplayWeight` or `toCanonicalKg` with 3 args — fix those by removing the equipment param.

- [ ] **Step 10: Commit**

```bash
cd web && git add -A
git commit -m "$(cat <<'EOF'
fix: remove equipment-increment rounding from input and display

toCanonicalKg and toDisplayWeight now do pure unit conversion without
snapping to equipment steps. This fixes 7.5 lbs showing as 10 on
machines, and prevents reps-only edits from silently overwriting
precise weights. roundToIncrement remains for progression suggestions.
EOF
)"
```

---

### Task 2: Add `unitOverride` field to `SessionExercise` (schema v2)

**Files:**
- Modify: `web/src/domain/types.ts:166-202`
- Modify: `web/src/db/database.ts:19-31`

- [ ] **Step 1: Add `unitOverride` to the `SessionExercise` interface**

In `web/src/domain/types.ts`, add after the `createdAt` field (line 202):

```typescript
  /**
   * Per-exercise unit override for this session.
   * null means "inherit the global setting from Settings.units".
   */
  unitOverride: UnitSystem | null;
```

`UnitSystem` is already imported from `"./enums"` at line 10.

- [ ] **Step 2: Add Dexie schema version 2**

In `web/src/db/database.ts`, add after the existing `this.version(1).stores({...})` block (after line 31):

```typescript
    // Version 2: Add unitOverride to sessionExercises.
    // No index change — unitOverride is not indexed.
    // Note: this is the Dexie DB version, distinct from the backup
    // envelope schemaVersion which stays at 1.
    this.version(2).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    }).upgrade(tx => {
      // Backfill existing sessionExercises with unitOverride: null
      return tx.table("sessionExercises").toCollection().modify(se => {
        if (se.unitOverride === undefined) {
          se.unitOverride = null;
        }
      });
    });
```

- [ ] **Step 3: Add `unitOverride: null` to all session exercise creation sites**

In `web/src/services/session-service.ts`, add `unitOverride: null` to all three places where `SessionExercise` objects are created:

1. In `startSessionWithCatalog`, the standalone exercise creation (around line 154-171), add `unitOverride: null,` after the `createdAt` line.

2. In `startSessionWithCatalog`, the superset exercise creation (around line 178-198), add `unitOverride: null,` after the `createdAt` line.

3. In `addExtraExercise`, the extra exercise creation (around line 421-438), add `unitOverride: null,` after the `createdAt` line.

- [ ] **Step 4: Run full test suite**

Run: `cd web && npm test`
Expected: All tests pass. Factory helpers in tests that create `SessionExercise` objects may need `unitOverride: null` added — fix any TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/domain/types.ts web/src/db/database.ts web/src/services/session-service.ts
git commit -m "$(cat <<'EOF'
feat: add unitOverride field to SessionExercise (schema v2)

New nullable field lets each exercise in a session override the global
kg/lbs setting. Defaults to null (inherit global). Dexie v2 migration
backfills existing records. Backup envelope schemaVersion stays at 1.
EOF
)"
```

---

### Task 3: Add `getEffectiveUnit` helper and wire it through hooks

**Files:**
- Create: `web/src/domain/unit-helpers.ts`
- Test: `web/tests/unit/domain/unit-helpers.test.ts`

- [ ] **Step 1: Write failing test for `getEffectiveUnit`**

Create `web/tests/unit/domain/unit-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getEffectiveUnit } from "@/domain/unit-helpers";

describe("getEffectiveUnit", () => {
  it("returns unitOverride when not null", () => {
    expect(getEffectiveUnit("lbs", "kg")).toBe("lbs");
  });

  it("returns globalUnits when unitOverride is null", () => {
    expect(getEffectiveUnit(null, "kg")).toBe("kg");
  });

  it("returns globalUnits when unitOverride is undefined", () => {
    expect(getEffectiveUnit(undefined as never, "lbs")).toBe("lbs");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/domain/unit-helpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `getEffectiveUnit`**

Create `web/src/domain/unit-helpers.ts`:

```typescript
import type { UnitSystem } from "./enums";

/**
 * Resolve the effective unit system for a session exercise.
 *
 * Returns unitOverride if set, otherwise falls back to the global setting.
 */
export function getEffectiveUnit(
  unitOverride: UnitSystem | null,
  globalUnits: UnitSystem
): UnitSystem {
  return unitOverride ?? globalUnits;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/domain/unit-helpers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/domain/unit-helpers.ts web/tests/unit/domain/unit-helpers.test.ts
git commit -m "feat: add getEffectiveUnit helper for per-exercise unit resolution"
```

---

### Task 4: Default `unitOverride` from most recent session

**Files:**
- Modify: `web/src/services/session-service.ts`
- Test: `web/tests/unit/services/session-service.test.ts` (existing tests, add new cases)

- [ ] **Step 1: Write failing tests for unit override carryover**

In the existing session service test file (`web/tests/unit/services/session-service.test.ts`), add a new describe block. If the test file doesn't exist, create it. Add tests that verify:

```typescript
describe("startSessionWithCatalog — unitOverride carryover", () => {
  it("carries forward unitOverride from the most recent finished session for same exercise", async () => {
    // Setup: create a finished session with unitOverride = "lbs" for exercise "leg-press"
    const routine = makeRoutine("r1", {
      days: {
        A: {
          id: "A",
          label: "Day A",
          entries: [
            {
              kind: "exercise" as const,
              entryId: "e1",
              exerciseId: "leg-press",
              setBlocks: [{ targetKind: "reps" as const, minValue: 8, maxValue: 12, count: 3 }],
            },
          ],
        },
      },
      dayOrder: ["A"],
      nextDayId: "A",
    });
    await db.routines.add(routine);

    // Create a finished session with unitOverride = "lbs"
    const oldSession: Session = {
      id: "old-s",
      routineId: "r1",
      routineNameSnapshot: "Test",
      dayId: "A",
      dayLabelSnapshot: "Day A",
      dayOrderSnapshot: ["A"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "finished",
      startedAt: "2026-04-01T10:00:00.000Z",
      finishedAt: "2026-04-01T11:00:00.000Z",
    };
    const oldSe: SessionExercise = {
      id: "old-se1",
      sessionId: "old-s",
      routineEntryId: "e1",
      exerciseId: "leg-press",
      exerciseNameSnapshot: "Leg Press",
      origin: "routine",
      orderIndex: 0,
      groupType: "single",
      supersetGroupId: null,
      supersetPosition: null,
      instanceLabel: "",
      effectiveType: "weight",
      effectiveEquipment: "machine",
      notesSnapshot: null,
      setBlocksSnapshot: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
      createdAt: "2026-04-01T10:00:00.000Z",
      unitOverride: "lbs",
    };
    await db.sessions.add(oldSession);
    await db.sessionExercises.add(oldSe);

    // Start a new session for the same routine/day
    const result = await startSessionWithCatalog(db, routine, "A");

    // The new session exercise for leg-press should carry forward "lbs"
    const legPressSe = result.sessionExercises.find(se => se.exerciseId === "leg-press");
    expect(legPressSe).toBeDefined();
    expect(legPressSe!.unitOverride).toBe("lbs");
  });

  it("defaults to null when no previous session exists", async () => {
    const routine = makeRoutine("r2", {
      days: {
        A: {
          id: "A",
          label: "Day A",
          entries: [
            {
              kind: "exercise" as const,
              entryId: "e1",
              exerciseId: "barbell-back-squat",
              setBlocks: [{ targetKind: "reps" as const, minValue: 5, maxValue: 5, count: 5 }],
            },
          ],
        },
      },
      dayOrder: ["A"],
      nextDayId: "A",
    });
    await db.routines.add(routine);

    const result = await startSessionWithCatalog(db, routine, "A");
    const squat = result.sessionExercises.find(se => se.exerciseId === "barbell-back-squat");
    expect(squat).toBeDefined();
    expect(squat!.unitOverride).toBeNull();
  });
});
```

Adapt the test helpers (makeRoutine, etc.) to match the patterns already used in the test file. The exercises "leg-press" and "barbell-back-squat" should be seeded in beforeEach.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/services/session-service.test.ts`
Expected: FAIL — `unitOverride` is always `null` (not yet carrying forward).

- [ ] **Step 3: Implement unit override carryover in `startSessionWithCatalog`**

In `web/src/services/session-service.ts`, add a helper function before `startSessionWithCatalog`:

```typescript
import type { UnitSystem } from "@/domain/enums";

/**
 * Look up the unitOverride from the most recent finished session
 * for a given exerciseId + instanceLabel.
 *
 * Performance: queries finished sessions sorted by finishedAt desc,
 * then checks their session exercises. This avoids a full-table scan
 * of sessionExercises.
 *
 * @param matchAnyLabel - When true, matches any instanceLabel (used for extras).
 *   When false, matches exact instanceLabel (used for routine exercises).
 */
async function findPreviousUnitOverride(
  db: ExerciseLoggerDB,
  exerciseId: string,
  instanceLabel: string,
  matchAnyLabel: boolean = false
): Promise<UnitSystem | null> {
  // Get finished sessions, most recent first
  const finishedSessions = await db.sessions
    .where("status")
    .equals("finished")
    .toArray();

  if (finishedSessions.length === 0) return null;

  // Sort by finishedAt desc
  finishedSessions.sort((a, b) => {
    const aTime = a.finishedAt ?? a.startedAt;
    const bTime = b.finishedAt ?? b.startedAt;
    return bTime.localeCompare(aTime);
  });

  // Check sessions from most recent, stop at first match
  for (const session of finishedSessions) {
    const exercises = await db.sessionExercises
      .where("sessionId")
      .equals(session.id)
      .toArray();

    const match = exercises.find(se =>
      se.exerciseId === exerciseId &&
      (matchAnyLabel || se.instanceLabel === instanceLabel)
    );

    if (match) {
      return match.unitOverride ?? null;
    }
  }

  return null;
}
```

Then in `startSessionWithCatalog`, move the unitOverride lookup **inside** the transaction to avoid TOCTOU races. After the active-session check and before `db.sessions.add()`, add:

```typescript
    // Look up previous unitOverride for each exercise (inside transaction for consistency)
    const unitOverrideMap = new Map<string, UnitSystem | null>();
    for (const entry of day.entries) {
      const items = entry.kind === "exercise" ? [entry] : entry.items;
      for (const ex of items) {
        const key = `${ex.exerciseId}:${ex.instanceLabel ?? ""}`;
        if (!unitOverrideMap.has(key)) {
          unitOverrideMap.set(
            key,
            await findPreviousUnitOverride(db, ex.exerciseId, ex.instanceLabel ?? "")
          );
        }
      }
    }
```

Add `db.sessionExercises` to the transaction's table list (it's not currently there but needs to be for the lookup).

Then when creating each `SessionExercise`, replace `unitOverride: null` with:

```typescript
unitOverride: unitOverrideMap.get(`${entry.exerciseId}:${entry.instanceLabel ?? ""}`) ?? null,
```

(Same pattern for superset items, using `item` instead of `entry`.)

- [ ] **Step 4: Implement unit override carryover in `addExtraExercise`**

In `addExtraExercise`, inside the transaction (after the active session check), look up the override with `matchAnyLabel: true`:

```typescript
    const previousOverride = await findPreviousUnitOverride(db, exercise.id, "", true);
```

Then use `unitOverride: previousOverride` instead of `unitOverride: null` in the created record.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd web && npx vitest run tests/unit/services/session-service.test.ts`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `cd web && npm test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add web/src/services/session-service.ts web/tests/unit/services/session-service.test.ts
git commit -m "$(cat <<'EOF'
feat: carry forward unitOverride from most recent finished session

When starting a session, each exercise inherits the unitOverride from
the most recent finished session for the same exercise+instanceLabel.
Extras match any instanceLabel. Lookup runs inside the transaction to
avoid TOCTOU races. Query strategy avoids full-table scans.
EOF
)"
```

---

### Task 5: Add `setUnitOverride` service function

**Files:**
- Modify: `web/src/services/settings-service.ts`
- Test: add test in `web/tests/unit/services/settings-service.test.ts` (or create if needed)

- [ ] **Step 1: Write failing test**

```typescript
describe("setUnitOverride", () => {
  it("updates the unitOverride on a session exercise", async () => {
    // Setup: create an active session with one exercise
    const session: Session = {
      id: "s1",
      routineId: null,
      routineNameSnapshot: "Test",
      dayId: "A",
      dayLabelSnapshot: "Day A",
      dayOrderSnapshot: ["A"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "active",
      startedAt: "2026-04-08T10:00:00.000Z",
      finishedAt: null,
    };
    const se: SessionExercise = {
      id: "se1",
      sessionId: "s1",
      routineEntryId: null,
      exerciseId: "leg-press",
      exerciseNameSnapshot: "Leg Press",
      origin: "routine",
      orderIndex: 0,
      groupType: "single",
      supersetGroupId: null,
      supersetPosition: null,
      instanceLabel: "",
      effectiveType: "weight",
      effectiveEquipment: "machine",
      notesSnapshot: null,
      setBlocksSnapshot: [],
      createdAt: "2026-04-08T10:00:00.000Z",
      unitOverride: null,
    };
    await db.sessions.add(session);
    await db.sessionExercises.add(se);

    await setUnitOverride(db, "se1", "lbs");

    const updated = await db.sessionExercises.get("se1");
    expect(updated!.unitOverride).toBe("lbs");
  });

  it("sets unitOverride back to null", async () => {
    const session: Session = {
      id: "s2",
      routineId: null,
      routineNameSnapshot: "Test",
      dayId: "A",
      dayLabelSnapshot: "Day A",
      dayOrderSnapshot: ["A"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "active",
      startedAt: "2026-04-08T10:00:00.000Z",
      finishedAt: null,
    };
    const se: SessionExercise = {
      id: "se2",
      sessionId: "s2",
      routineEntryId: null,
      exerciseId: "leg-press",
      exerciseNameSnapshot: "Leg Press",
      origin: "routine",
      orderIndex: 0,
      groupType: "single",
      supersetGroupId: null,
      supersetPosition: null,
      instanceLabel: "",
      effectiveType: "weight",
      effectiveEquipment: "machine",
      notesSnapshot: null,
      setBlocksSnapshot: [],
      createdAt: "2026-04-08T10:00:00.000Z",
      unitOverride: "lbs",
    };
    await db.sessions.add(session);
    await db.sessionExercises.add(se);

    await setUnitOverride(db, "se2", null);
    const updated = await db.sessionExercises.get("se2");
    expect(updated!.unitOverride).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/services/settings-service.test.ts`
Expected: FAIL — `setUnitOverride` not found.

- [ ] **Step 3: Implement `setUnitOverride`**

In `web/src/services/settings-service.ts`, add:

```typescript
import type { UnitSystem } from "@/domain/enums";

/**
 * Set the unit override for a specific session exercise.
 */
export async function setUnitOverride(
  db: ExerciseLoggerDB,
  sessionExerciseId: string,
  unitOverride: UnitSystem | null
): Promise<void> {
  await db.sessionExercises.update(sessionExerciseId, { unitOverride });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/services/settings-service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/services/settings-service.ts web/tests/unit/services/settings-service.test.ts
git commit -m "feat: add setUnitOverride service function"
```

---

### Task 6: Wire per-exercise units through the workout UI

**Files:**
- Modify: `web/src/features/workout/ExerciseCard.tsx`
- Modify: `web/src/features/workout/WorkoutScreen.tsx`
- Modify: `web/src/features/workout/SetLogSheet.tsx`

- [ ] **Step 1: Add unit toggle to `ExerciseCard`**

In `web/src/features/workout/ExerciseCard.tsx`:

Add `UnitSystem` import and new prop:

```typescript
import type { UnitSystem } from "@/domain/enums";

interface ExerciseCardProps {
  // ... existing props ...
  /** Callback when unit toggle is tapped. Undefined = no toggle shown (history view). */
  onUnitToggle?: (newUnit: UnitSystem) => void;
}
```

Add the toggle button in the header section, after the exercise name and "Extra" badge, inside the `!hideHeader` block (around line 93-101):

```typescript
{onUnitToggle && (
  <button
    className="ml-auto shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground hover:bg-muted/50"
    onClick={(e) => {
      e.stopPropagation();
      onUnitToggle(units === "kg" ? "lbs" : "kg");
    }}
  >
    {units}
  </button>
)}
```

- [ ] **Step 2: Wire unit toggle in `WorkoutScreen`**

In `web/src/features/workout/WorkoutScreen.tsx`:

Import `setUnitOverride` and `getEffectiveUnit`:

```typescript
import { setUnitOverride } from "@/services/settings-service";
import { getEffectiveUnit } from "@/domain/unit-helpers";
```

In `ExerciseCardWithHistory`, compute the effective unit and pass it down:

```typescript
function ExerciseCardWithHistory({
  sessionExercise,
  loggedSets,
  globalUnits,
  onSetTap,
}: {
  sessionExercise: SessionExercise;
  loggedSets: LoggedSet[];
  globalUnits: "kg" | "lbs";
  onSetTap: (blockIndex: number, setIndex: number) => void;
}) {
  const effectiveUnits = getEffectiveUnit(sessionExercise.unitOverride, globalUnits);
  const isRoutine = sessionExercise.origin === "routine";
  const historyData = useExerciseHistory(
    isRoutine ? sessionExercise : undefined,
    effectiveUnits
  );
  const extraHistory = useExtraHistory(
    !isRoutine ? sessionExercise.exerciseId : undefined
  );

  return (
    <ExerciseCard
      sessionExercise={sessionExercise}
      loggedSets={loggedSets}
      units={effectiveUnits}
      historyData={historyData}
      extraHistory={extraHistory}
      onSetTap={onSetTap}
      onUnitToggle={async (newUnit) => {
        await setUnitOverride(db, sessionExercise.id, newUnit);
      }}
    />
  );
}
```

Rename the `units` prop passed to `ExerciseCardWithHistory` from `units` to `globalUnits` in the calling code (the render loop around lines 165-191). The `units` variable from `settings.units` stays the same.

Similarly update `SetLogSheetWithHistory` to use effective units:

```typescript
function SetLogSheetWithHistory({ ..., units: globalUnits, ... }) {
  const effectiveUnits = getEffectiveUnit(sessionExercise.unitOverride, globalUnits);
  // ... use effectiveUnits instead of globalUnits for everything ...
}
```

- [ ] **Step 3: Run full test suite and build**

Run: `cd web && npm test && npm run build`
Expected: All pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/features/workout/ExerciseCard.tsx web/src/features/workout/WorkoutScreen.tsx web/src/features/workout/SetLogSheet.tsx
git commit -m "$(cat <<'EOF'
feat: add per-exercise kg/lbs toggle on workout exercise cards

Each exercise card now shows a small unit toggle (kg/lbs) in its header.
Tapping it updates the sessionExercise.unitOverride, which controls
display, input conversion, and progression suggestions for that exercise.
EOF
)"
```

---

### Task 7: Wire per-exercise units through history screens

**Files:**
- Modify: `web/src/features/history/SessionDetailScreen.tsx`
- Modify: `web/src/features/history/ExerciseHistoryScreen.tsx`
- Modify: `web/src/shared/hooks/useExerciseHistoryGroups.ts`

- [ ] **Step 1: Update `SessionDetailScreen` to use per-exercise units**

In `web/src/features/history/SessionDetailScreen.tsx`:

Import `getEffectiveUnit`:

```typescript
import { getEffectiveUnit } from "@/domain/unit-helpers";
```

In `SessionExerciseCardWithHistory`, compute effective units:

```typescript
function SessionExerciseCardWithHistory({ exData, units: globalUnits, onSetTap }) {
  const se = exData.sessionExercise;
  const effectiveUnits = getEffectiveUnit(se.unitOverride, globalUnits);
  const historyData = useExerciseHistory(
    se.origin === "routine" ? se : undefined,
    effectiveUnits
  );
  return (
    <div>
      <Link to={`/history/exercise/${se.exerciseId}`} className="text-base font-semibold hover:underline">
        {se.exerciseNameSnapshot}
      </Link>
      <ExerciseCard
        sessionExercise={se}
        loggedSets={exData.loggedSets}
        units={effectiveUnits}
        historyData={historyData}
        extraHistory={null}
        onSetTap={(bi, si) => onSetTap(se, bi, si)}
        readOnly
        hideHeader
      />
    </div>
  );
}
```

Similarly update `SetLogSheetWithHistoryForDetail` to use `getEffectiveUnit(sessionExercise.unitOverride, globalUnits)`.

- [ ] **Step 2: Update `useExerciseHistoryGroups` to expose `unitOverride`**

In `web/src/shared/hooks/useExerciseHistoryGroups.ts`, extend `ExerciseHistoryEntry`:

```typescript
import type { UnitSystem } from "@/domain/enums";

export interface ExerciseHistoryEntry {
  instanceLabel: string;
  effectiveEquipment: ExerciseEquipment;
  unitOverride: UnitSystem | null;
  sets: LoggedSet[];
}
```

In the `seMap` construction (around line 44), include `unitOverride`:

```typescript
seMap.set(se.id, {
  instanceLabel: se.instanceLabel,
  effectiveEquipment: se.effectiveEquipment,
  unitOverride: se.unitOverride ?? null,
});
```

And propagate it when building entries (around line 77):

```typescript
entries.push({
  instanceLabel: seData?.instanceLabel ?? "",
  effectiveEquipment: seData?.effectiveEquipment ?? "bodyweight",
  unitOverride: seData?.unitOverride ?? null,
  sets: sets.sort(...)
});
```

- [ ] **Step 3: Update `ExerciseHistoryScreen` to use per-entry units**

In `web/src/features/history/ExerciseHistoryScreen.tsx`:

```typescript
import { getEffectiveUnit } from "@/domain/unit-helpers";

// Inside the render, when displaying each entry:
const entryUnits = getEffectiveUnit(entry.unitOverride, units);
// Use entryUnits instead of units when calling toDisplayWeight
```

- [ ] **Step 4: Run full test suite and build**

Run: `cd web && npm test && npm run build`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/history/SessionDetailScreen.tsx web/src/features/history/ExerciseHistoryScreen.tsx web/src/shared/hooks/useExerciseHistoryGroups.ts
git commit -m "feat: use per-exercise unit override in history screens"
```

---

### Task 8: Update backup validation for `unitOverride`

**Files:**
- Modify: `web/src/services/backup-service.ts`
- Test: `web/tests/unit/services/backup-service.test.ts` (if exists, add cases)

- [ ] **Step 1: Add `unitOverride` validation to `validateSessionExercise`**

In `web/src/services/backup-service.ts`, inside `validateSessionExercise` (around line 590, after the `createdAt` check):

```typescript
  // unitOverride: optional, must be "kg", "lbs", or null/undefined
  if (
    s.unitOverride !== undefined &&
    s.unitOverride !== null &&
    !VALID_UNITS.includes(s.unitOverride as UnitSystem)
  ) {
    errors.push({
      field: `${path}.unitOverride`,
      message: `must be one of: ${VALID_UNITS.join(", ")}, or null`,
    });
  }
```

- [ ] **Step 2: Write test for backup round-trip with `unitOverride`**

Add a test that verifies:
1. A backup with `unitOverride: "lbs"` on a session exercise validates successfully
2. A backup with `unitOverride: undefined` (old format) validates successfully
3. A backup with `unitOverride: "invalid"` fails validation

```typescript
it("accepts valid unitOverride values in session exercises", () => {
  // Create minimal valid backup with unitOverride: "lbs"
  const envelope = makeValidBackup({
    sessionExerciseOverrides: { unitOverride: "lbs" },
  });
  const errors = validateBackupPayload(envelope, catalogIds);
  expect(errors).toHaveLength(0);
});

it("accepts missing unitOverride (old backup format)", () => {
  const envelope = makeValidBackup();
  // Remove unitOverride to simulate old format
  delete (envelope.data.sessionExercises[0] as Record<string, unknown>).unitOverride;
  const errors = validateBackupPayload(envelope, catalogIds);
  expect(errors).toHaveLength(0);
});

it("rejects invalid unitOverride value", () => {
  const envelope = makeValidBackup({
    sessionExerciseOverrides: { unitOverride: "invalid" },
  });
  const errors = validateBackupPayload(envelope, catalogIds);
  expect(errors.some(e => e.field.includes("unitOverride"))).toBe(true);
});
```

Adapt the test helper (`makeValidBackup`) to match existing test patterns in the file.

- [ ] **Step 3: Run full test suite**

Run: `cd web && npm test`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add web/src/services/backup-service.ts web/tests/unit/services/backup-service.test.ts
git commit -m "feat: validate unitOverride field in backup import"
```

---

### Task 9: Update test helpers and fix remaining TypeScript errors

**Files:**
- Modify: Any test files that create `SessionExercise` objects without `unitOverride`
- Modify: Any test files that call `toDisplayWeight` or `toCanonicalKg` with old signatures

- [ ] **Step 1: Search for all test files needing updates**

Run: `cd web && grep -rn "effectiveEquipment" tests/ --include="*.ts" -l`

Each of these files likely constructs `SessionExercise` objects and needs `unitOverride: null` added.

Also search for old function signatures:
Run: `cd web && grep -rn "toDisplayWeight\|toCanonicalKg" tests/ --include="*.ts" -l`

- [ ] **Step 2: Add `unitOverride: null` to all test factories and fix function calls**

For each file found:
- Add `unitOverride: null` to all `SessionExercise` object constructions
- Update `toCanonicalKg` calls from 3 params to 2 (remove equipment)
- Update `toDisplayWeight` calls from 3 params to 2 (remove equipment)

- [ ] **Step 3: Write regression test for reps-only edit preserving precise weight**

In an appropriate test file, add:

```typescript
it("reps-only edit does not change a precise weight value", async () => {
  // Setup: log a set with a precise weight (7.5 lbs = 3.40194 kg)
  const preciseWeightKg = lbsToKg(7.5);
  // ... create session, session exercise, log set with preciseWeightKg ...

  // Edit only the reps
  await editSet(db, loggedSet.id, {
    performedWeightKg: preciseWeightKg, // same weight passed back
    performedReps: 10, // changed reps
    performedDurationSec: null,
    performedDistanceM: null,
  });

  const updated = await db.loggedSets.get(loggedSet.id);
  // Weight should be unchanged — no rounding happened
  expect(updated!.performedWeightKg).toBe(preciseWeightKg);
});
```

- [ ] **Step 4: Run full test suite, TypeScript check, and lint**

Run: `cd web && npm test && npx tsc -b && npm run lint`
Expected: All pass, no type errors, lint clean.

- [ ] **Step 5: Run E2E tests**

Run: `cd web && npm run test:e2e`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: update test fixtures for new unit-conversion signatures and unitOverride"
```

---

### Task 10: Update CLAUDE.md documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `web/src/domain/CLAUDE.md`
- Modify: `web/src/services/CLAUDE.md`
- Modify: `web/src/db/CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add to the "Key Conventions" section:

```markdown
- **Unit override:** Per-exercise unit choice stored on `SessionExercise.unitOverride`. Resolve with `getEffectiveUnit(se.unitOverride, globalUnits)`. `null` = inherit global.
- **Weight precision:** `toCanonicalKg` and `toDisplayWeight` do not round to equipment increments. User input is stored and displayed with full precision. Only the progression engine's suggestions use `roundToIncrement`. Historical data logged before this change remains at its rounded values.
```

Add to "Domain Invariants":

```markdown
12. `toCanonicalKg` and `toDisplayWeight` do not round — user input is stored and displayed with full precision
```

- [ ] **Step 2: Update layer CLAUDEs**

In `web/src/domain/CLAUDE.md`, update the `unit-conversion.ts` section:
- `toCanonicalKg(displayValue, displayUnits)` — no equipment param, no rounding
- `toDisplayWeight(canonicalKg, units)` — no equipment param, no equipment rounding, only floating-point cleanup
- `roundToIncrement` — used only by the progression engine

Add a bullet for the new `unit-helpers.ts` file:
- `getEffectiveUnit(unitOverride, globalUnits)` — resolve per-exercise unit

In `web/src/db/CLAUDE.md`:
- Note schema version 2 (Dexie DB version, not backup schemaVersion)
- Note `unitOverride: UnitSystem | null` on `SessionExercise`

In `web/src/services/CLAUDE.md`:
- Note `setUnitOverride(db, sessionExerciseId, unitOverride)` in settings-service
- Note the carryover logic in `startSessionWithCatalog` (via `findPreviousUnitOverride`)
- Note that extras use `matchAnyLabel: true` for carryover

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md web/src/domain/CLAUDE.md web/src/services/CLAUDE.md web/src/db/CLAUDE.md
git commit -m "docs: update CLAUDE.md files for per-exercise unit override and weight precision"
```
