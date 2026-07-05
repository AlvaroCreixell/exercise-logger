import type { Session } from "@/domain/types";

/** Which rest snapshot the timer was started from. */
export type RestTimerKind = "single" | "superset";

/** Instruction to start a rest timer, returned by the pure helper. */
export interface RestTimerStart {
  kind: RestTimerKind;
  durationSec: number;
  label: string;
  /** 1-based superset round number, or null for single-exercise rest. */
  roundOrdinal: number | null;
}

/**
 * The timer as stored in WorkoutScreen state.
 *
 * `status` is stored as "running"; the screen derives the effective status at
 * render time — when remaining reaches <= 0 it renders the timer as "done"
 * without a separate timeout. Sprint 2 keeps this as ephemeral UI state:
 * never persisted, reset on reload.
 */
export interface ActiveRestTimer {
  status: "running" | "done";
  kind: RestTimerKind;
  durationSec: number;
  startedAtMs: number;
  label: string;
  roundOrdinal: number | null;
}

/**
 * Decide whether a rest timer should start after a NEW set was saved.
 *
 * Callers must only invoke this on the create path (never on edits, stale
 * upserts, or deletes — see WorkoutScreen.handleSave guards).
 *
 * Rules:
 * - Non-superset saves (including extra exercises) start default rest from
 *   `session.restDefaultSecSnapshot` labelled with the exercise name.
 * - Superset members rest only when the save completes an A/B round, using
 *   `session.restSupersetSecSnapshot` and a round label.
 * - A duration of 0 or less means "no rest configured" → null.
 */
export function getRestTimerStartAfterNewSet(args: {
  session: Session;
  exerciseName: string;
  isSupersetMember: boolean;
  supersetRoundJustCompleted: boolean;
  supersetRoundOrdinal: number | null;
}): RestTimerStart | null {
  const { session, exerciseName, isSupersetMember } = args;

  if (!isSupersetMember) {
    const durationSec = session.restDefaultSecSnapshot;
    if (durationSec <= 0) return null;
    return {
      kind: "single",
      durationSec,
      label: `Rest — ${exerciseName}`,
      roundOrdinal: null,
    };
  }

  if (!args.supersetRoundJustCompleted) return null;

  const durationSec = session.restSupersetSecSnapshot;
  if (durationSec <= 0) return null;
  const roundOrdinal = args.supersetRoundOrdinal;
  return {
    kind: "superset",
    durationSec,
    label: `Rest — Superset round ${roundOrdinal ?? 1}`,
    roundOrdinal,
  };
}

/**
 * Whole seconds left on a timer at `nowMs`. Goes negative once the duration
 * has elapsed — callers derive the done state from `remaining <= 0` and clamp
 * for display.
 */
export function getRestRemainingSec(
  timer: Pick<ActiveRestTimer, "durationSec" | "startedAtMs">,
  nowMs: number,
): number {
  return timer.durationSec - Math.floor((nowMs - timer.startedAtMs) / 1000);
}

/** Format seconds as a m:ss countdown clock; negative values clamp to 0:00. */
export function formatRestClock(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${mins}:${rem.toString().padStart(2, "0")}`;
}
