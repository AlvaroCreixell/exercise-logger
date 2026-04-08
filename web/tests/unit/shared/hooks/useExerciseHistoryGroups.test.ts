import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { db } from "@/db/database";
import { useExerciseHistoryGroups } from "@/shared/hooks/useExerciseHistoryGroups";
import type { Session, SessionExercise, LoggedSet } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
  id: string,
  status: "active" | "finished" | "discarded",
  startedAt: string
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
    finishedAt: status === "finished" ? startedAt.replace("T14", "T15") : null,
  };
}

function makeSessionExercise(
  id: string,
  sessionId: string,
  exerciseId: string = "barbell-back-squat",
  instanceLabel: string = ""
): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: null,
    exerciseId,
    exerciseNameSnapshot: "Barbell Back Squat",
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel,
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
  exerciseId: string = "barbell-back-squat",
  instanceLabel: string = "",
  loggedAt: string = "2026-03-28T14:10:00.000Z",
  blockIndex: number = 0,
  setIndex: number = 0
): LoggedSet {
  return {
    id,
    sessionId,
    sessionExerciseId,
    exerciseId,
    instanceLabel,
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

describe("useExerciseHistoryGroups", () => {
  it("returns null when exerciseId is undefined", async () => {
    const { result } = renderHook(() => useExerciseHistoryGroups(undefined));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toBeNull();
  });

  it("returns empty array when no sets exist for the exercise", async () => {
    const { result } = renderHook(() =>
      useExerciseHistoryGroups("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toEqual([]);
  });

  it("excludes sets from active sessions", async () => {
    const activeSession = makeSession("s-active", "active", "2026-03-28T14:00:00.000Z");
    await db.sessions.add(activeSession);

    const se = makeSessionExercise("se1", "s-active");
    await db.sessionExercises.add(se);

    const ls = makeLoggedSet(
      "ls1",
      "s-active",
      "se1",
      "barbell-back-squat",
      "",
      "2026-03-28T14:10:00.000Z"
    );
    await db.loggedSets.add(ls);

    const { result } = renderHook(() =>
      useExerciseHistoryGroups("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    // Sets exist in DB but session is active — should return empty array
    expect(result.current).toEqual([]);
  });

  it("groups sets by session with correct session context", async () => {
    const s1 = makeSession("s1", "finished", "2026-03-28T14:00:00.000Z");
    await db.sessions.add(s1);

    const se1 = makeSessionExercise("se1", "s1");
    await db.sessionExercises.add(se1);

    const ls1 = makeLoggedSet(
      "ls1",
      "s1",
      "se1",
      "barbell-back-squat",
      "",
      "2026-03-28T14:10:00.000Z",
      0,
      0
    );
    const ls2 = makeLoggedSet(
      "ls2",
      "s1",
      "se1",
      "barbell-back-squat",
      "",
      "2026-03-28T14:12:00.000Z",
      0,
      1
    );
    await db.loggedSets.bulkAdd([ls1, ls2]);

    const { result } = renderHook(() =>
      useExerciseHistoryGroups("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    const groups = result.current!;
    expect(groups[0]!.session.id).toBe("s1");
    expect(groups[0]!.session.dayLabelSnapshot).toBe("Day A");
    expect(groups[0]!.session.routineNameSnapshot).toBe("Test Routine");
    expect(groups[0]!.session.startedAt).toBe("2026-03-28T14:00:00.000Z");
    expect(groups[0]!.entries).toHaveLength(1);
    expect(groups[0]!.entries[0]!.sets).toHaveLength(2);
    // Sets sorted: setIndex 0 first, then 1
    expect(groups[0]!.entries[0]!.sets[0]!.id).toBe("ls1");
    expect(groups[0]!.entries[0]!.sets[1]!.id).toBe("ls2");
  });

  it("sorts groups by session startedAt desc (most recent first)", async () => {
    const s1 = makeSession("s1", "finished", "2026-03-27T14:00:00.000Z");
    const s2 = makeSession("s2", "finished", "2026-03-28T14:00:00.000Z");
    await db.sessions.bulkAdd([s1, s2]);

    const se1 = makeSessionExercise("se1", "s1");
    const se2 = makeSessionExercise("se2", "s2");
    await db.sessionExercises.bulkAdd([se1, se2]);

    const ls1 = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat", "", "2026-03-27T14:10:00.000Z");
    const ls2 = makeLoggedSet("ls2", "s2", "se2", "barbell-back-squat", "", "2026-03-28T14:10:00.000Z");
    await db.loggedSets.bulkAdd([ls1, ls2]);

    const { result } = renderHook(() =>
      useExerciseHistoryGroups("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(2);
    });

    const groups = result.current!;
    // Most recent session first
    expect(groups[0]!.session.id).toBe("s2");
    expect(groups[1]!.session.id).toBe("s1");
  });

  it("regression: same exercise twice in one session produces separate entries in same group", async () => {
    const session = makeSession("s1", "finished", "2026-03-28T14:00:00.000Z");
    await db.sessions.add(session);

    // Two session exercises for the same exercise with different instance labels
    const se1 = makeSessionExercise("se1", "s1", "barbell-back-squat", "morning");
    const se2 = makeSessionExercise("se2", "s1", "barbell-back-squat", "afternoon");
    await db.sessionExercises.bulkAdd([se1, se2]);

    const ls1 = makeLoggedSet(
      "ls1",
      "s1",
      "se1",
      "barbell-back-squat",
      "morning",
      "2026-03-28T14:10:00.000Z",
      0,
      0
    );
    const ls2 = makeLoggedSet(
      "ls2",
      "s1",
      "se2",
      "barbell-back-squat",
      "afternoon",
      "2026-03-28T14:30:00.000Z",
      0,
      0
    );
    await db.loggedSets.bulkAdd([ls1, ls2]);

    const { result } = renderHook(() =>
      useExerciseHistoryGroups("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    const groups = result.current!;
    // One group for the session
    expect(groups[0]!.session.id).toBe("s1");
    // Two entries — one per sessionExercise (different instance labels)
    expect(groups[0]!.entries).toHaveLength(2);

    const instanceLabels = groups[0]!.entries.map((e) => e.instanceLabel).sort();
    expect(instanceLabels).toEqual(["afternoon", "morning"]);

    // Each entry has exactly one set
    for (const entry of groups[0]!.entries) {
      expect(entry.sets).toHaveLength(1);
    }
  });
});
