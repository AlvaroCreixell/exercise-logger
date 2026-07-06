import { describe, it, expect, afterEach, vi } from "vitest";
import {
  buildTrendSeries,
  bestLiftSummary,
} from "@/features/history/lib/trendPoints";
import type {
  ExerciseHistoryGroup,
  ExerciseHistoryEntry,
} from "@/shared/hooks/useExerciseHistoryGroups";
import type { LoggedSet } from "@/domain/types";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

let setCounter = 0;

function makeSet(overrides: Partial<LoggedSet> = {}): LoggedSet {
  setCounter += 1;
  return {
    id: `ls-${setCounter}`,
    sessionId: "s1",
    sessionExerciseId: "se1",
    exerciseId: "barbell-bench-press",
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
    loggedAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeEntry(sets: LoggedSet[]): ExerciseHistoryEntry {
  return {
    instanceLabel: "",
    effectiveEquipment: "barbell",
    unitOverride: null,
    sets,
  };
}

function makeGroup(
  startedAt: string,
  sets: LoggedSet[],
  id = `sess-${startedAt}`
): ExerciseHistoryGroup {
  return {
    session: {
      id,
      dayLabelSnapshot: "Day A",
      routineNameSnapshot: "Routine",
      startedAt,
    },
    entries: [makeEntry(sets)],
  };
}

/** Groups arrive from useExerciseHistoryGroups sorted DESCENDING by startedAt. */
function descending(groups: ExerciseHistoryGroup[]): ExerciseHistoryGroup[] {
  return [...groups].sort((a, b) =>
    b.session.startedAt.localeCompare(a.session.startedAt)
  );
}

// ---------------------------------------------------------------------------
// buildTrendSeries
// ---------------------------------------------------------------------------

describe("buildTrendSeries", () => {
  it("returns null for empty groups", () => {
    expect(buildTrendSeries([])).toBeNull();
  });

  it("returns null when only one session carries the measure", () => {
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [
        makeSet({ performedWeightKg: 60, performedReps: 8 }),
      ]),
    ]);
    expect(buildTrendSeries(groups)).toBeNull();
  });

  it("prefers weight over reps across ALL groups, skipping sessions without weight", () => {
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [
        makeSet({ performedReps: 12 }), // reps-only session — skipped
      ]),
      makeGroup("2026-06-03T10:00:00.000Z", [
        makeSet({ performedWeightKg: 60, performedReps: 8 }),
      ]),
      makeGroup("2026-06-05T10:00:00.000Z", [
        makeSet({ performedWeightKg: 70, performedReps: 8 }),
      ]),
    ]);
    const series = buildTrendSeries(groups);
    expect(series).not.toBeNull();
    expect(series!.measure).toBe("weight");
    expect(series!.points).toEqual([
      { startedAt: "2026-06-03T10:00:00.000Z", value: 60 },
      { startedAt: "2026-06-05T10:00:00.000Z", value: 70 },
    ]);
  });

  it("falls back to reps when no set anywhere carries weight", () => {
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [makeSet({ performedReps: 10 })]),
      makeGroup("2026-06-03T10:00:00.000Z", [makeSet({ performedReps: 12 })]),
    ]);
    const series = buildTrendSeries(groups);
    expect(series!.measure).toBe("reps");
    expect(series!.points.map((p) => p.value)).toEqual([10, 12]);
  });

  it("falls back to duration, then distance, in priority order", () => {
    const durationGroups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [
        makeSet({ performedDurationSec: 30 }),
      ]),
      makeGroup("2026-06-03T10:00:00.000Z", [
        makeSet({ performedDurationSec: 45, performedDistanceM: 400 }),
      ]),
    ]);
    expect(buildTrendSeries(durationGroups)!.measure).toBe("duration");

    const distanceGroups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [
        makeSet({ performedDistanceM: 400 }),
      ]),
      makeGroup("2026-06-03T10:00:00.000Z", [
        makeSet({ performedDistanceM: 500 }),
      ]),
    ]);
    const series = buildTrendSeries(distanceGroups);
    expect(series!.measure).toBe("distance");
    expect(series!.points.map((p) => p.value)).toEqual([400, 500]);
  });

  it("uses the per-session max (top set) as the point value", () => {
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [
        makeSet({ performedWeightKg: 60, performedReps: 10 }),
        makeSet({ performedWeightKg: 80, performedReps: 5 }),
        makeSet({ performedWeightKg: 70, performedReps: 8 }),
      ]),
      makeGroup("2026-06-03T10:00:00.000Z", [
        makeSet({ performedWeightKg: 82.5, performedReps: 5 }),
      ]),
    ]);
    const series = buildTrendSeries(groups);
    expect(series!.points.map((p) => p.value)).toEqual([80, 82.5]);
  });

  it("aggregates the top set across multiple entries within one session", () => {
    const group: ExerciseHistoryGroup = {
      session: {
        id: "s-multi",
        dayLabelSnapshot: "Day A",
        routineNameSnapshot: "Routine",
        startedAt: "2026-06-01T10:00:00.000Z",
      },
      entries: [
        makeEntry([makeSet({ performedWeightKg: 60, performedReps: 8 })]),
        makeEntry([makeSet({ performedWeightKg: 90, performedReps: 3 })]),
      ],
    };
    const groups = descending([
      group,
      makeGroup("2026-06-03T10:00:00.000Z", [
        makeSet({ performedWeightKg: 70, performedReps: 8 }),
      ]),
    ]);
    const series = buildTrendSeries(groups);
    expect(series!.points.map((p) => p.value)).toEqual([90, 70]);
  });

  it("returns points ascending by startedAt despite descending input", () => {
    const groups = descending([
      makeGroup("2026-06-05T10:00:00.000Z", [
        makeSet({ performedWeightKg: 70, performedReps: 8 }),
      ]),
      makeGroup("2026-06-01T10:00:00.000Z", [
        makeSet({ performedWeightKg: 60, performedReps: 8 }),
      ]),
      makeGroup("2026-06-03T10:00:00.000Z", [
        makeSet({ performedWeightKg: 65, performedReps: 8 }),
      ]),
    ]);
    const series = buildTrendSeries(groups);
    expect(series!.points.map((p) => p.startedAt)).toEqual([
      "2026-06-01T10:00:00.000Z",
      "2026-06-03T10:00:00.000Z",
      "2026-06-05T10:00:00.000Z",
    ]);
  });

  it("truncates to the newest `limit` points, dropping the oldest", () => {
    const groups = descending(
      [1, 2, 3, 4, 5].map((d) =>
        makeGroup(`2026-06-0${d}T10:00:00.000Z`, [
          makeSet({ performedWeightKg: 50 + d, performedReps: 8 }),
        ])
      )
    );
    const series = buildTrendSeries(groups, 3);
    expect(series!.points.map((p) => p.value)).toEqual([53, 54, 55]);
  });

  it("defaults the limit to 12", () => {
    const groups = descending(
      Array.from({ length: 15 }, (_, i) =>
        makeGroup(
          `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
          [makeSet({ performedWeightKg: 40 + i, performedReps: 8 })]
        )
      )
    );
    const series = buildTrendSeries(groups);
    expect(series!.points).toHaveLength(12);
    // Oldest 3 dropped: first remaining value is 40 + 3.
    expect(series!.points[0]!.value).toBe(43);
    expect(series!.points[11]!.value).toBe(54);
  });

  it("returns null when skipping leaves fewer than 2 points", () => {
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [makeSet({ performedReps: 10 })]),
      makeGroup("2026-06-03T10:00:00.000Z", [makeSet({ performedReps: 12 })]),
      makeGroup("2026-06-05T10:00:00.000Z", [
        makeSet({ performedWeightKg: 60, performedReps: 8 }),
      ]),
    ]);
    // Weight wins the priority, but only one session carries it.
    expect(buildTrendSeries(groups)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// bestLiftSummary
// ---------------------------------------------------------------------------

describe("bestLiftSummary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns all nulls for empty groups", () => {
    expect(bestLiftSummary([])).toEqual({
      allTime: null,
      thisMonth: null,
      lastSession: null,
    });
  });

  it("picks the all-time best by max weight", () => {
    const best = makeSet({ performedWeightKg: 100, performedReps: 3 });
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [
        makeSet({ performedWeightKg: 90, performedReps: 5 }),
        best,
      ]),
      makeGroup("2026-06-03T10:00:00.000Z", [
        makeSet({ performedWeightKg: 95, performedReps: 5 }),
      ]),
    ]);
    expect(bestLiftSummary(groups).allTime).toBe(best);
  });

  it("breaks weight ties by more reps, then later loggedAt", () => {
    const lowReps = makeSet({
      performedWeightKg: 100,
      performedReps: 3,
      loggedAt: "2026-06-05T10:00:00.000Z",
    });
    const moreReps = makeSet({
      performedWeightKg: 100,
      performedReps: 5,
      loggedAt: "2026-06-01T10:00:00.000Z",
    });
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [moreReps]),
      makeGroup("2026-06-05T10:00:00.000Z", [lowReps]),
    ]);
    // 100kg × 5 beats 100kg × 3 even though the ×3 was logged later.
    expect(bestLiftSummary(groups).allTime).toBe(moreReps);

    const earlier = makeSet({
      performedWeightKg: 100,
      performedReps: 5,
      loggedAt: "2026-06-01T10:00:00.000Z",
    });
    const later = makeSet({
      performedWeightKg: 100,
      performedReps: 5,
      loggedAt: "2026-06-05T10:00:00.000Z",
    });
    const tieGroups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [earlier]),
      makeGroup("2026-06-05T10:00:00.000Z", [later]),
    ]);
    expect(bestLiftSummary(tieGroups).allTime).toBe(later);
  });

  it("computes thisMonth from sessions in the current local month only", () => {
    vi.useFakeTimers();
    // Mid-month UTC noon: same calendar month in every timezone.
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));

    const juneBest = makeSet({ performedWeightKg: 120, performedReps: 3 });
    const julyBest = makeSet({ performedWeightKg: 100, performedReps: 5 });
    const groups = descending([
      makeGroup("2026-06-15T10:00:00.000Z", [juneBest]),
      makeGroup("2026-07-10T10:00:00.000Z", [julyBest]),
    ]);
    const summary = bestLiftSummary(groups);
    expect(summary.thisMonth).toBe(julyBest);
    expect(summary.allTime).toBe(juneBest);
  });

  it("returns thisMonth null when no session falls in the current month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));

    const groups = descending([
      makeGroup("2026-05-15T10:00:00.000Z", [
        makeSet({ performedWeightKg: 100, performedReps: 5 }),
      ]),
    ]);
    expect(bestLiftSummary(groups).thisMonth).toBeNull();
  });

  it("returns the top set of the most recent session as lastSession", () => {
    const lastTop = makeSet({ performedWeightKg: 80, performedReps: 5 });
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [
        makeSet({ performedWeightKg: 100, performedReps: 5 }),
      ]),
      makeGroup("2026-06-05T10:00:00.000Z", [
        makeSet({ performedWeightKg: 75, performedReps: 8 }),
        lastTop,
      ]),
    ]);
    expect(bestLiftSummary(groups).lastSession).toBe(lastTop);
  });

  it("returns lastSession null when the most recent session lacks the measure", () => {
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [
        makeSet({ performedWeightKg: 100, performedReps: 5 }),
      ]),
      makeGroup("2026-06-05T10:00:00.000Z", [makeSet({ performedReps: 12 })]),
    ]);
    expect(bestLiftSummary(groups).lastSession).toBeNull();
  });

  it("uses reps as the measure when no weights exist (same priority as trend)", () => {
    const best = makeSet({ performedReps: 15 });
    const groups = descending([
      makeGroup("2026-06-01T10:00:00.000Z", [makeSet({ performedReps: 12 })]),
      makeGroup("2026-06-03T10:00:00.000Z", [best]),
    ]);
    const summary = bestLiftSummary(groups);
    expect(summary.allTime).toBe(best);
    expect(summary.lastSession).toBe(best);
  });
});
