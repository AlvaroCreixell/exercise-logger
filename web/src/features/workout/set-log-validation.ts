import type { TargetKind } from "@/domain/enums";

interface SetInput {
  performedWeightKg: number | null;
  performedReps: number | null;
  performedDurationSec: number | null;
  performedDistanceM: number | null;
}

/**
 * Returns true if the set input has no meaningful performance data.
 *
 * Validation is target-aware:
 * - reps blocks require performedReps
 * - duration blocks require performedDurationSec
 * - distance blocks require performedDistanceM
 * Weight alone is never sufficient — the target metric must be present.
 */
export function isSetInputEmpty(targetKind: TargetKind, input: SetInput): boolean {
  if (targetKind === "reps") return input.performedReps == null;
  if (targetKind === "duration") return input.performedDurationSec == null;
  if (targetKind === "distance") return input.performedDistanceM == null;
  return true;
}
