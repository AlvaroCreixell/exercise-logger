export type KeypadKey =
  | "0" | "1" | "2" | "3" | "4"
  | "5" | "6" | "7" | "8" | "9"
  | "." | "back";

/**
 * Pure reducer for one keypad-controlled string field.
 * Rules:
 * - "back" drops the last character (no-op on empty).
 * - "." is ignored if the string already contains one.
 * - "." on empty string becomes "0.".
 * - A digit after a standalone "0" replaces the "0" (prevents "07").
 */
export function applyKeypadKey(current: string, key: KeypadKey): string {
  if (key === "back") {
    return current.length === 0 ? "" : current.slice(0, -1);
  }
  if (key === ".") {
    if (current.includes(".")) return current;
    return current.length === 0 ? "0." : current + ".";
  }
  // digit
  if (current === "0") return key;
  return current + key;
}
