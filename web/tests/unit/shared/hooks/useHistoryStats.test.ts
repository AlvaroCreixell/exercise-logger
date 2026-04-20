import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { db } from "@/db/database";
import { useHistoryStats } from "@/shared/hooks/useHistoryStats";
import type { Session, SessionExercise, LoggedSet } from "@/domain/types";

beforeEach(async () => {
  await db.sessions.clear();
  await db.sessionExercises.clear();
  await db.loggedSets.clear();
});

function makeSession(
  id: string,
  status: "active" | "finished",
  startedAt: string,
  finishedAt: string | null,
): Session {
  return {
    id,
    routineId: "r1",
    routineNameSnapshot: "Test",
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
    createdAt: "2026-04-17T12:00:00Z",
    unitOverride: null,
  };
}

function makeLoggedSet(
  id: string,
  sessionId: string,
  sessionExerciseId: string,
  setIndex: number,
): LoggedSet {
  return {
    id,
    sessionId,
    sessionExerciseId,
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "sig",
    setIndex,
    tag: null,
    performedWeightKg: 100,
    performedReps: 5,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-17T12:00:00Z",
    updatedAt: "2026-04-17T12:00:00Z",
  };
}

describe("useHistoryStats", () => {
  it("returns zeros when no finished sessions exist", async () => {
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() => expect(result.current).toBeDefined());
    expect(result.current).toEqual({ sessionCount: 0, setCount: 0, hours: 0 });
  });

  it("counts only finished sessions (active sessions excluded)", async () => {
    await db.sessions.bulkPut([
      makeSession("s1", "finished", "2026-04-17T12:00:00Z", "2026-04-17T13:00:00Z"),
      makeSession("s2", "active", "2026-04-18T12:00:00Z", null),
    ]);
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() =>
      expect(result.current).toEqual({ sessionCount: 1, setCount: 0, hours: 1 }),
    );
  });

  it("sums sets across all finished sessions", async () => {
    await db.sessions.put(
      makeSession("s1", "finished", "2026-04-17T12:00:00Z", "2026-04-17T13:00:00Z"),
    );
    await db.sessionExercises.put(makeSessionExercise("se1", "s1"));
    await db.loggedSets.bulkPut([
      makeLoggedSet("ls1", "s1", "se1", 0),
      makeLoggedSet("ls2", "s1", "se1", 1),
      makeLoggedSet("ls3", "s1", "se1", 2),
    ]);
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() => expect(result.current?.setCount).toBe(3));
  });

  it("rounds hours to the nearest whole hour", async () => {
    await db.sessions.bulkPut([
      makeSession("s1", "finished", "2026-04-17T12:00:00Z", "2026-04-17T13:30:00Z"),
      makeSession("s2", "finished", "2026-04-18T12:00:00Z", "2026-04-18T12:30:00Z"),
    ]);
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() => expect(result.current?.hours).toBe(2));
  });

  it("skips sessions with null finishedAt (orphaned active)", async () => {
    await db.sessions.put({
      ...makeSession("s1", "finished", "2026-04-17T12:00:00Z", null),
    });
    const { result } = renderHook(() => useHistoryStats());
    await waitFor(() => expect(result.current?.hours).toBe(0));
  });
});
