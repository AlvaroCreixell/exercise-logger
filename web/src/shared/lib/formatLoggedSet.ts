import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";

/**
 * Subset of LoggedSet that this formatter needs. Accepting a structural type
 * (rather than the full LoggedSet) keeps the helper independent of the
 * domain layer's full record shape.
 */
export interface LoggedSetSubset {
  performedWeightKg: number | null;
  performedReps: number | null;
  performedDurationSec: number | null;
  performedDistanceM: number | null;
}

/**
 * Structured parts of a logged set, suitable for custom layouts (e.g.
 * SetRow renders primary/unit/secondary in separate spans with distinct
 * styling). Returns `null` when the set is empty (no performance fields
 * are non-null) — callers decide how to render empty.
 */
export interface LoggedSetParts {
  primary: string;
  unit: string | null;
  secondary: string | null;
}

/**
 * Render a logged set into its structured parts. Precedence (matches the
 * existing SetRow logic):
 * 1. weight + reps  → display weight, unit = kg/lbs, secondary = reps
 * 2. reps only      → primary = reps,  unit = "reps"
 * 3. duration only  → primary = sec,   unit = "s"
 * 4. distance only  → primary = m,     unit = "m"
 * 5. otherwise      → null
 */
export function formatLoggedSetParts(
  set: LoggedSetSubset,
  units: UnitSystem,
): LoggedSetParts | null {
  if (set.performedWeightKg !== null && set.performedReps !== null) {
    return {
      primary: String(toDisplayWeight(set.performedWeightKg, units)),
      unit: units,
      secondary: String(set.performedReps),
    };
  }
  if (set.performedReps !== null) {
    return { primary: String(set.performedReps), unit: "reps", secondary: null };
  }
  if (set.performedDurationSec !== null) {
    return { primary: String(set.performedDurationSec), unit: "s", secondary: null };
  }
  if (set.performedDistanceM !== null) {
    return { primary: String(set.performedDistanceM), unit: "m", secondary: null };
  }
  return null;
}

/**
 * Render a logged set as a compact string. Used for pills and hint strips
 * where a single-string output is preferred over per-part styling.
 *
 * Joining rules:
 * - weight unit (kg/lbs) is appended directly: "80kg"
 * - reps unit appears as " reps": "12 reps"
 * - duration "s" and distance "m" are appended directly: "30s", "500m"
 * - secondary (reps in weight+reps mode) joined with " × ": "80kg × 10"
 *
 * Returns `opts.fallback` (default `"—"`) when the set is empty.
 */
export function formatLoggedSet(
  set: LoggedSetSubset,
  units: UnitSystem,
  opts: { fallback?: string } = {},
): string {
  const parts = formatLoggedSetParts(set, units);
  if (parts === null) return opts.fallback ?? "—";
  let result = parts.primary;
  if (parts.unit === "reps") {
    result += " reps";
  } else if (parts.unit !== null) {
    // weight (kg/lbs), duration "s", distance "m" — all append directly
    result += parts.unit;
  }
  if (parts.secondary !== null) {
    result += " × " + parts.secondary;
  }
  return result;
}
