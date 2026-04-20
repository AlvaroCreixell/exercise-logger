import type { SetBlock } from "@/domain/types";

/** "1800 seconds" → "30min" when cleanly divisible by 60; "45" → "45s" otherwise. */
function formatDurationExact(sec: number): string {
  if (sec >= 60 && sec % 60 === 0) return `${sec / 60}min`;
  return `${sec}s`;
}

/** Duration range. When both endpoints are clean minutes, render as 'M–Nmin'; else 'M–Ns'. */
function formatDurationRange(min: number, max: number): string {
  const cleanMinutes = min >= 60 && max >= 60 && min % 60 === 0 && max % 60 === 0;
  return cleanMinutes ? `${min / 60}–${max / 60}min` : `${min}–${max}s`;
}

function formatValue(block: SetBlock): string {
  if (block.targetKind === "duration") {
    if (block.exactValue != null) return formatDurationExact(block.exactValue);
    if (block.minValue != null && block.maxValue != null) {
      return formatDurationRange(block.minValue, block.maxValue);
    }
    return "?";
  }

  // reps / distance — numeric rendering without unit suffix (suffix added below)
  if (block.exactValue != null) return `${block.exactValue}`;
  if (block.minValue != null && block.maxValue != null) {
    return `${block.minValue}–${block.maxValue}`;
  }
  return "?";
}

/** Format a single block target: e.g. "3 × 8–12", "1 × 12–16 top", "1 × 30min", "2 × 2000m". */
export function formatSetTarget(block: SetBlock): string {
  const value = formatValue(block);
  const tagSuffix = block.tag ? ` ${block.tag}` : "";

  if (block.targetKind === "duration") {
    // value already carries its unit ("30min" / "45s" / "30–60min")
    return `${block.count} × ${value}${tagSuffix}`;
  }
  if (block.targetKind === "distance") {
    return `${block.count} × ${value}m${tagSuffix}`;
  }
  return `${block.count} × ${value}${tagSuffix}`;
}

/** Format the full exercise target line by joining blocks with " · ". */
export function formatExerciseTargetLine(blocks: SetBlock[]): string {
  return blocks.map(formatSetTarget).join(" · ");
}
