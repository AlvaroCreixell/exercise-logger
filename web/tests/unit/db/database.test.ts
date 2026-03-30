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
      instanceLabel: "",
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
      instanceLabel: "",
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
      instanceLabel: "",
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
      instanceLabel: "",
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
      instanceLabel: "",
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
      instanceLabel: "",
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
