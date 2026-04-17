import type {
  LoggedSet,
} from "@/domain/types";
import type { SetTag } from "@/domain/enums";
import type { ExerciseLoggerDB } from "@/db/database";
import { generateId } from "@/domain/uuid";
import { nowISO } from "@/domain/timestamp";
import { generateBlockSignature } from "@/domain/block-signature";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input for logging or editing a set. */
export interface SetLogInput {
  /** Weight in kg (external load only), or null for bodyweight/unweighted. */
  performedWeightKg: number | null;
  /** Reps performed, or null when not applicable. */
  performedReps: number | null;
  /** Duration in seconds, or null when not applicable. */
  performedDurationSec: number | null;
  /** Distance in meters, or null when not applicable. */
  performedDistanceM: number | null;
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/**
 * Validate a SetLogInput for plausible numeric ranges.
 *
 * Rules (per `docs/notes.md`):
 * - performedWeightKg: >= 0 or null (zero allowed for bodyweight movements
 *   logged as "no added load").
 * - performedReps, performedDurationSec, performedDistanceM: > 0 or null
 *   (zero is meaningless -- use null to mean "not applicable").
 * - All numeric values must be finite (rejects NaN and +/-Infinity).
 *
 * Throws a descriptive Error on the first failing field.
 */
function validateSetInput(input: SetLogInput): void {
  const checkNonNegative = (value: number | null, field: string) => {
    if (value === null) return;
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid ${field}: must be a finite number, got ${value}`);
    }
    if (value < 0) {
      throw new Error(`Invalid ${field}: must be >= 0, got ${value}`);
    }
  };
  const checkPositive = (value: number | null, field: string) => {
    if (value === null) return;
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid ${field}: must be a finite number, got ${value}`);
    }
    if (value <= 0) {
      throw new Error(`Invalid ${field}: must be positive, got ${value}`);
    }
  };

  checkNonNegative(input.performedWeightKg, "performedWeightKg");
  checkPositive(input.performedReps, "performedReps");
  checkPositive(input.performedDurationSec, "performedDurationSec");
  checkPositive(input.performedDistanceM, "performedDistanceM");
}

// ---------------------------------------------------------------------------
// Log set
// ---------------------------------------------------------------------------

/**
 * Log a set for a session exercise.
 *
 * Creates or updates a loggedSet row keyed by [sessionExerciseId, blockIndex, setIndex].
 *
 * Enforces invariant 9: if a slot already exists, update it in place instead
 * of creating a duplicate.
 *
 * Denormalizes exerciseId, instanceLabel, origin, and blockSignature from
 * the sessionExercise record.
 *
 * IMPORTANT: instanceLabel is stored as "" instead of null in loggedSets
 * to keep the Dexie compound index [exerciseId+instanceLabel+blockSignature+loggedAt]
 * functional. Dexie excludes rows with null keys from compound indexes.
 *
 * [P4-D] Promotion runs AFTER both create and update branches.
 * [P4-G] setIndex is validated against block count.
 *
 * @param db - Dexie database instance
 * @param sessionExerciseId - The session exercise to log a set for
 * @param blockIndex - Index within setBlocksSnapshot (0 for extras)
 * @param setIndex - Zero-based index within the block
 * @param input - The performed values
 * @returns The created or updated LoggedSet
 */
export async function logSet(
  db: ExerciseLoggerDB,
  sessionExerciseId: string,
  blockIndex: number,
  setIndex: number,
  input: SetLogInput
): Promise<LoggedSet> {
  validateSetInput(input);

  return db.transaction(
    "rw",
    db.sessions,
    db.sessionExercises,
    db.loggedSets,
    async () => {
      const sessionExercise = await db.sessionExercises.get(sessionExerciseId);
      if (!sessionExercise) {
        throw new Error(`SessionExercise "${sessionExerciseId}" not found`);
      }

      // Verify the session is active
      const session = await db.sessions.get(sessionExercise.sessionId);
      if (!session) {
        throw new Error(`Session "${sessionExercise.sessionId}" not found`);
      }
      if (session.status !== "active") {
        throw new Error(
          `Cannot log set: session "${session.id}" is "${session.status}", expected "active"`
        );
      }

      // Resolve block signature and tag from the set block snapshot
      let blockSignature: string;
      let tag: SetTag | null = null;

      if (sessionExercise.origin === "extra" || sessionExercise.setBlocksSnapshot.length === 0) {
        // Extra exercises have no set blocks -- use a generic signature
        blockSignature = "extra:0:count0:tagnormal";
      } else {
        const block = sessionExercise.setBlocksSnapshot[blockIndex];
        if (!block) {
          throw new Error(
            `Block index ${blockIndex} out of range for session exercise "${sessionExerciseId}" (has ${sessionExercise.setBlocksSnapshot.length} blocks)`
          );
        }

        // [P4-G] Validate setIndex against block count
        if (setIndex < 0 || setIndex >= block.count) {
          throw new Error(
            `Set index ${setIndex} out of range for block ${blockIndex} of session exercise "${sessionExerciseId}" (block has ${block.count} sets)`
          );
        }

        blockSignature = generateBlockSignature(block);
        tag = block.tag ?? null;
      }

      const now = nowISO();

      // Invariant 9: check if this slot already exists
      const existing = await db.loggedSets
        .where("[sessionExerciseId+blockIndex+setIndex]")
        .equals([sessionExerciseId, blockIndex, setIndex])
        .first();

      // Normalize instanceLabel: store "" instead of null for compound index compatibility
      const instanceLabel = sessionExercise.instanceLabel ?? "";

      // [P4-D] Use result variable so promotion runs for BOTH create and update paths
      let result: LoggedSet;

      if (existing) {
        // Update existing slot
        const updated: Partial<LoggedSet> = {
          performedWeightKg: input.performedWeightKg,
          performedReps: input.performedReps,
          performedDurationSec: input.performedDurationSec,
          performedDistanceM: input.performedDistanceM,
          updatedAt: now,
        };
        await db.loggedSets.update(existing.id, updated);
        result = { ...existing, ...updated } as LoggedSet;
      } else {
        // Create new logged set
        const loggedSet: LoggedSet = {
          id: generateId(),
          sessionId: sessionExercise.sessionId,
          sessionExerciseId,
          exerciseId: sessionExercise.exerciseId,
          instanceLabel,
          origin: sessionExercise.origin,
          blockIndex,
          blockSignature,
          setIndex,
          tag,
          performedWeightKg: input.performedWeightKg,
          performedReps: input.performedReps,
          performedDurationSec: input.performedDurationSec,
          performedDistanceM: input.performedDistanceM,
          loggedAt: now,
          updatedAt: now,
        };

        await db.loggedSets.add(loggedSet);
        result = loggedSet;
      }

      // [P4-D] Weighted bodyweight runtime detection runs for BOTH create and update:
      // If the user logs a non-null weight for a bodyweight exercise, promote the
      // sessionExercise's effectiveType from "bodyweight" to "weight" so the
      // progression engine and UI treat it as a weighted movement for this session.
      if (
        input.performedWeightKg !== null &&
        sessionExercise.effectiveType === "bodyweight"
      ) {
        await db.sessionExercises.update(sessionExerciseId, {
          effectiveType: "weight",
        });
      }

      return result;
    }
  );
}

// ---------------------------------------------------------------------------
// Edit set
// ---------------------------------------------------------------------------

/**
 * Edit an existing logged set.
 *
 * Updates the performed values and sets updatedAt.
 * Can be called on sets from both active and finished sessions
 * (spec: "The user may edit or delete logged sets from the active workout
 * screen or finished session detail in History").
 *
 * [P4-E] Also promotes effectiveType from "bodyweight" to "weight" if
 * a non-null weight is provided.
 */
export async function editSet(
  db: ExerciseLoggerDB,
  loggedSetId: string,
  input: SetLogInput
): Promise<LoggedSet> {
  validateSetInput(input);

  const existing = await db.loggedSets.get(loggedSetId);
  if (!existing) {
    throw new Error(`LoggedSet "${loggedSetId}" not found`);
  }

  const now = nowISO();
  const updated: Partial<LoggedSet> = {
    performedWeightKg: input.performedWeightKg,
    performedReps: input.performedReps,
    performedDurationSec: input.performedDurationSec,
    performedDistanceM: input.performedDistanceM,
    updatedAt: now,
  };

  await db.loggedSets.update(loggedSetId, updated);

  // [P4-E / R2 / R3] Weighted bodyweight promotion on edit:
  // - Fail loudly if the sessionExercise row is gone (race with discard).
  // - Only promote on active sessions — finished snapshots are write-once.
  if (input.performedWeightKg !== null) {
    const sessionExercise = await db.sessionExercises.get(existing.sessionExerciseId);
    if (!sessionExercise) {
      throw new Error(`SessionExercise "${existing.sessionExerciseId}" not found`);
    }
    const session = await db.sessions.get(sessionExercise.sessionId);
    if (
      session?.status === "active" &&
      sessionExercise.effectiveType === "bodyweight"
    ) {
      await db.sessionExercises.update(existing.sessionExerciseId, {
        effectiveType: "weight",
      });
    }
  }

  return { ...existing, ...updated } as LoggedSet;
}

// ---------------------------------------------------------------------------
// Delete set
// ---------------------------------------------------------------------------

/**
 * Delete a logged set by ID.
 *
 * Removes the loggedSet row for that slot.
 * Does not change the session snapshot structure.
 * Can be called on sets from both active and finished sessions.
 */
export async function deleteSet(
  db: ExerciseLoggerDB,
  loggedSetId: string
): Promise<void> {
  const existing = await db.loggedSets.get(loggedSetId);
  if (!existing) {
    throw new Error(`LoggedSet "${loggedSetId}" not found`);
  }

  await db.loggedSets.delete(loggedSetId);
}
