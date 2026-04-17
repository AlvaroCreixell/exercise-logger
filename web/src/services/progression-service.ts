import type {
  LoggedSet,
  SessionExercise,
  SetBlock,
  Session,
} from "@/domain/types";
import type {
  ExerciseType,
  ExerciseEquipment,
  TargetKind,
  SetTag,
  UnitSystem,
} from "@/domain/enums";
import type { ExerciseLoggerDB } from "@/db/database";
import { generateBlockSignature } from "@/domain/block-signature";
import { kgToLbs, lbsToKg, roundToIncrement, getIncrement } from "@/domain/unit-conversion";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

/** A single set's performed data for last-time display. */
export interface LastTimeSet {
  /** Weight in kg, or null for unweighted. */
  weightKg: number | null;
  /** Reps performed, or null. */
  reps: number | null;
  /** Duration in seconds, or null. */
  durationSec: number | null;
  /** Distance in meters, or null. */
  distanceM: number | null;
}

/** Last-time data for a single set block. */
export interface BlockLastTime {
  /** The block index within the exercise's setBlocksSnapshot. */
  blockIndex: number;
  /** Human-readable block label (e.g., "Top", "Back-off", "Set block 1"). */
  blockLabel: string;
  /** The tag for this block, or null. */
  tag: SetTag | null;
  /** Individual set data, ordered by setIndex. */
  sets: LastTimeSet[];
}

/** Suggestion for a single set block's weight. */
export interface BlockSuggestion {
  /** The block index this suggestion is for. */
  blockIndex: number;
  /** Suggested weight in canonical kg. */
  suggestedWeightKg: number;
  /** Whether this is a progression increase (true) or repeat (false). */
  isProgression: boolean;
  /** The previous weight in kg, for display context. */
  previousWeightKg: number;
}

/** Combined last-time and suggestion data for an exercise card. */
export interface ExerciseHistoryData {
  /** Per-block last-time data, sparse array keyed by blockIndex. Undefined slots mean no history for that block. */
  lastTime: (BlockLastTime | undefined)[];
  /** Per-block suggestions. Only present for blocks that qualify. */
  suggestions: BlockSuggestion[];
}

/** Last-time data for an extra exercise (no block structure). */
export interface ExtraExerciseHistory {
  /** The sets from the most recent finished session for this exerciseId. */
  sets: LastTimeSet[];
  /** ISO timestamp of the session these sets came from. */
  sessionDate: string;
}

// ---------------------------------------------------------------------------
// Block matching -- internal helpers
// ---------------------------------------------------------------------------

/**
 * Find matching logged sets from the most recent finished session.
 *
 * Primary match strategy (spec section 11):
 *   exerciseId + instanceLabel + origin="routine" + blockSignature
 *
 * Fallback match strategy:
 *   exerciseId + instanceLabel + origin="routine" + tag + targetKind
 *
 * Only finished sessions are valid inputs.
 *
 * @returns The matching LoggedSet[] from a single session, or empty array if no match.
 */
export async function findMatchingBlock(
  db: ExerciseLoggerDB,
  exerciseId: string,
  instanceLabel: string | null,
  blockSignature: string,
  tag: SetTag | null,
  targetKind: TargetKind
): Promise<LoggedSet[]> {
  // Normalize instanceLabel: stored as "" instead of null in loggedSets
  // (see set-service.ts logSet implementation)
  const normalizedLabel = instanceLabel ?? "";

  // --- Primary match: exerciseId + instanceLabel + blockSignature ---
  // Use the compound index [exerciseId+instanceLabel+blockSignature+loggedAt]
  const primaryMatches = await db.loggedSets
    .where("[exerciseId+instanceLabel+blockSignature+loggedAt]")
    .between(
      [exerciseId, normalizedLabel, blockSignature, ""],
      [exerciseId, normalizedLabel, blockSignature, "\uffff"]
    )
    .toArray();

  // Filter to only routine-origin sets
  const routinePrimary = primaryMatches.filter((ls) => ls.origin === "routine");

  if (routinePrimary.length > 0) {
    // Find the most recent session among these sets
    const result = await findMostRecentFinishedSessionSets(db, routinePrimary);
    if (result.length > 0) {
      return result;
    }
  }

  // --- Fallback match: exerciseId + instanceLabel + tag + targetKind ---
  // No compound index for this combo, so we query by exerciseId+instanceLabel
  // and filter in memory
  const fallbackCandidates = await db.loggedSets
    .where("[exerciseId+instanceLabel+blockSignature+loggedAt]")
    .between(
      [exerciseId, normalizedLabel, "", ""],
      [exerciseId, normalizedLabel, "\uffff", "\uffff"]
    )
    .toArray();

  const normalizedTag = tag ?? null;
  const fallbackMatches = fallbackCandidates.filter((ls) => {
    if (ls.origin !== "routine") return false;
    if (ls.tag !== normalizedTag) return false;
    // Extract targetKind from blockSignature (format: "targetKind:...")
    const sigTargetKind = ls.blockSignature.split(":")[0];
    return sigTargetKind === targetKind;
  });

  if (fallbackMatches.length > 0) {
    return findMostRecentFinishedSessionSets(db, fallbackMatches);
  }

  return [];
}

/**
 * Given a set of logged sets, group them by sessionId, find the most recent
 * finished session, and return only the sets from that session.
 *
 * Sets are returned sorted by setIndex ascending.
 */
async function findMostRecentFinishedSessionSets(
  db: ExerciseLoggerDB,
  loggedSets: LoggedSet[]
): Promise<LoggedSet[]> {
  // Group by sessionId
  const bySession = new Map<string, LoggedSet[]>();
  for (const ls of loggedSets) {
    const existing = bySession.get(ls.sessionId);
    if (existing) {
      existing.push(ls);
    } else {
      bySession.set(ls.sessionId, [ls]);
    }
  }

  // Load all referenced sessions and filter to finished only
  const sessionIds = [...bySession.keys()];
  const sessions: Session[] = [];
  for (const id of sessionIds) {
    const session = await db.sessions.get(id);
    if (session && session.status === "finished") {
      sessions.push(session);
    }
  }

  if (sessions.length === 0) {
    return [];
  }

  // Sort by finishedAt descending to find the most recent
  sessions.sort((a, b) => {
    const aTime = a.finishedAt ?? a.startedAt;
    const bTime = b.finishedAt ?? b.startedAt;
    return bTime.localeCompare(aTime);
  });

  const mostRecentSession = sessions[0]!;
  const matchingSets = bySession.get(mostRecentSession.id) ?? [];

  // Sort by setIndex ascending
  return matchingSets.sort((a, b) => a.setIndex - b.setIndex);
}

// ---------------------------------------------------------------------------
// Suggestion engine
// ---------------------------------------------------------------------------

/**
 * Determine if a set block qualifies for automated progression.
 *
 * Returns true only when ALL 4 conditions are met (spec section 11):
 * 1. The block target is a range, not an exact value
 * 2. The exercise type is "weight" or a weighted bodyweight override
 * 3. The most recent matching finished session has ALL expected sets logged for that block
 * 4. All matching sets hit the ceiling (top of the range)
 */
function isRangeBlock(block: SetBlock): boolean {
  return block.minValue !== undefined && block.maxValue !== undefined;
}

function isWeightEligible(effectiveType: ExerciseType): boolean {
  return effectiveType === "weight";
}

function allSetsLogged(matchingSets: LoggedSet[], expectedCount: number): boolean {
  return matchingSets.length >= expectedCount;
}

// P5-A [CERTAIN — BUG]: allSetsHitCeiling must inspect targetKind and compare
// ceiling against the appropriate field, not just performedReps.
function allSetsHitCeiling(sets: LoggedSet[], ceiling: number, targetKind: TargetKind): boolean {
  if (sets.length === 0) return false;
  return sets.every((ls) => {
    if (targetKind === "reps") return ls.performedReps !== null && ls.performedReps >= ceiling;
    if (targetKind === "duration") return ls.performedDurationSec !== null && ls.performedDurationSec >= ceiling;
    if (targetKind === "distance") return ls.performedDistanceM !== null && ls.performedDistanceM >= ceiling;
    return false;
  });
}

/**
 * Calculate the weight suggestion for a single set block.
 *
 * Spec rules:
 * - If all 4 progression conditions are met:
 *   suggest lastWeightKg * 1.05, rounded to nearest practical increment
 * - Otherwise:
 *   suggest the same weight used in the most recent matching finished block
 * - Returns null if no suggestion is possible (no match, extras, cardio, etc.)
 *
 * @param matchingSets - The logged sets from the most recent matching block
 * @param block - The set block prescription
 * @param blockIndex - The index of this block within the exercise
 * @param effectiveType - The effective exercise type (from sessionExercise)
 * @param effectiveEquipment - The effective equipment (from sessionExercise)
 * @param units - The user's display unit preference
 * @returns BlockSuggestion or null if no suggestion is possible
 */
export function calculateBlockSuggestion(
  matchingSets: LoggedSet[],
  block: SetBlock,
  blockIndex: number,
  effectiveType: ExerciseType,
  effectiveEquipment: ExerciseEquipment,
  units: UnitSystem
): BlockSuggestion | null {
  // No suggestion if no matching sets
  if (matchingSets.length === 0) {
    return null;
  }

  // No suggestion for non-weight exercises (invariant: cardio, isometric, unweighted bodyweight)
  if (!isWeightEligible(effectiveType)) {
    return null;
  }

  // Find the weight used -- take the first set's weight as the reference
  // (all sets in a block should use the same weight in typical usage)
  const previousWeightKg = matchingSets[0]!.performedWeightKg;

  // No suggestion if previous weight is null (unweighted sets)
  if (previousWeightKg === null) {
    return null;
  }

  // Check all 4 progression conditions
  const conditionRange = isRangeBlock(block);
  const conditionWeight = isWeightEligible(effectiveType);
  const conditionAllLogged = allSetsLogged(matchingSets, block.count);
  // P5-A: pass targetKind to allSetsHitCeiling
  const conditionAllHitCeiling = conditionRange
    ? allSetsHitCeiling(matchingSets, block.maxValue!, block.targetKind)
    : false;

  if (conditionRange && conditionWeight && conditionAllLogged && conditionAllHitCeiling) {
    // Automated progression: 5% increase with practical rounding
    const rawIncrease = previousWeightKg * 1.05;

    // Round in the user's display units, then store canonical kg
    let suggestedWeightKg: number;
    if (units === "kg") {
      suggestedWeightKg = roundToIncrement(rawIncrease, effectiveEquipment, "kg");
    } else {
      // Convert to lbs, round in lbs, convert back to kg
      const rawLbs = kgToLbs(rawIncrease);
      const roundedLbs = roundToIncrement(rawLbs, effectiveEquipment, "lbs");
      // P5-C: Use lbsToKg() helper instead of hardcoded / 2.20462
      suggestedWeightKg = lbsToKg(roundedLbs);
    }
    // [R6] Apply 0.01 kg cleanup rounding uniformly to both branches so kg
    // path doesn't emit floating-point noise (e.g. 102.4999999997) and
    // produces output consistent with the lbs path.
    suggestedWeightKg = Math.round(suggestedWeightKg * 100) / 100;

    // P5-B [CERTAIN — BUG]: Ensure the suggestion is at least one increment
    // above the previous weight. Use getIncrement() directly instead of
    // roundToIncrement which can round down to 0 for small values.
    if (suggestedWeightKg <= previousWeightKg) {
      suggestedWeightKg = previousWeightKg + getIncrement(effectiveEquipment, "kg");
    }

    return {
      blockIndex,
      suggestedWeightKg,
      isProgression: true,
      previousWeightKg,
    };
  }

  // No progression -- suggest the same weight as last time
  return {
    blockIndex,
    suggestedWeightKg: previousWeightKg,
    isProgression: false,
    previousWeightKg,
  };
}

// ---------------------------------------------------------------------------
// Block label generation
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable label for a set block.
 *
 * Examples:
 * - Block with tag "top" -> "Top"
 * - Block with tag "amrap" -> "AMRAP"
 * - Single block, no tag -> "" (no label needed)
 * - Multiple blocks, no tag, index 0 -> "Set block 1"
 * - Multiple blocks, no tag, index 1 -> "Set block 2"
 *
 * P5-D: If a block follows a top-tagged block and has no tag, label it "Back-off".
 */
export function getBlockLabel(
  block: SetBlock,
  blockIndex: number,
  totalBlocks: number,
  allBlocks: SetBlock[]
): string {
  if (block.tag === "top") return "Top";
  if (block.tag === "amrap") return "AMRAP";
  if (totalBlocks <= 1) return "";

  // P5-D: If the previous block has a "top" tag and this block has no tag,
  // label it "Back-off" instead of "Set block N".
  if (blockIndex > 0) {
    const prevBlock = allBlocks[blockIndex - 1];
    if (prevBlock && prevBlock.tag === "top" && !block.tag) {
      return "Back-off";
    }
  }

  return `Set block ${blockIndex + 1}`;
}

// ---------------------------------------------------------------------------
// Exercise history data (routine exercises)
// ---------------------------------------------------------------------------

/**
 * Get the last-time display data and suggestions for a routine exercise.
 *
 * This is the main function the UI calls for each routine exercise card.
 * It returns per-block last-time data and per-block suggestions.
 *
 * Enforces invariant 7: extras never feed progression.
 * Enforces invariant 8: progression is per set block.
 *
 * @param db - Dexie database instance
 * @param sessionExercise - The session exercise to get history for
 * @param units - The user's display unit preference
 * @returns ExerciseHistoryData with lastTime and suggestions arrays
 */
export async function getExerciseHistoryData(
  db: ExerciseLoggerDB,
  sessionExercise: SessionExercise,
  units: UnitSystem
): Promise<ExerciseHistoryData> {
  // Guard: extras never feed progression (invariant 7)
  if (sessionExercise.origin === "extra") {
    return { lastTime: [], suggestions: [] };
  }

  const blocks = sessionExercise.setBlocksSnapshot;
  if (blocks.length === 0) {
    return { lastTime: [], suggestions: [] };
  }

  const lastTime: (BlockLastTime | undefined)[] = [];
  const suggestions: BlockSuggestion[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex]!;
    const blockSig = generateBlockSignature(block);

    // Find matching logged sets from the most recent finished session
    const matchingSets = await findMatchingBlock(
      db,
      sessionExercise.exerciseId,
      sessionExercise.instanceLabel,
      blockSig,
      block.tag ?? null,
      block.targetKind
    );

    // Build last-time data for this block
    if (matchingSets.length > 0) {
      const blockLabel = getBlockLabel(block, blockIndex, blocks.length, blocks);
      lastTime[blockIndex] = {
        blockIndex,
        blockLabel,
        tag: block.tag ?? null,
        sets: matchingSets.map((ls) => ({
          weightKg: ls.performedWeightKg,
          reps: ls.performedReps,
          durationSec: ls.performedDurationSec,
          distanceM: ls.performedDistanceM,
        })),
      };
    }

    // Calculate suggestion for this block (invariant 8: per set block)
    const suggestion = calculateBlockSuggestion(
      matchingSets,
      block,
      blockIndex,
      sessionExercise.effectiveType,
      sessionExercise.effectiveEquipment,
      units
    );

    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  return { lastTime, suggestions };
}

// ---------------------------------------------------------------------------
// Extra exercise history
// ---------------------------------------------------------------------------

/**
 * Get the most recent logged sets for an extra exercise.
 *
 * Unlike routine exercises, extras match on exerciseId alone -- regardless
 * of routine position, instanceLabel, or block structure.
 *
 * Only finished sessions are valid sources.
 *
 * @param db - Dexie database instance
 * @param exerciseId - The exercise to find history for
 * @returns ExtraExerciseHistory or null if no history exists
 */
export async function getExtraExerciseHistory(
  db: ExerciseLoggerDB,
  exerciseId: string
): Promise<ExtraExerciseHistory | null> {
  // Query all logged sets for this exerciseId, ordered by loggedAt
  const allSets = await db.loggedSets
    .where("[exerciseId+loggedAt]")
    .between(
      [exerciseId, ""],
      [exerciseId, "\uffff"]
    )
    .toArray();

  if (allSets.length === 0) {
    return null;
  }

  // Group by sessionId
  const bySession = new Map<string, LoggedSet[]>();
  for (const ls of allSets) {
    const existing = bySession.get(ls.sessionId);
    if (existing) {
      existing.push(ls);
    } else {
      bySession.set(ls.sessionId, [ls]);
    }
  }

  // Load sessions and filter to finished only
  const sessionIds = [...bySession.keys()];
  const finishedSessions: Session[] = [];
  for (const id of sessionIds) {
    const session = await db.sessions.get(id);
    if (session && session.status === "finished") {
      finishedSessions.push(session);
    }
  }

  if (finishedSessions.length === 0) {
    return null;
  }

  // Sort by finishedAt descending
  finishedSessions.sort((a, b) => {
    const aTime = a.finishedAt ?? a.startedAt;
    const bTime = b.finishedAt ?? b.startedAt;
    return bTime.localeCompare(aTime);
  });

  const mostRecentSession = finishedSessions[0]!;
  const sessionSets = bySession.get(mostRecentSession.id) ?? [];

  // Sort by blockIndex, then setIndex
  sessionSets.sort((a, b) => {
    if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
    return a.setIndex - b.setIndex;
  });

  return {
    sets: sessionSets.map((ls) => ({
      weightKg: ls.performedWeightKg,
      reps: ls.performedReps,
      durationSec: ls.performedDurationSec,
      distanceM: ls.performedDistanceM,
    })),
    sessionDate: mostRecentSession.finishedAt ?? mostRecentSession.startedAt,
  };
}

// ---------------------------------------------------------------------------
// Training cadence (Sprint 5)
// ---------------------------------------------------------------------------

/**
 * Rolling-window session counts + a calendar-day-granularity
 * "last session was N days ago" signal.
 *
 * Used by TodayScreen + LastSessionCard to surface training cadence without
 * committing to a strict "consecutive days" streak definition (which is a bad
 * fit for typical 3-day-per-week splits).
 *
 * Semantics:
 * - `sessionsLast7Days`: count of finished sessions whose `startedAt` is within
 *   the last 7 × 24 hours of `now`.
 * - `sessionsLast30Days`: same, last 30 × 24 hours.
 * - `daysSinceLastSession`: integer number of calendar days between the most
 *   recent finished session's `startedAt` and `now` (both truncated to local
 *   midnight). 0 = today. `null` if no finished sessions exist.
 * - Active and discarded sessions are excluded.
 */
export async function computeTrainingCadence(
  db: ExerciseLoggerDB,
  now: Date = new Date(),
): Promise<{
  sessionsLast7Days: number;
  sessionsLast30Days: number;
  daysSinceLastSession: number | null;
}> {
  const finished = await db.sessions
    .where("status")
    .equals("finished")
    .toArray();

  if (finished.length === 0) {
    return { sessionsLast7Days: 0, sessionsLast30Days: 0, daysSinceLastSession: null };
  }

  const nowMs = now.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  let sessionsLast7Days = 0;
  let sessionsLast30Days = 0;
  let mostRecentStartMs = -Infinity;

  for (const s of finished) {
    const startMs = new Date(s.startedAt).getTime();
    const ageMs = nowMs - startMs;
    if (ageMs >= 0 && ageMs < sevenDaysMs) sessionsLast7Days += 1;
    if (ageMs >= 0 && ageMs < thirtyDaysMs) sessionsLast30Days += 1;
    if (startMs > mostRecentStartMs) mostRecentStartMs = startMs;
  }

  const last = new Date(mostRecentStartMs);
  const lastMidnight = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  const nowMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceLastSession = Math.max(0, Math.round((nowMidnight - lastMidnight) / (24 * 60 * 60 * 1000)));

  return { sessionsLast7Days, sessionsLast30Days, daysSinceLastSession };
}
