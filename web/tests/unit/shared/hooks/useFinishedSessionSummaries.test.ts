import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { db } from "@/db/database";
import { useFinishedSessionSummaries } from "@/shared/hooks/useFinishedSessionSummaries";
import type { Session, SessionExercise, LoggedSet } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
  id: string,
  status: "active" | "finished" | "discarded",
  startedAt: string,
  finishedAt: string | null = null
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
    status,
    startedAt,
    finishedAt,
  };
}

function makeSessionExercise(id: string, sessionId: string): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: null,
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
    createdAt: "2026-03-28T12:00:00.000Z",
  };
}

function makeLoggedSet(
  id: string,
  sessionId: string,
  sessionExerciseId: string
): LoggedSet {
  return {
    id,
    sessionId,
    sessionExerciseId,
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: 100,
    performedReps: 10,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-03-28T12:10:00.000Z",
    updatedAt: "2026-03-28T12:10:00.000Z",
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

describe("useFinishedSessionSummaries", () => {
  it("returns empty array when no finished sessions exist", async () => {
    const { result } = renderHook(() => useFinishedSessionSummaries());

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toEqual([]);
  });

  it("excludes active sessions", async () => {
    await db.sessions.add(
      makeSession("s-active", "active", "2026-03-28T14:00:00.000Z")
    );

    const { result } = renderHook(() => useFinishedSessionSummaries());

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toEqual([]);
  });

  it("returns correct exerciseCount, loggedSetCount, displayDate sorted desc", async () => {
    // Older session
    const s1 = makeSession(
      "s1",
      "finished",
      "2026-03-27T10:00:00.000Z",
      "2026-03-27T11:00:00.000Z"
    );
    // Newer session
    const s2 = makeSession(
      "s2",
      "finished",
      "2026-03-28T14:00:00.000Z",
      "2026-03-28T15:00:00.000Z"
    );

    await db.sessions.bulkAdd([s1, s2]);

    // s1: 1 exercise, 2 sets
    const se1 = makeSessionExercise("se1", "s1");
    await db.sessionExercises.add(se1);
    const ls1a = makeLoggedSet("ls1a", "s1", "se1");
    const ls1b = { ...makeLoggedSet("ls1b", "s1", "se1"), setIndex: 1 };
    await db.loggedSets.bulkAdd([ls1a, ls1b]);

    // s2: 2 exercises, 1 set
    const se2a = makeSessionExercise("se2a", "s2");
    const se2b = { ...makeSessionExercise("se2b", "s2"), orderIndex: 1, id: "se2b" };
    await db.sessionExercises.bulkAdd([se2a, se2b]);
    const ls2 = makeLoggedSet("ls2", "s2", "se2a");
    await db.loggedSets.add(ls2);

    const { result } = renderHook(() => useFinishedSessionSummaries());

    await waitFor(() => {
      expect(result.current).toHaveLength(2);
    });

    const summaries = result.current!;
    // Sorted desc by displayDate (finishedAt) — s2 first
    expect(summaries[0]!.session.id).toBe("s2");
    expect(summaries[0]!.exerciseCount).toBe(2);
    expect(summaries[0]!.loggedSetCount).toBe(1);
    expect(summaries[0]!.displayDate).toBe("2026-03-28T15:00:00.000Z");

    expect(summaries[1]!.session.id).toBe("s1");
    expect(summaries[1]!.exerciseCount).toBe(1);
    expect(summaries[1]!.loggedSetCount).toBe(2);
    expect(summaries[1]!.displayDate).toBe("2026-03-27T11:00:00.000Z");
  });

  it("uses startedAt as displayDate when finishedAt is null", async () => {
    // A finished session with null finishedAt (edge case)
    const s = makeSession(
      "s-no-finished",
      "finished",
      "2026-03-28T14:00:00.000Z",
      null
    );
    await db.sessions.add(s);

    const { result } = renderHook(() => useFinishedSessionSummaries());

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    expect(result.current![0]!.displayDate).toBe("2026-03-28T14:00:00.000Z");
  });
});
