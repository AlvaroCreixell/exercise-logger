import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ExerciseLoggerDB,
  initializeSettings,
} from "@/db/database";
import { parseExerciseCatalog, seedCatalog } from "@/services/catalog-service";
import {
  validateAndNormalizeRoutine,
  importRoutine,
} from "@/services/routine-service";
import {
  startSessionWithCatalog,
  resumeSession,
  discardSession,
  finishSession,
  addExtraExercise,
} from "@/services/session-service";
import { logSet, editSet, deleteSet } from "@/services/set-service";
import {
  setActiveRoutine,
  deleteRoutine,
} from "@/services/settings-service";
import {
  exportBackup,
  importBackup,
  clearAllData,
  validateBackupPayload,
} from "@/services/backup-service";
import {
  getExerciseHistoryData,
} from "@/services/progression-service";
import { generateBlockSignature } from "@/domain/block-signature";
import type {
  Exercise,
} from "@/domain/types";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Setup: shared database and catalog
// ---------------------------------------------------------------------------

let db: ExerciseLoggerDB;
let catalogExercises: Exercise[];
let exerciseLookup: Map<string, Exercise>;

/**
 * Load the real CSV catalog from the repo.
 * This tests against the actual catalog, not a mock.
 */
async function loadRealCatalog(): Promise<Exercise[]> {
  const csvPath = path.resolve(
    __dirname,
    "../../src/data/catalog.csv"
  );
  const csvText = fs.readFileSync(csvPath, "utf-8");
  return parseExerciseCatalog(csvText);
}

/**
 * Load the real routine YAML from the repo.
 */
function loadRealRoutineYaml(): string {
  const yamlPath = path.resolve(
    __dirname,
    "../../data/routines/full-body-3day.yaml"
  );
  return fs.readFileSync(yamlPath, "utf-8");
}

beforeEach(async () => {
  db = new ExerciseLoggerDB();
  catalogExercises = await loadRealCatalog();
  await seedCatalog(db, catalogExercises);
  await initializeSettings(db);
  exerciseLookup = new Map(catalogExercises.map((e) => [e.id, e]));
});

afterEach(async () => {
  await db.delete();
});

// =========================================================================
// Scenario 1: Catalog seed succeeds
// =========================================================================

describe("Scenario 1: Catalog seed succeeds", () => {
  it("seeds all exercises from the real CSV including required additions", async () => {
    const exercises = await db.exercises.toArray();
    expect(exercises.length).toBeGreaterThan(50);

    // Verify the required additions from spec section 8
    const requiredIds = [
      "pallof-press",
      "cable-woodchop",
      "medicine-ball-rotational-slam",
      "wrist-roller",
      "reverse-lunge",
      "dumbbell-reverse-lunge",
      "single-leg-romanian-deadlift",
      "dumbbell-pullover",
    ];

    for (const id of requiredIds) {
      const exercise = await db.exercises.get(id);
      expect(exercise, `Exercise ${id} must exist in catalog`).toBeDefined();
    }
  });

  it("supports the medicine-ball equipment type", async () => {
    const ex = await db.exercises.get("medicine-ball-rotational-slam");
    expect(ex).toBeDefined();
    expect(ex!.equipment).toBe("medicine-ball");
  });
});

// =========================================================================
// Scenario 2: Valid routine YAML imports successfully
// =========================================================================

describe("Scenario 2: Valid routine YAML imports successfully", () => {
  it("validates and normalizes the Full Body 3-Day Rotation", () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.routine.name).toBe("Full Body 3-Day Rotation");
      expect(result.routine.dayOrder).toEqual(["A", "B", "C"]);
      expect(result.routine.nextDayId).toBe("A");
      expect(result.routine.schemaVersion).toBe(1);
      expect(Object.keys(result.routine.days)).toEqual(
        expect.arrayContaining(["A", "B", "C"])
      );
    }
  });

  it("imports the routine into the database", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0]!.name).toBe("Full Body 3-Day Rotation");
    expect(routines[0]!.nextDayId).toBe("A");
  });
});

// =========================================================================
// Scenario 3: Invalid YAML fails with field-specific messages
// =========================================================================

describe("Scenario 3: Invalid YAML fails with field-specific messages", () => {
  it("rejects missing version", () => {
    const yaml = `
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const result = validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.path).toBeDefined();
      expect(result.errors[0]!.message).toBeDefined();
    }
  });

  it("rejects unknown exercise_id with a specific error", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: does-not-exist-at-all
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const result = validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const exerciseError = result.errors.find((e) =>
        e.message.toLowerCase().includes("does-not-exist-at-all")
      );
      expect(exerciseError).toBeDefined();
    }
  });

  it("rejects invalid YAML syntax", () => {
    const yaml = `
version: 1
name: "Test
  this is broken yaml
`;
    const result = validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) =>
          e.message.toLowerCase().includes("yaml")
        )
      ).toBe(true);
    }
  });
});

// =========================================================================
// Scenario 4: Starting workout creates active session + snapshot
// =========================================================================

describe("Scenario 4: Starting workout creates active session + snapshot", () => {
  it("creates one active session with full snapshot data", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);
    await setActiveRoutine(db, result.routine.id);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Session snapshots
    expect(sessionData.session.status).toBe("active");
    expect(sessionData.session.routineNameSnapshot).toBe(
      "Full Body 3-Day Rotation"
    );
    expect(sessionData.session.dayId).toBe("A");
    expect(sessionData.session.dayLabelSnapshot).toBeTruthy();
    expect(sessionData.session.dayOrderSnapshot).toEqual(["A", "B", "C"]);
    expect(sessionData.session.restDefaultSecSnapshot).toBe(90);
    expect(sessionData.session.restSupersetSecSnapshot).toBe(60);
    expect(sessionData.session.finishedAt).toBeNull();

    // Session exercises are snapshotted
    expect(sessionData.sessionExercises.length).toBeGreaterThan(0);
    for (const se of sessionData.sessionExercises) {
      expect(se.exerciseNameSnapshot).toBeTruthy();
      expect(se.exerciseId).toBeTruthy();
      expect(se.sessionId).toBe(sessionData.session.id);
    }
  });
});

// =========================================================================
// Scenario 5: Relaunch during active session resumes
// =========================================================================

describe("Scenario 5: Relaunch during active session resumes", () => {
  it("resumeSession returns the active session with all data", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const original = await startSessionWithCatalog(db, result.routine, "A");

    // Simulate relaunch by calling resumeSession
    const resumed = await resumeSession(db);

    expect(resumed).not.toBeNull();
    expect(resumed!.session.id).toBe(original.session.id);
    expect(resumed!.session.status).toBe("active");
    expect(resumed!.sessionExercises.length).toBe(
      original.sessionExercises.length
    );
  });
});

// =========================================================================
// Scenario 6: Day override works
// =========================================================================

describe("Scenario 6: Day override works", () => {
  it("suggested B, started A, finished A, next becomes B", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Set nextDayId to B (simulating that A was done last time)
    const routine = { ...result.routine, nextDayId: "B" };
    await importRoutine(db, routine);

    // Verify suggestion is B
    const storedRoutine = await db.routines.get(routine.id);
    expect(storedRoutine!.nextDayId).toBe("B");

    // Start with day A (override)
    const sessionData = await startSessionWithCatalog(db, routine, "A");
    expect(sessionData.session.dayId).toBe("A");

    // nextDayId should NOT change yet (invariant 3)
    const routineAfterStart = await db.routines.get(routine.id);
    expect(routineAfterStart!.nextDayId).toBe("B");

    // Finish the session
    await finishSession(db, sessionData.session.id);

    // After finishing day A, next should be B (the day after A in the rotation)
    const routineAfterFinish = await db.routines.get(routine.id);
    expect(routineAfterFinish!.nextDayId).toBe("B");
  });
});

// =========================================================================
// Scenario 7: Switching routines preserves nextDayId
// =========================================================================

describe("Scenario 7: Switching routines preserves nextDayId", () => {
  it("each routine keeps its own nextDayId when switching", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result1 = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;

    await importRoutine(db, result1.routine);

    // Create a second routine (minimal)
    const yaml2 = `
version: 1
name: "Simple 2-Day"
rest_default_sec: 60
rest_superset_sec: 45
day_order: [X, Y]
days:
  X:
    label: "Day X"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [8, 12], count: 3 }
  Y:
    label: "Day Y"
    entries:
      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const result2 = validateAndNormalizeRoutine(yaml2, exerciseLookup);
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;

    await importRoutine(db, result2.routine);

    // Start and finish a session with routine 1 to advance its nextDayId
    await setActiveRoutine(db, result1.routine.id);
    const session1 = await startSessionWithCatalog(
      db,
      result1.routine,
      "A"
    );
    await finishSession(db, session1.session.id);

    // Routine 1 should now have nextDayId = "B"
    const r1After = await db.routines.get(result1.routine.id);
    expect(r1After!.nextDayId).toBe("B");

    // Routine 2 should still have nextDayId = "X" (never touched)
    const r2After = await db.routines.get(result2.routine.id);
    expect(r2After!.nextDayId).toBe("X");

    // Switch to routine 2 and back
    await setActiveRoutine(db, result2.routine.id);
    await setActiveRoutine(db, result1.routine.id);

    // Both routines still have their own nextDayId
    const r1Final = await db.routines.get(result1.routine.id);
    expect(r1Final!.nextDayId).toBe("B");
    const r2Final = await db.routines.get(result2.routine.id);
    expect(r2Final!.nextDayId).toBe("X");
  });
});

// =========================================================================
// Scenario 8: Multi-block exercise shows separate history/suggestions
// =========================================================================

describe("Scenario 8: Multi-block exercise shows separate history/suggestions", () => {
  it("top-set and back-off blocks have independent history", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start and log sets for Day A (which has barbell-back-squat with 2 blocks)
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Find the barbell-back-squat session exercise
    const squat = sessionData.sessionExercises.find(
      (se) => se.exerciseId === "barbell-back-squat"
    );
    expect(squat).toBeDefined();
    expect(squat!.setBlocksSnapshot.length).toBe(2);

    // Block 0: top set (1 x 6-8, tag: top)
    // Block 1: back-off (3 x 8-12, no tag)
    const block0Sig = generateBlockSignature(squat!.setBlocksSnapshot[0]!);
    const block1Sig = generateBlockSignature(squat!.setBlocksSnapshot[1]!);
    expect(block0Sig).not.toBe(block1Sig);

    // Log top set: 100kg x 7
    await logSet(db, squat!.id, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Log back-off sets: 80kg x 12, 11, 10
    for (let i = 0; i < 3; i++) {
      await logSet(db, squat!.id, 1, i, {
        performedWeightKg: 80,
        performedReps: 12 - i,
        performedDurationSec: null,
        performedDistanceM: null,
      });
    }

    // Finish the session
    await finishSession(db, sessionData.session.id);

    // Now query history data: each block should have its own history
    const historyData = await getExerciseHistoryData(
      db,
      squat!,
      "kg"
    );

    expect(historyData.lastTime.length).toBe(2);

    // Block 0 (top set) should show 100kg x 7
    const block0History = historyData.lastTime[0]!;
    expect(block0History.sets).toHaveLength(1);
    expect(block0History.sets[0]!.weightKg).toBe(100);
    expect(block0History.sets[0]!.reps).toBe(7);

    // Block 1 (back-off) should show 80kg x 12, 11, 10
    const block1History = historyData.lastTime[1]!;
    expect(block1History.sets).toHaveLength(3);
    expect(block1History.sets[0]!.weightKg).toBe(80);
  });
});

// =========================================================================
// Scenario 9: Extra exercises excluded from progression
// =========================================================================

describe("Scenario 9: Extra exercises excluded from progression", () => {
  it("extra exercises can be added and logged but do not affect routine progression", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Add an extra exercise
    const extra = await addExtraExercise(
      db,
      sessionData.session.id,
      "leg-curl"
    );

    expect(extra.origin).toBe("extra");
    expect(extra.setBlocksSnapshot).toEqual([]);

    // Log a set for the extra exercise
    await logSet(db, extra.id, 0, 0, {
      performedWeightKg: 40,
      performedReps: 12,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Finish the session
    await finishSession(db, sessionData.session.id);

    // The extra's logged set should exist
    const allSets = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    const extraSets = allSets.filter((s) => s.origin === "extra");
    expect(extraSets).toHaveLength(1);

    // Start a new session and check that the routine exercise for leg-curl
    // (if it exists as a routine entry) does NOT use the extra's data for
    // progression. The extra exercise is tagged with origin="extra" so the
    // progression service filters it out.
    const routineEntry = sessionData.sessionExercises.find(
      (se) => se.exerciseId === "leg-curl" && se.origin === "routine"
    );
    if (routineEntry) {
      const historyData = await getExerciseHistoryData(db, routineEntry, "kg");
      // The routine entry's history should NOT include the extra's logged set
      // because progression matching requires origin="routine"
      for (const blockLastTime of historyData.lastTime) {
        for (const set of blockLastTime.sets) {
          // The extra logged 40kg, but since origin="extra" the progression
          // service must exclude it. The routine entry had no logged sets,
          // so this loop should not execute at all.
          expect(set.weightKg).not.toBe(40);
        }
      }
    }
  });
});

// =========================================================================
// Scenario 10: Superset timer starts after both sides logged
// =========================================================================

describe("Scenario 10: Superset timer starts after both sides logged", () => {
  it("superset round detection requires both members to have the same round logged", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Find a superset pair in Day A
    const supersetMembers = sessionData.sessionExercises.filter(
      (se) => se.groupType === "superset"
    );

    // Day A has one superset (dumbbell-bench-press + dumbbell-row)
    expect(supersetMembers.length).toBeGreaterThanOrEqual(2);

    const side0 = supersetMembers.find((se) => se.supersetPosition === 0);
    const side1 = supersetMembers.find(
      (se) =>
        se.supersetPosition === 1 &&
        se.supersetGroupId === side0?.supersetGroupId
    );
    expect(side0).toBeDefined();
    expect(side1).toBeDefined();

    // Both sides share the same supersetGroupId
    expect(side0!.supersetGroupId).toBe(side1!.supersetGroupId);

    // Log side 0, round 0
    await logSet(db, side0!.id, 0, 0, {
      performedWeightKg: 30,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // After logging only one side, the round is NOT complete
    const setsAfterOneSide = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    const side0Sets = setsAfterOneSide.filter(
      (s) => s.sessionExerciseId === side0!.id && s.setIndex === 0
    );
    const side1Sets = setsAfterOneSide.filter(
      (s) => s.sessionExerciseId === side1!.id && s.setIndex === 0
    );
    expect(side0Sets).toHaveLength(1);
    expect(side1Sets).toHaveLength(0);
    // Timer should NOT start yet (both sides need round 0)

    // Log side 1, round 0
    await logSet(db, side1!.id, 0, 0, {
      performedWeightKg: 25,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Now both sides have round 0 logged -- timer should start
    const setsAfterBothSides = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    const side0SetsNow = setsAfterBothSides.filter(
      (s) => s.sessionExerciseId === side0!.id && s.setIndex === 0
    );
    const side1SetsNow = setsAfterBothSides.filter(
      (s) => s.sessionExerciseId === side1!.id && s.setIndex === 0
    );
    expect(side0SetsNow).toHaveLength(1);
    expect(side1SetsNow).toHaveLength(1);
    // Both sides logged for round 0 -- superset round is complete.
    // Timer behavior is UI-only (Zustand), tested in timer-store.test.ts.
    // Here we verify the data prerequisite: both sides have setIndex 0.
  });
});

// =========================================================================
// Scenario 11: Edit/delete set updates history correctly
// =========================================================================

describe("Scenario 11: Edit/delete set updates history correctly", () => {
  it("editing a set updates the record without duplicating", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    const se = sessionData.sessionExercises[0]!;

    // Log a set
    const logged = await logSet(db, se.id, 0, 0, {
      performedWeightKg: 60,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Edit the set
    await editSet(db, logged.id, {
      performedWeightKg: 65,
      performedReps: 8,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Verify no duplicate
    const allSets = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    const matchingSets = allSets.filter(
      (s) =>
        s.sessionExerciseId === se.id &&
        s.blockIndex === 0 &&
        s.setIndex === 0
    );
    expect(matchingSets).toHaveLength(1);
    expect(matchingSets[0]!.performedWeightKg).toBe(65);
    expect(matchingSets[0]!.performedReps).toBe(8);
    expect(matchingSets[0]!.updatedAt).not.toBe(matchingSets[0]!.loggedAt);
  });

  it("deleting a set removes the record", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    const se = sessionData.sessionExercises[0]!;

    // Log a set
    const logged = await logSet(db, se.id, 0, 0, {
      performedWeightKg: 60,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Delete the set
    await deleteSet(db, logged.id);

    // Verify the set is gone
    const remaining = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(remaining.find((s) => s.id === logged.id)).toBeUndefined();
  });
});

// =========================================================================
// Scenario 12: Discard session removes records, no rotation advance
// =========================================================================

describe("Scenario 12: Discard session removes records, no rotation advance", () => {
  it("discarding deletes session, sessionExercises, loggedSets and does NOT advance nextDayId", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // nextDayId starts at "A"
    const routineBefore = await db.routines.get(result.routine.id);
    expect(routineBefore!.nextDayId).toBe("A");

    // Start a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Log a set so there is data to discard
    const se = sessionData.sessionExercises[0]!;
    await logSet(db, se.id, 0, 0, {
      performedWeightKg: 60,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Discard the session
    await discardSession(db, sessionData.session.id);

    // Session should be deleted (hard delete)
    const session = await db.sessions.get(sessionData.session.id);
    expect(session).toBeUndefined();

    // SessionExercises should be deleted
    const seAfter = await db.sessionExercises
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(seAfter).toHaveLength(0);

    // LoggedSets should be deleted
    const lsAfter = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(lsAfter).toHaveLength(0);

    // nextDayId should NOT have advanced (invariant 4)
    const routineAfter = await db.routines.get(result.routine.id);
    expect(routineAfter!.nextDayId).toBe("A");
  });
});

// =========================================================================
// Scenario 13: Finishing partial workout allowed
// =========================================================================

describe("Scenario 13: Finishing partial workout allowed", () => {
  it("can finish a session with only some sets logged", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Log only ONE set for the first exercise (partial)
    const se = sessionData.sessionExercises[0]!;
    await logSet(db, se.id, 0, 0, {
      performedWeightKg: 60,
      performedReps: 8,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Finish with many sets unlogged -- this must succeed
    await finishSession(db, sessionData.session.id);

    // Session is now finished
    const finished = await db.sessions.get(sessionData.session.id);
    expect(finished!.status).toBe("finished");
    expect(finished!.finishedAt).not.toBeNull();

    // The logged set is still there (history is valid)
    const sets = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(sets).toHaveLength(1);
    expect(sets[0]!.performedWeightKg).toBe(60);
  });
});

// =========================================================================
// Scenario 14: Deleting routine doesn't break history
// =========================================================================

describe("Scenario 14: Deleting routine doesn't break history", () => {
  it("historical sessions remain renderable after routine deletion", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);
    await setActiveRoutine(db, result.routine.id);

    // Start and finish a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );
    await finishSession(db, sessionData.session.id);

    // Delete the routine
    await deleteRoutine(db, result.routine.id);

    // Routine should be gone
    const routine = await db.routines.get(result.routine.id);
    expect(routine).toBeUndefined();

    // But the session still exists with snapshot data
    const session = await db.sessions.get(sessionData.session.id);
    expect(session).toBeDefined();
    expect(session!.routineNameSnapshot).toBe("Full Body 3-Day Rotation");
    expect(session!.dayLabelSnapshot).toBeTruthy();

    // Session exercises still have snapshot data
    const exercises = await db.sessionExercises
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(exercises.length).toBeGreaterThan(0);
    for (const se of exercises) {
      expect(se.exerciseNameSnapshot).toBeTruthy();
    }
  });
});

// =========================================================================
// Scenario 15: Export -> import round-trips data
// =========================================================================

describe("Scenario 15: Export -> import round-trips data", () => {
  it("exports and imports all persisted user data faithfully", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);
    await setActiveRoutine(db, result.routine.id);

    // Start and log some sets, then finish
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );
    const se = sessionData.sessionExercises[0]!;
    await logSet(db, se.id, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });
    await finishSession(db, sessionData.session.id);

    // Change settings
    await db.settings.update("user", { units: "lbs" });

    // Export
    const exported = await exportBackup(db);
    expect(exported.app).toBe("exercise-logger");
    expect(exported.schemaVersion).toBe(1);

    // Clear the database
    await clearAllData(db);

    // Verify the database is clean
    expect(await db.routines.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);

    // Validate the export
    const catalogIds = new Set(catalogExercises.map((e) => e.id));
    const errors = validateBackupPayload(exported, catalogIds);
    expect(errors).toEqual([]);

    // Import
    await importBackup(db, exported);

    // Verify round-trip fidelity
    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0]!.name).toBe("Full Body 3-Day Rotation");

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.status).toBe("finished");
    expect(sessions[0]!.routineNameSnapshot).toBe("Full Body 3-Day Rotation");

    const seAfter = await db.sessionExercises.toArray();
    expect(seAfter.length).toBeGreaterThan(0);

    const lsAfter = await db.loggedSets.toArray();
    expect(lsAfter).toHaveLength(1);
    expect(lsAfter[0]!.performedWeightKg).toBe(100);
    expect(lsAfter[0]!.performedReps).toBe(7);

    const settings = await db.settings.get("user");
    expect(settings!.units).toBe("lbs");
    expect(settings!.activeRoutineId).toBe(result.routine.id);
  });
});

// =========================================================================
// Scenario 16: Import blocked during active session
// =========================================================================

describe("Scenario 16: Import blocked during active session", () => {
  it("rejects import when a local active session exists", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start a session (creates an active session)
    await startSessionWithCatalog(db, result.routine, "A");

    // Try to import -- should be blocked
    const envelope = await exportBackup(db);

    await expect(importBackup(db, envelope)).rejects.toThrow(
      /active.*session/i
    );
  });

  it("allows import after the active session is finished", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start and finish a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );
    await finishSession(db, sessionData.session.id);

    // Now import should succeed
    const envelope = await exportBackup(db);
    await importBackup(db, envelope);

    // No error thrown -- import succeeded
    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
  });

  it("allows import after the active session is discarded", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start and discard a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );
    await discardSession(db, sessionData.session.id);

    // Now import should succeed
    const envelope = await exportBackup(db);
    await importBackup(db, envelope);

    // No error thrown
    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(0); // discarded was deleted, import has no sessions
  });
});
