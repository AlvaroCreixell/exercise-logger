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
