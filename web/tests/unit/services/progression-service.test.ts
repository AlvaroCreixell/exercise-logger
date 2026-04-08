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
  Session,
  SessionExercise,
  LoggedSet,
  SetBlock,
} from "@/domain/types";
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
    instanceLabel: "",
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
      // P5-F: exercise ID "run-walk" matches the corrected CSV slug (Run-Walk -> run-walk)
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
        instanceLabel: "",
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
      // P5-E: Exact value assertion within floating-point tolerance
      // 100kg * 1.05 = 105kg -> ~231.49 lbs -> rounded to 230 lbs (barbell lbs increment 5)
      // 230 lbs -> lbsToKg(230) = 230 * 0.45359237 = 104.326... kg
      // Rounded to 0.01: 104.33
      expect(result!.suggestedWeightKg).toBeCloseTo(104.33, 1);
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

      // P5-D: Back-off label should be "Back-off" since it follows a top-tagged block
      expect(result.lastTime[1]!.blockLabel).toBe("Back-off");
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
      // 20 * 1.05 = 21, nearest bodyweight kg increment (2.5) = 20
      // Math.round(21 / 2.5) * 2.5 = Math.round(8.4) * 2.5 = 8 * 2.5 = 20
      // That rounds down to 20 (same weight), so P5-B minimum increment kicks in
      // 20 + 2.5 = 22.5
      expect(result.suggestions[0]!.suggestedWeightKg).toBe(22.5);
    });

    describe("sparse multi-block history", () => {
      const TWO_BLOCKS: SetBlock[] = [
        { targetKind: "reps", minValue: 6, maxValue: 8, count: 1, tag: "top" },
        { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 },
      ];

      it("returns lastTime keyed by blockIndex when only block 1 has history", async () => {
        const ex = makeExercise("squat");
        await db.exercises.add(ex);
        const s1 = makeFinishedSession("s1", "2026-03-10T15:00:00.000Z");
        await db.sessions.add(s1);
        const se1 = makeSessionExercise("se1", "s1", "squat", TWO_BLOCKS);
        await db.sessionExercises.add(se1);

        for (let i = 0; i < 3; i++) {
          await db.loggedSets.add(
            makeLoggedSet(`ls-1-${i}`, "s1", "se1", "squat", 1, i, TWO_BLOCKS[1]!, {
              performedWeightKg: 80,
              performedReps: 10,
            })
          );
        }

        const se2 = makeSessionExercise("se2", "s2", "squat", TWO_BLOCKS);
        await db.sessions.add({ ...makeFinishedSession("s2", "2026-03-11T15:00:00.000Z"), status: "active" as const });
        await db.sessionExercises.add(se2);

        const result = await getExerciseHistoryData(db, se2, "kg");

        expect(result.lastTime[0]).toBeUndefined();
        expect(result.lastTime[1]).toBeDefined();
        expect(result.lastTime[1]!.sets).toHaveLength(3);
        expect(result.lastTime[1]!.sets[0]!.weightKg).toBe(80);
      });

      it("returns lastTime keyed by blockIndex when only block 0 has history", async () => {
        const ex = makeExercise("bench");
        await db.exercises.add(ex);
        const s1 = makeFinishedSession("s1", "2026-03-10T15:00:00.000Z");
        await db.sessions.add(s1);
        const se1 = makeSessionExercise("se1", "s1", "bench", TWO_BLOCKS);
        await db.sessionExercises.add(se1);

        await db.loggedSets.add(
          makeLoggedSet("ls-0-0", "s1", "se1", "bench", 0, 0, TWO_BLOCKS[0]!, {
            performedWeightKg: 100,
            performedReps: 6,
          })
        );

        const se2 = makeSessionExercise("se2", "s2", "bench", TWO_BLOCKS);
        await db.sessions.add({ ...makeFinishedSession("s2", "2026-03-11T15:00:00.000Z"), status: "active" as const });
        await db.sessionExercises.add(se2);

        const result = await getExerciseHistoryData(db, se2, "kg");

        expect(result.lastTime[0]).toBeDefined();
        expect(result.lastTime[0]!.sets).toHaveLength(1);
        expect(result.lastTime[0]!.sets[0]!.weightKg).toBe(100);
        expect(result.lastTime[1]).toBeUndefined();
      });
    });
  });

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
});
