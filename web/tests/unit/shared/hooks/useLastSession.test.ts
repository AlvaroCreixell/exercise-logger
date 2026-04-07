import "fake-indexeddb/auto";
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { db } from "@/db/database";
import { useLastSession } from "@/shared/hooks/useLastSession";
import type { Session } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(
  id: string,
  routineId: string,
  status: "active" | "finished" | "discarded",
  startedAt: string,
  finishedAt: string | null = null
): Session {
  return {
    id,
    routineId,
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

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterEach(async () => {
  await db.sessions.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useLastSession", () => {
  it("returns null when routineId is null", async () => {
    const { result } = renderHook(() => useLastSession(null));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toBeNull();
  });

  it("returns null when routineId is undefined", async () => {
    const { result } = renderHook(() => useLastSession(undefined));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toBeNull();
  });

  it("returns null when no finished sessions exist for the routine", async () => {
    // Add an active session for this routine — should not be returned
    await db.sessions.add(
      makeSession("s-active", "r1", "active", "2026-03-28T14:00:00.000Z")
    );

    const { result } = renderHook(() => useLastSession("r1"));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toBeNull();
  });

  it("returns the most recent finished session for a routine", async () => {
    const older = makeSession(
      "s-older",
      "r1",
      "finished",
      "2026-03-27T10:00:00.000Z",
      "2026-03-27T11:00:00.000Z"
    );
    const newer = makeSession(
      "s-newer",
      "r1",
      "finished",
      "2026-03-28T14:00:00.000Z",
      "2026-03-28T15:00:00.000Z"
    );

    await db.sessions.bulkAdd([older, newer]);

    const { result } = renderHook(() => useLastSession("r1"));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current?.id).toBe("s-newer");
  });

  it("does not return sessions from a different routine", async () => {
    await db.sessions.add(
      makeSession(
        "s-other-routine",
        "r2",
        "finished",
        "2026-03-28T14:00:00.000Z",
        "2026-03-28T15:00:00.000Z"
      )
    );

    const { result } = renderHook(() => useLastSession("r1"));

    await waitFor(() => {
      expect(result.current).not.toBeUndefined();
    });

    expect(result.current).toBeNull();
  });
});
