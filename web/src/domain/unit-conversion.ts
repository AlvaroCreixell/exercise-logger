import type { ExerciseEquipment } from "./enums";

// ---------------------------------------------------------------------------
// Conversion constants
// ---------------------------------------------------------------------------

const KG_PER_LB = 0.45359237;
const LBS_PER_KG = 1 / KG_PER_LB; // ~2.20462

// ---------------------------------------------------------------------------
// Basic conversions
// ---------------------------------------------------------------------------

/**
 * Convert kilograms to pounds.
 * Returns the raw floating-point result — call `roundToIncrement` afterwards
 * if you need a practical display value.
 */
export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

/**
 * Convert pounds to kilograms.
 * Returns the raw floating-point result — call `roundToIncrement` afterwards
 * if you need a practical canonical value.
 */
export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

// ---------------------------------------------------------------------------
// Practical rounding
// ---------------------------------------------------------------------------

/**
 * Practical weight increment lookup table.
 *
 * Equipment     | kg step | lbs step
 * --------------|---------|----------
 * Barbell       |   2.5   |    5
 * Dumbbell      |   2     |    5
 * Machine       |   5     |   10
 * Cable         |   5     |   10
 * Kettlebell    |   2     |    5
 * Bodyweight    |   2.5   |    5
 * Medicine Ball |   2     |    5
 * Other         |   2     |    5
 */
const INCREMENT_TABLE: Record<ExerciseEquipment, { kg: number; lbs: number }> = {
  barbell:        { kg: 2.5, lbs: 5 },
  dumbbell:       { kg: 2,   lbs: 5 },
  machine:        { kg: 5,   lbs: 10 },
  cable:          { kg: 5,   lbs: 10 },
  kettlebell:     { kg: 2,   lbs: 5 },
  bodyweight:     { kg: 2.5, lbs: 5 },
  "medicine-ball": { kg: 2,   lbs: 5 },
  other:          { kg: 2,   lbs: 5 },
  // Cardio equipment does not have weight increments, but we include it
  // for type completeness. In practice, cardio exercises won't hit this path.
  cardio:         { kg: 2.5, lbs: 5 },
};

/**
 * Get the practical weight increment for a given equipment type and unit system.
 */
export function getIncrement(
  equipment: ExerciseEquipment,
  units: "kg" | "lbs"
): number {
  return INCREMENT_TABLE[equipment][units];
}

/**
 * Round a weight value to the nearest practical increment for the given
 * equipment and unit system.
 *
 * This is used after calculating a progression suggestion (e.g., lastWeight * 1.05)
 * to snap the result to a weight that actually exists on gym equipment.
 *
 * Rounding is to the *nearest* increment (standard mathematical rounding).
 */
export function roundToIncrement(
  value: number,
  equipment: ExerciseEquipment,
  units: "kg" | "lbs"
): number {
  const step = getIncrement(equipment, units);
  return Math.round(value / step) * step;
}

/**
 * Convert a canonical kg value to display units, rounded to the nearest
 * practical increment for the given equipment.
 *
 * When units is "kg", the value is rounded to the kg increment.
 * When units is "lbs", the value is converted to lbs then rounded to the lbs increment.
 */
export function toDisplayWeight(
  canonicalKg: number,
  equipment: ExerciseEquipment,
  units: "kg" | "lbs"
): number {
  if (units === "kg") {
    return roundToIncrement(canonicalKg, equipment, "kg");
  }
  const lbs = kgToLbs(canonicalKg);
  return roundToIncrement(lbs, equipment, "lbs");
}

/**
 * Convert a display value back to canonical kg, rounded to the nearest
 * practical kg increment for the given equipment.
 *
 * When displayUnits is "kg", the value is used directly (already canonical).
 * When displayUnits is "lbs", the value is converted to kg then rounded to the kg increment.
 */
export function toCanonicalKg(
  displayValue: number,
  equipment: ExerciseEquipment,
  displayUnits: "kg" | "lbs"
): number {
  if (displayUnits === "kg") {
    return roundToIncrement(displayValue, equipment, "kg");
  }
  const kg = lbsToKg(displayValue);
  return roundToIncrement(kg, equipment, "kg");
}
