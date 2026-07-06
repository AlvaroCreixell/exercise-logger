import type { LoggedSet, SetBlock } from "@/domain/types";
import type { ExerciseType, UnitSystem } from "@/domain/enums";
import type {
  BlockSuggestion,
  BlockLastTime,
} from "@/services/progression-service";
import { toDisplayWeight } from "@/domain/unit-conversion";

/**
 * The complete payload a primed row logs on tap. Shape-compatible with
 * `SetLogInput` (minus the PR flag) so quick-log passes it straight to
 * `logSet` — one tap, no translation layer.
 */
export interface QuickTarget {
  performedWeightKg: number | null;
  performedReps: number | null;
  performedDurationSec: number | null;
  performedDistanceM: number | null;
}

/** The first empty prescribed slot of an exercise — the only primed row. */
export interface PrimedSlot {
  blockIndex: number;
  setIndex: number;
}

/**
 * Find the lowest-index empty prescribed slot across blocks.
 *
 * Extra-set overruns (setIndex >= block.count) never count as prescribed
 * slots, so an overrun at [1,3] does not mask an empty [1,1].
 * Returns null when every prescribed slot is logged (or there are no blocks).
 */
export function resolvePrimedSlot(
  blocks: SetBlock[],
  loggedSets: LoggedSet[],
): PrimedSlot | null {
  const logged = new Set(loggedSets.map((ls) => `${ls.blockIndex}:${ls.setIndex}`));
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex]!;
    for (let setIndex = 0; setIndex < block.count; setIndex++) {
      if (!logged.has(`${blockIndex}:${setIndex}`)) {
        return { blockIndex, setIndex };
      }
    }
  }
  return null;
}

/** The block's per-set prescription value: range floor, else exact. */
function prescriptionFloor(block: SetBlock): number | null {
  return block.minValue ?? block.exactValue ?? null;
}

/**
 * Resolve what one tap on a primed row would log, per spec §3.4
 * (docs/superpowers/specs/2026-07-06-in-gym-hardening-plan.md).
 *
 * Returns null when the target is incomplete — the row then renders as a
 * plain empty slot and taps open the sheet instead. One-tap logging never
 * invents a number the user hasn't seen:
 * - weight blocks need a weight source (in-session carryover or suggestion);
 * - non-weight blocks need block history (`lastTime`).
 *
 * Invariant 8: callers must pass THIS block's suggestion/lastTime/sets only.
 * Invariant 7 holds structurally: extras have no suggestions and no blocks,
 * so no primed row can exist for them.
 */
export function resolveQuickTarget(args: {
  block: SetBlock;
  setIndex: number;
  suggestion: BlockSuggestion | undefined;
  lastTime: BlockLastTime | undefined;
  /** In-session logged sets for this block (carryover source). */
  blockSetsInSession: LoggedSet[];
  effectiveType: ExerciseType;
}): QuickTarget | null {
  const { block, setIndex, suggestion, lastTime, blockSetsInSession, effectiveType } = args;
  const lastSet = lastTime?.sets[setIndex];
  const empty: QuickTarget = {
    performedWeightKg: null,
    performedReps: null,
    performedDurationSec: null,
    performedDistanceM: null,
  };

  if (block.targetKind === "reps") {
    if (effectiveType === "weight") {
      // Weight: in-session carryover (latest update wins — mid-block weight
      // changes carry forward) outranks the suggestion.
      const carryover = blockSetsInSession
        .filter((ls) => ls.performedWeightKg != null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      const weightKg = carryover?.performedWeightKg ?? suggestion?.suggestedWeightKg ?? null;
      if (weightKg == null) return null;

      // Reps: a progression restarts at the range floor; a repeat matches
      // last time's reps for this set position.
      const reps = suggestion?.isProgression
        ? prescriptionFloor(block)
        : lastSet?.reps ?? prescriptionFloor(block);
      if (reps == null) return null;

      return { ...empty, performedWeightKg: weightKg, performedReps: reps };
    }

    // Reps-only (bodyweight etc.): needs block history; never carries weight,
    // so quick-log can never trigger weighted-bodyweight promotion.
    if (!lastTime) return null;
    const reps = lastSet?.reps ?? prescriptionFloor(block);
    if (reps == null) return null;
    return { ...empty, performedReps: reps };
  }

  if (block.targetKind === "duration") {
    if (!lastTime) return null;
    const durationSec = lastSet?.durationSec ?? prescriptionFloor(block);
    if (durationSec == null) return null;
    return { ...empty, performedDurationSec: durationSec };
  }

  // distance
  if (!lastTime) return null;
  const distanceM = lastSet?.distanceM ?? prescriptionFloor(block);
  if (distanceM == null) return null;
  return { ...empty, performedDistanceM: distanceM };
}

/** "1800" → "30min" when cleanly divisible by 60; "45" → "45s" otherwise. */
function formatDuration(sec: number): string {
  return sec >= 60 && sec % 60 === 0 ? `${sec / 60}min` : `${sec}s`;
}

/**
 * Render a QuickTarget for the primed row / rest-bar "next:" label.
 * "52.5 kg × 8" · "12 reps" · "45s" · "2000m".
 */
export function formatQuickTarget(target: QuickTarget, units: UnitSystem): string {
  if (target.performedWeightKg != null && target.performedReps != null) {
    return `${toDisplayWeight(target.performedWeightKg, units)} ${units} × ${target.performedReps}`;
  }
  if (target.performedReps != null) return `${target.performedReps} reps`;
  if (target.performedDurationSec != null) return formatDuration(target.performedDurationSec);
  if (target.performedDistanceM != null) return `${target.performedDistanceM}m`;
  return "";
}

/**
 * Per-set prescription hint for day-one empty rows ("tap to log · 8–12 reps").
 * Unlike `formatSetTarget` this omits the set count — it describes one set.
 */
export function formatBlockTargetHint(block: SetBlock): string {
  const range =
    block.minValue != null && block.maxValue != null
      ? `${block.minValue}–${block.maxValue}`
      : block.exactValue != null
        ? `${block.exactValue}`
        : "?";

  if (block.targetKind === "duration") {
    if (block.exactValue != null) return formatDuration(block.exactValue);
    return `${range}s`;
  }
  if (block.targetKind === "distance") return `${range}m`;
  return `${range} reps`;
}
