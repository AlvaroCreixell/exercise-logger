import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { db } from "@/db/database";
import { useSessionDetail } from "@/shared/hooks/useSessionDetail";
import type { Session, SessionExercise, LoggedSet } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(id: string): Session {
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
    startedAt: "2026-03-28T14:00:00.000Z",
    finishedAt: "2026-03-28T15:00:00.000Z",
  };
}

function makeSessionExercise(
  id: string,
  sessionId: string,
  orderIndex: number = 0
): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: null,
    exerciseId: "barbell-back-squat",
    exerciseNameSnapshot: "Barbell Back Squat",
    origin: "routine",
    orderIndex,
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
}

function makeLoggedSet(
  id: string,
  sessionId: string,
  sessionExerciseId: string,
  blockIndex: number = 0,
  setIndex: number = 0,
  loggedAt: string = "2026-03-28T14:10:00.000Z"
): LoggedSet {
  return {
    id,
    sessionId,
    sessionExerciseId,
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex,
    tag: null,
    performedWeightKg: 100,
    performedReps: 10,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt,
    updatedAt: loggedAt,
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.sessions.clear();
  await db.sessionExercises.clear();
  await db.loggedSets.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSessionDetail", () => {
  it("returns null when sessionId is undefined", async () => {
    const { result } = renderHook(() => useSessionDetail(undefined));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toBeNull();
  });

  it("returns null for a non-existent session ID", async () => {
    const { result } = renderHook(() => useSessionDetail("nonexistent-id"));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toBeNull();
  });

  it("returns session with exercises sorted by orderIndex", async () => {
    const session = makeSession("s1");
    await db.sessions.add(session);

    // Add exercises in reverse order to verify sorting
    const se2 = makeSessionExercise("se2", "s1", 1);
    const se1 = makeSessionExercise("se1", "s1", 0);
    await db.sessionExercises.bulkAdd([se2, se1]);

    const { result } = renderHook(() => useSessionDetail("s1"));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    const detail = result.current!;
    expect(detail).not.toBeNull();
    expect(detail!.session.id).toBe("s1");
    expect(detail!.exercises).toHaveLength(2);
    expect(detail!.exercises[0]!.sessionExercise.id).toBe("se1");
    expect(detail!.exercises[1]!.sessionExercise.id).toBe("se2");
  });

  it("groups logged sets by sessionExercise and sorts by blockIndex then setIndex", async () => {
    const session = makeSession("s1");
    await db.sessions.add(session);

    const se1 = makeSessionExercise("se1", "s1", 0);
    await db.sessionExercises.add(se1);

    // Add sets out of order to verify sorting
    const set_b1_s1 = makeLoggedSet("ls-b1s1", "s1", "se1", 1, 1, "2026-03-28T14:15:00.000Z");
    const set_b0_s0 = makeLoggedSet("ls-b0s0", "s1", "se1", 0, 0, "2026-03-28T14:10:00.000Z");
    const set_b0_s1 = makeLoggedSet("ls-b0s1", "s1", "se1", 0, 1, "2026-03-28T14:11:00.000Z");
    const set_b1_s0 = makeLoggedSet("ls-b1s0", "s1", "se1", 1, 0, "2026-03-28T14:14:00.000Z");

    await db.loggedSets.bulkAdd([set_b1_s1, set_b0_s0, set_b0_s1, set_b1_s0]);

    const { result } = renderHook(() => useSessionDetail("s1"));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    const detail = result.current!;
    const sets = detail!.exercises[0]!.loggedSets;
    expect(sets).toHaveLength(4);
    expect(sets[0]!.id).toBe("ls-b0s0");
    expect(sets[1]!.id).toBe("ls-b0s1");
    expect(sets[2]!.id).toBe("ls-b1s0");
    expect(sets[3]!.id).toBe("ls-b1s1");
  });

  it("returns empty loggedSets array for exercises with no sets", async () => {
    const session = makeSession("s1");
    await db.sessions.add(session);

    const se1 = makeSessionExercise("se1", "s1", 0);
    await db.sessionExercises.add(se1);
    // No sets added

    const { result } = renderHook(() => useSessionDetail("s1"));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    const detail = result.current!;
    expect(detail!.exercises[0]!.loggedSets).toEqual([]);
  });
});
