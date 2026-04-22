# Phase 4: Session Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **⚠ ERRATA — READ BEFORE IMPLEMENTING ⚠**
> Full errata: `docs/superpowers/plans/2026-03-30-plan-errata.md`
> Fixes for this phase: **P4-A through P4-H**. These fix real bugs in the code below. Apply during implementation.
>
> **P4-A [CERTAIN]:** Remove the dead `startSession` function and its helpers (`buildSessionExercises`, `buildSingleSessionExercise`). Only `startSessionWithCatalog` should exist. The dead code has placeholder values (`""` name, `"weight"` type, `"barbell"` equipment) that would produce silently wrong data if accidentally called.
> **P4-B [CERTAIN]:** `setActiveRoutine` and `deleteRoutine` check `hasActiveSession(db)` OUTSIDE the Dexie transaction — this is a TOCTOU race that can violate invariant 13. Move the active-session check INSIDE the transaction:
> ```ts
> // WRONG (current plan):
> const hasActive = await hasActiveSession(db);
> if (hasActive) throw ...;
> await db.transaction("rw", [...], async () => { /* mutation */ });
>
> // CORRECT:
> await db.transaction("rw", [db.settings, db.routines, db.sessions], async () => {
>   const active = await db.sessions.where("status").equals("active").first();
>   if (active) throw ...;
>   /* mutation */
> });
> ```
> **P4-C [CERTAIN]:** In `deleteRoutine`, move the `getSettings(db)` read INSIDE the transaction to avoid stale-data risk.
> **P4-D [CERTAIN — BUG]:** In `logSet`, the `if (existing)` branch returns at line ~1261 BEFORE the weighted bodyweight promotion code at line ~1286. The promotion check is unreachable on update. Fix: move promotion AFTER both branches:
> ```ts
> let result: LoggedSet;
> if (existing) {
>   await db.loggedSets.update(existing.id, updated);
>   result = { ...existing, ...updated } as LoggedSet;
> } else {
>   await db.loggedSets.add(loggedSet);
>   result = loggedSet;
> }
> // Promotion runs for BOTH create and update:
> if (input.performedWeightKg !== null && sessionExercise.effectiveType === "bodyweight") {
>   await db.sessionExercises.update(sessionExerciseId, { effectiveType: "weight" });
> }
> return result;
> ```
> **P4-E [RECOMMENDED]:** Add weighted bodyweight promotion to `editSet` too. If a user edits a bodyweight set to add weight, `effectiveType` should promote.
> **P4-F [RECOMMENDED]:** Add a negative test: editing a set to `performedWeightKg = null` does NOT demote `effectiveType` back to `"bodyweight"`.
> **P4-G [RECOMMENDED]:** Validate `setIndex` against `block.count` in `logSet`. Reject out-of-range values at the service layer.
> **P4-H [CERTAIN]:** Verify `deleteRoutine` implements auto-activation: "if deleting the active routine and other routines remain, activate the earliest remaining by `importedAt` ASC." If not present, add it.

**Goal:** Implement all session lifecycle operations as tested domain functions, independent of UI. This includes start, resume, discard, finish, day override, add extra exercise, log/edit/delete sets, weighted bodyweight detection, and the routine activation/deletion guard.

**Architecture:** Two new service files: `web/src/services/session-service.ts` for session lifecycle operations and `web/src/services/set-service.ts` for set logging operations. A new `web/src/services/settings-service.ts` for settings CRUD and the routine guard. All operations use Dexie transactions where atomicity is required. No UI, no Zustand, no React -- pure data layer with Dexie as the only external dependency.

**Tech Stack:** TypeScript 5 strict mode, Dexie.js 4 (IndexedDB wrapper), Vitest for unit testing, `fake-indexeddb` for Dexie tests in Node. Import alias `@/` maps to `web/src/`.

---

## File Structure (Phase 4 target state)

New files created by this phase:

```
web/
├── src/
│   └── services/
│       ├── session-service.ts      # Start, resume, discard, finish, add extra
│       ├── set-service.ts          # Log, edit, delete sets
│       └── settings-service.ts     # Settings CRUD, active routine, guards
└── tests/
    └── unit/
        └── services/
            ├── session-service.test.ts
            ├── session-lifecycle.test.ts
            ├── set-service.test.ts
            └── settings-service.test.ts
```

---

## Dependencies from previous phases

All imports below come from Phase 2 and Phase 3 deliverables:

```ts
// Phase 2: Domain types
import type {
  Session,
  SessionExercise,
  LoggedSet,
  Routine,
  RoutineDay,
  RoutineEntry,
  RoutineExerciseEntry,
  Exercise,
  Settings,
  SetBlock,
} from "@/domain/types";

// Phase 2: Domain enums
import type {
  SessionStatus,
  SessionExerciseOrigin,
  GroupType,
  ExerciseType,
  ExerciseEquipment,
  TargetKind,
  SetTag,
} from "@/domain/enums";

// Phase 2: Database
import { db, type ExerciseLoggerDB } from "@/db/database";

// Phase 2: Helpers
import { generateId } from "@/domain/uuid";
import { nowISO } from "@/domain/timestamp";
import { generateBlockSignature } from "@/domain/block-signature";
```

---

### Task 1: Create the settings service

**Files:**
- Create: `web/src/services/settings-service.ts`
- Create: `web/tests/unit/services/settings-service.test.ts`

This service provides settings CRUD operations and the routine activation/deletion guard (invariant 13).

- [ ] **Step 1: Create the settings service**

Create `web/src/services/settings-service.ts`:

```ts
import type { Settings } from "@/domain/types";
import type { ExerciseLoggerDB } from "@/db/database";
import type { UnitSystem, ThemePreference } from "@/domain/enums";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get the current settings record.
 * Throws if no settings record exists (should never happen after app init).
 */
export async function getSettings(db: ExerciseLoggerDB): Promise<Settings> {
  const settings = await db.settings.get("user");
  if (!settings) {
    throw new Error("Settings record not found. Was initializeSettings() called?");
  }
  return settings;
}

// ---------------------------------------------------------------------------
// Active routine management
// ---------------------------------------------------------------------------

/**
 * Check if there is an active session in the database.
 */
export async function hasActiveSession(db: ExerciseLoggerDB): Promise<boolean> {
  const count = await db.sessions.where("status").equals("active").count();
  return count > 0;
}

/**
 * Set the active routine ID.
 *
 * Enforces invariant 13: routine activation is blocked while an active session exists.
 * Throws if an active session exists.
 */
export async function setActiveRoutine(
  db: ExerciseLoggerDB,
  routineId: string
): Promise<void> {
  const active = await hasActiveSession(db);
  if (active) {
    throw new Error(
      "Cannot change active routine while a workout session is active. Finish or discard the session first."
    );
  }

  const routine = await db.routines.get(routineId);
  if (!routine) {
    throw new Error(`Routine "${routineId}" not found`);
  }

  await db.settings.update("user", { activeRoutineId: routineId });
}

/**
 * Delete a routine by ID.
 *
 * Enforces invariant 13: routine deletion is blocked while an active session exists.
 *
 * Deletion rules from spec section 13:
 * - If deleting the active routine and other routines remain, automatically
 *   activate the earliest remaining routine by importedAt ASC.
 * - If deleting the last remaining routine, set activeRoutineId = null.
 * - Routine deletion must not break history (sessions use snapshots).
 */
export async function deleteRoutine(
  db: ExerciseLoggerDB,
  routineId: string
): Promise<void> {
  const active = await hasActiveSession(db);
  if (active) {
    throw new Error(
      "Cannot delete a routine while a workout session is active. Finish or discard the session first."
    );
  }

  const settings = await getSettings(db);

  await db.transaction("rw", db.routines, db.settings, async () => {
    await db.routines.delete(routineId);

    if (settings.activeRoutineId === routineId) {
      // Find the earliest remaining routine by importedAt
      const remaining = await db.routines.toArray();
      if (remaining.length > 0) {
        remaining.sort((a, b) => a.importedAt.localeCompare(b.importedAt));
        await db.settings.update("user", {
          activeRoutineId: remaining[0]!.id,
        });
      } else {
        await db.settings.update("user", { activeRoutineId: null });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

/**
 * Update the display unit preference.
 */
export async function setUnits(
  db: ExerciseLoggerDB,
  units: UnitSystem
): Promise<void> {
  await db.settings.update("user", { units });
}

/**
 * Update the theme preference.
 */
export async function setTheme(
  db: ExerciseLoggerDB,
  theme: ThemePreference
): Promise<void> {
  await db.settings.update("user", { theme });
}
```

- [ ] **Step 2: Create the settings service tests**

Create `web/tests/unit/services/settings-service.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  getSettings,
  hasActiveSession,
  setActiveRoutine,
  deleteRoutine,
  setUnits,
  setTheme,
} from "@/services/settings-service";
import type { Routine, Session } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    schemaVersion: 1,
    name: "Test Routine",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A", "B"],
    nextDayId: "A",
    days: {
      A: { id: "A", label: "Day A", entries: [] },
      B: { id: "B", label: "Day B", entries: [] },
    },
    notes: [],
    cardio: null,
    importedAt: "2026-03-28T12:00:00.000Z",
    ...overrides,
  };
}

function makeActiveSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    routineId: "r1",
    routineNameSnapshot: "Test Routine",
    dayId: "A",
    dayLabelSnapshot: "Day A",
    dayOrderSnapshot: ["A", "B"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "active",
    startedAt: "2026-03-28T14:00:00.000Z",
    finishedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("settings-service", () => {
  let db: ExerciseLoggerDB;

  beforeEach(async () => {
    db = new ExerciseLoggerDB();
    await initializeSettings(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  // --- getSettings ---

  describe("getSettings", () => {
    it("returns the current settings", async () => {
      const settings = await getSettings(db);
      expect(settings.id).toBe("user");
      expect(settings.activeRoutineId).toBeNull();
      expect(settings.units).toBe("kg");
      expect(settings.theme).toBe("system");
    });

    it("throws if no settings record exists", async () => {
      await db.settings.delete("user");
      await expect(getSettings(db)).rejects.toThrow("Settings record not found");
    });
  });

  // --- hasActiveSession ---

  describe("hasActiveSession", () => {
    it("returns false when no sessions exist", async () => {
      expect(await hasActiveSession(db)).toBe(false);
    });

    it("returns true when an active session exists", async () => {
      await db.sessions.add(makeActiveSession());
      expect(await hasActiveSession(db)).toBe(true);
    });

    it("returns false when only finished sessions exist", async () => {
      await db.sessions.add(
        makeActiveSession({ status: "finished", finishedAt: "2026-03-28T15:00:00.000Z" })
      );
      expect(await hasActiveSession(db)).toBe(false);
    });
  });

  // --- setActiveRoutine (invariant 13) ---

  describe("setActiveRoutine", () => {
    it("sets the active routine", async () => {
      await db.routines.add(makeRoutine());
      await setActiveRoutine(db, "r1");
      const settings = await getSettings(db);
      expect(settings.activeRoutineId).toBe("r1");
    });

    it("throws if routine does not exist", async () => {
      await expect(setActiveRoutine(db, "nonexistent")).rejects.toThrow(
        'Routine "nonexistent" not found'
      );
    });

    it("blocks activation during active session (invariant 13)", async () => {
      await db.routines.add(makeRoutine());
      await db.sessions.add(makeActiveSession());
      await expect(setActiveRoutine(db, "r1")).rejects.toThrow(
        "Cannot change active routine while a workout session is active"
      );
    });

    it("allows activation when only finished sessions exist", async () => {
      await db.routines.add(makeRoutine());
      await db.sessions.add(
        makeActiveSession({ status: "finished", finishedAt: "2026-03-28T15:00:00.000Z" })
      );
      await setActiveRoutine(db, "r1");
      const settings = await getSettings(db);
      expect(settings.activeRoutineId).toBe("r1");
    });
  });

  // --- deleteRoutine (invariant 13) ---

  describe("deleteRoutine", () => {
    it("deletes a non-active routine", async () => {
      await db.routines.add(makeRoutine());
      await db.routines.add(makeRoutine({ id: "r2", name: "Other" }));
      await db.settings.update("user", { activeRoutineId: "r1" });

      await deleteRoutine(db, "r2");
      const remaining = await db.routines.toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.id).toBe("r1");

      // Active routine unchanged
      const settings = await getSettings(db);
      expect(settings.activeRoutineId).toBe("r1");
    });

    it("auto-activates earliest remaining routine when deleting active routine", async () => {
      await db.routines.add(
        makeRoutine({ id: "r1", importedAt: "2026-03-28T12:00:00.000Z" })
      );
      await db.routines.add(
        makeRoutine({ id: "r2", name: "Second", importedAt: "2026-03-28T13:00:00.000Z" })
      );
      await db.routines.add(
        makeRoutine({ id: "r3", name: "Third", importedAt: "2026-03-28T11:00:00.000Z" })
      );
      await db.settings.update("user", { activeRoutineId: "r1" });

      await deleteRoutine(db, "r1");

      const settings = await getSettings(db);
      // r3 has the earliest importedAt
      expect(settings.activeRoutineId).toBe("r3");
    });

    it("sets activeRoutineId to null when deleting the last routine", async () => {
      await db.routines.add(makeRoutine());
      await db.settings.update("user", { activeRoutineId: "r1" });

      await deleteRoutine(db, "r1");

      const settings = await getSettings(db);
      expect(settings.activeRoutineId).toBeNull();
    });

    it("blocks deletion during active session (invariant 13)", async () => {
      await db.routines.add(makeRoutine());
      await db.sessions.add(makeActiveSession());
      await expect(deleteRoutine(db, "r1")).rejects.toThrow(
        "Cannot delete a routine while a workout session is active"
      );
    });
  });

  // --- setUnits ---

  describe("setUnits", () => {
    it("updates units to lbs", async () => {
      await setUnits(db, "lbs");
      const settings = await getSettings(db);
      expect(settings.units).toBe("lbs");
    });

    it("updates units to kg", async () => {
      await setUnits(db, "lbs");
      await setUnits(db, "kg");
      const settings = await getSettings(db);
      expect(settings.units).toBe("kg");
    });
  });

  // --- setTheme ---

  describe("setTheme", () => {
    it("updates theme to dark", async () => {
      await setTheme(db, "dark");
      const settings = await getSettings(db);
      expect(settings.theme).toBe("dark");
    });

    it("updates theme to light", async () => {
      await setTheme(db, "light");
      const settings = await getSettings(db);
      expect(settings.theme).toBe("light");
    });

    it("updates theme to system", async () => {
      await setTheme(db, "dark");
      await setTheme(db, "system");
      const settings = await getSettings(db);
      expect(settings.theme).toBe("system");
    });
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/settings-service.test.ts
```

Expected: All 15 tests pass.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/services/settings-service.ts web/tests/unit/services/settings-service.test.ts
git commit -m "$(cat <<'EOF'
feat: add settings service with routine guard (invariant 13)
EOF
)"
```

---

### Task 2: Create the session service -- start session

**Files:**
- Create: `web/src/services/session-service.ts`

This task creates the session service file with the `startSession` function. Subsequent tasks add more functions to the same file.

- [ ] **Step 1: Create the session service with startSession**

Create `web/src/services/session-service.ts`:

```ts
import Dexie from "dexie";
import type {
  Session,
  SessionExercise,
  LoggedSet,
  Routine,
  RoutineEntry,
  RoutineExerciseEntry,
  Exercise,
  SetBlock,
} from "@/domain/types";
import type {
  ExerciseType,
  ExerciseEquipment,
  GroupType,
  SessionExerciseOrigin,
} from "@/domain/enums";
import type { ExerciseLoggerDB } from "@/db/database";
import { generateId } from "@/domain/uuid";
import { nowISO } from "@/domain/timestamp";
import { generateBlockSignature } from "@/domain/block-signature";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full session data returned by resume. */
export interface SessionData {
  session: Session;
  sessionExercises: SessionExercise[];
  loggedSets: LoggedSet[];
}

// ---------------------------------------------------------------------------
// Start session
// ---------------------------------------------------------------------------

/**
 * Start a new workout session for a given routine and day.
 *
 * Creates:
 * - One `sessions` row with `status = "active"`
 * - One `sessionExercises` row per routine-entry leaf in display order
 *
 * Enforces invariant 1: at most one active session.
 * Does NOT advance nextDayId (invariant 3: only on finish).
 *
 * @param db - Dexie database instance
 * @param routine - The routine to start a session for
 * @param dayId - The day ID to use (may differ from routine.nextDayId for overrides)
 * @returns The created SessionData
 */
export async function startSession(
  db: ExerciseLoggerDB,
  routine: Routine,
  dayId: string
): Promise<SessionData> {
  // Validate the dayId exists in the routine
  const day = routine.days[dayId];
  if (!day) {
    throw new Error(
      `Day "${dayId}" does not exist in routine "${routine.name}". Valid days: ${routine.dayOrder.join(", ")}`
    );
  }

  // Build the session and session exercises before entering the transaction
  const sessionId = generateId();
  const now = nowISO();

  const session: Session = {
    id: sessionId,
    routineId: routine.id,
    routineNameSnapshot: routine.name,
    dayId,
    dayLabelSnapshot: day.label,
    dayOrderSnapshot: [...routine.dayOrder],
    restDefaultSecSnapshot: routine.restDefaultSec,
    restSupersetSecSnapshot: routine.restSupersetSec,
    status: "active",
    startedAt: now,
    finishedAt: null,
  };

  // Build session exercises from the day's entries
  const sessionExercises = buildSessionExercises(
    db,
    sessionId,
    day.entries,
    routine,
    now
  );

  // Perform the write in a transaction to enforce invariant 1
  await db.transaction("rw", db.sessions, db.sessionExercises, async () => {
    // Invariant 1: at most one active session
    const activeCount = await db.sessions
      .where("status")
      .equals("active")
      .count();
    if (activeCount > 0) {
      throw new Error(
        "An active session already exists. Resume or discard it before starting a new one."
      );
    }

    await db.sessions.add(session);
    if (sessionExercises.length > 0) {
      await db.sessionExercises.bulkAdd(sessionExercises);
    }
  });

  return {
    session,
    sessionExercises,
    loggedSets: [],
  };
}

// ---------------------------------------------------------------------------
// Build session exercises from routine entries
// ---------------------------------------------------------------------------

/**
 * Resolve the effective type for a session exercise.
 *
 * Weighted bodyweight rules (spec section 7):
 * - If routine entry has typeOverride, use it
 * - If routine entry has equipmentOverride != "bodyweight", treat as "weight"
 * - Otherwise use the catalog exercise type
 */
function resolveEffectiveType(
  catalogExercise: Exercise,
  entry: RoutineExerciseEntry
): ExerciseType {
  if (entry.typeOverride) {
    return entry.typeOverride;
  }
  if (
    entry.equipmentOverride &&
    entry.equipmentOverride !== "bodyweight" &&
    catalogExercise.type === "bodyweight"
  ) {
    return "weight";
  }
  return catalogExercise.type;
}

/**
 * Resolve the effective equipment for a session exercise.
 */
function resolveEffectiveEquipment(
  catalogExercise: Exercise,
  entry: RoutineExerciseEntry
): ExerciseEquipment {
  return entry.equipmentOverride ?? catalogExercise.equipment;
}

/**
 * Build SessionExercise rows from a day's routine entries.
 *
 * The db parameter is used to look up catalog exercises synchronously
 * from a pre-loaded cache passed via the exerciseCache parameter.
 * Since we need exercise names and types, we pass the db so the caller
 * can use it -- but the actual lookup happens via the routine data
 * and the exercises table.
 *
 * NOTE: This function is called inside a transaction context, so it
 * must not perform writes. All writes happen after this returns.
 */
function buildSessionExercises(
  db: ExerciseLoggerDB,
  sessionId: string,
  entries: RoutineEntry[],
  routine: Routine,
  createdAt: string
): SessionExercise[] {
  const result: SessionExercise[] = [];
  let orderIndex = 0;

  for (const entry of entries) {
    if (entry.kind === "exercise") {
      result.push(
        buildSingleSessionExercise(
          sessionId,
          entry,
          orderIndex,
          "single",
          null,
          null,
          createdAt
        )
      );
      orderIndex++;
    } else if (entry.kind === "superset") {
      const supersetGroupId = generateId();
      for (let pos = 0; pos < entry.items.length; pos++) {
        const item = entry.items[pos]!;
        result.push(
          buildSingleSessionExercise(
            sessionId,
            item,
            orderIndex,
            "superset",
            supersetGroupId,
            pos,
            createdAt
          )
        );
        orderIndex++;
      }
    }
  }

  return result;
}

/**
 * Build a single SessionExercise from a RoutineExerciseEntry.
 *
 * NOTE: This function needs catalog exercise data for name and type resolution.
 * Since we don't have async access inside the synchronous loop, the exercise
 * lookup is deferred -- the caller must populate exerciseNameSnapshot and
 * effective type/equipment after the exercises are loaded.
 *
 * REVISED: We build the session exercise with placeholder values that will
 * be populated by the async wrapper function.
 */
function buildSingleSessionExercise(
  sessionId: string,
  entry: RoutineExerciseEntry,
  orderIndex: number,
  groupType: GroupType,
  supersetGroupId: string | null,
  supersetPosition: number | null,
  createdAt: string
): SessionExercise {
  return {
    id: generateId(),
    sessionId,
    routineEntryId: entry.entryId,
    exerciseId: entry.exerciseId,
    // Placeholder -- will be populated by startSession after exercise lookup
    exerciseNameSnapshot: "",
    origin: "routine" as SessionExerciseOrigin,
    orderIndex,
    groupType,
    supersetGroupId,
    supersetPosition,
    instanceLabel: entry.instanceLabel ?? null,
    // Placeholder -- will be populated by startSession after exercise lookup
    effectiveType: "weight" as ExerciseType,
    effectiveEquipment: "barbell" as ExerciseEquipment,
    notesSnapshot: entry.notes ?? null,
    setBlocksSnapshot: [...entry.setBlocks],
    createdAt,
  };
}

/**
 * Start a new workout session with full exercise catalog resolution.
 *
 * This is the main entry point. It:
 * 1. Loads all referenced exercises from the catalog
 * 2. Builds session exercises with resolved names and effective types
 * 3. Creates the session in a transaction enforcing invariant 1
 */
export async function startSessionWithCatalog(
  db: ExerciseLoggerDB,
  routine: Routine,
  dayId: string
): Promise<SessionData> {
  // Validate the dayId exists in the routine
  const day = routine.days[dayId];
  if (!day) {
    throw new Error(
      `Day "${dayId}" does not exist in routine "${routine.name}". Valid days: ${routine.dayOrder.join(", ")}`
    );
  }

  // Collect all exerciseIds referenced by this day
  const exerciseIds = new Set<string>();
  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      exerciseIds.add(entry.exerciseId);
    } else if (entry.kind === "superset") {
      for (const item of entry.items) {
        exerciseIds.add(item.exerciseId);
      }
    }
  }

  // Load all referenced exercises from catalog
  const exerciseMap = new Map<string, Exercise>();
  for (const id of exerciseIds) {
    const exercise = await db.exercises.get(id);
    if (!exercise) {
      throw new Error(
        `Exercise "${id}" referenced in routine "${routine.name}" day "${dayId}" not found in catalog`
      );
    }
    exerciseMap.set(id, exercise);
  }

  // Build session and session exercises
  const sessionId = generateId();
  const now = nowISO();

  const session: Session = {
    id: sessionId,
    routineId: routine.id,
    routineNameSnapshot: routine.name,
    dayId,
    dayLabelSnapshot: day.label,
    dayOrderSnapshot: [...routine.dayOrder],
    restDefaultSecSnapshot: routine.restDefaultSec,
    restSupersetSecSnapshot: routine.restSupersetSec,
    status: "active",
    startedAt: now,
    finishedAt: null,
  };

  const sessionExercises: SessionExercise[] = [];
  let orderIndex = 0;

  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      const exercise = exerciseMap.get(entry.exerciseId)!;
      sessionExercises.push({
        id: generateId(),
        sessionId,
        routineEntryId: entry.entryId,
        exerciseId: entry.exerciseId,
        exerciseNameSnapshot: exercise.name,
        origin: "routine",
        orderIndex,
        groupType: "single",
        supersetGroupId: null,
        supersetPosition: null,
        instanceLabel: entry.instanceLabel ?? null,
        effectiveType: resolveEffectiveType(exercise, entry),
        effectiveEquipment: resolveEffectiveEquipment(exercise, entry),
        notesSnapshot: entry.notes ?? null,
        setBlocksSnapshot: [...entry.setBlocks],
        createdAt: now,
      });
      orderIndex++;
    } else if (entry.kind === "superset") {
      const supersetGroupId = generateId();
      for (let pos = 0; pos < entry.items.length; pos++) {
        const item = entry.items[pos]!;
        const exercise = exerciseMap.get(item.exerciseId)!;
        sessionExercises.push({
          id: generateId(),
          sessionId,
          routineEntryId: item.entryId,
          exerciseId: item.exerciseId,
          exerciseNameSnapshot: exercise.name,
          origin: "routine",
          orderIndex,
          groupType: "superset",
          supersetGroupId,
          supersetPosition: pos,
          instanceLabel: item.instanceLabel ?? null,
          effectiveType: resolveEffectiveType(exercise, item),
          effectiveEquipment: resolveEffectiveEquipment(exercise, item),
          notesSnapshot: item.notes ?? null,
          setBlocksSnapshot: [...item.setBlocks],
          createdAt: now,
        });
        orderIndex++;
      }
    }
  }

  // Write in a transaction enforcing invariant 1
  await db.transaction("rw", db.sessions, db.sessionExercises, async () => {
    const activeCount = await db.sessions
      .where("status")
      .equals("active")
      .count();
    if (activeCount > 0) {
      throw new Error(
        "An active session already exists. Resume or discard it before starting a new one."
      );
    }

    await db.sessions.add(session);
    if (sessionExercises.length > 0) {
      await db.sessionExercises.bulkAdd(sessionExercises);
    }
  });

  return {
    session,
    sessionExercises,
    loggedSets: [],
  };
}

// ---------------------------------------------------------------------------
// Resume session
// ---------------------------------------------------------------------------

/**
 * Find and return the active session with all its session exercises and logged sets.
 *
 * Returns null if no active session exists.
 */
export async function resumeSession(
  db: ExerciseLoggerDB
): Promise<SessionData | null> {
  const activeSessions = await db.sessions
    .where("status")
    .equals("active")
    .toArray();

  if (activeSessions.length === 0) {
    return null;
  }

  const session = activeSessions[0]!;

  const sessionExercises = await db.sessionExercises
    .where("[sessionId+orderIndex]")
    .between([session.id, Dexie.minKey], [session.id, Dexie.maxKey])
    .toArray();

  const loggedSets = await db.loggedSets
    .where("sessionId")
    .equals(session.id)
    .toArray();

  return { session, sessionExercises, loggedSets };
}

// ---------------------------------------------------------------------------
// Discard session
// ---------------------------------------------------------------------------

/**
 * Discard an active session by hard-deleting the session and all related
 * session exercises and logged sets in one transaction.
 *
 * Enforces invariant 4: discarding must NOT advance rotation (nextDayId).
 * This is achieved by simply not touching the routine record at all.
 */
export async function discardSession(
  db: ExerciseLoggerDB,
  sessionId: string
): Promise<void> {
  await db.transaction(
    "rw",
    db.sessions,
    db.sessionExercises,
    db.loggedSets,
    async () => {
      const session = await db.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }
      if (session.status !== "active") {
        throw new Error(
          `Cannot discard session "${sessionId}": status is "${session.status}", expected "active"`
        );
      }

      // Delete logged sets for this session
      const loggedSetIds = await db.loggedSets
        .where("sessionId")
        .equals(sessionId)
        .primaryKeys();
      if (loggedSetIds.length > 0) {
        await db.loggedSets.bulkDelete(loggedSetIds);
      }

      // Delete session exercises for this session
      const seIds = await db.sessionExercises
        .where("sessionId")
        .equals(sessionId)
        .primaryKeys();
      if (seIds.length > 0) {
        await db.sessionExercises.bulkDelete(seIds);
      }

      // Delete the session itself
      await db.sessions.delete(sessionId);
    }
  );
}

// ---------------------------------------------------------------------------
// Finish session
// ---------------------------------------------------------------------------

/**
 * Finish an active session.
 *
 * Sets status to "finished", sets finishedAt, and advances the source
 * routine's nextDayId using the session's dayOrderSnapshot.
 *
 * Invariant 3: nextDayId is updated only on finish.
 * Spec: "The user may finish a session even if some prescribed sets were not logged."
 *
 * Day override rotation rule (spec section 10):
 * - Session used dayId "A" (override or suggested)
 * - On finish, nextDayId becomes the day AFTER "A" in dayOrderSnapshot
 * - Wraps around: if "A" is the last day, next becomes the first day
 */
export async function finishSession(
  db: ExerciseLoggerDB,
  sessionId: string
): Promise<void> {
  await db.transaction("rw", db.sessions, db.routines, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    if (session.status !== "active") {
      throw new Error(
        `Cannot finish session "${sessionId}": status is "${session.status}", expected "active"`
      );
    }

    const now = nowISO();

    // Update session status
    await db.sessions.update(sessionId, {
      status: "finished" as const,
      finishedAt: now,
    });

    // Advance rotation on the source routine (if it still exists)
    if (session.routineId) {
      const routine = await db.routines.get(session.routineId);
      if (routine) {
        const dayOrder = session.dayOrderSnapshot;
        const currentIndex = dayOrder.indexOf(session.dayId);
        const nextIndex = (currentIndex + 1) % dayOrder.length;
        const nextDayId = dayOrder[nextIndex]!;

        await db.routines.update(session.routineId, { nextDayId });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Add extra exercise
// ---------------------------------------------------------------------------

/**
 * Add an extra exercise to an active session.
 *
 * Creates a sessionExercise with origin="extra", no setBlocksSnapshot,
 * appended at the end of orderIndex.
 *
 * Enforces invariant 6: extras only during active session.
 */
export async function addExtraExercise(
  db: ExerciseLoggerDB,
  sessionId: string,
  exerciseId: string
): Promise<SessionExercise> {
  // Look up the exercise from catalog
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) {
    throw new Error(`Exercise "${exerciseId}" not found in catalog`);
  }

  let sessionExercise: SessionExercise | null = null;

  await db.transaction("rw", db.sessions, db.sessionExercises, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    if (session.status !== "active") {
      throw new Error(
        `Cannot add extra exercise: session "${sessionId}" is "${session.status}", expected "active" (invariant 6)`
      );
    }

    // Find the current max orderIndex for this session
    const existing = await db.sessionExercises
      .where("sessionId")
      .equals(sessionId)
      .toArray();
    const maxOrder = existing.reduce(
      (max, se) => Math.max(max, se.orderIndex),
      -1
    );

    const now = nowISO();

    sessionExercise = {
      id: generateId(),
      sessionId,
      routineEntryId: null,
      exerciseId: exercise.id,
      exerciseNameSnapshot: exercise.name,
      origin: "extra" as SessionExerciseOrigin,
      orderIndex: maxOrder + 1,
      groupType: "single" as GroupType,
      supersetGroupId: null,
      supersetPosition: null,
      instanceLabel: null,
      effectiveType: exercise.type,
      effectiveEquipment: exercise.equipment,
      notesSnapshot: null,
      setBlocksSnapshot: [],
      createdAt: now,
    };

    await db.sessionExercises.add(sessionExercise);
  });

  return sessionExercise!;
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx tsc --noEmit --project tsconfig.app.json
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/services/session-service.ts
git commit -m "$(cat <<'EOF'
feat: add session service with start, resume, discard, finish, add extra
EOF
)"
```

---

### Task 3: Create the set service -- log, edit, delete sets

**Files:**
- Create: `web/src/services/set-service.ts`

- [ ] **Step 1: Create the set service**

Create `web/src/services/set-service.ts`:

```ts
import Dexie from "dexie";
import type {
  LoggedSet,
  SessionExercise,
  SetBlock,
} from "@/domain/types";
import type { SetTag } from "@/domain/enums";
import type { ExerciseLoggerDB } from "@/db/database";
import { generateId } from "@/domain/uuid";
import { nowISO } from "@/domain/timestamp";
import { generateBlockSignature } from "@/domain/block-signature";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input for logging or editing a set. */
export interface SetLogInput {
  /** Weight in kg (external load only), or null for bodyweight/unweighted. */
  performedWeightKg: number | null;
  /** Reps performed, or null when not applicable. */
  performedReps: number | null;
  /** Duration in seconds, or null when not applicable. */
  performedDurationSec: number | null;
  /** Distance in meters, or null when not applicable. */
  performedDistanceM: number | null;
}

// ---------------------------------------------------------------------------
// Log set
// ---------------------------------------------------------------------------

/**
 * Log a set for a session exercise.
 *
 * Creates or updates a loggedSet row keyed by [sessionExerciseId, blockIndex, setIndex].
 *
 * Enforces invariant 9: if a slot already exists, update it in place instead
 * of creating a duplicate.
 *
 * Denormalizes exerciseId, instanceLabel, origin, and blockSignature from
 * the sessionExercise record.
 *
 * IMPORTANT: instanceLabel is stored as "" instead of null in loggedSets
 * to keep the Dexie compound index [exerciseId+instanceLabel+blockSignature+loggedAt]
 * functional. Dexie excludes rows with null keys from compound indexes.
 *
 * @param db - Dexie database instance
 * @param sessionExerciseId - The session exercise to log a set for
 * @param blockIndex - Index within setBlocksSnapshot (0 for extras)
 * @param setIndex - Zero-based index within the block
 * @param input - The performed values
 * @returns The created or updated LoggedSet
 */
export async function logSet(
  db: ExerciseLoggerDB,
  sessionExerciseId: string,
  blockIndex: number,
  setIndex: number,
  input: SetLogInput
): Promise<LoggedSet> {
  const sessionExercise = await db.sessionExercises.get(sessionExerciseId);
  if (!sessionExercise) {
    throw new Error(`SessionExercise "${sessionExerciseId}" not found`);
  }

  // Verify the session is active
  const session = await db.sessions.get(sessionExercise.sessionId);
  if (!session) {
    throw new Error(`Session "${sessionExercise.sessionId}" not found`);
  }
  if (session.status !== "active") {
    throw new Error(
      `Cannot log set: session "${session.id}" is "${session.status}", expected "active"`
    );
  }

  // Resolve block signature and tag from the set block snapshot
  let blockSignature: string;
  let tag: SetTag | null = null;

  if (sessionExercise.origin === "extra" || sessionExercise.setBlocksSnapshot.length === 0) {
    // Extra exercises have no set blocks -- use a generic signature
    blockSignature = "extra:0:count0:tagnormal";
  } else {
    const block = sessionExercise.setBlocksSnapshot[blockIndex];
    if (!block) {
      throw new Error(
        `Block index ${blockIndex} out of range for session exercise "${sessionExerciseId}" (has ${sessionExercise.setBlocksSnapshot.length} blocks)`
      );
    }
    blockSignature = generateBlockSignature(block);
    tag = block.tag ?? null;
  }

  const now = nowISO();

  // Invariant 9: check if this slot already exists
  const existing = await db.loggedSets
    .where("[sessionExerciseId+blockIndex+setIndex]")
    .equals([sessionExerciseId, blockIndex, setIndex])
    .first();

  // Normalize instanceLabel: store "" instead of null for compound index compatibility
  const instanceLabel = sessionExercise.instanceLabel ?? "";

  if (existing) {
    // Update existing slot
    const updated: Partial<LoggedSet> = {
      performedWeightKg: input.performedWeightKg,
      performedReps: input.performedReps,
      performedDurationSec: input.performedDurationSec,
      performedDistanceM: input.performedDistanceM,
      updatedAt: now,
    };
    await db.loggedSets.update(existing.id, updated);

    return { ...existing, ...updated } as LoggedSet;
  }

  // Create new logged set
  const loggedSet: LoggedSet = {
    id: generateId(),
    sessionId: sessionExercise.sessionId,
    sessionExerciseId,
    exerciseId: sessionExercise.exerciseId,
    instanceLabel,
    origin: sessionExercise.origin,
    blockIndex,
    blockSignature,
    setIndex,
    tag,
    performedWeightKg: input.performedWeightKg,
    performedReps: input.performedReps,
    performedDurationSec: input.performedDurationSec,
    performedDistanceM: input.performedDistanceM,
    loggedAt: now,
    updatedAt: now,
  };

  await db.loggedSets.add(loggedSet);

  // Weighted bodyweight runtime detection:
  // If the user logs a non-null weight for a bodyweight exercise, promote the
  // sessionExercise's effectiveType from "bodyweight" to "weight" so the
  // progression engine and UI treat it as a weighted movement for this session.
  if (
    input.performedWeightKg !== null &&
    sessionExercise.effectiveType === "bodyweight"
  ) {
    await db.sessionExercises.update(sessionExerciseId, {
      effectiveType: "weight",
    });
  }

  return loggedSet;
}

// ---------------------------------------------------------------------------
// Edit set
// ---------------------------------------------------------------------------

/**
 * Edit an existing logged set.
 *
 * Updates the performed values and sets updatedAt.
 * Can be called on sets from both active and finished sessions
 * (spec: "The user may edit or delete logged sets from the active workout
 * screen or finished session detail in History").
 */
export async function editSet(
  db: ExerciseLoggerDB,
  loggedSetId: string,
  input: SetLogInput
): Promise<LoggedSet> {
  const existing = await db.loggedSets.get(loggedSetId);
  if (!existing) {
    throw new Error(`LoggedSet "${loggedSetId}" not found`);
  }

  const now = nowISO();
  const updated: Partial<LoggedSet> = {
    performedWeightKg: input.performedWeightKg,
    performedReps: input.performedReps,
    performedDurationSec: input.performedDurationSec,
    performedDistanceM: input.performedDistanceM,
    updatedAt: now,
  };

  await db.loggedSets.update(loggedSetId, updated);

  return { ...existing, ...updated } as LoggedSet;
}

// ---------------------------------------------------------------------------
// Delete set
// ---------------------------------------------------------------------------

/**
 * Delete a logged set by ID.
 *
 * Removes the loggedSet row for that slot.
 * Does not change the session snapshot structure.
 * Can be called on sets from both active and finished sessions.
 */
export async function deleteSet(
  db: ExerciseLoggerDB,
  loggedSetId: string
): Promise<void> {
  const existing = await db.loggedSets.get(loggedSetId);
  if (!existing) {
    throw new Error(`LoggedSet "${loggedSetId}" not found`);
  }

  await db.loggedSets.delete(loggedSetId);
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx tsc --noEmit --project tsconfig.app.json
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/services/set-service.ts
git commit -m "$(cat <<'EOF'
feat: add set service with log, edit, delete operations
EOF
)"
```

---

### Task 4: Test the session service -- start session

**Files:**
- Create: `web/tests/unit/services/session-service.test.ts`

This task creates the test file for the session service. The tests cover start, resume, discard, finish, day override, add extra exercise, and all related invariants.

- [ ] **Step 1: Create the session service test file**

Create `web/tests/unit/services/session-service.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  startSessionWithCatalog,
  resumeSession,
  discardSession,
  finishSession,
  addExtraExercise,
} from "@/services/session-service";
import type {
  Exercise,
  Routine,
  RoutineDay,
  RoutineEntry,
  RoutineExerciseEntry,
  Session,
  SessionExercise,
  SetBlock,
} from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal exercise record. */
function makeExercise(
  id: string,
  overrides: Partial<Exercise> = {}
): Exercise {
  return {
    id,
    name: id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
    ...overrides,
  };
}

/** Create a single exercise routine entry. */
function makeExerciseEntry(
  dayId: string,
  index: number,
  exerciseId: string,
  setBlocks: SetBlock[],
  extras: Partial<RoutineExerciseEntry> = {}
): RoutineEntry {
  return {
    kind: "exercise",
    entryId: `${dayId}-e${index}`,
    exerciseId,
    setBlocks,
    ...extras,
  };
}

/** Create a superset routine entry. */
function makeSupersetEntry(
  dayId: string,
  index: number,
  items: [
    { exerciseId: string; setBlocks: SetBlock[]; extras?: Partial<RoutineExerciseEntry> },
    { exerciseId: string; setBlocks: SetBlock[]; extras?: Partial<RoutineExerciseEntry> },
  ]
): RoutineEntry {
  return {
    kind: "superset",
    groupId: `${dayId}-e${index}-group`,
    items: [
      {
        entryId: `${dayId}-e${index}-s0`,
        exerciseId: items[0].exerciseId,
        setBlocks: items[0].setBlocks,
        ...items[0].extras,
      },
      {
        entryId: `${dayId}-e${index}-s1`,
        exerciseId: items[1].exerciseId,
        setBlocks: items[1].setBlocks,
        ...items[1].extras,
      },
    ],
  };
}

/** Standard set block: reps 8-12, count 3. */
const STANDARD_BLOCK: SetBlock = {
  targetKind: "reps",
  minValue: 8,
  maxValue: 12,
  count: 3,
};

/** Top set block: reps 6-8, count 1, tag top. */
const TOP_SET_BLOCK: SetBlock = {
  targetKind: "reps",
  minValue: 6,
  maxValue: 8,
  count: 1,
  tag: "top",
};

/** Create a routine with configurable days. */
function makeRoutine(
  days: Record<string, { label: string; entries: RoutineEntry[] }>,
  overrides: Partial<Routine> = {}
): Routine {
  const dayOrder = Object.keys(days);
  const normalizedDays: Record<string, RoutineDay> = {};
  for (const [id, day] of Object.entries(days)) {
    normalizedDays[id] = { id, label: day.label, entries: day.entries };
  }
  return {
    id: "r1",
    schemaVersion: 1,
    name: "Test Routine",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder,
    nextDayId: dayOrder[0]!,
    days: normalizedDays,
    notes: [],
    cardio: null,
    importedAt: "2026-03-28T12:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("session-service", () => {
  let db: ExerciseLoggerDB;

  beforeEach(async () => {
    db = new ExerciseLoggerDB();
    await initializeSettings(db);

    // Seed common exercises
    await db.exercises.bulkAdd([
      makeExercise("barbell-back-squat"),
      makeExercise("leg-curl", { equipment: "machine" }),
      makeExercise("dumbbell-bench-press", { equipment: "dumbbell", muscleGroups: ["Chest"] }),
      makeExercise("dumbbell-row", { equipment: "dumbbell", muscleGroups: ["Back"] }),
      makeExercise("pull-up", { type: "bodyweight", equipment: "bodyweight", muscleGroups: ["Back"] }),
      makeExercise("dip", { type: "bodyweight", equipment: "bodyweight", muscleGroups: ["Chest", "Arms"] }),
      makeExercise("tricep-pushdown", { equipment: "cable", muscleGroups: ["Arms"] }),
    ]);
  });

  afterEach(async () => {
    await db.delete();
  });

  // =====================================================================
  // startSessionWithCatalog
  // =====================================================================

  describe("startSessionWithCatalog", () => {
    it("creates a session with correct snapshots", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [TOP_SET_BLOCK, STANDARD_BLOCK]),
            makeExerciseEntry("A", 1, "leg-curl", [STANDARD_BLOCK]),
          ],
        },
        B: { label: "Day B", entries: [] },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");

      // Session snapshots
      expect(result.session.status).toBe("active");
      expect(result.session.routineId).toBe("r1");
      expect(result.session.routineNameSnapshot).toBe("Test Routine");
      expect(result.session.dayId).toBe("A");
      expect(result.session.dayLabelSnapshot).toBe("Day A");
      expect(result.session.dayOrderSnapshot).toEqual(["A", "B"]);
      expect(result.session.restDefaultSecSnapshot).toBe(90);
      expect(result.session.restSupersetSecSnapshot).toBe(60);
      expect(result.session.finishedAt).toBeNull();
    });

    it("creates session exercises with correct order and snapshots", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [TOP_SET_BLOCK, STANDARD_BLOCK]),
            makeExerciseEntry("A", 1, "leg-curl", [STANDARD_BLOCK]),
          ],
        },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");

      expect(result.sessionExercises).toHaveLength(2);

      const se0 = result.sessionExercises[0]!;
      expect(se0.exerciseId).toBe("barbell-back-squat");
      expect(se0.exerciseNameSnapshot).toBe("Barbell Back Squat");
      expect(se0.origin).toBe("routine");
      expect(se0.orderIndex).toBe(0);
      expect(se0.groupType).toBe("single");
      expect(se0.supersetGroupId).toBeNull();
      expect(se0.supersetPosition).toBeNull();
      expect(se0.effectiveType).toBe("weight");
      expect(se0.effectiveEquipment).toBe("barbell");
      expect(se0.setBlocksSnapshot).toHaveLength(2);
      expect(se0.setBlocksSnapshot[0]!.tag).toBe("top");

      const se1 = result.sessionExercises[1]!;
      expect(se1.exerciseId).toBe("leg-curl");
      expect(se1.orderIndex).toBe(1);
      expect(se1.effectiveEquipment).toBe("machine");
    });

    it("handles superset entries correctly", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeSupersetEntry("A", 0, [
              { exerciseId: "dumbbell-bench-press", setBlocks: [STANDARD_BLOCK] },
              { exerciseId: "dumbbell-row", setBlocks: [STANDARD_BLOCK] },
            ]),
          ],
        },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");

      expect(result.sessionExercises).toHaveLength(2);

      const se0 = result.sessionExercises[0]!;
      const se1 = result.sessionExercises[1]!;

      expect(se0.groupType).toBe("superset");
      expect(se1.groupType).toBe("superset");
      expect(se0.supersetGroupId).toBe(se1.supersetGroupId);
      expect(se0.supersetGroupId).not.toBeNull();
      expect(se0.supersetPosition).toBe(0);
      expect(se1.supersetPosition).toBe(1);
      expect(se0.exerciseId).toBe("dumbbell-bench-press");
      expect(se1.exerciseId).toBe("dumbbell-row");
    });

    it("snapshots exercise notes", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [STANDARD_BLOCK], {
              notes: "Warm up with 2 lighter sets",
            }),
          ],
        },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");
      expect(result.sessionExercises[0]!.notesSnapshot).toBe(
        "Warm up with 2 lighter sets"
      );
    });

    it("returns empty loggedSets array", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");
      expect(result.loggedSets).toEqual([]);
    });

    it("persists session and session exercises to Dexie", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [STANDARD_BLOCK]),
          ],
        },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");

      // Verify persisted
      const storedSession = await db.sessions.get(result.session.id);
      expect(storedSession).toBeDefined();
      expect(storedSession!.status).toBe("active");

      const storedSEs = await db.sessionExercises
        .where("sessionId")
        .equals(result.session.id)
        .toArray();
      expect(storedSEs).toHaveLength(1);
    });

    // --- Invariant 1: at most one active session ---

    it("throws if an active session already exists (invariant 1)", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);

      await startSessionWithCatalog(db, routine, "A");
      await expect(startSessionWithCatalog(db, routine, "A")).rejects.toThrow(
        "An active session already exists"
      );
    });

    it("allows starting after previous session is finished", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
        B: { label: "Day B", entries: [] },
      });
      await db.routines.add(routine);

      const first = await startSessionWithCatalog(db, routine, "A");
      await finishSession(db, first.session.id);

      // Should succeed
      const second = await startSessionWithCatalog(db, routine, "B");
      expect(second.session.status).toBe("active");
    });

    // --- Invalid day ---

    it("throws for an invalid day ID", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);

      await expect(startSessionWithCatalog(db, routine, "Z")).rejects.toThrow(
        'Day "Z" does not exist'
      );
    });

    // --- Missing catalog exercise ---

    it("throws if a referenced exercise is not in the catalog", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "nonexistent-exercise", [STANDARD_BLOCK]),
          ],
        },
      });
      await db.routines.add(routine);

      await expect(
        startSessionWithCatalog(db, routine, "A")
      ).rejects.toThrow('Exercise "nonexistent-exercise"');
    });

    // --- Does NOT advance rotation (invariant 3) ---

    it("does not change nextDayId on start", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
        B: { label: "Day B", entries: [] },
      });
      await db.routines.add(routine);

      await startSessionWithCatalog(db, routine, "A");

      const updatedRoutine = await db.routines.get("r1");
      expect(updatedRoutine!.nextDayId).toBe("A");
    });
  });

  // =====================================================================
  // Weighted bodyweight detection
  // =====================================================================

  describe("weighted bodyweight detection", () => {
    it("uses catalog type when no overrides are present", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "pull-up", [STANDARD_BLOCK]),
          ],
        },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");
      expect(result.sessionExercises[0]!.effectiveType).toBe("bodyweight");
      expect(result.sessionExercises[0]!.effectiveEquipment).toBe("bodyweight");
    });

    it("uses typeOverride when specified", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "pull-up", [STANDARD_BLOCK], {
              typeOverride: "weight",
            }),
          ],
        },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");
      expect(result.sessionExercises[0]!.effectiveType).toBe("weight");
    });

    it("treats bodyweight exercise as weight when equipmentOverride is not bodyweight", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "pull-up", [STANDARD_BLOCK], {
              equipmentOverride: "cable",
            }),
          ],
        },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");
      expect(result.sessionExercises[0]!.effectiveType).toBe("weight");
      expect(result.sessionExercises[0]!.effectiveEquipment).toBe("cable");
    });

    it("keeps bodyweight type when equipmentOverride is bodyweight", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "pull-up", [STANDARD_BLOCK], {
              equipmentOverride: "bodyweight",
            }),
          ],
        },
      });
      await db.routines.add(routine);

      const result = await startSessionWithCatalog(db, routine, "A");
      expect(result.sessionExercises[0]!.effectiveType).toBe("bodyweight");
    });
  });

  // =====================================================================
  // resumeSession
  // =====================================================================

  describe("resumeSession", () => {
    it("returns null when no active session exists", async () => {
      const result = await resumeSession(db);
      expect(result).toBeNull();
    });

    it("returns the active session with exercises and logged sets", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [STANDARD_BLOCK]),
          ],
        },
      });
      await db.routines.add(routine);
      await startSessionWithCatalog(db, routine, "A");

      const result = await resumeSession(db);
      expect(result).not.toBeNull();
      expect(result!.session.status).toBe("active");
      expect(result!.sessionExercises).toHaveLength(1);
      expect(result!.loggedSets).toHaveLength(0);
    });

    it("returns logged sets when they exist", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [STANDARD_BLOCK]),
          ],
        },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      // Import set-service to log a set
      const { logSet } = await import("@/services/set-service");
      await logSet(db, sessionData.sessionExercises[0]!.id, 0, 0, {
        performedWeightKg: 100,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      const result = await resumeSession(db);
      expect(result!.loggedSets).toHaveLength(1);
      expect(result!.loggedSets[0]!.performedWeightKg).toBe(100);
    });

    it("returns session exercises in orderIndex order", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [STANDARD_BLOCK]),
            makeExerciseEntry("A", 1, "leg-curl", [STANDARD_BLOCK]),
            makeExerciseEntry("A", 2, "tricep-pushdown", [STANDARD_BLOCK]),
          ],
        },
      });
      await db.routines.add(routine);
      await startSessionWithCatalog(db, routine, "A");

      const result = await resumeSession(db);
      expect(result!.sessionExercises.map((se) => se.orderIndex)).toEqual([0, 1, 2]);
      expect(result!.sessionExercises.map((se) => se.exerciseId)).toEqual([
        "barbell-back-squat",
        "leg-curl",
        "tricep-pushdown",
      ]);
    });
  });

  // =====================================================================
  // discardSession
  // =====================================================================

  describe("discardSession", () => {
    it("deletes the session and all related records", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [STANDARD_BLOCK]),
          ],
        },
        B: { label: "Day B", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      // Log a set so there's a loggedSet to delete
      const { logSet } = await import("@/services/set-service");
      await logSet(db, sessionData.sessionExercises[0]!.id, 0, 0, {
        performedWeightKg: 100,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      await discardSession(db, sessionData.session.id);

      // Everything should be gone
      expect(await db.sessions.count()).toBe(0);
      expect(await db.sessionExercises.count()).toBe(0);
      expect(await db.loggedSets.count()).toBe(0);
    });

    it("does not advance rotation (invariant 4)", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
        B: { label: "Day B", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      await discardSession(db, sessionData.session.id);

      const updatedRoutine = await db.routines.get("r1");
      expect(updatedRoutine!.nextDayId).toBe("A");
    });

    it("throws if session does not exist", async () => {
      await expect(discardSession(db, "nonexistent")).rejects.toThrow(
        'Session "nonexistent" not found'
      );
    });

    it("throws if session is not active", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");
      await finishSession(db, sessionData.session.id);

      await expect(
        discardSession(db, sessionData.session.id)
      ).rejects.toThrow('status is "finished"');
    });

    it("allows starting a new session after discard", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");
      await discardSession(db, sessionData.session.id);

      // Should succeed
      const second = await startSessionWithCatalog(db, routine, "A");
      expect(second.session.status).toBe("active");
    });
  });

  // =====================================================================
  // finishSession
  // =====================================================================

  describe("finishSession", () => {
    it("sets status to finished and sets finishedAt", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
        B: { label: "Day B", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      await finishSession(db, sessionData.session.id);

      const session = await db.sessions.get(sessionData.session.id);
      expect(session!.status).toBe("finished");
      expect(session!.finishedAt).not.toBeNull();
    });

    it("advances nextDayId to the next day in dayOrderSnapshot (invariant 3)", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
        B: { label: "Day B", entries: [] },
        C: { label: "Day C", entries: [] },
      });
      await db.routines.add(routine);

      // Start day A
      const sessionData = await startSessionWithCatalog(db, routine, "A");
      await finishSession(db, sessionData.session.id);

      const updatedRoutine = await db.routines.get("r1");
      expect(updatedRoutine!.nextDayId).toBe("B");
    });

    it("wraps around when finishing the last day", async () => {
      const routine = makeRoutine(
        {
          A: { label: "Day A", entries: [] },
          B: { label: "Day B", entries: [] },
          C: { label: "Day C", entries: [] },
        },
        { nextDayId: "C" }
      );
      await db.routines.add(routine);

      const sessionData = await startSessionWithCatalog(db, routine, "C");
      await finishSession(db, sessionData.session.id);

      const updatedRoutine = await db.routines.get("r1");
      expect(updatedRoutine!.nextDayId).toBe("A");
    });

    it("allows finishing with unlogged sets", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [
              { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 },
            ]),
          ],
        },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      // Finish without logging any sets -- should succeed
      await finishSession(db, sessionData.session.id);

      const session = await db.sessions.get(sessionData.session.id);
      expect(session!.status).toBe("finished");
    });

    it("throws if session is not active", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");
      await finishSession(db, sessionData.session.id);

      await expect(
        finishSession(db, sessionData.session.id)
      ).rejects.toThrow('status is "finished"');
    });

    it("does not throw if the source routine was deleted", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      // Delete the routine (bypassing the guard since no active session check in raw delete)
      await db.routines.delete("r1");

      // Finish should still succeed -- just can't advance rotation
      await finishSession(db, sessionData.session.id);

      const session = await db.sessions.get(sessionData.session.id);
      expect(session!.status).toBe("finished");
    });

    // --- Invariant 5: finished sessions renderable after routine deletion ---

    it("finished session retains all snapshots after routine deletion (invariant 5)", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [STANDARD_BLOCK]),
          ],
        },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");
      await finishSession(db, sessionData.session.id);

      // Delete the routine
      await db.routines.delete("r1");
      expect(await db.routines.get("r1")).toBeUndefined();

      // Session and session exercises should still be intact
      const session = await db.sessions.get(sessionData.session.id);
      expect(session!.routineNameSnapshot).toBe("Test Routine");
      expect(session!.dayLabelSnapshot).toBe("Day A");

      const exercises = await db.sessionExercises
        .where("sessionId")
        .equals(sessionData.session.id)
        .toArray();
      expect(exercises).toHaveLength(1);
      expect(exercises[0]!.exerciseNameSnapshot).toBe("Barbell Back Squat");
      expect(exercises[0]!.setBlocksSnapshot).toHaveLength(1);
    });
  });

  // =====================================================================
  // Day override
  // =====================================================================

  describe("day override", () => {
    it("starts with a non-suggested day and advances correctly", async () => {
      const routine = makeRoutine(
        {
          A: { label: "Day A", entries: [] },
          B: { label: "Day B", entries: [] },
          C: { label: "Day C", entries: [] },
        },
        { nextDayId: "B" }
      );
      await db.routines.add(routine);

      // Override: start A instead of suggested B
      const sessionData = await startSessionWithCatalog(db, routine, "A");
      expect(sessionData.session.dayId).toBe("A");

      await finishSession(db, sessionData.session.id);

      // nextDayId should be the day after A, which is B
      const updatedRoutine = await db.routines.get("r1");
      expect(updatedRoutine!.nextDayId).toBe("B");
    });

    it("override with last day wraps around correctly", async () => {
      const routine = makeRoutine(
        {
          A: { label: "Day A", entries: [] },
          B: { label: "Day B", entries: [] },
          C: { label: "Day C", entries: [] },
        },
        { nextDayId: "A" }
      );
      await db.routines.add(routine);

      // Override: start C instead of suggested A
      const sessionData = await startSessionWithCatalog(db, routine, "C");
      await finishSession(db, sessionData.session.id);

      // nextDayId should wrap around to A
      const updatedRoutine = await db.routines.get("r1");
      expect(updatedRoutine!.nextDayId).toBe("A");
    });

    it("override uses the session's dayOrderSnapshot for advancement", async () => {
      const routine = makeRoutine(
        {
          A: { label: "Day A", entries: [] },
          B: { label: "Day B", entries: [] },
          C: { label: "Day C", entries: [] },
        },
        { nextDayId: "B" }
      );
      await db.routines.add(routine);

      const sessionData = await startSessionWithCatalog(db, routine, "B");

      // Verify dayOrderSnapshot is captured
      expect(sessionData.session.dayOrderSnapshot).toEqual(["A", "B", "C"]);

      await finishSession(db, sessionData.session.id);

      const updatedRoutine = await db.routines.get("r1");
      expect(updatedRoutine!.nextDayId).toBe("C");
    });
  });

  // =====================================================================
  // addExtraExercise
  // =====================================================================

  describe("addExtraExercise", () => {
    it("appends an extra exercise at the end of orderIndex", async () => {
      const routine = makeRoutine({
        A: {
          label: "Day A",
          entries: [
            makeExerciseEntry("A", 0, "barbell-back-squat", [STANDARD_BLOCK]),
            makeExerciseEntry("A", 1, "leg-curl", [STANDARD_BLOCK]),
          ],
        },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      const extra = await addExtraExercise(
        db,
        sessionData.session.id,
        "tricep-pushdown"
      );

      expect(extra.origin).toBe("extra");
      expect(extra.orderIndex).toBe(2); // After 0, 1
      expect(extra.exerciseId).toBe("tricep-pushdown");
      expect(extra.exerciseNameSnapshot).toBe("Tricep Pushdown");
      expect(extra.routineEntryId).toBeNull();
      expect(extra.groupType).toBe("single");
      expect(extra.supersetGroupId).toBeNull();
      expect(extra.setBlocksSnapshot).toEqual([]);
      expect(extra.instanceLabel).toBeNull();
    });

    it("uses catalog type/equipment for extra exercise", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      const extra = await addExtraExercise(
        db,
        sessionData.session.id,
        "pull-up"
      );

      expect(extra.effectiveType).toBe("bodyweight");
      expect(extra.effectiveEquipment).toBe("bodyweight");
    });

    it("throws if session is not active (invariant 6)", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");
      await finishSession(db, sessionData.session.id);

      await expect(
        addExtraExercise(db, sessionData.session.id, "tricep-pushdown")
      ).rejects.toThrow("expected \"active\" (invariant 6)");
    });

    it("throws if exercise is not in catalog", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      await expect(
        addExtraExercise(db, sessionData.session.id, "nonexistent")
      ).rejects.toThrow('Exercise "nonexistent" not found');
    });

    it("allows adding multiple extras", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      const extra1 = await addExtraExercise(
        db,
        sessionData.session.id,
        "tricep-pushdown"
      );
      const extra2 = await addExtraExercise(
        db,
        sessionData.session.id,
        "pull-up"
      );

      expect(extra1.orderIndex).toBe(0);
      expect(extra2.orderIndex).toBe(1);
    });

    it("persists to Dexie", async () => {
      const routine = makeRoutine({
        A: { label: "Day A", entries: [] },
      });
      await db.routines.add(routine);
      const sessionData = await startSessionWithCatalog(db, routine, "A");

      await addExtraExercise(db, sessionData.session.id, "tricep-pushdown");

      const stored = await db.sessionExercises
        .where("sessionId")
        .equals(sessionData.session.id)
        .toArray();
      expect(stored).toHaveLength(1);
      expect(stored[0]!.origin).toBe("extra");
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/session-service.test.ts
```

Expected: All tests pass (approximately 28 tests across 6 describe blocks).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/session-service.test.ts
git commit -m "$(cat <<'EOF'
test: add comprehensive session service tests covering all invariants
EOF
)"
```

---

### Task 5: Test the set service -- log, edit, delete sets

**Files:**
- Create: `web/tests/unit/services/set-service.test.ts`

- [ ] **Step 1: Create the set service test file**

Create `web/tests/unit/services/set-service.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  startSessionWithCatalog,
  addExtraExercise,
  finishSession,
} from "@/services/session-service";
import { logSet, editSet, deleteSet } from "@/services/set-service";
import type {
  Exercise,
  Routine,
  RoutineDay,
  RoutineEntry,
  SetBlock,
  LoggedSet,
} from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
    ...overrides,
  };
}

const STANDARD_BLOCK: SetBlock = {
  targetKind: "reps",
  minValue: 8,
  maxValue: 12,
  count: 3,
};

const TOP_SET_BLOCK: SetBlock = {
  targetKind: "reps",
  minValue: 6,
  maxValue: 8,
  count: 1,
  tag: "top",
};

const DURATION_BLOCK: SetBlock = {
  targetKind: "duration",
  minValue: 30,
  maxValue: 60,
  count: 2,
};

function makeRoutine(
  entries: RoutineEntry[],
  overrides: Partial<Routine> = {}
): Routine {
  return {
    id: "r1",
    schemaVersion: 1,
    name: "Test Routine",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A"],
    nextDayId: "A",
    days: {
      A: { id: "A", label: "Day A", entries },
    },
    notes: [],
    cardio: null,
    importedAt: "2026-03-28T12:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("set-service", () => {
  let db: ExerciseLoggerDB;

  beforeEach(async () => {
    db = new ExerciseLoggerDB();
    await initializeSettings(db);
    await db.exercises.bulkAdd([
      makeExercise("barbell-back-squat"),
      makeExercise("leg-curl", { equipment: "machine" }),
      makeExercise("pull-up", {
        type: "bodyweight",
        equipment: "bodyweight",
        muscleGroups: ["Back"],
      }),
      makeExercise("tricep-pushdown", {
        equipment: "cable",
        muscleGroups: ["Arms"],
      }),
    ]);
  });

  afterEach(async () => {
    await db.delete();
  });

  // =====================================================================
  // logSet
  // =====================================================================

  describe("logSet", () => {
    it("creates a new logged set with correct denormalized values", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [TOP_SET_BLOCK, STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const result = await logSet(db, seId, 0, 0, {
        performedWeightKg: 100,
        performedReps: 7,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      expect(result.sessionExerciseId).toBe(seId);
      expect(result.exerciseId).toBe("barbell-back-squat");
      expect(result.instanceLabel).toBe(""); // Normalized from null
      expect(result.origin).toBe("routine");
      expect(result.blockIndex).toBe(0);
      expect(result.blockSignature).toBe("reps:6-8:count1:tagtop");
      expect(result.setIndex).toBe(0);
      expect(result.tag).toBe("top");
      expect(result.performedWeightKg).toBe(100);
      expect(result.performedReps).toBe(7);
      expect(result.performedDurationSec).toBeNull();
      expect(result.performedDistanceM).toBeNull();
      expect(result.loggedAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it("creates logged set for the back-off block (blockIndex 1)", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [TOP_SET_BLOCK, STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const result = await logSet(db, seId, 1, 0, {
        performedWeightKg: 80,
        performedReps: 12,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      expect(result.blockIndex).toBe(1);
      expect(result.blockSignature).toBe("reps:8-12:count3:tagnormal");
      expect(result.tag).toBeNull();
    });

    // --- Invariant 9: no duplicates, update in place ---

    it("updates existing slot instead of creating duplicate (invariant 9)", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      // First log
      const first = await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      // Re-log same slot with different values
      const second = await logSet(db, seId, 0, 0, {
        performedWeightKg: 85,
        performedReps: 8,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      // Should be the same record, updated
      expect(second.id).toBe(first.id);
      expect(second.performedWeightKg).toBe(85);
      expect(second.performedReps).toBe(8);

      // Only one loggedSet should exist
      const all = await db.loggedSets.toArray();
      expect(all).toHaveLength(1);
    });

    it("creates separate records for different set indexes", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 12,
        performedDurationSec: null,
        performedDistanceM: null,
      });
      await logSet(db, seId, 0, 1, {
        performedWeightKg: 80,
        performedReps: 11,
        performedDurationSec: null,
        performedDistanceM: null,
      });
      await logSet(db, seId, 0, 2, {
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      const all = await db.loggedSets.toArray();
      expect(all).toHaveLength(3);
    });

    // --- instanceLabel normalization ---

    it("stores instanceLabel as empty string when sessionExercise has null instanceLabel", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const result = await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      expect(result.instanceLabel).toBe("");

      // Verify it works with the compound index
      const indexed = await db.loggedSets
        .where("[exerciseId+instanceLabel+blockSignature+loggedAt]")
        .between(
          ["barbell-back-squat", "", "reps:8-12:count3:tagnormal", Dexie.minKey],
          ["barbell-back-squat", "", "reps:8-12:count3:tagnormal", Dexie.maxKey]
        )
        .toArray();
      expect(indexed).toHaveLength(1);
    });

    it("preserves instanceLabel when sessionExercise has one", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          instanceLabel: "narrow",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const result = await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      expect(result.instanceLabel).toBe("narrow");
    });

    // --- Extra exercise logging ---

    it("logs a set for an extra exercise", async () => {
      const routine = makeRoutine([]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const extra = await addExtraExercise(
        db,
        session.session.id,
        "tricep-pushdown"
      );

      const result = await logSet(db, extra.id, 0, 0, {
        performedWeightKg: 30,
        performedReps: 12,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      expect(result.origin).toBe("extra");
      expect(result.blockIndex).toBe(0);
      expect(result.blockSignature).toBe("extra:0:count0:tagnormal");
      expect(result.tag).toBeNull();
    });

    // --- Duration-based sets ---

    it("logs a duration-based set correctly", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [DURATION_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const result = await logSet(db, seId, 0, 0, {
        performedWeightKg: null,
        performedReps: null,
        performedDurationSec: 45,
        performedDistanceM: null,
      });

      expect(result.performedDurationSec).toBe(45);
      expect(result.blockSignature).toBe("duration:30-60:count2:tagnormal");
    });

    // --- Error cases ---

    it("throws if sessionExercise does not exist", async () => {
      await expect(
        logSet(db, "nonexistent", 0, 0, {
          performedWeightKg: 80,
          performedReps: 10,
          performedDurationSec: null,
          performedDistanceM: null,
        })
      ).rejects.toThrow('SessionExercise "nonexistent" not found');
    });

    it("throws if session is not active", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;
      await finishSession(db, session.session.id);

      await expect(
        logSet(db, seId, 0, 0, {
          performedWeightKg: 80,
          performedReps: 10,
          performedDurationSec: null,
          performedDistanceM: null,
        })
      ).rejects.toThrow('session .* is "finished"');
    });

    it("throws if blockIndex is out of range", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      await expect(
        logSet(db, seId, 5, 0, {
          performedWeightKg: 80,
          performedReps: 10,
          performedDurationSec: null,
          performedDistanceM: null,
        })
      ).rejects.toThrow("Block index 5 out of range");
    });
  });

  // =====================================================================
  // editSet
  // =====================================================================

  describe("editSet", () => {
    it("updates performed values and sets updatedAt", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const original = await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      const edited = await editSet(db, original.id, {
        performedWeightKg: 85,
        performedReps: 8,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      expect(edited.id).toBe(original.id);
      expect(edited.performedWeightKg).toBe(85);
      expect(edited.performedReps).toBe(8);
      expect(edited.updatedAt).not.toBe(original.updatedAt);

      // Verify persistence
      const stored = await db.loggedSets.get(original.id);
      expect(stored!.performedWeightKg).toBe(85);
    });

    it("works on sets from finished sessions", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const logged = await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });
      await finishSession(db, session.session.id);

      // Edit after finish should succeed
      const edited = await editSet(db, logged.id, {
        performedWeightKg: 82.5,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });
      expect(edited.performedWeightKg).toBe(82.5);
    });

    it("throws if loggedSet does not exist", async () => {
      await expect(
        editSet(db, "nonexistent", {
          performedWeightKg: 80,
          performedReps: 10,
          performedDurationSec: null,
          performedDistanceM: null,
        })
      ).rejects.toThrow('LoggedSet "nonexistent" not found');
    });
  });

  // =====================================================================
  // deleteSet
  // =====================================================================

  describe("deleteSet", () => {
    it("removes the logged set row", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const logged = await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      await deleteSet(db, logged.id);

      const stored = await db.loggedSets.get(logged.id);
      expect(stored).toBeUndefined();
    });

    it("does not affect other logged sets", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const set1 = await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 12,
        performedDurationSec: null,
        performedDistanceM: null,
      });
      const set2 = await logSet(db, seId, 0, 1, {
        performedWeightKg: 80,
        performedReps: 11,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      await deleteSet(db, set1.id);

      expect(await db.loggedSets.get(set1.id)).toBeUndefined();
      expect(await db.loggedSets.get(set2.id)).toBeDefined();
    });

    it("works on sets from finished sessions", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const logged = await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });
      await finishSession(db, session.session.id);

      // Delete after finish should succeed
      await deleteSet(db, logged.id);
      expect(await db.loggedSets.get(logged.id)).toBeUndefined();
    });

    it("does not change session snapshot structure", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      const logged = await logSet(db, seId, 0, 0, {
        performedWeightKg: 80,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      await deleteSet(db, logged.id);

      // Session exercise still exists with its snapshot
      const se = await db.sessionExercises.get(seId);
      expect(se).toBeDefined();
      expect(se!.setBlocksSnapshot).toHaveLength(1);
    });

    it("throws if loggedSet does not exist", async () => {
      await expect(deleteSet(db, "nonexistent")).rejects.toThrow(
        'LoggedSet "nonexistent" not found'
      );
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/set-service.test.ts
```

Expected: All tests pass (approximately 20 tests across 3 describe blocks).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/set-service.test.ts
git commit -m "$(cat <<'EOF'
test: add comprehensive set service tests covering log, edit, delete, invariant 9
EOF
)"
```

---

### Task 6: Integration test -- full session lifecycle

**Files:**
- Create: `web/tests/unit/services/session-lifecycle.test.ts`

This test exercises the complete session lifecycle end-to-end: start, log sets, add extra, finish, resume, discard. It covers acceptance test scenarios 4-7, 9, 11-13 from spec section 16.

- [ ] **Step 1: Create the integration test file**

Create `web/tests/unit/services/session-lifecycle.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Dexie from "dexie";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  startSessionWithCatalog,
  resumeSession,
  discardSession,
  finishSession,
  addExtraExercise,
} from "@/services/session-service";
import { logSet, editSet, deleteSet } from "@/services/set-service";
import {
  hasActiveSession,
  setActiveRoutine,
  deleteRoutine,
} from "@/services/settings-service";
import type { Exercise, Routine, RoutineEntry, SetBlock } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExercise(id: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: id
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
    ...overrides,
  };
}

const STANDARD_BLOCK: SetBlock = {
  targetKind: "reps",
  minValue: 8,
  maxValue: 12,
  count: 3,
};

const TOP_SET_BLOCK: SetBlock = {
  targetKind: "reps",
  minValue: 6,
  maxValue: 8,
  count: 1,
  tag: "top",
};

function makeFullRoutine(): Routine {
  return {
    id: "r1",
    schemaVersion: 1,
    name: "Full Body 3-Day",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A", "B", "C"],
    nextDayId: "A",
    days: {
      A: {
        id: "A",
        label: "Heavy Squat + Push/Pull",
        entries: [
          {
            kind: "exercise",
            entryId: "A-e0",
            exerciseId: "barbell-back-squat",
            setBlocks: [TOP_SET_BLOCK, STANDARD_BLOCK],
            notes: "Warm up with 2 lighter sets",
          },
          {
            kind: "exercise",
            entryId: "A-e1",
            exerciseId: "leg-curl",
            setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 2 }],
          },
          {
            kind: "superset",
            groupId: "A-e2-group",
            items: [
              {
                entryId: "A-e2-s0",
                exerciseId: "dumbbell-bench-press",
                setBlocks: [STANDARD_BLOCK],
              },
              {
                entryId: "A-e2-s1",
                exerciseId: "dumbbell-row",
                setBlocks: [STANDARD_BLOCK],
                notes: "Each arm",
              },
            ],
          },
        ],
      },
      B: {
        id: "B",
        label: "Moderate Hinge",
        entries: [
          {
            kind: "exercise",
            entryId: "B-e0",
            exerciseId: "barbell-back-squat",
            setBlocks: [STANDARD_BLOCK],
          },
        ],
      },
      C: {
        id: "C",
        label: "Unilateral",
        entries: [
          {
            kind: "exercise",
            entryId: "C-e0",
            exerciseId: "leg-curl",
            setBlocks: [STANDARD_BLOCK],
          },
        ],
      },
    },
    notes: ["Rotation is continuous: A-B-C regardless of training days per week."],
    cardio: null,
    importedAt: "2026-03-28T12:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("session lifecycle integration", () => {
  let db: ExerciseLoggerDB;

  beforeEach(async () => {
    db = new ExerciseLoggerDB();
    await initializeSettings(db);
    await db.exercises.bulkAdd([
      makeExercise("barbell-back-squat"),
      makeExercise("leg-curl", { equipment: "machine" }),
      makeExercise("dumbbell-bench-press", { equipment: "dumbbell", muscleGroups: ["Chest"] }),
      makeExercise("dumbbell-row", { equipment: "dumbbell", muscleGroups: ["Back"] }),
      makeExercise("tricep-pushdown", { equipment: "cable", muscleGroups: ["Arms"] }),
      makeExercise("pull-up", { type: "bodyweight", equipment: "bodyweight", muscleGroups: ["Back"] }),
    ]);
  });

  afterEach(async () => {
    await db.delete();
  });

  // --- Scenario 4: Starting a workout creates full snapshot ---

  it("scenario 4: starting a workout creates a full session snapshot", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);

    const result = await startSessionWithCatalog(db, routine, "A");

    // Verify session snapshot
    expect(result.session.routineNameSnapshot).toBe("Full Body 3-Day");
    expect(result.session.dayLabelSnapshot).toBe("Heavy Squat + Push/Pull");
    expect(result.session.dayOrderSnapshot).toEqual(["A", "B", "C"]);
    expect(result.session.restDefaultSecSnapshot).toBe(90);
    expect(result.session.restSupersetSecSnapshot).toBe(60);

    // 4 session exercises: squat, leg curl, bench (superset), row (superset)
    expect(result.sessionExercises).toHaveLength(4);

    // Squat has 2 set blocks
    const squat = result.sessionExercises.find(
      (se) => se.exerciseId === "barbell-back-squat"
    )!;
    expect(squat.setBlocksSnapshot).toHaveLength(2);
    expect(squat.notesSnapshot).toBe("Warm up with 2 lighter sets");

    // Superset pair shares a groupId
    const bench = result.sessionExercises.find(
      (se) => se.exerciseId === "dumbbell-bench-press"
    )!;
    const row = result.sessionExercises.find(
      (se) => se.exerciseId === "dumbbell-row"
    )!;
    expect(bench.supersetGroupId).toBe(row.supersetGroupId);
    expect(row.notesSnapshot).toBe("Each arm");
  });

  // --- Scenario 5: Resume active session ---

  it("scenario 5: relaunching with active session resumes the same session", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);

    const original = await startSessionWithCatalog(db, routine, "A");

    // Log a set
    const seId = original.sessionExercises[0]!.id;
    await logSet(db, seId, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // "Relaunch" by resuming
    const resumed = await resumeSession(db);
    expect(resumed).not.toBeNull();
    expect(resumed!.session.id).toBe(original.session.id);
    expect(resumed!.sessionExercises).toHaveLength(4);
    expect(resumed!.loggedSets).toHaveLength(1);
    expect(resumed!.loggedSets[0]!.performedWeightKg).toBe(100);
  });

  // --- Scenario 6: Day override ---

  it("scenario 6: day override works correctly", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);

    // Suggested day is A, but user starts B
    const session = await startSessionWithCatalog(db, routine, "B");
    expect(session.session.dayId).toBe("B");

    await finishSession(db, session.session.id);

    // nextDayId should be C (the day after B)
    const updatedRoutine = await db.routines.get("r1");
    expect(updatedRoutine!.nextDayId).toBe("C");
  });

  // --- Scenario 7: Routine switching preserves rotation ---

  it("scenario 7: switching active routines preserves each routine's nextDayId", async () => {
    const routine1 = makeFullRoutine();
    const routine2: Routine = {
      ...makeFullRoutine(),
      id: "r2",
      name: "Other Routine",
      dayOrder: ["X", "Y"],
      nextDayId: "X",
      days: {
        X: { id: "X", label: "Day X", entries: [] },
        Y: { id: "Y", label: "Day Y", entries: [] },
      },
      importedAt: "2026-03-29T12:00:00.000Z",
    };
    await db.routines.bulkAdd([routine1, routine2]);

    // Work routine 1: start A, finish -> nextDayId becomes B
    const s1 = await startSessionWithCatalog(db, routine1, "A");
    await finishSession(db, s1.session.id);

    let r1 = await db.routines.get("r1");
    expect(r1!.nextDayId).toBe("B");

    // Activate routine 2 and start X
    await setActiveRoutine(db, "r2");
    const s2 = await startSessionWithCatalog(db, routine2, "X");
    await finishSession(db, s2.session.id);

    let r2 = await db.routines.get("r2");
    expect(r2!.nextDayId).toBe("Y");

    // Routine 1 still has nextDayId = B
    r1 = await db.routines.get("r1");
    expect(r1!.nextDayId).toBe("B");
  });

  // --- Scenario 9: Extra exercises ---

  it("scenario 9: extras can be added and logged but excluded from routine progression", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);
    const session = await startSessionWithCatalog(db, routine, "A");

    // Add extra exercise
    const extra = await addExtraExercise(
      db,
      session.session.id,
      "tricep-pushdown"
    );
    expect(extra.origin).toBe("extra");
    expect(extra.setBlocksSnapshot).toEqual([]);

    // Log a set for the extra
    const logged = await logSet(db, extra.id, 0, 0, {
      performedWeightKg: 30,
      performedReps: 15,
      performedDurationSec: null,
      performedDistanceM: null,
    });
    expect(logged.origin).toBe("extra");
    expect(logged.blockSignature).toBe("extra:0:count0:tagnormal");

    // Finish session
    await finishSession(db, session.session.id);

    // Verify extra is persisted with correct origin
    const allSets = await db.loggedSets.toArray();
    const extraSets = allSets.filter((s) => s.origin === "extra");
    expect(extraSets).toHaveLength(1);
  });

  // --- Scenario 11: Edit and delete sets ---

  it("scenario 11: editing a set updates history without duplicates", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);
    const session = await startSessionWithCatalog(db, routine, "A");
    const seId = session.sessionExercises[0]!.id;

    // Log a set
    const logged = await logSet(db, seId, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Edit it
    const edited = await editSet(db, logged.id, {
      performedWeightKg: 102.5,
      performedReps: 6,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    expect(edited.id).toBe(logged.id);
    expect(edited.performedWeightKg).toBe(102.5);
    expect(edited.performedReps).toBe(6);

    // No duplicates
    const all = await db.loggedSets.toArray();
    expect(all).toHaveLength(1);
  });

  it("scenario 11: deleting a set removes it from history", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);
    const session = await startSessionWithCatalog(db, routine, "A");
    const seId = session.sessionExercises[0]!.id;

    const logged = await logSet(db, seId, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    await deleteSet(db, logged.id);
    expect(await db.loggedSets.count()).toBe(0);
  });

  // --- Scenario 12: Discard does not advance rotation ---

  it("scenario 12: discarding removes records and does not advance rotation", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);

    const session = await startSessionWithCatalog(db, routine, "A");

    // Log some sets
    const seId = session.sessionExercises[0]!.id;
    await logSet(db, seId, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Add an extra
    await addExtraExercise(db, session.session.id, "tricep-pushdown");

    await discardSession(db, session.session.id);

    // Everything gone
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sessionExercises.count()).toBe(0);
    expect(await db.loggedSets.count()).toBe(0);

    // Rotation not advanced
    const r = await db.routines.get("r1");
    expect(r!.nextDayId).toBe("A");
  });

  // --- Scenario 13: Partial finish allowed ---

  it("scenario 13: finishing a partial workout is allowed and history is valid", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);

    const session = await startSessionWithCatalog(db, routine, "A");
    const seId = session.sessionExercises[0]!.id;

    // Log only 1 of 4 possible sets (top set + 3 back-off)
    await logSet(db, seId, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    await finishSession(db, session.session.id);

    // Session is finished
    const s = await db.sessions.get(session.session.id);
    expect(s!.status).toBe("finished");

    // Only 1 logged set
    const sets = await db.loggedSets
      .where("sessionId")
      .equals(session.session.id)
      .toArray();
    expect(sets).toHaveLength(1);

    // All 4 session exercises still exist (snapshot intact)
    const ses = await db.sessionExercises
      .where("sessionId")
      .equals(session.session.id)
      .toArray();
    expect(ses).toHaveLength(4);
  });

  // --- Invariant 13: Routine guard during active session ---

  it("invariant 13: blocks routine activation during active session", async () => {
    const routine = makeFullRoutine();
    const routine2: Routine = {
      ...makeFullRoutine(),
      id: "r2",
      name: "Other",
      importedAt: "2026-03-29T12:00:00.000Z",
    };
    await db.routines.bulkAdd([routine, routine2]);

    await startSessionWithCatalog(db, routine, "A");

    await expect(setActiveRoutine(db, "r2")).rejects.toThrow(
      "Cannot change active routine while a workout session is active"
    );
  });

  it("invariant 13: blocks routine deletion during active session", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);

    await startSessionWithCatalog(db, routine, "A");

    await expect(deleteRoutine(db, "r1")).rejects.toThrow(
      "Cannot delete a routine while a workout session is active"
    );
  });

  // --- Full lifecycle ---

  it("full lifecycle: start -> log -> add extra -> log extra -> finish -> verify", async () => {
    const routine = makeFullRoutine();
    await db.routines.add(routine);

    // Start
    const session = await startSessionWithCatalog(db, routine, "A");
    expect(session.session.status).toBe("active");

    // Log sets for squat top set
    const squat = session.sessionExercises.find(
      (se) => se.exerciseId === "barbell-back-squat"
    )!;
    await logSet(db, squat.id, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Log sets for squat back-off
    await logSet(db, squat.id, 1, 0, {
      performedWeightKg: 80,
      performedReps: 12,
      performedDurationSec: null,
      performedDistanceM: null,
    });
    await logSet(db, squat.id, 1, 1, {
      performedWeightKg: 80,
      performedReps: 11,
      performedDurationSec: null,
      performedDistanceM: null,
    });
    await logSet(db, squat.id, 1, 2, {
      performedWeightKg: 80,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Add extra exercise
    const extra = await addExtraExercise(
      db,
      session.session.id,
      "pull-up"
    );
    await logSet(db, extra.id, 0, 0, {
      performedWeightKg: null,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Finish
    await finishSession(db, session.session.id);

    // Verify final state
    const finalSession = await db.sessions.get(session.session.id);
    expect(finalSession!.status).toBe("finished");
    expect(finalSession!.finishedAt).not.toBeNull();

    const allSets = await db.loggedSets
      .where("sessionId")
      .equals(session.session.id)
      .toArray();
    expect(allSets).toHaveLength(5); // 1 top + 3 back-off + 1 extra

    // 5 session exercises total (4 from routine + 1 extra)
    const allExercises = await db.sessionExercises
      .where("sessionId")
      .equals(session.session.id)
      .toArray();
    expect(allExercises).toHaveLength(5);

    // Rotation advanced to B
    const updatedRoutine = await db.routines.get("r1");
    expect(updatedRoutine!.nextDayId).toBe("B");
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/session-lifecycle.test.ts
```

Expected: All tests pass (approximately 12 tests).

- [ ] **Step 3: Run all Phase 4 tests together**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/settings-service.test.ts tests/unit/services/session-service.test.ts tests/unit/services/set-service.test.ts tests/unit/services/session-lifecycle.test.ts
```

Expected: All tests pass (approximately 75 tests total).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/session-lifecycle.test.ts
git commit -m "$(cat <<'EOF'
test: add integration tests for full session lifecycle (scenarios 4-7, 9, 11-13)
EOF
)"
```

---

### ~~Task 7: Clean up unused startSession function~~ [DELETED]

> **Deleted.** The rename from `startSessionWithCatalog` to `startSession` was removed to avoid breaking ~15+ call sites in Phases 6 and 7 that import `startSessionWithCatalog`. The canonical public API name remains `startSessionWithCatalog`. The original `startSession` (without catalog resolution) and its helpers (`buildSessionExercises`, `buildSingleSessionExercise`) are dead code but harmless; they can be cleaned up opportunistically.

---

## Self-Review

### 1. Spec coverage

| Spec requirement | Task(s) | Status |
|---|---|---|
| Start session with snapshot | Task 2, Task 4 | Covered |
| Resume session | Task 2, Task 4 | Covered |
| Discard session (hard delete, no rotation advance) | Task 2, Task 4, Task 6 | Covered |
| Finish session (set status, finishedAt, advance rotation) | Task 2, Task 4, Task 6 | Covered |
| Day override (start non-suggested, advance to day after override) | Task 4, Task 6 | Covered |
| Add extra exercise (origin=extra, no setBlocks, active only) | Task 2, Task 4, Task 6 | Covered |
| Log set (create/update keyed by [seId, blockIndex, setIndex]) | Task 3, Task 5 | Covered |
| Edit set (update existing, set updatedAt) | Task 3, Task 5 | Covered |
| Delete set (remove loggedSet row) | Task 3, Task 5 | Covered |
| Weighted bodyweight detection (typeOverride, equipmentOverride) | Task 2, Task 4 | Covered |
| Weighted bodyweight runtime detection (promote effectiveType on non-null weight) | Task 3 | Covered |
| Guard: routine activation blocked during active session | Task 1, Task 6 | Covered |
| Guard: routine deletion blocked during active session | Task 1, Task 6 | Covered |
| instanceLabel stored as "" not null in loggedSets | Task 3, Task 5 | Covered |
| Invariant 1 (zero or one active session) | Task 2, Task 4 | Covered |
| Invariant 3 (nextDayId updated only on finish) | Task 2, Task 4, Task 6 | Covered |
| Invariant 4 (discard must not advance rotation) | Task 2, Task 4, Task 6 | Covered |
| Invariant 5 (finished sessions renderable after deletion) | Task 4 | Covered |
| Invariant 6 (extras only during active session) | Task 2, Task 4 | Covered |
| Invariant 9 (set log edits existing slot, no duplicates) | Task 3, Task 5 | Covered |
| Invariant 13 (routine activation/deletion blocked) | Task 1, Task 6 | Covered |
| Acceptance scenarios 4-7, 9, 11-13 | Task 6 | Covered |

### 2. Placeholder scan

No instances of "TBD", "TODO", "similar to above", or "..." placeholders found. All code blocks are complete.

### 3. Type/import consistency with Phase 2-3

- All types imported from `@/domain/types`: `Session`, `SessionExercise`, `LoggedSet`, `Routine`, `RoutineEntry`, `RoutineExerciseEntry`, `Exercise`, `Settings`, `SetBlock` -- all defined in Phase 2
- All enums imported from `@/domain/enums`: `SessionStatus`, `SessionExerciseOrigin`, `GroupType`, `ExerciseType`, `ExerciseEquipment`, `TargetKind`, `SetTag`, `UnitSystem`, `ThemePreference` -- all defined in Phase 2
- Database imported from `@/db/database`: `ExerciseLoggerDB`, `initializeSettings`, `DEFAULT_SETTINGS` -- all defined in Phase 2
- Helpers imported from `@/domain/uuid` (`generateId`), `@/domain/timestamp` (`nowISO`), `@/domain/block-signature` (`generateBlockSignature`) -- all defined in Phase 2
- `startSessionWithCatalog` and other session-service functions match the `Routine` type structure exactly (using `routine.days[dayId]`, `entry.kind`, `entry.items`, etc.)
- `logSet` correctly uses `generateBlockSignature` from Phase 2 for block signature generation
- `instanceLabel` normalization (`null` -> `""`) documented and tested as specified in Phase 2 self-review section 4
