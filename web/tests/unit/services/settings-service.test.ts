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
  setUnitOverride,
} from "@/services/settings-service";
import type { Routine, Session, SessionExercise } from "@/domain/types";

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

  // --- setUnitOverride ---

  describe("setUnitOverride", () => {
    function makeSessionExercise(overrides: Partial<SessionExercise> = {}): SessionExercise {
      return {
        id: "se1",
        sessionId: "s1",
        routineEntryId: null,
        exerciseId: "leg-press",
        exerciseNameSnapshot: "Leg Press",
        origin: "routine",
        orderIndex: 0,
        groupType: "single",
        supersetGroupId: null,
        supersetPosition: null,
        instanceLabel: "",
        effectiveType: "weight",
        effectiveEquipment: "machine",
        notesSnapshot: null,
        setBlocksSnapshot: [],
        createdAt: "2026-04-08T10:00:00.000Z",
        unitOverride: null,
        ...overrides,
      };
    }

    it("updates the unitOverride on a session exercise", async () => {
      const session: Session = {
        id: "s1", routineId: null, routineNameSnapshot: "Test",
        dayId: "A", dayLabelSnapshot: "Day A", dayOrderSnapshot: ["A"],
        restDefaultSecSnapshot: 90, restSupersetSecSnapshot: 60,
        status: "active", startedAt: "2026-04-08T10:00:00.000Z", finishedAt: null,
      };
      await db.sessions.add(session);
      await db.sessionExercises.add(makeSessionExercise());

      await setUnitOverride(db, "se1", "lbs");

      const updated = await db.sessionExercises.get("se1");
      expect(updated!.unitOverride).toBe("lbs");
    });

    it("sets unitOverride back to null", async () => {
      const session: Session = {
        id: "s2", routineId: null, routineNameSnapshot: "Test",
        dayId: "A", dayLabelSnapshot: "Day A", dayOrderSnapshot: ["A"],
        restDefaultSecSnapshot: 90, restSupersetSecSnapshot: 60,
        status: "active", startedAt: "2026-04-08T10:00:00.000Z", finishedAt: null,
      };
      await db.sessions.add(session);
      await db.sessionExercises.add(makeSessionExercise({ id: "se2", sessionId: "s2", unitOverride: "lbs" }));

      await setUnitOverride(db, "se2", null);

      const updated = await db.sessionExercises.get("se2");
      expect(updated!.unitOverride).toBeNull();
    });
  });
});
