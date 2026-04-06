import "fake-indexeddb/auto";
import Dexie from "dexie";
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
  RoutineEntry,
  SetBlock,
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

    // --- Weighted bodyweight runtime detection (P4-D) ---

    it("promotes effectiveType from bodyweight to weight when weight is logged", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "pull-up",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      // Verify starts as bodyweight
      const seBefore = await db.sessionExercises.get(seId);
      expect(seBefore!.effectiveType).toBe("bodyweight");

      await logSet(db, seId, 0, 0, {
        performedWeightKg: 10,
        performedReps: 8,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      // Should be promoted
      const seAfter = await db.sessionExercises.get(seId);
      expect(seAfter!.effectiveType).toBe("weight");
    });

    it("[P4-D] promotes effectiveType on UPDATE path too (not just create)", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "pull-up",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      // First log without weight (no promotion)
      await logSet(db, seId, 0, 0, {
        performedWeightKg: null,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      const seMiddle = await db.sessionExercises.get(seId);
      expect(seMiddle!.effectiveType).toBe("bodyweight");

      // Re-log same slot with weight (should promote on update path)
      await logSet(db, seId, 0, 0, {
        performedWeightKg: 10,
        performedReps: 8,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      const seAfter = await db.sessionExercises.get(seId);
      expect(seAfter!.effectiveType).toBe("weight");
    });

    // --- [P4-G] setIndex validation ---

    it("[P4-G] throws if setIndex is out of range for block count", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "barbell-back-squat",
          setBlocks: [TOP_SET_BLOCK], // count: 1
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      // setIndex 1 is out of range for a block with count=1
      await expect(
        logSet(db, seId, 0, 1, {
          performedWeightKg: 100,
          performedReps: 7,
          performedDurationSec: null,
          performedDistanceM: null,
        })
      ).rejects.toThrow("Set index 1 out of range");
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
      ).rejects.toThrow(/session .* is "finished"/);
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
      // updatedAt should be a valid ISO timestamp (may equal original if same ms)
      expect(edited.updatedAt).toBeDefined();
      expect(new Date(edited.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.updatedAt).getTime()
      );

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

    // --- [P4-E] Weighted bodyweight promotion on edit ---

    it("[P4-E] promotes effectiveType from bodyweight to weight when editing to add weight", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "pull-up",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      // Log without weight
      const logged = await logSet(db, seId, 0, 0, {
        performedWeightKg: null,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      const seBefore = await db.sessionExercises.get(seId);
      expect(seBefore!.effectiveType).toBe("bodyweight");

      // Edit to add weight -- should promote
      await editSet(db, logged.id, {
        performedWeightKg: 10,
        performedReps: 8,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      const seAfter = await db.sessionExercises.get(seId);
      expect(seAfter!.effectiveType).toBe("weight");
    });

    // --- [P4-F] Negative test: editing to null weight does NOT demote ---

    it("[P4-F] editing set to null weight does NOT demote effectiveType back to bodyweight", async () => {
      const routine = makeRoutine([
        {
          kind: "exercise",
          entryId: "A-e0",
          exerciseId: "pull-up",
          setBlocks: [STANDARD_BLOCK],
        },
      ]);
      await db.routines.add(routine);
      const session = await startSessionWithCatalog(db, routine, "A");
      const seId = session.sessionExercises[0]!.id;

      // Log with weight (promotes to "weight")
      const logged = await logSet(db, seId, 0, 0, {
        performedWeightKg: 10,
        performedReps: 8,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      const seAfterLog = await db.sessionExercises.get(seId);
      expect(seAfterLog!.effectiveType).toBe("weight");

      // Edit to remove weight -- should NOT demote
      await editSet(db, logged.id, {
        performedWeightKg: null,
        performedReps: 10,
        performedDurationSec: null,
        performedDistanceM: null,
      });

      const seAfterEdit = await db.sessionExercises.get(seId);
      expect(seAfterEdit!.effectiveType).toBe("weight"); // Still "weight", no demotion
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
