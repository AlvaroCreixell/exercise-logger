import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { db } from "@/db/database";
import { useExercisePersonalBests } from "@/shared/hooks/useExercisePersonalBests";
import type { Session, LoggedSet } from "@/domain/types";

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

let idCounter = 0;

function makeLoggedSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  idCounter += 1;
  return {
    id: `ls-${idCounter}`,
    sessionId: "s-1",
    sessionExerciseId: "se-1",
    exerciseId: "barbell-back-squat",
    instanceLabel: "",
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: null,
    performedReps: null,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-04-16T14:10:00.000Z",
    updatedAt: "2026-04-16T14:10:00.000Z",
    ...overrides,
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

describe("useExercisePersonalBests", () => {
  it("returns undefined when exerciseId is undefined", async () => {
    const { result } = renderHook(() => useExercisePersonalBests(undefined));
    // Give the live query a chance to resolve; it must stay undefined.
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current).toBeUndefined();
  });

  it("returns empty bests (all null) when no sets exist for the exercise", async () => {
    const { result } = renderHook(() =>
      useExercisePersonalBests("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current!.bestWeightKgAtReps(10)).toBeNull();
    expect(result.current!.maxReps).toBeNull();
    expect(result.current!.maxDurationSec).toBeNull();
    expect(result.current!.maxDistanceM).toBeNull();
  });

  it("computes bests from all logged sets regardless of session status (active sessions count)", async () => {
    await db.sessions.bulkAdd([
      makeSession("s-finished", "finished", "2026-04-15T14:00:00.000Z"),
      makeSession("s-active", "active", "2026-04-16T14:00:00.000Z"),
    ]);
    await db.loggedSets.bulkAdd([
      makeLoggedSet({
        sessionId: "s-finished",
        performedWeightKg: 100,
        performedReps: 10,
        loggedAt: "2026-04-15T14:10:00.000Z",
      }),
      makeLoggedSet({
        sessionId: "s-active",
        performedWeightKg: 105,
        performedReps: 10,
        loggedAt: "2026-04-16T14:10:00.000Z",
      }),
    ]);

    const { result } = renderHook(() =>
      useExercisePersonalBests("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current?.bestWeightKgAtReps(10)).toBe(105);
    });
  });

  it("includes extra-origin sets (invariant 7 is about progression, not PRs)", async () => {
    await db.loggedSets.add(
      makeLoggedSet({
        origin: "extra",
        performedReps: 15,
      })
    );

    const { result } = renderHook(() =>
      useExercisePersonalBests("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current?.maxReps).toBe(15);
    });
  });

  it("excludes sets from other exercises", async () => {
    await db.loggedSets.bulkAdd([
      makeLoggedSet({
        exerciseId: "barbell-bench-press",
        performedWeightKg: 200,
        performedReps: 10,
      }),
      makeLoggedSet({
        exerciseId: "barbell-back-squat",
        performedWeightKg: 100,
        performedReps: 10,
        loggedAt: "2026-04-16T14:11:00.000Z",
      }),
    ]);

    const { result } = renderHook(() =>
      useExercisePersonalBests("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current?.bestWeightKgAtReps(10)).toBe(100);
    });
  });

  it("live-updates when a new set is logged", async () => {
    await db.loggedSets.add(
      makeLoggedSet({
        performedWeightKg: 100,
        performedReps: 10,
        loggedAt: "2026-04-16T14:10:00.000Z",
      })
    );

    const { result } = renderHook(() =>
      useExercisePersonalBests("barbell-back-squat")
    );

    await waitFor(() => {
      expect(result.current?.bestWeightKgAtReps(10)).toBe(100);
    });

    await db.loggedSets.add(
      makeLoggedSet({
        performedWeightKg: 110,
        performedReps: 10,
        loggedAt: "2026-04-16T14:20:00.000Z",
      })
    );

    await waitFor(() => {
      expect(result.current?.bestWeightKgAtReps(10)).toBe(110);
    });
  });
});
