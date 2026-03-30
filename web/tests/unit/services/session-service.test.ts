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
      expect(extra.instanceLabel).toBe("");
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
