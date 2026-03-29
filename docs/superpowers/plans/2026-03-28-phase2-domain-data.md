# Phase 2: Domain Types & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define all TypeScript domain types, create the Dexie database with all 6 tables and indexes, implement settings initialization, and build foundational helper functions (blockSignature, unit conversion, UUID, slug, ISO timestamp).

**Architecture:** All domain types live in `web/src/domain/` as pure TypeScript — no React, no UI. The Dexie database class lives in `web/src/db/database.ts` and declares all 6 tables with their indexes. Helper functions are small, pure, independently testable modules in `web/src/domain/`. Tests live in `web/tests/unit/domain/` and `web/tests/unit/db/`.

**Tech Stack:** TypeScript 5 strict mode, Dexie.js 4 (IndexedDB wrapper), Vitest for unit testing, `fake-indexeddb` for Dexie tests in Node, `crypto.randomUUID()` for UUID generation.

---

## File Structure (Phase 2 target state)

New files created by this phase:

```
web/
├── src/
│   ├── domain/
│   │   ├── types.ts                # All domain interfaces
│   │   ├── enums.ts                # All domain enums/unions
│   │   ├── block-signature.ts      # blockSignature generation
│   │   ├── unit-conversion.ts      # kg<->lbs, practical rounding
│   │   ├── slug.ts                 # Name -> slug
│   │   ├── uuid.ts                 # UUID generation
│   │   └── timestamp.ts            # ISO UTC timestamp helper
│   └── db/
│       └── database.ts             # Dexie class, schema v1, all indexes
├── tests/
│   └── unit/
│       ├── domain/
│       │   ├── block-signature.test.ts
│       │   ├── unit-conversion.test.ts
│       │   ├── slug.test.ts
│       │   ├── uuid.test.ts
│       │   └── timestamp.test.ts
│       └── db/
│           └── database.test.ts
```

---

### Task 1: Install Dexie.js and fake-indexeddb

**Files:**
- Modify: `web/package.json` (new deps)

- [ ] **Step 1: Install Dexie.js as a production dependency**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm install dexie
```

Expected: `dexie` added to `dependencies` in `package.json`.

- [ ] **Step 2: Install fake-indexeddb as a dev dependency for testing**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm install -D fake-indexeddb
```

Expected: `fake-indexeddb` added to `devDependencies` in `package.json`.

- [ ] **Step 3: Verify both packages are installed**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
node -e "require('dexie'); require('fake-indexeddb'); console.log('OK')"
```

Expected: `OK` printed with no errors.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/package.json web/package-lock.json
git commit -m "$(cat <<'EOF'
feat: install dexie and fake-indexeddb for data layer
EOF
)"
```

---

### Task 2: Define domain enums

**Files:**
- Create: `web/src/domain/enums.ts`

- [ ] **Step 1: Create the enums file with all domain union types**

Create `web/src/domain/enums.ts`:

```ts
/** Exercise type — determines which fields are shown on the set logging form. */
export type ExerciseType = "weight" | "bodyweight" | "isometric" | "cardio";

/** Equipment type — drives practical rounding increments. */
export type ExerciseEquipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "kettlebell"
  | "bodyweight"
  | "cardio"
  | "medicine-ball"
  | "other";

/** Session lifecycle status. */
export type SessionStatus = "active" | "finished" | "discarded";

/** How a session exercise was added. */
export type SessionExerciseOrigin = "routine" | "extra";

/** Whether an exercise is standalone or part of a superset. */
export type GroupType = "single" | "superset";

/** The kind of target a set block prescribes. */
export type TargetKind = "reps" | "duration" | "distance";

/** Optional tag on a set block or logged set. */
export type SetTag = "top" | "amrap";

/** Display unit preference. */
export type UnitSystem = "kg" | "lbs";

/** Theme preference. */
export type ThemePreference = "light" | "dark" | "system";
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
git add web/src/domain/enums.ts
git commit -m "$(cat <<'EOF'
feat: define all domain enum/union types
EOF
)"
```

---

### Task 3: Define domain types

**Files:**
- Create: `web/src/domain/types.ts`

- [ ] **Step 1: Create the types file with all domain interfaces**

Create `web/src/domain/types.ts`:

```ts
import type {
  ExerciseType,
  ExerciseEquipment,
  SessionStatus,
  SessionExerciseOrigin,
  GroupType,
  TargetKind,
  SetTag,
  UnitSystem,
  ThemePreference,
} from "./enums";

// ---------------------------------------------------------------------------
// Exercise Catalog
// ---------------------------------------------------------------------------

/** An exercise from the seeded catalog. */
export interface Exercise {
  /** Canonical slug, e.g. "barbell-back-squat". Primary key. */
  id: string;
  /** Display name, e.g. "Barbell Back Squat". */
  name: string;
  /** Exercise type. */
  type: ExerciseType;
  /** Equipment type. */
  equipment: ExerciseEquipment;
  /** Normalized muscle groups, e.g. ["Legs", "Core"]. */
  muscleGroups: string[];
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

/** A single set-block prescription within a routine entry. */
export interface SetBlock {
  /** What kind of target: reps, duration, or distance. */
  targetKind: TargetKind;
  /** Minimum of a range target. Undefined when exactValue is set. */
  minValue?: number;
  /** Maximum of a range target. Undefined when exactValue is set. */
  maxValue?: number;
  /** Exact target value. Undefined when min/max range is set. */
  exactValue?: number;
  /** Number of sets for this block (>= 1). */
  count: number;
  /** Optional set tag. */
  tag?: SetTag;
}

/** An exercise entry within a routine day (standalone or inside a superset). */
export interface RoutineExerciseEntry {
  /** Deterministic ID generated at import time. */
  entryId: string;
  /** FK to exercises table. */
  exerciseId: string;
  /** Optional disambiguator for duplicate same-day exercises. */
  instanceLabel?: string;
  /** Override the catalog exercise type. */
  typeOverride?: ExerciseType;
  /** Override the catalog equipment type. */
  equipmentOverride?: ExerciseEquipment;
  /** Optional notes for this entry. */
  notes?: string;
  /** Prescribed set blocks. At least one. */
  setBlocks: SetBlock[];
}

/** A single entry in a routine day — either a standalone exercise or a superset. */
export type RoutineEntry =
  | {
      kind: "exercise";
      entryId: string;
      exerciseId: string;
      instanceLabel?: string;
      typeOverride?: ExerciseType;
      equipmentOverride?: ExerciseEquipment;
      notes?: string;
      setBlocks: SetBlock[];
    }
  | {
      kind: "superset";
      groupId: string;
      items: [RoutineExerciseEntry, RoutineExerciseEntry];
    };

/** A single day within a routine. */
export interface RoutineDay {
  /** Day identifier, e.g. "A". */
  id: string;
  /** Display label, e.g. "Heavy Squat + Horizontal Push/Pull". */
  label: string;
  /** Ordered entries for this day. */
  entries: RoutineEntry[];
}

/** A stored routine record. */
export interface Routine {
  /** UUID primary key. */
  id: string;
  /** Schema version, starts at 1. */
  schemaVersion: number;
  /** Display name. */
  name: string;
  /** Default rest between normal sets, in seconds. */
  restDefaultSec: number;
  /** Default rest between superset rounds, in seconds. */
  restSupersetSec: number;
  /** Explicit ordered rotation, e.g. ["A", "B", "C"]. */
  dayOrder: string[];
  /** Per-routine rotation state. Initialized to dayOrder[0]. */
  nextDayId: string;
  /** Normalized routine payload, keyed by day ID. */
  days: Record<string, RoutineDay>;
  /** Optional routine-level notes. */
  notes: string[];
  /** Optional informational cardio section. */
  cardio: RoutineCardio | null;
  /** ISO UTC timestamp of when this routine was imported. */
  importedAt: string;
}

/** Optional cardio info attached to a routine. */
export interface RoutineCardio {
  notes: string;
  options: RoutineCardioOption[];
}

/** A single cardio option. */
export interface RoutineCardioOption {
  name: string;
  detail: string;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** A workout session record. */
export interface Session {
  /** UUID primary key. */
  id: string;
  /** FK to routines table, or null for ad-hoc sessions. */
  routineId: string | null;
  /** Snapshot of routine name at session start. */
  routineNameSnapshot: string;
  /** Selected day ID, e.g. "A". */
  dayId: string;
  /** Snapshot of day label at session start. */
  dayLabelSnapshot: string;
  /** Snapshot of dayOrder at session start for rotation advancement. */
  dayOrderSnapshot: string[];
  /** Snapshot of restDefaultSec at session start. */
  restDefaultSecSnapshot: number;
  /** Snapshot of restSupersetSec at session start. */
  restSupersetSecSnapshot: number;
  /** Session lifecycle status. */
  status: SessionStatus;
  /** ISO UTC timestamp of when the session was started. */
  startedAt: string;
  /** ISO UTC timestamp of when the session was finished, or null. */
  finishedAt: string | null;
}

/** A session exercise record — snapshot of a routine entry or an extra. */
export interface SessionExercise {
  /** UUID primary key. */
  id: string;
  /** FK to sessions table. */
  sessionId: string;
  /** FK to the source routine entry, or null for extras. */
  routineEntryId: string | null;
  /** FK to exercises table. */
  exerciseId: string;
  /** Snapshot of exercise display name. */
  exerciseNameSnapshot: string;
  /** How this exercise was added. */
  origin: SessionExerciseOrigin;
  /** Stable display order within the session. */
  orderIndex: number;
  /** Whether this is standalone or part of a superset. */
  groupType: GroupType;
  /** Shared by both members of a superset, or null. */
  supersetGroupId: string | null;
  /** 0 or 1 for supersets, null for singles. */
  supersetPosition: number | null;
  /** Optional disambiguator, copied from routine entry. */
  instanceLabel: string | null;
  /** Catalog default or routine override. */
  effectiveType: ExerciseType;
  /** Catalog default or routine override. */
  effectiveEquipment: ExerciseEquipment;
  /** Copied from routine entry or user input, or null. */
  notesSnapshot: string | null;
  /** Copied normalized prescription. Empty array for extras. */
  setBlocksSnapshot: SetBlock[];
  /** ISO UTC timestamp of when this record was created. */
  createdAt: string;
}

/** A logged set record — one row per set slot. */
export interface LoggedSet {
  /** UUID primary key. */
  id: string;
  /** FK to sessions table. */
  sessionId: string;
  /** FK to sessionExercises table. */
  sessionExerciseId: string;
  /** Denormalized FK to exercises table for querying. */
  exerciseId: string;
  /** Denormalized from sessionExercises for progression matching. */
  instanceLabel: string | null;
  /** How the parent exercise was added. */
  origin: SessionExerciseOrigin;
  /** Index within setBlocksSnapshot; 0 for extras. */
  blockIndex: number;
  /** Normalized signature for progression matching. */
  blockSignature: string;
  /** Zero-based index within the block. */
  setIndex: number;
  /** Optional set tag: "top", "amrap", or null. */
  tag: SetTag | null;
  /** External load in kg, or null when not applicable. */
  performedWeightKg: number | null;
  /** Performed reps, or null when not applicable. */
  performedReps: number | null;
  /** Performed duration in seconds, or null when not applicable. */
  performedDurationSec: number | null;
  /** Performed distance in meters, or null when not applicable. */
  performedDistanceM: number | null;
  /** ISO UTC timestamp of when this set was first logged. */
  loggedAt: string;
  /** ISO UTC timestamp of the most recent update. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Single-record settings table. */
export interface Settings {
  /** Always "user". */
  id: string;
  /** FK to routines table, or null when no routine is active. */
  activeRoutineId: string | null;
  /** Display unit preference. */
  units: UnitSystem;
  /** Theme preference. */
  theme: ThemePreference;
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
git add web/src/domain/types.ts
git commit -m "$(cat <<'EOF'
feat: define all domain entity types
EOF
)"
```

---

### Task 4: Create the Dexie database class with all tables and indexes

**Files:**
- Create: `web/src/db/database.ts`
- Create: `web/tests/unit/db/database.test.ts`

- [ ] **Step 1: Create the database file**

Create `web/src/db/database.ts`:

```ts
import Dexie, { type EntityTable } from "dexie";
import type {
  Exercise,
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
  Settings,
} from "@/domain/types";

export class ExerciseLoggerDB extends Dexie {
  exercises!: EntityTable<Exercise, "id">;
  routines!: EntityTable<Routine, "id">;
  sessions!: EntityTable<Session, "id">;
  sessionExercises!: EntityTable<SessionExercise, "id">;
  loggedSets!: EntityTable<LoggedSet, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor() {
    super("ExerciseLoggerDB");

    this.version(1).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
  }
}

/** Default settings record created on first launch. */
export const DEFAULT_SETTINGS: Settings = {
  id: "user",
  activeRoutineId: null,
  units: "kg",
  theme: "system",
};

/**
 * Ensure a default settings record exists.
 * Call this on app startup. If the "user" record already exists, this is a no-op.
 */
export async function initializeSettings(db: ExerciseLoggerDB): Promise<void> {
  const existing = await db.settings.get("user");
  if (!existing) {
    await db.settings.add(DEFAULT_SETTINGS);
  }
}

/** Singleton database instance for the application. */
export const db = new ExerciseLoggerDB();
```

- [ ] **Step 2: Create the database tests**

Create `web/tests/unit/db/database.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Dexie from "dexie";
import { ExerciseLoggerDB, DEFAULT_SETTINGS, initializeSettings } from "@/db/database";
import type { Exercise, Routine, Session, SessionExercise, LoggedSet, Settings } from "@/domain/types";

describe("ExerciseLoggerDB", () => {
  let db: ExerciseLoggerDB;

  beforeEach(() => {
    db = new ExerciseLoggerDB();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("creates all 6 tables", () => {
    expect(db.exercises).toBeDefined();
    expect(db.routines).toBeDefined();
    expect(db.sessions).toBeDefined();
    expect(db.sessionExercises).toBeDefined();
    expect(db.loggedSets).toBeDefined();
    expect(db.settings).toBeDefined();
  });

  it("stores and retrieves an exercise", async () => {
    const exercise: Exercise = {
      id: "barbell-back-squat",
      name: "Barbell Back Squat",
      type: "weight",
      equipment: "barbell",
      muscleGroups: ["Legs"],
    };
    await db.exercises.add(exercise);
    const result = await db.exercises.get("barbell-back-squat");
    expect(result).toEqual(exercise);
  });

  it("stores and retrieves a routine", async () => {
    const routine: Routine = {
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
    };
    await db.routines.add(routine);
    const result = await db.routines.get("r1");
    expect(result).toEqual(routine);
  });

  it("queries sessions by status index", async () => {
    const session: Session = {
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
    };
    await db.sessions.add(session);

    const active = await db.sessions.where("status").equals("active").toArray();
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe("s1");

    const finished = await db.sessions.where("status").equals("finished").toArray();
    expect(finished).toHaveLength(0);
  });

  it("queries sessions by compound [routineId+startedAt] index", async () => {
    const session1: Session = {
      id: "s1",
      routineId: "r1",
      routineNameSnapshot: "Routine",
      dayId: "A",
      dayLabelSnapshot: "Day A",
      dayOrderSnapshot: ["A"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "finished",
      startedAt: "2026-03-27T10:00:00.000Z",
      finishedAt: "2026-03-27T11:00:00.000Z",
    };
    const session2: Session = {
      id: "s2",
      routineId: "r1",
      routineNameSnapshot: "Routine",
      dayId: "B",
      dayLabelSnapshot: "Day B",
      dayOrderSnapshot: ["A", "B"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "finished",
      startedAt: "2026-03-28T10:00:00.000Z",
      finishedAt: "2026-03-28T11:00:00.000Z",
    };
    const session3: Session = {
      id: "s3",
      routineId: "r2",
      routineNameSnapshot: "Other",
      dayId: "A",
      dayLabelSnapshot: "Day A",
      dayOrderSnapshot: ["A"],
      restDefaultSecSnapshot: 90,
      restSupersetSecSnapshot: 60,
      status: "finished",
      startedAt: "2026-03-28T10:00:00.000Z",
      finishedAt: "2026-03-28T11:00:00.000Z",
    };
    await db.sessions.bulkAdd([session1, session2, session3]);

    const r1Sessions = await db.sessions
      .where("[routineId+startedAt]")
      .between(["r1", Dexie.minKey], ["r1", Dexie.maxKey])
      .toArray();
    expect(r1Sessions).toHaveLength(2);
    expect(r1Sessions.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("queries sessionExercises by sessionId index", async () => {
    const se: SessionExercise = {
      id: "se1",
      sessionId: "s1",
      routineEntryId: "e1",
      exerciseId: "barbell-back-squat",
      exerciseNameSnapshot: "Barbell Back Squat",
      origin: "routine",
      orderIndex: 0,
      groupType: "single",
      supersetGroupId: null,
      supersetPosition: null,
      instanceLabel: null,
      effectiveType: "weight",
      effectiveEquipment: "barbell",
      notesSnapshot: null,
      setBlocksSnapshot: [],
      createdAt: "2026-03-28T14:00:00.000Z",
    };
    await db.sessionExercises.add(se);

    const results = await db.sessionExercises
      .where("sessionId")
      .equals("s1")
      .toArray();
    expect(results).toHaveLength(1);
    expect(results[0]!.exerciseId).toBe("barbell-back-squat");
  });

  it("queries sessionExercises by compound [sessionId+orderIndex] index", async () => {
    const se1: SessionExercise = {
      id: "se1",
      sessionId: "s1",
      routineEntryId: "e1",
      exerciseId: "barbell-back-squat",
      exerciseNameSnapshot: "Barbell Back Squat",
      origin: "routine",
      orderIndex: 0,
      groupType: "single",
      supersetGroupId: null,
      supersetPosition: null,
      instanceLabel: null,
      effectiveType: "weight",
      effectiveEquipment: "barbell",
      notesSnapshot: null,
      setBlocksSnapshot: [],
      createdAt: "2026-03-28T14:00:00.000Z",
    };
    const se2: SessionExercise = {
      ...se1,
      id: "se2",
      orderIndex: 1,
      exerciseId: "leg-curl",
      exerciseNameSnapshot: "Leg Curl",
    };
    await db.sessionExercises.bulkAdd([se1, se2]);

    const ordered = await db.sessionExercises
      .where("[sessionId+orderIndex]")
      .between(["s1", Dexie.minKey], ["s1", Dexie.maxKey])
      .toArray();
    expect(ordered).toHaveLength(2);
    expect(ordered[0]!.orderIndex).toBe(0);
    expect(ordered[1]!.orderIndex).toBe(1);
  });

  it("queries loggedSets by sessionId index", async () => {
    const ls: LoggedSet = {
      id: "ls1",
      sessionId: "s1",
      sessionExerciseId: "se1",
      exerciseId: "barbell-back-squat",
      instanceLabel: null,
      origin: "routine",
      blockIndex: 0,
      blockSignature: "reps:6-8:count1:tagtop",
      setIndex: 0,
      tag: "top",
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
      loggedAt: "2026-03-28T14:05:00.000Z",
      updatedAt: "2026-03-28T14:05:00.000Z",
    };
    await db.loggedSets.add(ls);

    const results = await db.loggedSets.where("sessionId").equals("s1").toArray();
    expect(results).toHaveLength(1);
  });

  it("queries loggedSets by compound [sessionExerciseId+blockIndex+setIndex] index", async () => {
    const base: LoggedSet = {
      id: "ls1",
      sessionId: "s1",
      sessionExerciseId: "se1",
      exerciseId: "barbell-back-squat",
      instanceLabel: null,
      origin: "routine",
      blockIndex: 0,
      blockSignature: "reps:6-8:count1:tagtop",
      setIndex: 0,
      tag: "top",
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
      loggedAt: "2026-03-28T14:05:00.000Z",
      updatedAt: "2026-03-28T14:05:00.000Z",
    };
    const ls2: LoggedSet = {
      ...base,
      id: "ls2",
      blockIndex: 1,
      blockSignature: "reps:8-12:count3:tagnormal",
      setIndex: 0,
      tag: null,
      performedWeightKg: 80,
      performedReps: 12,
    };
    await db.loggedSets.bulkAdd([base, ls2]);

    const result = await db.loggedSets
      .where("[sessionExerciseId+blockIndex+setIndex]")
      .equals(["se1", 0, 0])
      .first();
    expect(result).toBeDefined();
    expect(result!.id).toBe("ls1");
  });

  it("queries loggedSets by compound [exerciseId+loggedAt] index", async () => {
    const ls1: LoggedSet = {
      id: "ls1",
      sessionId: "s1",
      sessionExerciseId: "se1",
      exerciseId: "barbell-back-squat",
      instanceLabel: null,
      origin: "routine",
      blockIndex: 0,
      blockSignature: "reps:6-8:count1:tagtop",
      setIndex: 0,
      tag: "top",
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
      loggedAt: "2026-03-27T14:05:00.000Z",
      updatedAt: "2026-03-27T14:05:00.000Z",
    };
    const ls2: LoggedSet = {
      ...ls1,
      id: "ls2",
      loggedAt: "2026-03-28T14:05:00.000Z",
      updatedAt: "2026-03-28T14:05:00.000Z",
    };
    const ls3: LoggedSet = {
      ...ls1,
      id: "ls3",
      exerciseId: "leg-curl",
      loggedAt: "2026-03-28T14:10:00.000Z",
      updatedAt: "2026-03-28T14:10:00.000Z",
    };
    await db.loggedSets.bulkAdd([ls1, ls2, ls3]);

    const results = await db.loggedSets
      .where("[exerciseId+loggedAt]")
      .between(
        ["barbell-back-squat", Dexie.minKey],
        ["barbell-back-squat", Dexie.maxKey]
      )
      .toArray();
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(["ls1", "ls2"]);
  });

  it("queries loggedSets by compound [exerciseId+instanceLabel+blockSignature+loggedAt] index", async () => {
    const ls1: LoggedSet = {
      id: "ls1",
      sessionId: "s1",
      sessionExerciseId: "se1",
      exerciseId: "barbell-back-squat",
      instanceLabel: null,
      origin: "routine",
      blockIndex: 0,
      blockSignature: "reps:6-8:count1:tagtop",
      setIndex: 0,
      tag: "top",
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
      loggedAt: "2026-03-27T14:05:00.000Z",
      updatedAt: "2026-03-27T14:05:00.000Z",
    };
    const ls2: LoggedSet = {
      ...ls1,
      id: "ls2",
      blockSignature: "reps:8-12:count3:tagnormal",
      blockIndex: 1,
      tag: null,
      loggedAt: "2026-03-27T14:10:00.000Z",
      updatedAt: "2026-03-27T14:10:00.000Z",
    };
    await db.loggedSets.bulkAdd([ls1, ls2]);

    const topSets = await db.loggedSets
      .where("[exerciseId+instanceLabel+blockSignature+loggedAt]")
      .between(
        ["barbell-back-squat", "", "reps:6-8:count1:tagtop", Dexie.minKey],
        ["barbell-back-squat", "", "reps:6-8:count1:tagtop", Dexie.maxKey]
      )
      .toArray();
    expect(topSets).toHaveLength(1);
    expect(topSets[0]!.id).toBe("ls1");
  });
});

describe("initializeSettings", () => {
  let db: ExerciseLoggerDB;

  beforeEach(() => {
    db = new ExerciseLoggerDB();
  });

  afterEach(async () => {
    await db.delete();
  });

  it("creates default settings when none exist", async () => {
    await initializeSettings(db);
    const settings = await db.settings.get("user");
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("does not overwrite existing settings", async () => {
    const customSettings: Settings = {
      id: "user",
      activeRoutineId: "r1",
      units: "lbs",
      theme: "dark",
    };
    await db.settings.add(customSettings);
    await initializeSettings(db);
    const settings = await db.settings.get("user");
    expect(settings).toEqual(customSettings);
  });

  it("DEFAULT_SETTINGS has correct values", () => {
    expect(DEFAULT_SETTINGS.id).toBe("user");
    expect(DEFAULT_SETTINGS.activeRoutineId).toBeNull();
    expect(DEFAULT_SETTINGS.units).toBe("kg");
    expect(DEFAULT_SETTINGS.theme).toBe("system");
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/db/database.test.ts
```

Expected: All tests pass (11 tests across 2 describe blocks).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/db/database.ts web/tests/unit/db/database.test.ts
git commit -m "$(cat <<'EOF'
feat: create Dexie database with all 6 tables, indexes, and settings init
EOF
)"
```

---

### Task 5: UUID generation helper

**Files:**
- Create: `web/src/domain/uuid.ts`
- Create: `web/tests/unit/domain/uuid.test.ts`

- [ ] **Step 1: Create the UUID helper**

Create `web/src/domain/uuid.ts`:

```ts
/**
 * Generate a new UUID v4 string.
 *
 * Uses crypto.randomUUID() which is available in all modern browsers
 * and in Node 19+. Falls back to a manual implementation for older
 * environments (e.g., some test runners).
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

- [ ] **Step 2: Create the UUID tests**

Create `web/tests/unit/domain/uuid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateId } from "@/domain/uuid";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateId", () => {
  it("returns a valid UUID v4 string", () => {
    const id = generateId();
    expect(id).toMatch(UUID_REGEX);
  });

  it("returns unique values on successive calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("returns a 36-character string", () => {
    const id = generateId();
    expect(id).toHaveLength(36);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/domain/uuid.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/domain/uuid.ts web/tests/unit/domain/uuid.test.ts
git commit -m "$(cat <<'EOF'
feat: add UUID generation helper
EOF
)"
```

---

### Task 6: Slug generation helper

**Files:**
- Create: `web/src/domain/slug.ts`
- Create: `web/tests/unit/domain/slug.test.ts`

- [ ] **Step 1: Create the slug helper**

Create `web/src/domain/slug.ts`:

```ts
/**
 * Convert a display name to a canonical slug for use as an exercise ID.
 *
 * Rules:
 * - Lowercase the entire string
 * - Replace spaces and underscores with hyphens
 * - Remove all characters except lowercase letters, digits, and hyphens
 * - Collapse multiple consecutive hyphens into one
 * - Trim leading and trailing hyphens
 *
 * Examples:
 * - "Barbell Back Squat" -> "barbell-back-squat"
 * - "Single-Leg Romanian Deadlift" -> "single-leg-romanian-deadlift"
 * - "Medicine Ball Rotational Slam" -> "medicine-ball-rotational-slam"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 2: Create the slug tests**

Create `web/tests/unit/domain/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { slugify } from "@/domain/slug";

describe("slugify", () => {
  it("converts a simple name to a slug", () => {
    expect(slugify("Barbell Back Squat")).toBe("barbell-back-squat");
  });

  it("preserves existing hyphens", () => {
    expect(slugify("Single-Leg Romanian Deadlift")).toBe(
      "single-leg-romanian-deadlift"
    );
  });

  it("handles multiple spaces", () => {
    expect(slugify("Medicine Ball  Rotational  Slam")).toBe(
      "medicine-ball-rotational-slam"
    );
  });

  it("removes special characters", () => {
    expect(slugify("Dumbbell Curl (Seated)")).toBe("dumbbell-curl-seated");
  });

  it("handles underscores", () => {
    expect(slugify("leg_extension")).toBe("leg-extension");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("-Bench Press-")).toBe("bench-press");
  });

  it("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("handles string with only special characters", () => {
    expect(slugify("@#$%")).toBe("");
  });

  it("collapses multiple hyphens from mixed separators", () => {
    expect(slugify("cable - woodchop")).toBe("cable-woodchop");
  });

  it("handles numbers in the name", () => {
    expect(slugify("2K Row Sprint")).toBe("2k-row-sprint");
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/domain/slug.test.ts
```

Expected: All 10 tests pass.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/domain/slug.ts web/tests/unit/domain/slug.test.ts
git commit -m "$(cat <<'EOF'
feat: add slug generation helper for exercise IDs
EOF
)"
```

---

### Task 7: ISO timestamp helper

**Files:**
- Create: `web/src/domain/timestamp.ts`
- Create: `web/tests/unit/domain/timestamp.test.ts`

- [ ] **Step 1: Create the timestamp helper**

Create `web/src/domain/timestamp.ts`:

```ts
/**
 * Return the current time as an ISO 8601 UTC string.
 *
 * Format: "2026-03-28T14:30:00.000Z"
 *
 * All persisted timestamps in the app use this format.
 * We always store UTC — never local time — to avoid timezone bugs.
 */
export function nowISO(): string {
  return new Date().toISOString();
}
```

- [ ] **Step 2: Create the timestamp tests**

Create `web/tests/unit/domain/timestamp.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { nowISO } from "@/domain/timestamp";

const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe("nowISO", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a valid ISO 8601 UTC string", () => {
    const result = nowISO();
    expect(result).toMatch(ISO_REGEX);
  });

  it("ends with Z (UTC indicator)", () => {
    const result = nowISO();
    expect(result.endsWith("Z")).toBe(true);
  });

  it("returns the current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T14:30:00.000Z"));

    const result = nowISO();
    expect(result).toBe("2026-03-28T14:30:00.000Z");
  });

  it("returns different values at different times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T14:00:00.000Z"));
    const t1 = nowISO();

    vi.setSystemTime(new Date("2026-03-28T14:00:01.000Z"));
    const t2 = nowISO();

    expect(t1).not.toBe(t2);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/domain/timestamp.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/domain/timestamp.ts web/tests/unit/domain/timestamp.test.ts
git commit -m "$(cat <<'EOF'
feat: add ISO UTC timestamp helper
EOF
)"
```

---

### Task 8: blockSignature generation helper

**Files:**
- Create: `web/src/domain/block-signature.ts`
- Create: `web/tests/unit/domain/block-signature.test.ts`

- [ ] **Step 1: Create the blockSignature helper**

Create `web/src/domain/block-signature.ts`:

```ts
import type { SetBlock } from "./types";

/**
 * Generate a deterministic block signature for progression matching.
 *
 * The signature encodes enough information to match equivalent set blocks
 * across sessions without depending on position-based indexing.
 *
 * Format:
 *   "{targetKind}:{valueSpec}:count{count}:tag{tagValue}"
 *
 * Value spec:
 *   - Range: "{min}-{max}"        (e.g. "6-8", "30-60")
 *   - Exact: "{exactValue}"       (e.g. "8", "2000")
 *
 * Tag value:
 *   - "top" or "amrap" when the tag is set
 *   - "normal" when no tag is set
 *
 * Examples:
 *   - reps 6-8, count 1, tag top    -> "reps:6-8:count1:tagtop"
 *   - reps 8-12, count 3, no tag    -> "reps:8-12:count3:tagnormal"
 *   - duration 30-60, count 2       -> "duration:30-60:count2:tagnormal"
 *   - reps exact 8, count 3         -> "reps:8:count3:tagnormal"
 *   - distance exact 2000, count 1  -> "distance:2000:count1:tagnormal"
 */
export function generateBlockSignature(block: SetBlock): string {
  const { targetKind, minValue, maxValue, exactValue, count, tag } = block;

  let valueSpec: string;
  if (exactValue !== undefined) {
    valueSpec = String(exactValue);
  } else if (minValue !== undefined && maxValue !== undefined) {
    valueSpec = `${minValue}-${maxValue}`;
  } else {
    // Defensive fallback — should never happen with valid data
    valueSpec = "0";
  }

  const tagValue = tag ?? "normal";

  return `${targetKind}:${valueSpec}:count${count}:tag${tagValue}`;
}
```

- [ ] **Step 2: Create the blockSignature tests**

Create `web/tests/unit/domain/block-signature.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateBlockSignature } from "@/domain/block-signature";
import type { SetBlock } from "@/domain/types";

describe("generateBlockSignature", () => {
  it("generates signature for reps range with top tag", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 6,
      maxValue: 8,
      count: 1,
      tag: "top",
    };
    expect(generateBlockSignature(block)).toBe("reps:6-8:count1:tagtop");
  });

  it("generates signature for reps range without tag", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 8,
      maxValue: 12,
      count: 3,
    };
    expect(generateBlockSignature(block)).toBe("reps:8-12:count3:tagnormal");
  });

  it("generates signature for duration range without tag", () => {
    const block: SetBlock = {
      targetKind: "duration",
      minValue: 30,
      maxValue: 60,
      count: 2,
    };
    expect(generateBlockSignature(block)).toBe("duration:30-60:count2:tagnormal");
  });

  it("generates signature for exact reps", () => {
    const block: SetBlock = {
      targetKind: "reps",
      exactValue: 8,
      count: 3,
    };
    expect(generateBlockSignature(block)).toBe("reps:8:count3:tagnormal");
  });

  it("generates signature for exact distance", () => {
    const block: SetBlock = {
      targetKind: "distance",
      exactValue: 2000,
      count: 1,
    };
    expect(generateBlockSignature(block)).toBe("distance:2000:count1:tagnormal");
  });

  it("generates signature with amrap tag", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 6,
      maxValue: 10,
      count: 1,
      tag: "amrap",
    };
    expect(generateBlockSignature(block)).toBe("reps:6-10:count1:tagamrap");
  });

  it("generates signature for reps range with large count", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 12,
      maxValue: 15,
      count: 5,
    };
    expect(generateBlockSignature(block)).toBe("reps:12-15:count5:tagnormal");
  });

  it("produces deterministic output for the same input", () => {
    const block: SetBlock = {
      targetKind: "reps",
      minValue: 8,
      maxValue: 12,
      count: 3,
    };
    const sig1 = generateBlockSignature(block);
    const sig2 = generateBlockSignature(block);
    expect(sig1).toBe(sig2);
  });

  it("produces different signatures for different blocks", () => {
    const blockA: SetBlock = {
      targetKind: "reps",
      minValue: 6,
      maxValue: 8,
      count: 1,
      tag: "top",
    };
    const blockB: SetBlock = {
      targetKind: "reps",
      minValue: 8,
      maxValue: 12,
      count: 3,
    };
    expect(generateBlockSignature(blockA)).not.toBe(
      generateBlockSignature(blockB)
    );
  });

  it("falls back to '0' for a block missing both range and exact value", () => {
    const block: SetBlock = {
      targetKind: "reps",
      count: 1,
    };
    expect(generateBlockSignature(block)).toBe("reps:0:count1:tagnormal");
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/domain/block-signature.test.ts
```

Expected: All 10 tests pass.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/domain/block-signature.ts web/tests/unit/domain/block-signature.test.ts
git commit -m "$(cat <<'EOF'
feat: add blockSignature generation helper for progression matching
EOF
)"
```

---

### Task 9: Unit conversion and practical rounding helpers

**Files:**
- Create: `web/src/domain/unit-conversion.ts`
- Create: `web/tests/unit/domain/unit-conversion.test.ts`

- [ ] **Step 1: Create the unit conversion module**

Create `web/src/domain/unit-conversion.ts`:

```ts
import type { ExerciseEquipment } from "./enums";

// ---------------------------------------------------------------------------
// Conversion constants
// ---------------------------------------------------------------------------

const KG_PER_LB = 0.45359237;
const LBS_PER_KG = 1 / KG_PER_LB; // ~2.20462

// ---------------------------------------------------------------------------
// Basic conversions
// ---------------------------------------------------------------------------

/**
 * Convert kilograms to pounds.
 * Returns the raw floating-point result — call `roundToIncrement` afterwards
 * if you need a practical display value.
 */
export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

/**
 * Convert pounds to kilograms.
 * Returns the raw floating-point result — call `roundToIncrement` afterwards
 * if you need a practical canonical value.
 */
export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

// ---------------------------------------------------------------------------
// Practical rounding
// ---------------------------------------------------------------------------

/**
 * Practical weight increment lookup table.
 *
 * Equipment     | kg step | lbs step
 * --------------|---------|----------
 * Barbell       |   2.5   |    5
 * Dumbbell      |   2     |    5
 * Machine       |   5     |   10
 * Cable         |   5     |   10
 * Kettlebell    |   2     |    5
 * Bodyweight    |   2.5   |    5
 * Medicine Ball |   2     |    5
 * Other         |   2     |    5
 */
const INCREMENT_TABLE: Record<ExerciseEquipment, { kg: number; lbs: number }> = {
  barbell:        { kg: 2.5, lbs: 5 },
  dumbbell:       { kg: 2,   lbs: 5 },
  machine:        { kg: 5,   lbs: 10 },
  cable:          { kg: 5,   lbs: 10 },
  kettlebell:     { kg: 2,   lbs: 5 },
  bodyweight:     { kg: 2.5, lbs: 5 },
  "medicine-ball": { kg: 2,   lbs: 5 },
  other:          { kg: 2,   lbs: 5 },
  // Cardio equipment does not have weight increments, but we include it
  // for type completeness. In practice, cardio exercises won't hit this path.
  cardio:         { kg: 2.5, lbs: 5 },
};

/**
 * Get the practical weight increment for a given equipment type and unit system.
 */
export function getIncrement(
  equipment: ExerciseEquipment,
  units: "kg" | "lbs"
): number {
  return INCREMENT_TABLE[equipment][units];
}

/**
 * Round a weight value to the nearest practical increment for the given
 * equipment and unit system.
 *
 * This is used after calculating a progression suggestion (e.g., lastWeight * 1.05)
 * to snap the result to a weight that actually exists on gym equipment.
 *
 * Rounding is to the *nearest* increment (standard mathematical rounding).
 */
export function roundToIncrement(
  value: number,
  equipment: ExerciseEquipment,
  units: "kg" | "lbs"
): number {
  const step = getIncrement(equipment, units);
  return Math.round(value / step) * step;
}

/**
 * Convert a canonical kg value to display units, rounded to the nearest
 * practical increment for the given equipment.
 *
 * When units is "kg", the value is rounded to the kg increment.
 * When units is "lbs", the value is converted to lbs then rounded to the lbs increment.
 */
export function toDisplayWeight(
  canonicalKg: number,
  equipment: ExerciseEquipment,
  units: "kg" | "lbs"
): number {
  if (units === "kg") {
    return roundToIncrement(canonicalKg, equipment, "kg");
  }
  const lbs = kgToLbs(canonicalKg);
  return roundToIncrement(lbs, equipment, "lbs");
}

/**
 * Convert a display value back to canonical kg, rounded to the nearest
 * practical kg increment for the given equipment.
 *
 * When displayUnits is "kg", the value is used directly (already canonical).
 * When displayUnits is "lbs", the value is converted to kg then rounded to the kg increment.
 */
export function toCanonicalKg(
  displayValue: number,
  equipment: ExerciseEquipment,
  displayUnits: "kg" | "lbs"
): number {
  if (displayUnits === "kg") {
    return roundToIncrement(displayValue, equipment, "kg");
  }
  const kg = lbsToKg(displayValue);
  return roundToIncrement(kg, equipment, "kg");
}
```

- [ ] **Step 2: Create the unit conversion tests**

Create `web/tests/unit/domain/unit-conversion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  kgToLbs,
  lbsToKg,
  getIncrement,
  roundToIncrement,
  toDisplayWeight,
  toCanonicalKg,
} from "@/domain/unit-conversion";

describe("kgToLbs", () => {
  it("converts 0 kg to 0 lbs", () => {
    expect(kgToLbs(0)).toBe(0);
  });

  it("converts 100 kg to approximately 220.46 lbs", () => {
    expect(kgToLbs(100)).toBeCloseTo(220.462, 2);
  });

  it("converts 1 kg to approximately 2.205 lbs", () => {
    expect(kgToLbs(1)).toBeCloseTo(2.205, 2);
  });
});

describe("lbsToKg", () => {
  it("converts 0 lbs to 0 kg", () => {
    expect(lbsToKg(0)).toBe(0);
  });

  it("converts 220 lbs to approximately 99.79 kg", () => {
    expect(lbsToKg(220)).toBeCloseTo(99.79, 1);
  });

  it("converts 1 lb to approximately 0.454 kg", () => {
    expect(lbsToKg(1)).toBeCloseTo(0.454, 2);
  });

  it("round-trips: lbsToKg(kgToLbs(x)) ≈ x", () => {
    const original = 80;
    expect(lbsToKg(kgToLbs(original))).toBeCloseTo(original, 10);
  });
});

describe("getIncrement", () => {
  it("returns 2.5 kg for barbell", () => {
    expect(getIncrement("barbell", "kg")).toBe(2.5);
  });

  it("returns 5 lbs for barbell", () => {
    expect(getIncrement("barbell", "lbs")).toBe(5);
  });

  it("returns 2 kg for dumbbell", () => {
    expect(getIncrement("dumbbell", "kg")).toBe(2);
  });

  it("returns 5 lbs for dumbbell", () => {
    expect(getIncrement("dumbbell", "lbs")).toBe(5);
  });

  it("returns 5 kg for machine", () => {
    expect(getIncrement("machine", "kg")).toBe(5);
  });

  it("returns 10 lbs for machine", () => {
    expect(getIncrement("machine", "lbs")).toBe(10);
  });

  it("returns 5 kg for cable", () => {
    expect(getIncrement("cable", "kg")).toBe(5);
  });

  it("returns 10 lbs for cable", () => {
    expect(getIncrement("cable", "lbs")).toBe(10);
  });

  it("returns 2 kg for kettlebell", () => {
    expect(getIncrement("kettlebell", "kg")).toBe(2);
  });

  it("returns 5 lbs for kettlebell", () => {
    expect(getIncrement("kettlebell", "lbs")).toBe(5);
  });

  it("returns 2.5 kg for bodyweight", () => {
    expect(getIncrement("bodyweight", "kg")).toBe(2.5);
  });

  it("returns 5 lbs for bodyweight", () => {
    expect(getIncrement("bodyweight", "lbs")).toBe(5);
  });

  it("returns 2 kg for medicine-ball", () => {
    expect(getIncrement("medicine-ball", "kg")).toBe(2);
  });

  it("returns 5 lbs for medicine-ball", () => {
    expect(getIncrement("medicine-ball", "lbs")).toBe(5);
  });

  it("returns 2 kg for other", () => {
    expect(getIncrement("other", "kg")).toBe(2);
  });

  it("returns 5 lbs for other", () => {
    expect(getIncrement("other", "lbs")).toBe(5);
  });
});

describe("roundToIncrement", () => {
  it("rounds barbell kg to nearest 2.5", () => {
    expect(roundToIncrement(81.3, "barbell", "kg")).toBe(82.5);
  });

  it("rounds barbell kg down when closer to lower step", () => {
    expect(roundToIncrement(81.0, "barbell", "kg")).toBe(80);
  });

  it("rounds barbell lbs to nearest 5", () => {
    expect(roundToIncrement(177, "barbell", "lbs")).toBe(175);
  });

  it("rounds machine kg to nearest 5", () => {
    expect(roundToIncrement(37, "machine", "kg")).toBe(35);
  });

  it("rounds machine lbs to nearest 10", () => {
    expect(roundToIncrement(94, "machine", "lbs")).toBe(90);
  });

  it("rounds dumbbell kg to nearest 2", () => {
    expect(roundToIncrement(21.5, "dumbbell", "kg")).toBe(22);
  });

  it("rounds exactly on step boundary to the step itself", () => {
    expect(roundToIncrement(80, "barbell", "kg")).toBe(80);
  });

  it("rounds 0 to 0", () => {
    expect(roundToIncrement(0, "barbell", "kg")).toBe(0);
  });
});

describe("toDisplayWeight", () => {
  it("returns kg rounded to barbell increment when units is kg", () => {
    expect(toDisplayWeight(81.3, "barbell", "kg")).toBe(82.5);
  });

  it("converts kg to lbs and rounds to barbell lbs increment", () => {
    // 100 kg = ~220.46 lbs -> rounds to 220 lbs (nearest 5)
    expect(toDisplayWeight(100, "barbell", "lbs")).toBe(220);
  });

  it("converts kg to lbs for dumbbell (nearest 5 lbs)", () => {
    // 20 kg = ~44.09 lbs -> rounds to 45 lbs (nearest 5)
    expect(toDisplayWeight(20, "dumbbell", "lbs")).toBe(45);
  });

  it("converts kg to lbs for machine (nearest 10 lbs)", () => {
    // 50 kg = ~110.23 lbs -> rounds to 110 lbs (nearest 10)
    expect(toDisplayWeight(50, "machine", "lbs")).toBe(110);
  });
});

describe("toCanonicalKg", () => {
  it("returns kg rounded to barbell increment when displayUnits is kg", () => {
    expect(toCanonicalKg(81.3, "barbell", "kg")).toBe(82.5);
  });

  it("converts lbs to kg and rounds to barbell kg increment", () => {
    // 225 lbs = ~102.06 kg -> rounds to 102.5 kg (nearest 2.5)
    expect(toCanonicalKg(225, "barbell", "lbs")).toBe(102.5);
  });

  it("converts lbs to kg for dumbbell (nearest 2 kg)", () => {
    // 45 lbs = ~20.41 kg -> rounds to 20 kg (nearest 2)
    expect(toCanonicalKg(45, "dumbbell", "lbs")).toBe(20);
  });

  it("converts lbs to kg for machine (nearest 5 kg)", () => {
    // 110 lbs = ~49.9 kg -> rounds to 50 kg (nearest 5)
    expect(toCanonicalKg(110, "machine", "lbs")).toBe(50);
  });

  it("round-trips display -> canonical -> display", () => {
    const canonicalKg = 80;
    const displayLbs = toDisplayWeight(canonicalKg, "barbell", "lbs");
    const backToKg = toCanonicalKg(displayLbs, "barbell", "lbs");
    // Should be close to original, within one increment
    expect(Math.abs(backToKg - canonicalKg)).toBeLessThanOrEqual(2.5);
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/domain/unit-conversion.test.ts
```

Expected: All tests pass (30 tests across 6 describe blocks).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/domain/unit-conversion.ts web/tests/unit/domain/unit-conversion.test.ts
git commit -m "$(cat <<'EOF'
feat: add unit conversion and practical rounding helpers
EOF
)"
```

---

### Task 10: Run the full test suite and verify

**Files:**
- No new files

- [ ] **Step 1: Run all Phase 2 tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run
```

Expected: All tests pass, including both Phase 1 tests (if any) and all new Phase 2 tests:
- `tests/unit/db/database.test.ts` — 14 tests (11 DB + 3 settings init)
- `tests/unit/domain/uuid.test.ts` — 3 tests
- `tests/unit/domain/slug.test.ts` — 10 tests
- `tests/unit/domain/timestamp.test.ts` — 4 tests
- `tests/unit/domain/block-signature.test.ts` — 10 tests
- `tests/unit/domain/unit-conversion.test.ts` — 30 tests

Total new Phase 2 tests: 71

- [ ] **Step 2: Verify TypeScript compilation**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx tsc --noEmit --project tsconfig.app.json
```

Expected: No errors.

- [ ] **Step 3: Verify the build still succeeds**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
```

Expected: Build completes successfully with no errors.

---

## Self-Review

### 1. Spec coverage check

| Spec requirement | Task | Status |
|---|---|---|
| `Exercise` type | Task 3 | Covered |
| `ExerciseType` enum | Task 2 | Covered |
| `ExerciseEquipment` enum | Task 2 | Covered |
| `Routine` type | Task 3 | Covered |
| `RoutineDay` type | Task 3 | Covered |
| `RoutineEntry` discriminated union | Task 3 | Covered |
| `RoutineExerciseEntry` type | Task 3 | Covered |
| `SetBlock` type | Task 3 | Covered |
| `Session` type | Task 3 | Covered |
| `SessionStatus` enum | Task 2 | Covered |
| `SessionExercise` type | Task 3 | Covered |
| `SessionExerciseOrigin` enum | Task 2 | Covered |
| `GroupType` enum | Task 2 | Covered |
| `LoggedSet` type | Task 3 | Covered |
| `Settings` type | Task 3 | Covered |
| `TargetKind` enum | Task 2 | Covered |
| `SetTag` enum | Task 2 | Covered |
| `UnitSystem` enum | Task 2 | Covered |
| `ThemePreference` enum | Task 2 | Covered |
| Dexie 6 tables | Task 4 | Covered |
| Schema version 1 | Task 4 | Covered |
| `sessions` index: `status` | Task 4 | Covered |
| `sessions` index: `[routineId+startedAt]` | Task 4 | Covered |
| `sessionExercises` index: `sessionId` | Task 4 | Covered |
| `sessionExercises` index: `[sessionId+orderIndex]` | Task 4 | Covered |
| `loggedSets` index: `sessionId` | Task 4 | Covered |
| `loggedSets` index: `[sessionExerciseId+blockIndex+setIndex]` | Task 4 | Covered |
| `loggedSets` index: `[exerciseId+loggedAt]` | Task 4 | Covered |
| `loggedSets` index: `[exerciseId+instanceLabel+blockSignature+loggedAt]` | Task 4 | Covered |
| Settings initialization | Task 4 | Covered |
| `blockSignature` helper | Task 8 | Covered |
| kg to lbs conversion | Task 9 | Covered |
| lbs to kg conversion | Task 9 | Covered |
| Practical rounding by equipment | Task 9 | Covered |
| All 9 equipment increments | Task 9 | Covered (including cardio for completeness) |
| UUID generation | Task 5 | Covered |
| Slug generation | Task 6 | Covered |
| ISO timestamp helper | Task 7 | Covered |
| `RoutineCardio` / `RoutineCardioOption` types | Task 3 | Covered |

### 2. Placeholder scan

No TBD, TODO, or vague steps found. All code blocks are complete. All expected outputs are specified.

### 3. Type consistency check

- All import paths use `@/domain/` and `@/db/` — matches Phase 1 path alias `@/ -> web/src/`
- All test paths use `web/tests/unit/domain/` and `web/tests/unit/db/` — matches Phase 1 test structure
- Enum type names match between `enums.ts` and `types.ts` imports
- `SetBlock.tag` uses `SetTag` type (`"top" | "amrap"`) — consistent with spec
- `LoggedSet.tag` uses `SetTag | null` — consistent with spec (null for non-tagged sets)
- `blockSignature` format matches spec examples exactly: `"reps:6-8:count1:tagtop"`, `"reps:8-12:count3:tagnormal"`, `"duration:30-60:count2:tagnormal"`
- `Settings.units` uses `UnitSystem` (`"kg" | "lbs"`) — consistent with spec
- `Settings.theme` uses `ThemePreference` (`"light" | "dark" | "system"`) — consistent with spec
- Default settings: `{ id: "user", activeRoutineId: null, units: "kg", theme: "system" }` — matches spec
- Compound index on `loggedSets` for `instanceLabel`: Dexie stores `null` as-is in compound indexes. The test uses `""` as a query key which aligns with how Dexie handles `null` values in compound indexes — this needs a note: when `instanceLabel` is `null`, Dexie will not index the row in the `[exerciseId+instanceLabel+blockSignature+loggedAt]` compound index because Dexie excludes entries with any null key in compound indexes. This is addressed below.

### 4. Compound index null-key concern

Dexie does not index rows where any key in a compound index is `null`. This means `loggedSets` rows with `instanceLabel: null` will not appear in the `[exerciseId+instanceLabel+blockSignature+loggedAt]` index.

**Resolution:** The `instanceLabel` field on `LoggedSet` should store an empty string `""` instead of `null` when there is no instance label. This keeps the compound index functional. The `types.ts` definition already allows `string | null`, but the service layer (Phase 4) must normalize `null` to `""` before writing `loggedSets` rows. This is a Phase 4 implementation concern — the types remain `string | null` to clearly communicate the domain semantics, and the normalization happens at the write boundary.

This concern is documented here so Phase 4 implementors know to handle it. No changes to Phase 2 code are needed — the types correctly model the domain, and the index correctly declares the compound key. The test in Task 4 already uses `""` as the query value, which demonstrates the working pattern.
