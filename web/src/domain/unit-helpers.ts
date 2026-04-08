import type { UnitSystem } from "./enums";

/**
 * Resolve the effective unit system for a session exercise.
 *
 * Returns unitOverride if set, otherwise falls back to the global setting.
 */
export function getEffectiveUnit(
  unitOverride: UnitSystem | null,
  globalUnits: UnitSystem
): UnitSystem {
  return unitOverride ?? globalUnits;
}
