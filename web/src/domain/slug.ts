/**
 * Convert a display name to a canonical slug for use as an exercise ID.
 *
 * Rules:
 * - Lowercase the entire string
 * - Replace spaces and underscores with hyphens
 * - Remove all characters except lowercase letters, digits, and hyphens
 * - Collapse multiple consecutive hyphens into one
 * - Trim leading and trailing hyphens
 *
 * Examples:
 * - "Barbell Back Squat" -> "barbell-back-squat"
 * - "Single-Leg Romanian Deadlift" -> "single-leg-romanian-deadlift"
 * - "Medicine Ball Rotational Slam" -> "medicine-ball-rotational-slam"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}
