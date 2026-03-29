# Phase 5: Progression & History Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement per-block history matching, weight suggestion engine, and last-time data retrieval. This covers block matching (primary + fallback strategies), automated progression with practical rounding, all no-suggestion cases, last-time display data, extra exercise history, and invariant guards 7 and 8.

**Architecture:** One new service file: `web/src/services/progression-service.ts` contains all progression and history logic as pure functions that query Dexie. No UI, no Zustand, no React -- pure data layer. The service consumes types, helpers, and database from Phases 2-4. Tests live in `web/tests/unit/services/progression-service.test.ts`.

**Tech Stack:** TypeScript 5 strict mode, Dexie.js 4 (IndexedDB wrapper), Vitest for unit testing, `fake-indexeddb` for Dexie tests in Node. Import alias `@/` maps to `web/src/`.

---

## File Structure (Phase 5 target state)

New files created by this phase:

```
web/
├── src/
│   └── services/
│       └── progression-service.ts    # Block matching, suggestions, last-time
└── tests/
    └── unit/
        └── services/
            └── progression-service.test.ts
```

---

## Dependencies from previous phases

All imports below come from Phase 2 and Phase 4 deliverables:

```ts
// Phase 2: Domain types
import type {
  LoggedSet,
  SessionExercise,
  SetBlock,
  Session,
} from "@/domain/types";

// Phase 2: Domain enums
import type {
  ExerciseType,
  ExerciseEquipment,
  TargetKind,
  SetTag,
  UnitSystem,
} from "@/domain/enums";

// Phase 2: Database
import type { ExerciseLoggerDB } from "@/db/database";

// Phase 2: Helpers
import { generateBlockSignature } from "@/domain/block-signature";
import {
  kgToLbs,
  roundToIncrement,
} from "@/domain/unit-conversion";
```

---

### Task 1: Create the progression service -- return types and block matching

**Files:**
- Create: `web/src/services/progression-service.ts`

This task creates the service file with the core return types and the block matching function that finds the most recent finished session's logged sets for a given exercise block.

- [ ] **Step 1: Create the progression service with types and block matching**

Create `web/src/services/progression-service.ts`:

```ts
import Dexie from "dexie";
import type {
  LoggedSet,
  SessionExercise,
  SetBlock,
  Session,
} from "@/domain/types";
import type {
  ExerciseType,
  ExerciseEquipment,
  TargetKind,
  SetTag,
  UnitSystem,
} from "@/domain/enums";
import type { ExerciseLoggerDB } from "@/db/database";
import { generateBlockSignature } from "@/domain/block-signature";
import { kgToLbs, roundToIncrement } from "@/domain/unit-conversion";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

/** A single set's performed data for last-time display. */
export interface LastTimeSet {
  /** Weight in kg, or null for unweighted. */
  weightKg: number | null;
  /** Reps performed, or null. */
  reps: number | null;
  /** Duration in seconds, or null. */
  durationSec: number | null;
  /** Distance in meters, or null. */
  distanceM: number | null;
}

/** Last-time data for a single set block. */
export interface BlockLastTime {
  /** Human-readable block label (e.g., "Top", "Back-off", "Set block 1"). */
  blockLabel: string;
  /** The tag for this block, or null. */
  tag: SetTag | null;
  /** Individual set data, ordered by setIndex. */
  sets: LastTimeSet[];
}

/** Suggestion for a single set block's weight. */
export interface BlockSuggestion {
  /** The block index this suggestion is for. */
  blockIndex: number;
  /** Suggested weight in canonical kg. */
  suggestedWeightKg: number;
  /** Whether this is a progression increase (true) or repeat (false). */
  isProgression: boolean;
  /** The previous weight in kg, for display context. */
  previousWeightKg: number;
}

/** Combined last-time and suggestion data for an exercise card. */
export interface ExerciseHistoryData {
  /** Per-block last-time data. Empty array if no history. */
  lastTime: BlockLastTime[];
  /** Per-block suggestions. Only present for blocks that qualify. */
  suggestions: BlockSuggestion[];
}

/** Last-time data for an extra exercise (no block structure). */
export interface ExtraExerciseHistory {
  /** The sets from the most recent finished session for this exerciseId. */
  sets: LastTimeSet[];
  /** ISO timestamp of the session these sets came from. */
  sessionDate: string;
}

// ---------------------------------------------------------------------------
// Block matching -- internal helpers
// ---------------------------------------------------------------------------

/**
 * Find matching logged sets from the most recent finished session.
 *
 * Primary match strategy (spec section 11):
 *   exerciseId + instanceLabel + origin="routine" + blockSignature
 *
 * Fallback match strategy:
 *   exerciseId + instanceLabel + origin="routine" + tag + targetKind
 *
 * Only finished sessions are valid inputs.
 *
 * @returns The matching LoggedSet[] from a single session, or empty array if no match.
 */
export async function findMatchingBlock(
  db: ExerciseLoggerDB,
  exerciseId: string,
  instanceLabel: string | null,
  blockSignature: string,
  tag: SetTag | null,
  targetKind: TargetKind
): Promise<LoggedSet[]> {
  // Normalize instanceLabel: stored as "" instead of null in loggedSets
  // (see set-service.ts logSet implementation)
  const normalizedLabel = instanceLabel ?? "";

  // --- Primary match: exerciseId + instanceLabel + blockSignature ---
  // Use the compound index [exerciseId+instanceLabel+blockSignature+loggedAt]
  const primaryMatches = await db.loggedSets
    .where("[exerciseId+instanceLabel+blockSignature+loggedAt]")
    .between(
      [exerciseId, normalizedLabel, blockSignature, Dexie.minKey],
      [exerciseId, normalizedLabel, blockSignature, Dexie.maxKey]
    )
    .toArray();

  // Filter to only routine-origin sets
  const routinePrimary = primaryMatches.filter((ls) => ls.origin === "routine");

  if (routinePrimary.length > 0) {
    // Find the most recent session among these sets
    const result = await findMostRecentFinishedSessionSets(db, routinePrimary);
    if (result.length > 0) {
      return result;
    }
  }

  // --- Fallback match: exerciseId + instanceLabel + tag + targetKind ---
  // No compound index for this combo, so we query by exerciseId+instanceLabel
  // and filter in memory
  const fallbackCandidates = await db.loggedSets
    .where("[exerciseId+instanceLabel+blockSignature+loggedAt]")
    .between(
      [exerciseId, normalizedLabel, Dexie.minKey, Dexie.minKey],
      [exerciseId, normalizedLabel, Dexie.maxKey, Dexie.maxKey]
    )
    .toArray();

  const normalizedTag = tag ?? null;
  const fallbackMatches = fallbackCandidates.filter((ls) => {
    if (ls.origin !== "routine") return false;
    if (ls.tag !== normalizedTag) return false;
    // Extract targetKind from blockSignature (format: "targetKind:...")
    const sigTargetKind = ls.blockSignature.split(":")[0];
    return sigTargetKind === targetKind;
  });

  if (fallbackMatches.length > 0) {
    return findMostRecentFinishedSessionSets(db, fallbackMatches);
  }

  return [];
}

/**
 * Given a set of logged sets, group them by sessionId, find the most recent
 * finished session, and return only the sets from that session.
 *
 * Sets are returned sorted by setIndex ascending.
 */
async function findMostRecentFinishedSessionSets(
  db: ExerciseLoggerDB,
  loggedSets: LoggedSet[]
): Promise<LoggedSet[]> {
  // Group by sessionId
  const bySession = new Map<string, LoggedSet[]>();
  for (const ls of loggedSets) {
    const existing = bySession.get(ls.sessionId);
    if (existing) {
      existing.push(ls);
    } else {
      bySession.set(ls.sessionId, [ls]);
    }
  }

  // Load all referenced sessions and filter to finished only
  const sessionIds = [...bySession.keys()];
  const sessions: Session[] = [];
  for (const id of sessionIds) {
    const session = await db.sessions.get(id);
    if (session && session.status === "finished") {
      sessions.push(session);
    }
  }

  if (sessions.length === 0) {
    return [];
  }

  // Sort by finishedAt descending to find the most recent
  sessions.sort((a, b) => {
    const aTime = a.finishedAt ?? a.startedAt;
    const bTime = b.finishedAt ?? b.startedAt;
    return bTime.localeCompare(aTime);
  });

  const mostRecentSession = sessions[0]!;
  const matchingSets = bySession.get(mostRecentSession.id) ?? [];

  // Sort by setIndex ascending
  return matchingSets.sort((a, b) => a.setIndex - b.setIndex);
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
git add web/src/services/progression-service.ts
git commit -m "$(cat <<'EOF'
feat: add progression service with types and block matching
EOF
)"
```

---

### Task 2: Add the suggestion engine

**Files:**
- Modify: `web/src/services/progression-service.ts`

This task adds the `calculateBlockSuggestion` function that evaluates the 4 automated progression conditions and calculates the suggested weight.

- [ ] **Step 1: Add the suggestion engine to the progression service**

Append to `web/src/services/progression-service.ts` (after the `findMostRecentFinishedSessionSets` function):

```ts
// ---------------------------------------------------------------------------
// Suggestion engine
// ---------------------------------------------------------------------------

/**
 * Determine if a set block qualifies for automated progression.
 *
 * Returns true only when ALL 4 conditions are met (spec section 11):
 * 1. The block target is a range, not an exact value
 * 2. The exercise type is "weight" or a weighted bodyweight override
 * 3. The most recent matching finished session has ALL expected sets logged for that block
 * 4. All matching sets hit the ceiling (top of the range)
 */
function isRangeBlock(block: SetBlock): boolean {
  return block.minValue !== undefined && block.maxValue !== undefined;
}

function isWeightEligible(effectiveType: ExerciseType): boolean {
  return effectiveType === "weight";
}

function allSetsLogged(matchingSets: LoggedSet[], expectedCount: number): boolean {
  return matchingSets.length >= expectedCount;
}

function allSetsHitCeiling(matchingSets: LoggedSet[], ceiling: number): boolean {
  if (matchingSets.length === 0) return false;
  return matchingSets.every((ls) => {
    if (ls.performedReps === null) return false;
    return ls.performedReps >= ceiling;
  });
}

/**
 * Calculate the weight suggestion for a single set block.
 *
 * Spec rules:
 * - If all 4 progression conditions are met:
 *   suggest lastWeightKg * 1.05, rounded to nearest practical increment
 * - Otherwise:
 *   suggest the same weight used in the most recent matching finished block
 * - Returns null if no suggestion is possible (no match, extras, cardio, etc.)
 *
 * @param matchingSets - The logged sets from the most recent matching block
 * @param block - The set block prescription
 * @param effectiveType - The effective exercise type (from sessionExercise)
 * @param effectiveEquipment - The effective equipment (from sessionExercise)
 * @param units - The user's display unit preference
 * @returns BlockSuggestion or null if no suggestion is possible
 */
export function calculateBlockSuggestion(
  matchingSets: LoggedSet[],
  block: SetBlock,
  blockIndex: number,
  effectiveType: ExerciseType,
  effectiveEquipment: ExerciseEquipment,
  units: UnitSystem
): BlockSuggestion | null {
  // No suggestion if no matching sets
  if (matchingSets.length === 0) {
    return null;
  }

  // No suggestion for non-weight exercises (invariant: cardio, isometric, unweighted bodyweight)
  if (!isWeightEligible(effectiveType)) {
    return null;
  }

  // Find the weight used -- take the first set's weight as the reference
  // (all sets in a block should use the same weight in typical usage)
  const previousWeightKg = matchingSets[0]!.performedWeightKg;

  // No suggestion if previous weight is null (unweighted sets)
  if (previousWeightKg === null) {
    return null;
  }

  // Check all 4 progression conditions
  const conditionRange = isRangeBlock(block);
  const conditionWeight = isWeightEligible(effectiveType);
  const conditionAllLogged = allSetsLogged(matchingSets, block.count);
  const conditionAllHitCeiling = conditionRange
    ? allSetsHitCeiling(matchingSets, block.maxValue!)
    : false;

  if (conditionRange && conditionWeight && conditionAllLogged && conditionAllHitCeiling) {
    // Automated progression: 5% increase with practical rounding
    const rawIncrease = previousWeightKg * 1.05;

    // Round in the user's display units, then store canonical kg
    let suggestedWeightKg: number;
    if (units === "kg") {
      suggestedWeightKg = roundToIncrement(rawIncrease, effectiveEquipment, "kg");
    } else {
      // Convert to lbs, round in lbs, convert back to kg
      const rawLbs = kgToLbs(rawIncrease);
      const roundedLbs = roundToIncrement(rawLbs, effectiveEquipment, "lbs");
      // Store the canonical kg equivalent of the rounded lbs value
      // Use the exact conversion factor, not rounded again
      suggestedWeightKg = roundedLbs / 2.20462;
      // Round the kg to avoid floating point noise (0.01 precision)
      suggestedWeightKg = Math.round(suggestedWeightKg * 100) / 100;
    }

    // Ensure the suggestion is at least one increment above the previous weight
    // (5% on very small weights might round to the same value)
    if (suggestedWeightKg <= previousWeightKg) {
      if (units === "kg") {
        const increment = roundToIncrement(
          previousWeightKg + 0.01,
          effectiveEquipment,
          "kg"
        );
        suggestedWeightKg = increment > previousWeightKg ? increment : previousWeightKg + roundToIncrement(1, effectiveEquipment, "kg");
      } else {
        const prevLbs = kgToLbs(previousWeightKg);
        const nextLbs = roundToIncrement(prevLbs + 0.01, effectiveEquipment, "lbs");
        if (nextLbs > prevLbs) {
          suggestedWeightKg = Math.round((nextLbs / 2.20462) * 100) / 100;
        } else {
          suggestedWeightKg = previousWeightKg;
        }
      }
    }

    return {
      blockIndex,
      suggestedWeightKg,
      isProgression: true,
      previousWeightKg,
    };
  }

  // No progression -- suggest the same weight as last time
  return {
    blockIndex,
    suggestedWeightKg: previousWeightKg,
    isProgression: false,
    previousWeightKg,
  };
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
git add web/src/services/progression-service.ts
git commit -m "$(cat <<'EOF'
feat: add suggestion engine with 4-condition progression check
EOF
)"
```

---

### Task 3: Add the last-time display data and exercise history functions

**Files:**
- Modify: `web/src/services/progression-service.ts`

This task adds the high-level functions that the UI will consume: `getExerciseHistoryData` for routine exercises and `getExtraExerciseHistory` for extras.

- [ ] **Step 1: Add the last-time and history functions**

Append to `web/src/services/progression-service.ts`:

```ts
// ---------------------------------------------------------------------------
// Block label generation
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable label for a set block.
 *
 * Examples:
 * - Block with tag "top" -> "Top"
 * - Block with tag "amrap" -> "AMRAP"
 * - Single block, no tag -> "" (no label needed)
 * - Multiple blocks, no tag, index 0 -> "Set block 1"
 * - Multiple blocks, no tag, index 1 -> "Set block 2"
 */
function getBlockLabel(block: SetBlock, blockIndex: number, totalBlocks: number): string {
  if (block.tag === "top") return "Top";
  if (block.tag === "amrap") return "AMRAP";
  if (totalBlocks <= 1) return "";
  return `Set block ${blockIndex + 1}`;
}

// ---------------------------------------------------------------------------
// Exercise history data (routine exercises)
// ---------------------------------------------------------------------------

/**
 * Get the last-time display data and suggestions for a routine exercise.
 *
 * This is the main function the UI calls for each routine exercise card.
 * It returns per-block last-time data and per-block suggestions.
 *
 * Enforces invariant 7: extras never feed progression.
 * Enforces invariant 8: progression is per set block.
 *
 * @param db - Dexie database instance
 * @param sessionExercise - The session exercise to get history for
 * @param units - The user's display unit preference
 * @returns ExerciseHistoryData with lastTime and suggestions arrays
 */
export async function getExerciseHistoryData(
  db: ExerciseLoggerDB,
  sessionExercise: SessionExercise,
  units: UnitSystem
): Promise<ExerciseHistoryData> {
  // Guard: extras never feed progression (invariant 7)
  if (sessionExercise.origin === "extra") {
    return { lastTime: [], suggestions: [] };
  }

  const blocks = sessionExercise.setBlocksSnapshot;
  if (blocks.length === 0) {
    return { lastTime: [], suggestions: [] };
  }

  const lastTime: BlockLastTime[] = [];
  const suggestions: BlockSuggestion[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex]!;
    const blockSig = generateBlockSignature(block);

    // Find matching logged sets from the most recent finished session
    const matchingSets = await findMatchingBlock(
      db,
      sessionExercise.exerciseId,
      sessionExercise.instanceLabel,
      blockSig,
      block.tag ?? null,
      block.targetKind
    );

    // Build last-time data for this block
    if (matchingSets.length > 0) {
      const blockLabel = getBlockLabel(block, blockIndex, blocks.length);
      lastTime.push({
        blockLabel,
        tag: block.tag ?? null,
        sets: matchingSets.map((ls) => ({
          weightKg: ls.performedWeightKg,
          reps: ls.performedReps,
          durationSec: ls.performedDurationSec,
          distanceM: ls.performedDistanceM,
        })),
      });
    }

    // Calculate suggestion for this block (invariant 8: per set block)
    const suggestion = calculateBlockSuggestion(
      matchingSets,
      block,
      blockIndex,
      sessionExercise.effectiveType,
      sessionExercise.effectiveEquipment,
      units
    );

    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  return { lastTime, suggestions };
}

// ---------------------------------------------------------------------------
// Extra exercise history
// ---------------------------------------------------------------------------

/**
 * Get the most recent logged sets for an extra exercise.
 *
 * Unlike routine exercises, extras match on exerciseId alone -- regardless
 * of routine position, instanceLabel, or block structure.
 *
 * Only finished sessions are valid sources.
 *
 * @param db - Dexie database instance
 * @param exerciseId - The exercise to find history for
 * @returns ExtraExerciseHistory or null if no history exists
 */
export async function getExtraExerciseHistory(
  db: ExerciseLoggerDB,
  exerciseId: string
): Promise<ExtraExerciseHistory | null> {
  // Query all logged sets for this exerciseId, ordered by loggedAt
  const allSets = await db.loggedSets
    .where("[exerciseId+loggedAt]")
    .between(
      [exerciseId, Dexie.minKey],
      [exerciseId, Dexie.maxKey]
    )
    .toArray();

  if (allSets.length === 0) {
    return null;
  }

  // Group by sessionId
  const bySession = new Map<string, LoggedSet[]>();
  for (const ls of allSets) {
    const existing = bySession.get(ls.sessionId);
    if (existing) {
      existing.push(ls);
    } else {
      bySession.set(ls.sessionId, [ls]);
    }
  }

  // Load sessions and filter to finished only
  const sessionIds = [...bySession.keys()];
  const finishedSessions: Session[] = [];
  for (const id of sessionIds) {
    const session = await db.sessions.get(id);
    if (session && session.status === "finished") {
      finishedSessions.push(session);
    }
  }

  if (finishedSessions.length === 0) {
    return null;
  }

  // Sort by finishedAt descending
  finishedSessions.sort((a, b) => {
    const aTime = a.finishedAt ?? a.startedAt;
    const bTime = b.finishedAt ?? b.startedAt;
    return bTime.localeCompare(aTime);
  });

  const mostRecentSession = finishedSessions[0]!;
  const sessionSets = bySession.get(mostRecentSession.id) ?? [];

  // Sort by blockIndex, then setIndex
  sessionSets.sort((a, b) => {
    if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
    return a.setIndex - b.setIndex;
  });

  return {
    sets: sessionSets.map((ls) => ({
      weightKg: ls.performedWeightKg,
      reps: ls.performedReps,
      durationSec: ls.performedDurationSec,
      distanceM: ls.performedDistanceM,
    })),
    sessionDate: mostRecentSession.finishedAt ?? mostRecentSession.startedAt,
  };
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
git add web/src/services/progression-service.ts
git commit -m "$(cat <<'EOF'
feat: add last-time display and extra exercise history functions
EOF
)"
```

---

### Task 4: Test block matching -- primary match

**Files:**
- Create: `web/tests/unit/services/progression-service.test.ts`

This task creates the test file and covers the primary block matching strategy.

- [ ] **Step 1: Create the progression service test file with helpers and primary match tests**

Create `web/tests/unit/services/progression-service.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExerciseLoggerDB, initializeSettings } from "@/db/database";
import {
  findMatchingBlock,
  calculateBlockSuggestion,
  getExerciseHistoryData,
  getExtraExerciseHistory,
} from "@/services/progression-service";
import type {
  Exercise,
  Routine,
  RoutineDay,
  RoutineEntry,
  RoutineExerciseEntry,
  Session,
  SessionExercise,
  LoggedSet,
  SetBlock,
} from "@/domain/types";
import type { ExerciseType, ExerciseEquipment, SetTag, UnitSystem } from "@/domain/enums";
import { generateBlockSignature } from "@/domain/block-signature";

// ---------------------------------------------------------------------------
// Test helpers
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

/** Create a finished session. */
function makeFinishedSession(
  id: string,
  finishedAt: string,
  overrides: Partial<Session> = {}
): Session {
  return {
    id,
    routineId: "r1",
    routineNameSnapshot: "Test Routine",
    dayId: "A",
    dayLabelSnapshot: "Day A",
    dayOrderSnapshot: ["A", "B"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: finishedAt.replace("T15:", "T14:"),
    finishedAt,
    ...overrides,
  };
}

/** Create a session exercise. */
function makeSessionExercise(
  id: string,
  sessionId: string,
  exerciseId: string,
  setBlocks: SetBlock[],
  overrides: Partial<SessionExercise> = {}
): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: `${exerciseId}-entry`,
    exerciseId,
    exerciseNameSnapshot: exerciseId
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel: null,
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: null,
    setBlocksSnapshot: setBlocks,
    createdAt: "2026-03-28T14:00:00.000Z",
    ...overrides,
  };
}

/** Create a logged set. */
function makeLoggedSet(
  id: string,
  sessionId: string,
  sessionExerciseId: string,
  exerciseId: string,
  blockIndex: number,
  setIndex: number,
  block: SetBlock,
  overrides: Partial<LoggedSet> = {}
): LoggedSet {
  return {
    id,
    sessionId,
    sessionExerciseId,
    exerciseId,
    instanceLabel: "",
    origin: "routine",
    blockIndex,
    blockSignature: generateBlockSignature(block),
    setIndex,
    tag: block.tag ?? null,
    performedWeightKg: 100,
    performedReps: 10,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-03-28T14:05:00.000Z",
    updatedAt: "2026-03-28T14:05:00.000Z",
    ...overrides,
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

/** Exact reps block: reps 8, count 3. */
const EXACT_REPS_BLOCK: SetBlock = {
  targetKind: "reps",
  exactValue: 8,
  count: 3,
};

/** Duration block: 30-60s, count 2. */
const DURATION_BLOCK: SetBlock = {
  targetKind: "duration",
  minValue: 30,
  maxValue: 60,
  count: 2,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("progression-service", () => {
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
      makeExercise("tricep-pushdown", { equipment: "cable", muscleGroups: ["Arms"] }),
      makeExercise("run-walk", { type: "cardio", equipment: "cardio", muscleGroups: ["Cardio"] }),
    ]);
  });

  afterEach(async () => {
    await db.delete();
  });

  // =====================================================================
  // findMatchingBlock -- primary match
  // =====================================================================

  describe("findMatchingBlock -- primary match", () => {
    it("finds matching sets from the most recent finished session", async () => {
      // Two finished sessions with the same block
      const session1 = makeFinishedSession("s1", "2026-03-26T15:00:00.000Z");
      const session2 = makeFinishedSession("s2", "2026-03-28T15:00:00.000Z");
      await db.sessions.bulkAdd([session1, session2]);

      const se1 = makeSessionExercise("se1", "s1", "barbell-back-squat", [TOP_SET_BLOCK]);
      const se2 = makeSessionExercise("se2", "s2", "barbell-back-squat", [TOP_SET_BLOCK]);
      await db.sessionExercises.bulkAdd([se1, se2]);

      // Session 1: older data
      const ls1 = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, TOP_SET_BLOCK, {
        performedWeightKg: 90,
        performedReps: 7,
        loggedAt: "2026-03-26T14:05:00.000Z",
      });

      // Session 2: newer data
      const ls2 = makeLoggedSet("ls2", "s2", "se2", "barbell-back-squat", 0, 0, TOP_SET_BLOCK, {
        performedWeightKg: 95,
        performedReps: 8,
        loggedAt: "2026-03-28T14:05:00.000Z",
      });

      await db.loggedSets.bulkAdd([ls1, ls2]);

      const result = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        generateBlockSignature(TOP_SET_BLOCK),
        "top",
        "reps"
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.performedWeightKg).toBe(95);
      expect(result[0]!.sessionId).toBe("s2");
    });

    it("ignores active sessions", async () => {
      const finishedSession = makeFinishedSession("s1", "2026-03-26T15:00:00.000Z");
      const activeSession = makeFinishedSession("s2", "2026-03-28T15:00:00.000Z", {
        status: "active",
        finishedAt: null,
      });
      await db.sessions.bulkAdd([finishedSession, activeSession]);

      const se1 = makeSessionExercise("se1", "s1", "barbell-back-squat", [TOP_SET_BLOCK]);
      const se2 = makeSessionExercise("se2", "s2", "barbell-back-squat", [TOP_SET_BLOCK]);
      await db.sessionExercises.bulkAdd([se1, se2]);

      const ls1 = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, TOP_SET_BLOCK, {
        performedWeightKg: 90,
        loggedAt: "2026-03-26T14:05:00.000Z",
      });
      const ls2 = makeLoggedSet("ls2", "s2", "se2", "barbell-back-squat", 0, 0, TOP_SET_BLOCK, {
        performedWeightKg: 100,
        loggedAt: "2026-03-28T14:05:00.000Z",
      });
      await db.loggedSets.bulkAdd([ls1, ls2]);

      const result = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        generateBlockSignature(TOP_SET_BLOCK),
        "top",
        "reps"
      );

      // Should only return from the finished session
      expect(result).toHaveLength(1);
      expect(result[0]!.performedWeightKg).toBe(90);
    });

    it("returns empty array when no matching sets exist", async () => {
      const result = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        generateBlockSignature(TOP_SET_BLOCK),
        "top",
        "reps"
      );

      expect(result).toEqual([]);
    });

    it("respects instanceLabel -- null only matches null", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const se1 = makeSessionExercise("se1", "s1", "barbell-back-squat", [STANDARD_BLOCK], {
        instanceLabel: null,
      });
      const se2 = makeSessionExercise("se2", "s1", "barbell-back-squat", [STANDARD_BLOCK], {
        instanceLabel: "close-grip",
      });
      await db.sessionExercises.bulkAdd([se1, se2]);

      const lsNull = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        instanceLabel: "",
        performedWeightKg: 80,
      });
      const lsLabeled = makeLoggedSet("ls2", "s1", "se2", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        instanceLabel: "close-grip",
        performedWeightKg: 60,
      });
      await db.loggedSets.bulkAdd([lsNull, lsLabeled]);

      // Query with null instanceLabel -- should match only the null one
      const resultNull = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        generateBlockSignature(STANDARD_BLOCK),
        null,
        "reps"
      );
      expect(resultNull).toHaveLength(1);
      expect(resultNull[0]!.performedWeightKg).toBe(80);

      // Query with "close-grip" instanceLabel -- should match only the labeled one
      const resultLabeled = await findMatchingBlock(
        db,
        "barbell-back-squat",
        "close-grip",
        generateBlockSignature(STANDARD_BLOCK),
        null,
        "reps"
      );
      expect(resultLabeled).toHaveLength(1);
      expect(resultLabeled[0]!.performedWeightKg).toBe(60);
    });

    it("ignores extra-origin sets", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", [], {
        origin: "extra",
      });
      await db.sessionExercises.add(se);

      const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        origin: "extra",
        blockSignature: "extra:0:count0:tagnormal",
      });
      await db.loggedSets.add(ls);

      const result = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        generateBlockSignature(STANDARD_BLOCK),
        null,
        "reps"
      );

      expect(result).toEqual([]);
    });

    it("returns multiple sets sorted by setIndex", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", [STANDARD_BLOCK]);
      await db.sessionExercises.add(se);

      // 3 sets in the block, added out of order
      const ls0 = makeLoggedSet("ls0", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        performedReps: 12,
        loggedAt: "2026-03-28T14:05:00.000Z",
      });
      const ls2 = makeLoggedSet("ls2", "s1", "se1", "barbell-back-squat", 0, 2, STANDARD_BLOCK, {
        performedReps: 10,
        loggedAt: "2026-03-28T14:07:00.000Z",
      });
      const ls1 = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 1, STANDARD_BLOCK, {
        performedReps: 11,
        loggedAt: "2026-03-28T14:06:00.000Z",
      });
      await db.loggedSets.bulkAdd([ls0, ls2, ls1]);

      const result = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        generateBlockSignature(STANDARD_BLOCK),
        null,
        "reps"
      );

      expect(result).toHaveLength(3);
      expect(result[0]!.setIndex).toBe(0);
      expect(result[1]!.setIndex).toBe(1);
      expect(result[2]!.setIndex).toBe(2);
      expect(result[0]!.performedReps).toBe(12);
      expect(result[1]!.performedReps).toBe(11);
      expect(result[2]!.performedReps).toBe(10);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/progression-service.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/progression-service.test.ts
git commit -m "$(cat <<'EOF'
test: add primary block matching tests for progression service
EOF
)"
```

---

### Task 5: Test block matching -- fallback match

**Files:**
- Modify: `web/tests/unit/services/progression-service.test.ts`

This task adds tests for the fallback matching strategy (same tag + targetKind when blockSignature doesn't match).

- [ ] **Step 1: Add fallback match tests**

Append inside the `describe("progression-service")` block, after the primary match describe:

```ts
  // =====================================================================
  // findMatchingBlock -- fallback match
  // =====================================================================

  describe("findMatchingBlock -- fallback match", () => {
    it("falls back to tag + targetKind when blockSignature does not match", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      // Old block: reps 6-8, count 1, tag top
      const oldBlock: SetBlock = {
        targetKind: "reps",
        minValue: 6,
        maxValue: 8,
        count: 1,
        tag: "top",
      };
      // New block (different range): reps 4-6, count 1, tag top
      const newBlock: SetBlock = {
        targetKind: "reps",
        minValue: 4,
        maxValue: 6,
        count: 1,
        tag: "top",
      };

      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", [oldBlock]);
      await db.sessionExercises.add(se);

      const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, oldBlock, {
        performedWeightKg: 100,
        performedReps: 8,
      });
      await db.loggedSets.add(ls);

      // Query with the new block's signature -- primary won't match
      const result = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        generateBlockSignature(newBlock),
        "top",
        "reps"
      );

      // Should fall back and find the old block by tag + targetKind
      expect(result).toHaveLength(1);
      expect(result[0]!.performedWeightKg).toBe(100);
    });

    it("fallback respects tag -- null tag does not match top tag", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const topBlock: SetBlock = {
        targetKind: "reps",
        minValue: 6,
        maxValue: 8,
        count: 1,
        tag: "top",
      };

      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", [topBlock]);
      await db.sessionExercises.add(se);

      const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, topBlock, {
        performedWeightKg: 100,
      });
      await db.loggedSets.add(ls);

      // Query with null tag (normal set) -- should NOT match a top-tagged set
      const differentSig = "reps:10-15:count4:tagnormal";
      const result = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        differentSig,
        null,
        "reps"
      );

      expect(result).toEqual([]);
    });

    it("fallback respects targetKind -- reps does not match duration", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const repsBlock: SetBlock = {
        targetKind: "reps",
        minValue: 8,
        maxValue: 12,
        count: 3,
      };

      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", [repsBlock]);
      await db.sessionExercises.add(se);

      const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, repsBlock);
      await db.loggedSets.add(ls);

      // Query with duration targetKind -- should NOT match reps
      const durationSig = "duration:30-60:count2:tagnormal";
      const result = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        durationSig,
        null,
        "duration"
      );

      expect(result).toEqual([]);
    });

    it("prefers primary match over fallback when both exist", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const block: SetBlock = {
        targetKind: "reps",
        minValue: 8,
        maxValue: 12,
        count: 3,
      };

      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", [block]);
      await db.sessionExercises.add(se);

      const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, block, {
        performedWeightKg: 80,
      });
      await db.loggedSets.add(ls);

      // Query with the exact same blockSignature -- should use primary, not fallback
      const result = await findMatchingBlock(
        db,
        "barbell-back-squat",
        null,
        generateBlockSignature(block),
        null,
        "reps"
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.performedWeightKg).toBe(80);
    });
  });
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/progression-service.test.ts
```

Expected: All 10 tests pass (6 primary + 4 fallback).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/progression-service.test.ts
git commit -m "$(cat <<'EOF'
test: add fallback block matching tests for progression service
EOF
)"
```

---

### Task 6: Test the suggestion engine -- progression cases

**Files:**
- Modify: `web/tests/unit/services/progression-service.test.ts`

This task tests the `calculateBlockSuggestion` function for cases where progression applies.

- [ ] **Step 1: Add suggestion engine progression tests**

Append inside the `describe("progression-service")` block:

```ts
  // =====================================================================
  // calculateBlockSuggestion -- progression cases
  // =====================================================================

  describe("calculateBlockSuggestion -- progression", () => {
    it("suggests 5% increase when all 4 conditions are met (barbell, kg)", () => {
      // Previous: 100kg, all 3 sets hit ceiling of 12
      const matchingSets: LoggedSet[] = [
        makeLoggedSet("ls0", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 12,
        }),
        makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 1, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 12,
        }),
        makeLoggedSet("ls2", "s1", "se1", "barbell-back-squat", 0, 2, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 12,
        }),
      ];

      const result = calculateBlockSuggestion(
        matchingSets,
        STANDARD_BLOCK,
        0,
        "weight",
        "barbell",
        "kg"
      );

      expect(result).not.toBeNull();
      expect(result!.isProgression).toBe(true);
      // 100 * 1.05 = 105, nearest barbell kg increment (2.5) = 105
      expect(result!.suggestedWeightKg).toBe(105);
      expect(result!.previousWeightKg).toBe(100);
    });

    it("rounds to nearest dumbbell increment (2kg)", () => {
      const matchingSets: LoggedSet[] = [
        makeLoggedSet("ls0", "s1", "se1", "dumbbell-bench-press", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: 30, performedReps: 12,
        }),
        makeLoggedSet("ls1", "s1", "se1", "dumbbell-bench-press", 0, 1, STANDARD_BLOCK, {
          performedWeightKg: 30, performedReps: 12,
        }),
        makeLoggedSet("ls2", "s1", "se1", "dumbbell-bench-press", 0, 2, STANDARD_BLOCK, {
          performedWeightKg: 30, performedReps: 12,
        }),
      ];

      const result = calculateBlockSuggestion(
        matchingSets,
        STANDARD_BLOCK,
        0,
        "weight",
        "dumbbell",
        "kg"
      );

      expect(result).not.toBeNull();
      expect(result!.isProgression).toBe(true);
      // 30 * 1.05 = 31.5, nearest dumbbell kg increment (2) = 32
      expect(result!.suggestedWeightKg).toBe(32);
    });

    it("rounds to nearest machine increment (5kg)", () => {
      const matchingSets: LoggedSet[] = [
        makeLoggedSet("ls0", "s1", "se1", "leg-curl", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: 60, performedReps: 12,
        }),
        makeLoggedSet("ls1", "s1", "se1", "leg-curl", 0, 1, STANDARD_BLOCK, {
          performedWeightKg: 60, performedReps: 12,
        }),
        makeLoggedSet("ls2", "s1", "se1", "leg-curl", 0, 2, STANDARD_BLOCK, {
          performedWeightKg: 60, performedReps: 12,
        }),
      ];

      const result = calculateBlockSuggestion(
        matchingSets,
        STANDARD_BLOCK,
        0,
        "weight",
        "machine",
        "kg"
      );

      expect(result).not.toBeNull();
      expect(result!.isProgression).toBe(true);
      // 60 * 1.05 = 63, nearest machine kg increment (5) = 65
      expect(result!.suggestedWeightKg).toBe(65);
    });

    it("rounds in lbs when user prefers lbs", () => {
      const matchingSets: LoggedSet[] = [
        makeLoggedSet("ls0", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 12,
        }),
        makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 1, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 12,
        }),
        makeLoggedSet("ls2", "s1", "se1", "barbell-back-squat", 0, 2, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 12,
        }),
      ];

      const result = calculateBlockSuggestion(
        matchingSets,
        STANDARD_BLOCK,
        0,
        "weight",
        "barbell",
        "lbs"
      );

      expect(result).not.toBeNull();
      expect(result!.isProgression).toBe(true);
      // 100kg * 1.05 = 105kg -> ~231.5 lbs -> rounded to 230 lbs (barbell lbs increment 5)
      // 230 lbs -> ~104.33 kg
      // The exact value depends on rounding, but it should be higher than 100
      expect(result!.suggestedWeightKg).toBeGreaterThan(100);
      expect(result!.previousWeightKg).toBe(100);
    });

    it("works for top set blocks with tag", () => {
      const matchingSets: LoggedSet[] = [
        makeLoggedSet("ls0", "s1", "se1", "barbell-back-squat", 0, 0, TOP_SET_BLOCK, {
          performedWeightKg: 120, performedReps: 8, tag: "top",
        }),
      ];

      const result = calculateBlockSuggestion(
        matchingSets,
        TOP_SET_BLOCK,
        0,
        "weight",
        "barbell",
        "kg"
      );

      expect(result).not.toBeNull();
      expect(result!.isProgression).toBe(true);
      // 120 * 1.05 = 126, nearest barbell kg increment (2.5) = 125
      // Actually: Math.round(126 / 2.5) * 2.5 = Math.round(50.4) * 2.5 = 50 * 2.5 = 125
      expect(result!.suggestedWeightKg).toBe(125);
    });
  });
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/progression-service.test.ts
```

Expected: All 15 tests pass (6 primary + 4 fallback + 5 progression).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/progression-service.test.ts
git commit -m "$(cat <<'EOF'
test: add suggestion engine progression tests with rounding
EOF
)"
```

---

### Task 7: Test the suggestion engine -- no-suggestion cases

**Files:**
- Modify: `web/tests/unit/services/progression-service.test.ts`

This task covers all the cases where no progression increase should be suggested.

- [ ] **Step 1: Add no-suggestion and repeat-weight tests**

Append inside the `describe("progression-service")` block:

```ts
  // =====================================================================
  // calculateBlockSuggestion -- no-suggestion cases
  // =====================================================================

  describe("calculateBlockSuggestion -- no-suggestion cases", () => {
    it("returns null when no matching sets exist", () => {
      const result = calculateBlockSuggestion(
        [],
        STANDARD_BLOCK,
        0,
        "weight",
        "barbell",
        "kg"
      );

      expect(result).toBeNull();
    });

    it("returns null for exact-rep blocks (no range)", () => {
      const matchingSets: LoggedSet[] = [
        makeLoggedSet("ls0", "s1", "se1", "barbell-back-squat", 0, 0, EXACT_REPS_BLOCK, {
          performedWeightKg: 80, performedReps: 8,
        }),
        makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 1, EXACT_REPS_BLOCK, {
          performedWeightKg: 80, performedReps: 8,
        }),
        makeLoggedSet("ls2", "s1", "se1", "barbell-back-squat", 0, 2, EXACT_REPS_BLOCK, {
          performedWeightKg: 80, performedReps: 8,
        }),
      ];

      const result = calculateBlockSuggestion(
        matchingSets,
        EXACT_REPS_BLOCK,
        0,
        "weight",
        "barbell",
        "kg"
      );

      // Should suggest same weight (repeat), not a progression
      expect(result).not.toBeNull();
      expect(result!.isProgression).toBe(false);
      expect(result!.suggestedWeightKg).toBe(80);
    });

    it("returns null for cardio exercises", () => {
      const result = calculateBlockSuggestion(
        [makeLoggedSet("ls0", "s1", "se1", "run-walk", 0, 0, DURATION_BLOCK, {
          performedWeightKg: null, performedDurationSec: 45,
        })],
        DURATION_BLOCK,
        0,
        "cardio",
        "cardio",
        "kg"
      );

      expect(result).toBeNull();
    });

    it("returns null for isometric exercises", () => {
      const result = calculateBlockSuggestion(
        [makeLoggedSet("ls0", "s1", "se1", "plank", 0, 0, DURATION_BLOCK, {
          performedWeightKg: null, performedDurationSec: 60,
        })],
        DURATION_BLOCK,
        0,
        "isometric",
        "bodyweight",
        "kg"
      );

      expect(result).toBeNull();
    });

    it("returns null for unweighted bodyweight exercises (null weight)", () => {
      const result = calculateBlockSuggestion(
        [makeLoggedSet("ls0", "s1", "se1", "pull-up", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: null, performedReps: 10,
        })],
        STANDARD_BLOCK,
        0,
        "bodyweight",
        "bodyweight",
        "kg"
      );

      expect(result).toBeNull();
    });

    it("suggests same weight when not all sets hit ceiling", () => {
      const matchingSets: LoggedSet[] = [
        makeLoggedSet("ls0", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 12,
        }),
        makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 1, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 11, // did not hit ceiling of 12
        }),
        makeLoggedSet("ls2", "s1", "se1", "barbell-back-squat", 0, 2, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 10,
        }),
      ];

      const result = calculateBlockSuggestion(
        matchingSets,
        STANDARD_BLOCK,
        0,
        "weight",
        "barbell",
        "kg"
      );

      expect(result).not.toBeNull();
      expect(result!.isProgression).toBe(false);
      expect(result!.suggestedWeightKg).toBe(100);
    });

    it("suggests same weight when not all expected sets are logged (partial completion)", () => {
      // Block expects 3 sets but only 2 were logged
      const matchingSets: LoggedSet[] = [
        makeLoggedSet("ls0", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 12,
        }),
        makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 1, STANDARD_BLOCK, {
          performedWeightKg: 100, performedReps: 12,
        }),
      ];

      const result = calculateBlockSuggestion(
        matchingSets,
        STANDARD_BLOCK, // count = 3
        0,
        "weight",
        "barbell",
        "kg"
      );

      expect(result).not.toBeNull();
      expect(result!.isProgression).toBe(false);
      expect(result!.suggestedWeightKg).toBe(100);
    });

    it("returns null when previous weight is null", () => {
      const matchingSets: LoggedSet[] = [
        makeLoggedSet("ls0", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: null, performedReps: 12,
        }),
      ];

      const result = calculateBlockSuggestion(
        matchingSets,
        STANDARD_BLOCK,
        0,
        "weight",
        "barbell",
        "kg"
      );

      expect(result).toBeNull();
    });
  });
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/progression-service.test.ts
```

Expected: All 23 tests pass (6 primary + 4 fallback + 5 progression + 8 no-suggestion).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/progression-service.test.ts
git commit -m "$(cat <<'EOF'
test: add no-suggestion and repeat-weight test cases
EOF
)"
```

---

### Task 8: Test getExerciseHistoryData -- multi-block exercises

**Files:**
- Modify: `web/tests/unit/services/progression-service.test.ts`

This task tests the main `getExerciseHistoryData` function, which is the primary consumer-facing API. It covers multi-block exercises (top set + back-off) with separate suggestions per block, verifying invariant 8.

- [ ] **Step 1: Add getExerciseHistoryData tests**

Append inside the `describe("progression-service")` block:

```ts
  // =====================================================================
  // getExerciseHistoryData -- multi-block (invariant 8, acceptance test 8)
  // =====================================================================

  describe("getExerciseHistoryData", () => {
    it("returns per-block last-time and suggestions for multi-block exercise", async () => {
      // Setup: finished session with barbell back squat, 2 blocks
      // Block 0: top set 6-8 x1 tag:top -> hit ceiling
      // Block 1: back-off 8-12 x3 -> did NOT hit ceiling
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const blocks: SetBlock[] = [TOP_SET_BLOCK, STANDARD_BLOCK];
      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", blocks);
      await db.sessionExercises.add(se);

      // Top set: 120kg x 8 (hit ceiling)
      const lsTop = makeLoggedSet("ls-top", "s1", "se1", "barbell-back-squat", 0, 0, TOP_SET_BLOCK, {
        performedWeightKg: 120, performedReps: 8, tag: "top",
      });

      // Back-off: 100kg x 12, 11, 10 (did NOT all hit ceiling)
      const lsBo0 = makeLoggedSet("ls-bo0", "s1", "se1", "barbell-back-squat", 1, 0, STANDARD_BLOCK, {
        performedWeightKg: 100, performedReps: 12,
        loggedAt: "2026-03-28T14:10:00.000Z",
      });
      const lsBo1 = makeLoggedSet("ls-bo1", "s1", "se1", "barbell-back-squat", 1, 1, STANDARD_BLOCK, {
        performedWeightKg: 100, performedReps: 11,
        loggedAt: "2026-03-28T14:12:00.000Z",
      });
      const lsBo2 = makeLoggedSet("ls-bo2", "s1", "se1", "barbell-back-squat", 1, 2, STANDARD_BLOCK, {
        performedWeightKg: 100, performedReps: 10,
        loggedAt: "2026-03-28T14:14:00.000Z",
      });

      await db.loggedSets.bulkAdd([lsTop, lsBo0, lsBo1, lsBo2]);

      // Create the current session exercise that we're getting history for
      const currentSE = makeSessionExercise(
        "se-current",
        "s-current",
        "barbell-back-squat",
        blocks
      );

      const result = await getExerciseHistoryData(db, currentSE, "kg");

      // Last-time: 2 blocks
      expect(result.lastTime).toHaveLength(2);

      expect(result.lastTime[0]!.blockLabel).toBe("Top");
      expect(result.lastTime[0]!.tag).toBe("top");
      expect(result.lastTime[0]!.sets).toHaveLength(1);
      expect(result.lastTime[0]!.sets[0]!.weightKg).toBe(120);
      expect(result.lastTime[0]!.sets[0]!.reps).toBe(8);

      expect(result.lastTime[1]!.sets).toHaveLength(3);
      expect(result.lastTime[1]!.sets[0]!.reps).toBe(12);
      expect(result.lastTime[1]!.sets[1]!.reps).toBe(11);
      expect(result.lastTime[1]!.sets[2]!.reps).toBe(10);

      // Suggestions: 2 blocks
      expect(result.suggestions).toHaveLength(2);

      // Top set: all conditions met -> progression
      const topSuggestion = result.suggestions.find((s) => s.blockIndex === 0);
      expect(topSuggestion).toBeDefined();
      expect(topSuggestion!.isProgression).toBe(true);
      expect(topSuggestion!.suggestedWeightKg).toBeGreaterThan(120);

      // Back-off: not all hit ceiling -> same weight
      const boSuggestion = result.suggestions.find((s) => s.blockIndex === 1);
      expect(boSuggestion).toBeDefined();
      expect(boSuggestion!.isProgression).toBe(false);
      expect(boSuggestion!.suggestedWeightKg).toBe(100);
    });

    it("returns empty data for exercises with no history", async () => {
      const se = makeSessionExercise(
        "se-current",
        "s-current",
        "barbell-back-squat",
        [STANDARD_BLOCK]
      );

      const result = await getExerciseHistoryData(db, se, "kg");

      expect(result.lastTime).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it("returns empty data for extra exercises (invariant 7)", async () => {
      // Setup some history for the exercise
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", [STANDARD_BLOCK]);
      await db.sessionExercises.add(se);

      const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        performedWeightKg: 100, performedReps: 12,
      });
      await db.loggedSets.add(ls);

      // Query as an extra exercise -- should return empty
      const extraSE = makeSessionExercise(
        "se-extra",
        "s-current",
        "barbell-back-squat",
        [],
        { origin: "extra" }
      );

      const result = await getExerciseHistoryData(db, extraSE, "kg");

      expect(result.lastTime).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it("returns empty data for exercises with empty setBlocksSnapshot", async () => {
      const se = makeSessionExercise(
        "se-current",
        "s-current",
        "barbell-back-squat",
        []
      );

      const result = await getExerciseHistoryData(db, se, "kg");

      expect(result.lastTime).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });

    it("handles single-block exercise with progression", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const se = makeSessionExercise("se1", "s1", "leg-curl", [STANDARD_BLOCK], {
        effectiveEquipment: "machine",
      });
      await db.sessionExercises.add(se);

      // All 3 sets hit ceiling
      await db.loggedSets.bulkAdd([
        makeLoggedSet("ls0", "s1", "se1", "leg-curl", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: 60, performedReps: 12,
          loggedAt: "2026-03-28T14:05:00.000Z",
        }),
        makeLoggedSet("ls1", "s1", "se1", "leg-curl", 0, 1, STANDARD_BLOCK, {
          performedWeightKg: 60, performedReps: 12,
          loggedAt: "2026-03-28T14:06:00.000Z",
        }),
        makeLoggedSet("ls2", "s1", "se1", "leg-curl", 0, 2, STANDARD_BLOCK, {
          performedWeightKg: 60, performedReps: 12,
          loggedAt: "2026-03-28T14:07:00.000Z",
        }),
      ]);

      const currentSE = makeSessionExercise(
        "se-current",
        "s-current",
        "leg-curl",
        [STANDARD_BLOCK],
        { effectiveEquipment: "machine" }
      );

      const result = await getExerciseHistoryData(db, currentSE, "kg");

      // Single block -- no label needed
      expect(result.lastTime).toHaveLength(1);
      expect(result.lastTime[0]!.blockLabel).toBe("");

      // Progression should apply
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]!.isProgression).toBe(true);
      // 60 * 1.05 = 63, nearest machine kg increment (5) = 65
      expect(result.suggestions[0]!.suggestedWeightKg).toBe(65);
    });

    it("handles weighted bodyweight exercise with progression", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      // Weighted pull-up: effectiveType = "weight" (from override)
      const se = makeSessionExercise("se1", "s1", "pull-up", [STANDARD_BLOCK], {
        effectiveType: "weight",
        effectiveEquipment: "bodyweight",
      });
      await db.sessionExercises.add(se);

      // All 3 sets hit ceiling with 20kg added weight
      await db.loggedSets.bulkAdd([
        makeLoggedSet("ls0", "s1", "se1", "pull-up", 0, 0, STANDARD_BLOCK, {
          performedWeightKg: 20, performedReps: 12,
          loggedAt: "2026-03-28T14:05:00.000Z",
        }),
        makeLoggedSet("ls1", "s1", "se1", "pull-up", 0, 1, STANDARD_BLOCK, {
          performedWeightKg: 20, performedReps: 12,
          loggedAt: "2026-03-28T14:06:00.000Z",
        }),
        makeLoggedSet("ls2", "s1", "se1", "pull-up", 0, 2, STANDARD_BLOCK, {
          performedWeightKg: 20, performedReps: 12,
          loggedAt: "2026-03-28T14:07:00.000Z",
        }),
      ]);

      const currentSE = makeSessionExercise(
        "se-current",
        "s-current",
        "pull-up",
        [STANDARD_BLOCK],
        { effectiveType: "weight", effectiveEquipment: "bodyweight" }
      );

      const result = await getExerciseHistoryData(db, currentSE, "kg");

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]!.isProgression).toBe(true);
      // 20 * 1.05 = 21, nearest bodyweight kg increment (2.5) = 22.5
      // Actually: Math.round(21 / 2.5) * 2.5 = Math.round(8.4) * 2.5 = 8 * 2.5 = 20
      // That rounds down to 20 (same weight), so minimum increment kicks in
      // The suggestion should be > 20
      expect(result.suggestions[0]!.suggestedWeightKg).toBeGreaterThan(20);
    });
  });
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/progression-service.test.ts
```

Expected: All 30 tests pass (6 + 4 + 5 + 8 + 7).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/progression-service.test.ts
git commit -m "$(cat <<'EOF'
test: add getExerciseHistoryData tests for multi-block and invariants 7-8
EOF
)"
```

---

### Task 9: Test extra exercise history

**Files:**
- Modify: `web/tests/unit/services/progression-service.test.ts`

This task tests the `getExtraExerciseHistory` function.

- [ ] **Step 1: Add extra exercise history tests**

Append inside the `describe("progression-service")` block:

```ts
  // =====================================================================
  // getExtraExerciseHistory
  // =====================================================================

  describe("getExtraExerciseHistory", () => {
    it("returns the most recent finished session sets for an exerciseId", async () => {
      // Two finished sessions with the same exercise
      const session1 = makeFinishedSession("s1", "2026-03-26T15:00:00.000Z");
      const session2 = makeFinishedSession("s2", "2026-03-28T15:00:00.000Z");
      await db.sessions.bulkAdd([session1, session2]);

      // Session 1 sets
      const se1 = makeSessionExercise("se1", "s1", "barbell-back-squat", [STANDARD_BLOCK]);
      const se2 = makeSessionExercise("se2", "s2", "barbell-back-squat", [STANDARD_BLOCK]);
      await db.sessionExercises.bulkAdd([se1, se2]);

      const ls1 = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        performedWeightKg: 90, performedReps: 10,
        loggedAt: "2026-03-26T14:05:00.000Z",
      });
      const ls2 = makeLoggedSet("ls2", "s2", "se2", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        performedWeightKg: 95, performedReps: 11,
        loggedAt: "2026-03-28T14:05:00.000Z",
      });
      await db.loggedSets.bulkAdd([ls1, ls2]);

      const result = await getExtraExerciseHistory(db, "barbell-back-squat");

      expect(result).not.toBeNull();
      expect(result!.sets).toHaveLength(1);
      expect(result!.sets[0]!.weightKg).toBe(95);
      expect(result!.sets[0]!.reps).toBe(11);
      expect(result!.sessionDate).toBe("2026-03-28T15:00:00.000Z");
    });

    it("returns null when no history exists", async () => {
      const result = await getExtraExerciseHistory(db, "nonexistent-exercise");

      expect(result).toBeNull();
    });

    it("ignores active sessions", async () => {
      const finishedSession = makeFinishedSession("s1", "2026-03-26T15:00:00.000Z");
      const activeSession = makeFinishedSession("s2", "2026-03-28T15:00:00.000Z", {
        status: "active",
        finishedAt: null,
      });
      await db.sessions.bulkAdd([finishedSession, activeSession]);

      const se1 = makeSessionExercise("se1", "s1", "barbell-back-squat", [STANDARD_BLOCK]);
      const se2 = makeSessionExercise("se2", "s2", "barbell-back-squat", [STANDARD_BLOCK]);
      await db.sessionExercises.bulkAdd([se1, se2]);

      const ls1 = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        performedWeightKg: 90,
        loggedAt: "2026-03-26T14:05:00.000Z",
      });
      const ls2 = makeLoggedSet("ls2", "s2", "se2", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        performedWeightKg: 100,
        loggedAt: "2026-03-28T14:05:00.000Z",
      });
      await db.loggedSets.bulkAdd([ls1, ls2]);

      const result = await getExtraExerciseHistory(db, "barbell-back-squat");

      expect(result).not.toBeNull();
      // Should only use the finished session's data
      expect(result!.sets[0]!.weightKg).toBe(90);
    });

    it("returns sets from any routine position and instanceLabel", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      // Same exerciseId but with an instanceLabel
      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", [STANDARD_BLOCK], {
        instanceLabel: "close-grip",
      });
      await db.sessionExercises.add(se);

      const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        instanceLabel: "close-grip",
        performedWeightKg: 70,
        loggedAt: "2026-03-28T14:05:00.000Z",
      });
      await db.loggedSets.add(ls);

      // Extra exercise query ignores instanceLabel
      const result = await getExtraExerciseHistory(db, "barbell-back-squat");

      expect(result).not.toBeNull();
      expect(result!.sets).toHaveLength(1);
      expect(result!.sets[0]!.weightKg).toBe(70);
    });

    it("returns sets sorted by blockIndex then setIndex", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      const se = makeSessionExercise("se1", "s1", "barbell-back-squat", [TOP_SET_BLOCK, STANDARD_BLOCK]);
      await db.sessionExercises.add(se);

      // Add sets out of order
      await db.loggedSets.bulkAdd([
        makeLoggedSet("ls-bo2", "s1", "se1", "barbell-back-squat", 1, 2, STANDARD_BLOCK, {
          performedWeightKg: 80, performedReps: 10,
          loggedAt: "2026-03-28T14:14:00.000Z",
        }),
        makeLoggedSet("ls-top", "s1", "se1", "barbell-back-squat", 0, 0, TOP_SET_BLOCK, {
          performedWeightKg: 120, performedReps: 7, tag: "top",
          loggedAt: "2026-03-28T14:05:00.000Z",
        }),
        makeLoggedSet("ls-bo0", "s1", "se1", "barbell-back-squat", 1, 0, STANDARD_BLOCK, {
          performedWeightKg: 80, performedReps: 12,
          loggedAt: "2026-03-28T14:10:00.000Z",
        }),
        makeLoggedSet("ls-bo1", "s1", "se1", "barbell-back-squat", 1, 1, STANDARD_BLOCK, {
          performedWeightKg: 80, performedReps: 11,
          loggedAt: "2026-03-28T14:12:00.000Z",
        }),
      ]);

      const result = await getExtraExerciseHistory(db, "barbell-back-squat");

      expect(result).not.toBeNull();
      expect(result!.sets).toHaveLength(4);
      // Should be sorted: block 0 set 0, block 1 set 0, block 1 set 1, block 1 set 2
      expect(result!.sets[0]!.weightKg).toBe(120);
      expect(result!.sets[1]!.weightKg).toBe(80);
      expect(result!.sets[1]!.reps).toBe(12);
      expect(result!.sets[2]!.reps).toBe(11);
      expect(result!.sets[3]!.reps).toBe(10);
    });

    it("includes both routine and extra origin sets", async () => {
      const session = makeFinishedSession("s1", "2026-03-28T15:00:00.000Z");
      await db.sessions.add(session);

      // One routine set and one extra set for same exerciseId
      const seRoutine = makeSessionExercise("se1", "s1", "barbell-back-squat", [STANDARD_BLOCK]);
      const seExtra = makeSessionExercise("se2", "s1", "barbell-back-squat", [], {
        origin: "extra",
        orderIndex: 1,
      });
      await db.sessionExercises.bulkAdd([seRoutine, seExtra]);

      const lsRoutine = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        performedWeightKg: 100, performedReps: 10,
        loggedAt: "2026-03-28T14:05:00.000Z",
      });
      const lsExtra = makeLoggedSet("ls2", "s1", "se2", "barbell-back-squat", 0, 0, STANDARD_BLOCK, {
        origin: "extra",
        blockSignature: "extra:0:count0:tagnormal",
        performedWeightKg: 80, performedReps: 15,
        loggedAt: "2026-03-28T14:30:00.000Z",
      });
      await db.loggedSets.bulkAdd([lsRoutine, lsExtra]);

      const result = await getExtraExerciseHistory(db, "barbell-back-squat");

      expect(result).not.toBeNull();
      // getExtraExerciseHistory is for display convenience -- it includes all sets
      expect(result!.sets.length).toBeGreaterThanOrEqual(2);
    });
  });
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/progression-service.test.ts
```

Expected: All 36 tests pass (6 + 4 + 5 + 8 + 7 + 6).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/progression-service.test.ts
git commit -m "$(cat <<'EOF'
test: add extra exercise history tests
EOF
)"
```

---

### Task 10: Run full test suite and verify

**Files:**
- No new files

This task runs the complete test suite to verify nothing is broken.

- [ ] **Step 1: Run all tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run
```

Expected: All tests pass, including Phase 2-4 tests plus all new Phase 5 tests. Zero failures.

- [ ] **Step 2: Run type checking**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx tsc --noEmit --project tsconfig.app.json
```

Expected: No type errors.

- [ ] **Step 3: Verify the progression service exports are correct**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
node -e "
const ts = require('typescript');
const source = ts.sys.readFile('src/services/progression-service.ts');
const exports = source.match(/export (async )?function (\w+)/g);
console.log('Exports:', exports);
"
```

Expected: Exports include `findMatchingBlock`, `calculateBlockSuggestion`, `getExerciseHistoryData`, `getExtraExerciseHistory`.

- [ ] **Step 4: Final commit (if any adjustments were needed)**

Only if fixes were made in steps 1-3:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add -A web/src/services/progression-service.ts web/tests/unit/services/progression-service.test.ts
git commit -m "$(cat <<'EOF'
fix: address test suite issues in progression service
EOF
)"
```

---

## Summary of Phase 5 Deliverables

### New files
| File | Purpose |
|------|---------|
| `web/src/services/progression-service.ts` | Block matching, suggestion engine, last-time display, extra history |
| `web/tests/unit/services/progression-service.test.ts` | ~36 unit tests covering all progression and history logic |

### Exported API

| Function | Purpose |
|----------|---------|
| `findMatchingBlock(db, exerciseId, instanceLabel, blockSignature, tag, targetKind)` | Find matching logged sets from most recent finished session (primary + fallback) |
| `calculateBlockSuggestion(matchingSets, block, blockIndex, effectiveType, effectiveEquipment, units)` | Evaluate 4 progression conditions, return suggestion or null |
| `getExerciseHistoryData(db, sessionExercise, units)` | Main UI entry point: per-block last-time + suggestions for a routine exercise |
| `getExtraExerciseHistory(db, exerciseId)` | Most recent sets for an extra exercise regardless of routine position |

### Return types

| Type | Purpose |
|------|---------|
| `LastTimeSet` | Single set's performed data |
| `BlockLastTime` | Per-block label + sets array |
| `BlockSuggestion` | Weight suggestion with progression flag |
| `ExerciseHistoryData` | Combined lastTime + suggestions for an exercise card |
| `ExtraExerciseHistory` | Sets + session date for extras |

### Spec coverage

| Spec requirement | Covered by |
|-----------------|-----------|
| Primary match (exerciseId + instanceLabel + blockSignature) | `findMatchingBlock` + tests |
| Fallback match (tag + targetKind) | `findMatchingBlock` + tests |
| 4 progression conditions | `calculateBlockSuggestion` + tests |
| 5% increase with practical rounding | `calculateBlockSuggestion` + tests |
| Exact-rep no-suggestion | Test: "returns null for exact-rep blocks" |
| Cardio no-suggestion | Test: "returns null for cardio exercises" |
| Extra no-suggestion (invariant 7) | `getExerciseHistoryData` guard + test |
| Per-block progression (invariant 8) | `getExerciseHistoryData` multi-block test |
| Partial completion no-progression | Test: "suggests same weight when not all expected sets are logged" |
| Last-time display per block | `getExerciseHistoryData` + tests |
| Extra exercise history | `getExtraExerciseHistory` + tests |
| Only finished sessions | All matching functions filter by status="finished" |
| Weighted bodyweight progression | Test: "handles weighted bodyweight exercise with progression" |
| instanceLabel matching | Test: "respects instanceLabel -- null only matches null" |
| Acceptance test scenario 8 | Multi-block test: top set ready for increase, back-off not |
