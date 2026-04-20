import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/database";
import { importAndActivateRoutine } from "@/services/routine-service";
import { generateId } from "@/domain/uuid";
import { nowISO } from "@/domain/timestamp";
import type { Routine, Session } from "@/domain/types";

beforeEach(async () => {
  await db.sessions.clear();
  await db.routines.clear();
  await db.settings.clear();
  await db.settings.put({ id: "user", activeRoutineId: null, units: "kg" });
});

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: generateId(),
    schemaVersion: 1,
    name: "Test Routine",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A"],
    nextDayId: "A",
    days: { A: { id: "A", label: "Day A", entries: [] } },
    notes: [],
    cardio: null,
    importedAt: nowISO(),
    ...overrides,
  };
}

function makeActiveSession(): Session {
  return {
    id: generateId(),
    routineId: null,
    routineNameSnapshot: "Old",
    dayId: "A",
    dayLabelSnapshot: "Day A",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "active",
    startedAt: nowISO(),
    finishedAt: null,
  };
}

describe("importAndActivateRoutine", () => {
  it("inserts the routine and sets it active when no session is active", async () => {
    const routine = makeRoutine({ name: "New Plan" });

    const result = await importAndActivateRoutine(db, routine);

    expect(result.ok).toBe(true);
    const stored = await db.routines.get(routine.id);
    expect(stored).toBeDefined();
    expect(stored?.name).toBe("New Plan");
    const settings = await db.settings.get("user");
    expect(settings?.activeRoutineId).toBe(routine.id);
  });

  it("blocks when an active session exists — returns ok:false and does NOT insert the routine", async () => {
    await db.sessions.put(makeActiveSession());
    const routine = makeRoutine({ name: "Blocked Plan" });

    const result = await importAndActivateRoutine(db, routine);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.blocked).toBe("active-session");
      expect(result.message.toLowerCase()).toContain("active");
    }
    const stored = await db.routines.get(routine.id);
    expect(stored).toBeUndefined();
    const settings = await db.settings.get("user");
    expect(settings?.activeRoutineId).toBeNull();
  });

  it("replaces the previously active routine when called again", async () => {
    const first = makeRoutine({ name: "First" });
    await importAndActivateRoutine(db, first);
    const second = makeRoutine({ name: "Second" });

    const result = await importAndActivateRoutine(db, second);

    expect(result.ok).toBe(true);
    const settings = await db.settings.get("user");
    expect(settings?.activeRoutineId).toBe(second.id);
    // Both routines should still exist; first is just no longer active.
    expect(await db.routines.get(first.id)).toBeDefined();
    expect(await db.routines.get(second.id)).toBeDefined();
  });
});
