import type { TargetKind } from "@/domain/enums";

interface SetInput {
  performedWeightKg: number | null;
  performedReps: number | null;
  performedDurationSec: number | null;
  performedDistanceM: number | null;
}

interface ValidationOptions {
  /**
   * When true, treats the input as a cardio-extra entry (no `SetBlock`,
   * `effectiveType === "cardio"`). Cardio extras accept any combination
   * of `performedDurationSec` and/or `performedDistanceM`. The `targetKind`
   * argument is ignored in this mode (cardio-extras default to `"duration"`
   * upstream, but the user is allowed to log either field).
   */
  cardioExtra?: boolean;
}

/**
 * Returns true if the set input has no meaningful performance data.
 *
 * Standard validation is target-aware:
 * - reps blocks require performedReps
 * - duration blocks require performedDurationSec
 * - distance blocks require performedDistanceM
 * Weight alone is never sufficient — the target metric must be present.
 *
 * Cardio-extra mode (opts.cardioExtra=true) accepts any non-null value
 * in performedDurationSec OR performedDistanceM, since cardio-extras
 * surface both fields and the user may log either or both.
 */
export function isSetInputEmpty(
  targetKind: TargetKind,
  input: SetInput,
  opts: ValidationOptions = {},
): boolean {
  if (opts.cardioExtra) {
    return input.performedDurationSec == null && input.performedDistanceM == null;
  }
  if (targetKind === "reps") return input.performedReps == null;
  if (targetKind === "duration") return input.performedDurationSec == null;
  if (targetKind === "distance") return input.performedDistanceM == null;
  return true;
}
