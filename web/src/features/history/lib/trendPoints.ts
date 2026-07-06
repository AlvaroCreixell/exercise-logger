import type { LoggedSet } from "@/domain/types";
import type { ExerciseHistoryGroup } from "@/shared/hooks/useExerciseHistoryGroups";

/**
 * Pure trend/summary helpers for the exercise-history screen.
 * Input is the group shape produced by `useExerciseHistoryGroups` — finished
 * sessions only, sorted DESCENDING by `session.startedAt`.
 * All values are canonical units (kg / count / sec / m); display conversion
 * happens at render time.
 */

export type TrendMeasure = "weight" | "reps" | "duration" | "distance";

export interface TrendPoint {
  /** ISO startedAt of the session; result points are in ascending order. */
  startedAt: string;
  /** Canonical value (kg / count / sec / m). */
  value: number;
}

export interface TrendSeries {
  measure: TrendMeasure;
  /** Oldest → newest, at most `limit` points. */
  points: TrendPoint[];
}

export interface BestLiftSummary {
  allTime: LoggedSet | null;
  /** Best set among sessions started in the current local-time month. */
  thisMonth: LoggedSet | null;
  /** Top set of the most recent session (null if it lacks the measure). */
  lastSession: LoggedSet | null;
}

/** Priority order used to choose the measure across ALL groups. */
const MEASURE_PRIORITY: readonly TrendMeasure[] = [
  "weight",
  "reps",
  "duration",
  "distance",
];

function measureValue(set: LoggedSet, measure: TrendMeasure): number | null {
  switch (measure) {
    case "weight":
      return set.performedWeightKg;
    case "reps":
      return set.performedReps;
    case "duration":
      return set.performedDurationSec;
    case "distance":
      return set.performedDistanceM;
  }
}

/** First measure in priority order that any set in any group carries. */
function pickMeasure(groups: ExerciseHistoryGroup[]): TrendMeasure | null {
  for (const measure of MEASURE_PRIORITY) {
    for (const group of groups) {
      for (const entry of group.entries) {
        for (const set of entry.sets) {
          if (measureValue(set, measure) !== null) return measure;
        }
      }
    }
  }
  return null;
}

function allSetsOf(group: ExerciseHistoryGroup): LoggedSet[] {
  return group.entries.flatMap((entry) => entry.sets);
}

/**
 * Top set within `sets` for the chosen measure: max value; ties broken by
 * more reps (weight measure only), then later `loggedAt`.
 */
function topSet(sets: LoggedSet[], measure: TrendMeasure): LoggedSet | null {
  let best: LoggedSet | null = null;
  let bestValue = -Infinity;
  for (const set of sets) {
    const value = measureValue(set, measure);
    if (value === null) continue;
    if (best === null || value > bestValue) {
      best = set;
      bestValue = value;
      continue;
    }
    if (value < bestValue) continue;
    // Tie on value.
    if (measure === "weight") {
      const reps = set.performedReps ?? -1;
      const bestReps = best.performedReps ?? -1;
      if (reps > bestReps) {
        best = set;
        continue;
      }
      if (reps < bestReps) continue;
    }
    if (set.loggedAt > best.loggedAt) best = set;
  }
  return best;
}

/**
 * Build the spark-line series: one point per session (the top-set value for
 * the chosen measure), ascending by date, truncated to the newest `limit`
 * sessions. Sessions with no set carrying the measure are skipped.
 * Returns null when fewer than 2 points remain.
 */
export function buildTrendSeries(
  groups: ExerciseHistoryGroup[],
  limit = 12
): TrendSeries | null {
  const measure = pickMeasure(groups);
  if (measure === null) return null;

  const ascending = [...groups].sort((a, b) =>
    a.session.startedAt.localeCompare(b.session.startedAt)
  );

  const points: TrendPoint[] = [];
  for (const group of ascending) {
    const top = topSet(allSetsOf(group), measure);
    if (top === null) continue;
    points.push({
      startedAt: group.session.startedAt,
      value: measureValue(top, measure)!,
    });
  }

  const truncated =
    points.length > limit ? points.slice(points.length - limit) : points;
  if (truncated.length < 2) return null;
  return { measure, points: truncated };
}

/**
 * Best-lift stats using the same measure priority as the trend.
 * `thisMonth` uses the local-time month boundary of the session's startedAt.
 */
export function bestLiftSummary(
  groups: ExerciseHistoryGroup[]
): BestLiftSummary {
  const measure = pickMeasure(groups);
  if (measure === null) {
    return { allTime: null, thisMonth: null, lastSession: null };
  }

  const allSets = groups.flatMap(allSetsOf);
  const allTime = topSet(allSets, measure);

  const now = new Date();
  const monthSets = groups
    .filter((group) => {
      const started = new Date(group.session.startedAt);
      return (
        started.getFullYear() === now.getFullYear() &&
        started.getMonth() === now.getMonth()
      );
    })
    .flatMap(allSetsOf);
  const thisMonth = topSet(monthSets, measure);

  const newest = groups.reduce((a, b) =>
    a.session.startedAt >= b.session.startedAt ? a : b
  );
  const lastSession = topSet(allSetsOf(newest), measure);

  return { allTime, thisMonth, lastSession };
}
