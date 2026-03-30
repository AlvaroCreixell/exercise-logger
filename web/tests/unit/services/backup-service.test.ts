import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ExerciseLoggerDB,
  DEFAULT_SETTINGS,
  initializeSettings,
} from "@/db/database";
import {
  exportBackup,
  importBackup,
  clearAllData,
  validateBackupPayload,
  readJsonFile,
  type BackupEnvelope,
  type BackupData,
} from "@/services/backup-service";
import type {
  Exercise,
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
  Settings,
} from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let db: ExerciseLoggerDB;

function makeExercise(
  id: string,
  overrides?: Partial<Exercise>
): Exercise {
  return {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
    ...overrides,
  };
}

function makeRoutine(id: string, overrides?: Partial<Routine>): Routine {
  return {
    id,
    schemaVersion: 1,
    name: "Test Routine",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A"],
    nextDayId: "A",
    days: {
      A: {
        id: "A",
        label: "Day A",
        entries: [],
      },
    },
    notes: [],
    cardio: null,
    importedAt: "2026-03-28T10:00:00.000Z",
    ...overrides,
  };
}

function makeSession(
  id: string,
  overrides?: Partial<Session>
): Session {
  return {
    id,
    routineId: "r1",
    routineNameSnapshot: "Test Routine",
    dayId: "A",
    dayLabelSnapshot: "Day A",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: "2026-03-28T10:00:00.000Z",
    finishedAt: "2026-03-28T11:00:00.000Z",
    ...overrides,
  };
}

function makeSessionExercise(
  id: string,
  sessionId: string,
  exerciseId: string,
  overrides?: Partial<SessionExercise>
): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: "entry-1",
    exerciseId,
    exerciseNameSnapshot: "Test Exercise",
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel: "",
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: null,
    setBlocksSnapshot: [
      { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 },
    ],
    createdAt: "2026-03-28T10:00:00.000Z",
    ...overrides,
  };
}

function makeLoggedSet(
  id: string,
  sessionId: string,
  sessionExerciseId: string,
  exerciseId: string,
  overrides?: Partial<LoggedSet>
): LoggedSet {
  return {
    id,
    sessionId,
    sessionExerciseId,
    exerciseId,
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: 60,
    performedReps: 10,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-03-28T10:05:00.000Z",
    updatedAt: "2026-03-28T10:05:00.000Z",
    ...overrides,
  };
}

function makeValidEnvelope(overrides?: {
  routines?: Routine[];
  sessions?: Session[];
  sessionExercises?: SessionExercise[];
  loggedSets?: LoggedSet[];
  settings?: Settings;
}): BackupEnvelope {
  return {
    app: "exercise-logger",
    schemaVersion: 1,
    exportedAt: "2026-03-28T12:00:00.000Z",
    data: {
      routines: overrides?.routines ?? [makeRoutine("r1")],
      sessions: overrides?.sessions ?? [makeSession("s1")],
      sessionExercises: overrides?.sessionExercises ?? [
        makeSessionExercise("se1", "s1", "barbell-back-squat"),
      ],
      loggedSets: overrides?.loggedSets ?? [
        makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat"),
      ],
      settings: overrides?.settings ?? { ...DEFAULT_SETTINGS },
    },
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

beforeEach(async () => {
  db = new ExerciseLoggerDB();
  await initializeSettings(db);
  await db.exercises.bulkAdd([
    makeExercise("barbell-back-squat"),
    makeExercise("leg-curl"),
    makeExercise("dumbbell-bench-press"),
  ]);
});

afterEach(async () => {
  await db.delete();
});

// =========================================================================
// exportBackup
// =========================================================================

describe("exportBackup", () => {
  it("exports an empty database with correct envelope structure", async () => {
    const result = await exportBackup(db);

    expect(result.app).toBe("exercise-logger");
    expect(result.schemaVersion).toBe(1);
    expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.data.routines).toEqual([]);
    expect(result.data.sessions).toEqual([]);
    expect(result.data.sessionExercises).toEqual([]);
    expect(result.data.loggedSets).toEqual([]);
    expect(result.data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("exports all user data including routines, sessions, and sets", async () => {
    const routine = makeRoutine("r1");
    const session = makeSession("s1");
    const se = makeSessionExercise("se1", "s1", "barbell-back-squat");
    const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat");

    await db.routines.add(routine);
    await db.sessions.add(session);
    await db.sessionExercises.add(se);
    await db.loggedSets.add(ls);

    const result = await exportBackup(db);

    expect(result.data.routines).toHaveLength(1);
    expect(result.data.routines[0]!.id).toBe("r1");
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0]!.id).toBe("s1");
    expect(result.data.sessionExercises).toHaveLength(1);
    expect(result.data.sessionExercises[0]!.id).toBe("se1");
    expect(result.data.loggedSets).toHaveLength(1);
    expect(result.data.loggedSets[0]!.id).toBe("ls1");
  });

  it("does not export exercises (catalog)", async () => {
    const result = await exportBackup(db);

    // The envelope must not contain exercises
    const dataKeys = Object.keys(result.data);
    expect(dataKeys).not.toContain("exercises");
  });

  it("exports even with an active session present", async () => {
    const session = makeSession("s1", { status: "active", finishedAt: null });
    await db.sessions.add(session);

    const result = await exportBackup(db);

    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0]!.status).toBe("active");
  });
});

// =========================================================================
// validateBackupPayload
// =========================================================================

describe("validateBackupPayload", () => {
  const catalogIds = new Set(["barbell-back-squat", "leg-curl", "dumbbell-bench-press"]);

  it("accepts a valid envelope", () => {
    const envelope = makeValidEnvelope();
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual([]);
  });

  it("rejects when app is not exercise-logger", () => {
    const envelope = { ...makeValidEnvelope(), app: "wrong-app" };
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "app",
          message: expect.stringContaining('"exercise-logger"'),
        }),
      ])
    );
  });

  it("rejects unsupported schemaVersion", () => {
    const envelope = { ...makeValidEnvelope(), schemaVersion: 99 };
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "schemaVersion",
          message: expect.stringContaining("unsupported"),
        }),
      ])
    );
  });

  it("rejects missing data object", () => {
    const envelope = { app: "exercise-logger", schemaVersion: 1, exportedAt: "now" };
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data",
          message: "must be an object",
        }),
      ])
    );
  });

  it("rejects missing required collections", () => {
    const envelope = {
      app: "exercise-logger",
      schemaVersion: 1,
      exportedAt: "now",
      data: {},
    };
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it("rejects unknown exerciseId in sessionExercises", () => {
    const envelope = makeValidEnvelope({
      sessionExercises: [
        makeSessionExercise("se1", "s1", "unknown-exercise-xyz"),
      ],
      loggedSets: [],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.sessionExercises[0].exerciseId",
          message: expect.stringContaining("not found in current catalog"),
        }),
      ])
    );
  });

  it("rejects unknown exerciseId in loggedSets", () => {
    const envelope = makeValidEnvelope({
      loggedSets: [
        makeLoggedSet("ls1", "s1", "se1", "unknown-exercise-xyz"),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.loggedSets[0].exerciseId",
          message: expect.stringContaining("not found in current catalog"),
        }),
      ])
    );
  });

  it("rejects more than one active session", () => {
    const envelope = makeValidEnvelope({
      sessions: [
        makeSession("s1", { status: "active", finishedAt: null }),
        makeSession("s2", { status: "active", finishedAt: null }),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.sessions",
          message: expect.stringContaining("at most one"),
        }),
      ])
    );
  });

  it("accepts exactly one active session", () => {
    const envelope = makeValidEnvelope({
      sessions: [
        makeSession("s1", { status: "active", finishedAt: null }),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual([]);
  });

  it("rejects invalid session status", () => {
    const envelope = makeValidEnvelope({
      sessions: [
        makeSession("s1", { status: "bogus" as any }),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.sessions[0].status",
        }),
      ])
    );
  });

  it("rejects invalid settings units", () => {
    const envelope = makeValidEnvelope({
      settings: { ...DEFAULT_SETTINGS, units: "stones" as any },
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.settings.units",
        }),
      ])
    );
  });

  it("rejects non-object root", () => {
    const errors = validateBackupPayload("just a string", catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "root",
        }),
      ])
    );
  });

  it("rejects null root", () => {
    const errors = validateBackupPayload(null, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "root",
        }),
      ])
    );
  });

  // ERRATA P7-A: Test that routine exerciseId references are checked
  it("rejects unknown exerciseId in routine entries", () => {
    const envelope = makeValidEnvelope({
      routines: [
        makeRoutine("r1", {
          days: {
            A: {
              id: "A",
              label: "Day A",
              entries: [
                {
                  kind: "exercise",
                  entryId: "e1",
                  exerciseId: "nonexistent-exercise",
                  setBlocks: [{ targetKind: "reps", minValue: 8, maxValue: 12, count: 3 }],
                },
              ],
            },
          },
        }),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining("nonexistent-exercise"),
        }),
      ])
    );
  });

  // ERRATA P7-B: Test deep validation of routine entries
  it("rejects routine entry with invalid kind", () => {
    const envelope = makeValidEnvelope({
      routines: [
        makeRoutine("r1", {
          days: {
            A: {
              id: "A",
              label: "Day A",
              entries: [
                {
                  kind: "invalid" as any,
                  entryId: "e1",
                  exerciseId: "barbell-back-squat",
                  setBlocks: [],
                },
              ],
            },
          },
        }),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('"exercise" or "superset"'),
        }),
      ])
    );
  });

  // ERRATA P7-C: Test cross-record FK integrity
  it("rejects settings.activeRoutineId referencing missing routine", () => {
    const envelope = makeValidEnvelope({
      routines: [makeRoutine("r1")],
      settings: { ...DEFAULT_SETTINGS, activeRoutineId: "nonexistent-routine" },
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.settings.activeRoutineId",
          message: expect.stringContaining("nonexistent-routine"),
        }),
      ])
    );
  });

  it("rejects sessionExercise referencing missing session", () => {
    const envelope = makeValidEnvelope({
      sessions: [makeSession("s1")],
      sessionExercises: [
        makeSessionExercise("se1", "nonexistent-session", "barbell-back-squat"),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.sessionExercises[0].sessionId",
          message: expect.stringContaining("nonexistent-session"),
        }),
      ])
    );
  });

  it("rejects loggedSet referencing missing sessionExercise", () => {
    const envelope = makeValidEnvelope({
      sessionExercises: [
        makeSessionExercise("se1", "s1", "barbell-back-squat"),
      ],
      loggedSets: [
        makeLoggedSet("ls1", "s1", "nonexistent-se", "barbell-back-squat"),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.loggedSets[0].sessionExerciseId",
          message: expect.stringContaining("nonexistent-se"),
        }),
      ])
    );
  });
});

// =========================================================================
// importBackup
// =========================================================================

describe("importBackup", () => {
  it("replaces all existing data with imported data", async () => {
    // Add some existing data
    await db.routines.add(makeRoutine("existing-r1", { name: "Old Routine" }));
    await db.sessions.add(makeSession("existing-s1"));

    // Import new data
    const envelope = makeValidEnvelope();
    await importBackup(db, envelope);

    // Verify old data is gone, new data is in
    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0]!.id).toBe("r1");

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe("s1");

    const se = await db.sessionExercises.toArray();
    expect(se).toHaveLength(1);

    const ls = await db.loggedSets.toArray();
    expect(ls).toHaveLength(1);

    const settings = await db.settings.get("user");
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("blocks import while a local active session exists", async () => {
    await db.sessions.add(
      makeSession("local-active", { status: "active", finishedAt: null })
    );

    const envelope = makeValidEnvelope();

    await expect(importBackup(db, envelope)).rejects.toThrow(
      /active.*session/i
    );
  });

  it("imports data containing one active session successfully", async () => {
    const envelope = makeValidEnvelope({
      sessions: [
        makeSession("s1", { status: "active", finishedAt: null }),
      ],
    });

    const result = await importBackup(db, envelope);

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.status).toBe("active");

    // ERRATA P7-F: importBackup returns hasActiveSession flag
    expect(result.hasActiveSession).toBe(true);
  });

  it("imports empty collections successfully", async () => {
    const envelope = makeValidEnvelope({
      routines: [],
      sessions: [],
      sessionExercises: [],
      loggedSets: [],
    });

    await importBackup(db, envelope);

    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(0);
    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(0);
  });

  it("returns hasActiveSession=false when no active session in import", async () => {
    const envelope = makeValidEnvelope();
    const result = await importBackup(db, envelope);
    expect(result.hasActiveSession).toBe(false);
  });
});

// =========================================================================
// clearAllData
// =========================================================================

describe("clearAllData", () => {
  it("deletes all user data and recreates default settings", async () => {
    // Populate data
    await db.routines.add(makeRoutine("r1"));
    await db.sessions.add(makeSession("s1"));
    await db.sessionExercises.add(
      makeSessionExercise("se1", "s1", "barbell-back-squat")
    );
    await db.loggedSets.add(
      makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat")
    );
    await db.settings.update("user", { activeRoutineId: "r1", units: "lbs" });

    await clearAllData(db);

    expect(await db.routines.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sessionExercises.count()).toBe(0);
    expect(await db.loggedSets.count()).toBe(0);

    // Settings should be reset to defaults
    const settings = await db.settings.get("user");
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("does not delete the exercise catalog", async () => {
    await clearAllData(db);

    const exercises = await db.exercises.toArray();
    expect(exercises.length).toBeGreaterThan(0);
  });

  it("blocks clear while an active session exists", async () => {
    await db.sessions.add(
      makeSession("s1", { status: "active", finishedAt: null })
    );

    await expect(clearAllData(db)).rejects.toThrow(/active.*session/i);
  });
});

// =========================================================================
// readJsonFile
// =========================================================================

describe("readJsonFile", () => {
  it("parses valid JSON from a File", async () => {
    const content = JSON.stringify({ app: "exercise-logger" });
    const file = new File([content], "backup.json", {
      type: "application/json",
    });

    const result = await readJsonFile(file);
    expect(result).toEqual({ app: "exercise-logger" });
  });

  it("throws on invalid JSON", async () => {
    const file = new File(["not valid json!!!"], "bad.json", {
      type: "application/json",
    });

    await expect(readJsonFile(file)).rejects.toThrow(/Invalid JSON/);
  });
});

// =========================================================================
// Round-trip test
// =========================================================================

describe("export -> import round-trip", () => {
  it("round-trips all persisted user data", async () => {
    // Populate data
    const routine = makeRoutine("r1");
    const session = makeSession("s1");
    const se = makeSessionExercise("se1", "s1", "barbell-back-squat");
    const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat");

    await db.routines.add(routine);
    await db.sessions.add(session);
    await db.sessionExercises.add(se);
    await db.loggedSets.add(ls);
    await db.settings.update("user", { units: "lbs", activeRoutineId: "r1" });

    // Export
    const exported = await exportBackup(db);

    // Clear the database to simulate importing into a fresh state
    await db.routines.clear();
    await db.sessions.clear();
    await db.sessionExercises.clear();
    await db.loggedSets.clear();
    await db.settings.put(DEFAULT_SETTINGS);

    // Validate the exported data
    const catalogIds = new Set(
      (await db.exercises.toArray()).map((e) => e.id)
    );
    const errors = validateBackupPayload(exported, catalogIds);
    expect(errors).toEqual([]);

    // Import
    await importBackup(db, exported);

    // Verify all data round-tripped
    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0]!.id).toBe("r1");
    expect(routines[0]!.name).toBe("Test Routine");

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe("s1");

    const seResult = await db.sessionExercises.toArray();
    expect(seResult).toHaveLength(1);
    expect(seResult[0]!.id).toBe("se1");

    const lsResult = await db.loggedSets.toArray();
    expect(lsResult).toHaveLength(1);
    expect(lsResult[0]!.id).toBe("ls1");

    const settings = await db.settings.get("user");
    expect(settings!.units).toBe("lbs");
    expect(settings!.activeRoutineId).toBe("r1");
  });
});
