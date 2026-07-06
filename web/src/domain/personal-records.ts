import type { LoggedSet } from "./types";

// ---------------------------------------------------------------------------
// Personal-record detection (pure — no React, no DB)
//
// Owner decision (2026-07-06): a PR is *best ever* (all-time), compared
// against ALL previously logged sets for the exercise — any session status,
// extra-origin sets included. Invariant 7 ("extras never feed progression
// suggestions") is about progression, not PRs.
// ---------------------------------------------------------------------------

/**
 * The four performed measures of a set, as parsed from user input.
 * Matches the shape `SetLogSheet` passes to `onSave` (minus the PR flag).
 */
export interface SetInputShape {
  performedWeightKg: number | null;
  performedReps: number | null;
  performedDurationSec: number | null;
  performedDistanceM: number | null;
}

/** All-time bests for one exercise, per set shape. */
export interface PersonalBests {
  /**
   * Max performedWeightKg among prior weight+reps sets with
   * performedReps >= reps; null if none.
   */
  bestWeightKgAtReps(reps: number): number | null;
  /** Max reps among reps-only sets (weight null, reps non-null); null if none. */
  maxReps: number | null;
  /** Max duration among duration-only sets; null if none. */
  maxDurationSec: number | null;
  /** Max distance among distance-only sets; null if none. */
  maxDistanceM: number | null;
}

type SetShape =
  | "weight-reps"
  | "reps-only"
  | "duration-only"
  | "distance-only"
  | "cardio"
  | "other";

/**
 * Classify a set by which measures it carries.
 *
 * Note: weight 0 with reps (bodyweight logged as 0kg on a weight-type
 * exercise) still classifies as weight+reps — 0kg never beats anything,
 * so such an input is never an auto-PR, but as a *prior* it does establish
 * a 0kg baseline that a first weighted set can beat.
 */
function classifyShape(s: SetInputShape): SetShape {
  const w = s.performedWeightKg;
  const r = s.performedReps;
  const d = s.performedDurationSec;
  const m = s.performedDistanceM;
  // duration+distance together = cardio; never an auto-PR category.
  if (d != null && m != null) return "cardio";
  if (w != null && r != null) return "weight-reps";
  if (r != null && w == null && d == null && m == null) return "reps-only";
  if (d != null && w == null && r == null && m == null) return "duration-only";
  if (m != null && w == null && r == null && d == null) return "distance-only";
  return "other";
}

/**
 * Fold a set of previously logged sets into per-shape all-time bests.
 * Pass ALL logged sets for the exercise (any session status, extras included).
 */
export function computePersonalBests(sets: LoggedSet[]): PersonalBests {
  const weightRepPairs: { weightKg: number; reps: number }[] = [];
  let maxReps: number | null = null;
  let maxDurationSec: number | null = null;
  let maxDistanceM: number | null = null;

  for (const set of sets) {
    switch (classifyShape(set)) {
      case "weight-reps":
        weightRepPairs.push({
          weightKg: set.performedWeightKg!,
          reps: set.performedReps!,
        });
        break;
      case "reps-only":
        if (maxReps == null || set.performedReps! > maxReps) {
          maxReps = set.performedReps!;
        }
        break;
      case "duration-only":
        if (maxDurationSec == null || set.performedDurationSec! > maxDurationSec) {
          maxDurationSec = set.performedDurationSec!;
        }
        break;
      case "distance-only":
        if (maxDistanceM == null || set.performedDistanceM! > maxDistanceM) {
          maxDistanceM = set.performedDistanceM!;
        }
        break;
      // cardio / other: never establish an auto-PR baseline.
    }
  }

  return {
    bestWeightKgAtReps(reps: number): number | null {
      let best: number | null = null;
      for (const pair of weightRepPairs) {
        if (pair.reps >= reps && (best == null || pair.weightKg > best)) {
          best = pair.weightKg;
        }
      }
      return best;
    },
    maxReps,
    maxDurationSec,
    maxDistanceM,
  };
}

/** True when `value` is a usable positive number. */
function isPositive(value: number | null): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

/**
 * Would saving `input` set a new all-time record?
 *
 * Rules (boundaries are strict — equalling a record is NOT a new one):
 * - weight+reps: weight > bestWeightKgAtReps(reps). No prior comparable
 *   set (null best) → false, so day-one sets stay quiet. Weight 0 with
 *   reps never beats anything → false.
 * - reps-only: reps > maxReps (null → false).
 * - duration-only: longer than maxDurationSec (null → false).
 * - distance-only: farther than maxDistanceM (null → false).
 * - duration+distance together (cardio): always false — manual toggle only.
 * - Zero, negative, NaN, or absent values: false.
 */
export function isNewPersonalBest(
  input: SetInputShape,
  bests: PersonalBests
): boolean {
  switch (classifyShape(input)) {
    case "weight-reps": {
      const weight = input.performedWeightKg!;
      const reps = input.performedReps!;
      if (!isPositive(weight) || !isPositive(reps)) return false;
      const best = bests.bestWeightKgAtReps(reps);
      return best != null && weight > best;
    }
    case "reps-only": {
      const reps = input.performedReps!;
      if (!isPositive(reps)) return false;
      return bests.maxReps != null && reps > bests.maxReps;
    }
    case "duration-only": {
      const duration = input.performedDurationSec!;
      if (!isPositive(duration)) return false;
      return bests.maxDurationSec != null && duration > bests.maxDurationSec;
    }
    case "distance-only": {
      const distance = input.performedDistanceM!;
      if (!isPositive(distance)) return false;
      return bests.maxDistanceM != null && distance > bests.maxDistanceM;
    }
    default:
      // cardio (duration+distance) and degenerate shapes: never auto-PR.
      return false;
  }
}
