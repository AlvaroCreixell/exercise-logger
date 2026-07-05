import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { db } from "@/db/database";
import { useExerciseSearchSessionIds } from "@/shared/hooks/useExerciseSearchSessionIds";
import type { SessionExercise } from "@/domain/types";

function makeSE(id: string, sessionId: string, name: string): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: "re-1",
    exerciseId: name.toLowerCase().replace(/ /g, "-"),
    exerciseNameSnapshot: name,
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
    createdAt: "2026-07-01T10:00:00.000Z",
    unitOverride: null,
  };
}

describe("useExerciseSearchSessionIds", () => {
  beforeEach(async () => {
    await db.sessionExercises.clear();
    await db.sessionExercises.bulkPut([
      makeSE("se1", "s1", "Barbell Bench Press"),
      makeSE("se2", "s2", "Barbell Back Squat"),
      makeSE("se3", "s3", "Dumbbell Bench Press"),
    ]);
  });

  it("returns null for a blank query (no filter)", async () => {
    const { result } = renderHook(() => useExerciseSearchSessionIds("   "));
    await waitFor(() => {
      expect(result.current).toBeNull();
    });
  });

  it("returns session ids whose exercises match, case-insensitively", async () => {
    const { result } = renderHook(() => useExerciseSearchSessionIds("bench"));
    await waitFor(() => {
      expect(result.current).toEqual(new Set(["s1", "s3"]));
    });
  });

  it("returns an empty set when nothing matches", async () => {
    const { result } = renderHook(() => useExerciseSearchSessionIds("deadlift"));
    await waitFor(() => {
      expect(result.current).toEqual(new Set());
    });
  });
});
