import type { SetBlock } from "./types";

/**
 * Generate a deterministic block signature for progression matching.
 *
 * The signature encodes enough information to match equivalent set blocks
 * across sessions without depending on position-based indexing.
 *
 * Format:
 *   "{targetKind}:{valueSpec}:count{count}:tag{tagValue}"
 *
 * Value spec:
 *   - Range: "{min}-{max}"        (e.g. "6-8", "30-60")
 *   - Exact: "{exactValue}"       (e.g. "8", "2000")
 *
 * Tag value:
 *   - "top" or "amrap" when the tag is set
 *   - "normal" when no tag is set
 *
 * Examples:
 *   - reps 6-8, count 1, tag top    -> "reps:6-8:count1:tagtop"
 *   - reps 8-12, count 3, no tag    -> "reps:8-12:count3:tagnormal"
 *   - duration 30-60, count 2       -> "duration:30-60:count2:tagnormal"
 *   - reps exact 8, count 3         -> "reps:8:count3:tagnormal"
 *   - distance exact 2000, count 1  -> "distance:2000:count1:tagnormal"
 */
export function generateBlockSignature(block: SetBlock): string {
  const { targetKind, minValue, maxValue, exactValue, count, tag } = block;

  let valueSpec: string;
  if (exactValue !== undefined) {
    valueSpec = String(exactValue);
  } else if (minValue !== undefined && maxValue !== undefined) {
    valueSpec = `${minValue}-${maxValue}`;
  } else {
    // Defensive fallback — should never happen with valid data
    valueSpec = "0";
  }

  const tagValue = tag ?? "normal";

  return `${targetKind}:${valueSpec}:count${count}:tag${tagValue}`;
}
