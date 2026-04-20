import type { LoggedSet } from "@/domain/types";
import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

/** Sum of `weight × reps` across logged sets. Non-strength sets contribute 0. */
export function computeSessionVolumeKg(sets: LoggedSet[]): number {
  let total = 0;
  for (const set of sets) {
    if (set.performedWeightKg == null || set.performedReps == null) continue;
    total += set.performedWeightKg * set.performedReps;
  }
  return total;
}

/** Display volume with thousands separator and unit suffix. E.g. "8,240 kg". */
export function formatVolume(canonicalKg: number, units: UnitSystem): string {
  const display = Math.round(toDisplayWeight(canonicalKg, units));
  const withCommas = display.toLocaleString("en-US");
  return `${withCommas} ${units}`;
}

/** Short minutes string for session meta lines. E.g. "52m", "< 1m", "".
 *  Uses nearest-minute rounding so row/header duration stays consistent with
 *  SessionDetailStatsTile, which computes `Math.round(ms / 60000)`. The
 *  sub-minute sentinel is preserved — anything < 1 minute reads "< 1m"
 *  regardless of rounding. */
export function formatShortDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 60_000) return "< 1m";
  return `${Math.round(ms / 60000)}m`;
}
