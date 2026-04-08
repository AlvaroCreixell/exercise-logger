import Dexie from "dexie";
import type {
  Session,
  SessionExercise,
  LoggedSet,
  Routine,
  RoutineExerciseEntry,
  Exercise,
} from "@/domain/types";
import type {
  ExerciseType,
  ExerciseEquipment,
  GroupType,
  SessionExerciseOrigin,
} from "@/domain/enums";
import type { ExerciseLoggerDB } from "@/db/database";
import { generateId } from "@/domain/uuid";
import { nowISO } from "@/domain/timestamp";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full session data returned by resume. */
export interface SessionData {
  session: Session;
  sessionExercises: SessionExercise[];
  loggedSets: LoggedSet[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective type for a session exercise.
 *
 * Weighted bodyweight rules (spec section 7):
 * - If routine entry has typeOverride, use it
 * - If routine entry has equipmentOverride != "bodyweight", treat as "weight"
 * - Otherwise use the catalog exercise type
 */
function resolveEffectiveType(
  catalogExercise: Exercise,
  entry: RoutineExerciseEntry
): ExerciseType {
  if (entry.typeOverride) {
    return entry.typeOverride;
  }
  if (
    entry.equipmentOverride &&
    entry.equipmentOverride !== "bodyweight" &&
    catalogExercise.type === "bodyweight"
  ) {
    return "weight";
  }
  return catalogExercise.type;
}

/**
 * Resolve the effective equipment for a session exercise.
 */
function resolveEffectiveEquipment(
  catalogExercise: Exercise,
  entry: RoutineExerciseEntry
): ExerciseEquipment {
  return entry.equipmentOverride ?? catalogExercise.equipment;
}

// ---------------------------------------------------------------------------
// Start session
// ---------------------------------------------------------------------------

/**
 * Start a new workout session with full exercise catalog resolution.
 *
 * [P4-A] This is the only start function. The dead `startSession` and its
 * helpers (`buildSessionExercises`, `buildSingleSessionExercise`) have been
 * removed to avoid accidentally using placeholder data.
 *
 * Creates:
 * - One `sessions` row with `status = "active"`
 * - One `sessionExercises` row per routine-entry leaf in display order
 *
 * Enforces invariant 1: at most one active session.
 * Does NOT advance nextDayId (invariant 3: only on finish).
 *
 * @param db - Dexie database instance
 * @param routine - The routine to start a session for
 * @param dayId - The day ID to use (may differ from routine.nextDayId for overrides)
 * @returns The created SessionData
 */
export async function startSessionWithCatalog(
  db: ExerciseLoggerDB,
  routine: Routine,
  dayId: string
): Promise<SessionData> {
  // Validate the dayId exists in the routine
  const day = routine.days[dayId];
  if (!day) {
    throw new Error(
      `Day "${dayId}" does not exist in routine "${routine.name}". Valid days: ${routine.dayOrder.join(", ")}`
    );
  }

  // Collect all exerciseIds referenced by this day
  const exerciseIds = new Set<string>();
  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      exerciseIds.add(entry.exerciseId);
    } else if (entry.kind === "superset") {
      for (const item of entry.items) {
        exerciseIds.add(item.exerciseId);
      }
    }
  }

  // Load all referenced exercises from catalog
  const exerciseMap = new Map<string, Exercise>();
  for (const id of exerciseIds) {
    const exercise = await db.exercises.get(id);
    if (!exercise) {
      throw new Error(
        `Exercise "${id}" referenced in routine "${routine.name}" day "${dayId}" not found in catalog`
      );
    }
    exerciseMap.set(id, exercise);
  }

  // Build session and session exercises
  const sessionId = generateId();
  const now = nowISO();

  const session: Session = {
    id: sessionId,
    routineId: routine.id,
    routineNameSnapshot: routine.name,
    dayId,
    dayLabelSnapshot: day.label,
    dayOrderSnapshot: [...routine.dayOrder],
    restDefaultSecSnapshot: routine.restDefaultSec,
    restSupersetSecSnapshot: routine.restSupersetSec,
    status: "active",
    startedAt: now,
    finishedAt: null,
  };

  const sessionExercises: SessionExercise[] = [];
  let orderIndex = 0;

  for (const entry of day.entries) {
    if (entry.kind === "exercise") {
      const exercise = exerciseMap.get(entry.exerciseId)!;
      sessionExercises.push({
        id: generateId(),
        sessionId,
        routineEntryId: entry.entryId,
        exerciseId: entry.exerciseId,
        exerciseNameSnapshot: exercise.name,
        origin: "routine",
        orderIndex,
        groupType: "single",
        supersetGroupId: null,
        supersetPosition: null,
        instanceLabel: entry.instanceLabel ?? "",
        effectiveType: resolveEffectiveType(exercise, entry),
        effectiveEquipment: resolveEffectiveEquipment(exercise, entry),
        notesSnapshot: entry.notes ?? null,
        setBlocksSnapshot: [...entry.setBlocks],
        createdAt: now,
        unitOverride: null,
      });
      orderIndex++;
    } else if (entry.kind === "superset") {
      const supersetGroupId = generateId();
      for (let pos = 0; pos < entry.items.length; pos++) {
        const item = entry.items[pos]!;
        const exercise = exerciseMap.get(item.exerciseId)!;
        sessionExercises.push({
          id: generateId(),
          sessionId,
          routineEntryId: item.entryId,
          exerciseId: item.exerciseId,
          exerciseNameSnapshot: exercise.name,
          origin: "routine",
          orderIndex,
          groupType: "superset",
          supersetGroupId,
          supersetPosition: pos,
          instanceLabel: item.instanceLabel ?? "",
          effectiveType: resolveEffectiveType(exercise, item),
          effectiveEquipment: resolveEffectiveEquipment(exercise, item),
          notesSnapshot: item.notes ?? null,
          setBlocksSnapshot: [...item.setBlocks],
          createdAt: now,
          unitOverride: null,
        });
        orderIndex++;
      }
    }
  }

  // Write in a transaction enforcing invariant 1
  await db.transaction("rw", db.sessions, db.sessionExercises, async () => {
    const activeCount = await db.sessions
      .where("status")
      .equals("active")
      .count();
    if (activeCount > 0) {
      throw new Error(
        "An active session already exists. Resume or discard it before starting a new one."
      );
    }

    await db.sessions.add(session);
    if (sessionExercises.length > 0) {
      await db.sessionExercises.bulkAdd(sessionExercises);
    }
  });

  return {
    session,
    sessionExercises,
    loggedSets: [],
  };
}

// ---------------------------------------------------------------------------
// Resume session
// ---------------------------------------------------------------------------

/**
 * Find and return the active session with all its session exercises and logged sets.
 *
 * Returns null if no active session exists.
 */
export async function resumeSession(
  db: ExerciseLoggerDB
): Promise<SessionData | null> {
  const activeSessions = await db.sessions
    .where("status")
    .equals("active")
    .toArray();

  if (activeSessions.length === 0) {
    return null;
  }

  const session = activeSessions[0]!;

  const sessionExercises = await db.sessionExercises
    .where("[sessionId+orderIndex]")
    .between([session.id, Dexie.minKey], [session.id, Dexie.maxKey])
    .toArray();

  const loggedSets = await db.loggedSets
    .where("sessionId")
    .equals(session.id)
    .toArray();

  return { session, sessionExercises, loggedSets };
}

// ---------------------------------------------------------------------------
// Discard session
// ---------------------------------------------------------------------------

/**
 * Discard an active session by hard-deleting the session and all related
 * session exercises and logged sets in one transaction.
 *
 * Enforces invariant 4: discarding must NOT advance rotation (nextDayId).
 * This is achieved by simply not touching the routine record at all.
 */
export async function discardSession(
  db: ExerciseLoggerDB,
  sessionId: string
): Promise<void> {
  await db.transaction(
    "rw",
    db.sessions,
    db.sessionExercises,
    db.loggedSets,
    async () => {
      const session = await db.sessions.get(sessionId);
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`);
      }
      if (session.status !== "active") {
        throw new Error(
          `Cannot discard session "${sessionId}": status is "${session.status}", expected "active"`
        );
      }

      // Delete logged sets for this session
      const loggedSetIds = await db.loggedSets
        .where("sessionId")
        .equals(sessionId)
        .primaryKeys();
      if (loggedSetIds.length > 0) {
        await db.loggedSets.bulkDelete(loggedSetIds);
      }

      // Delete session exercises for this session
      const seIds = await db.sessionExercises
        .where("sessionId")
        .equals(sessionId)
        .primaryKeys();
      if (seIds.length > 0) {
        await db.sessionExercises.bulkDelete(seIds);
      }

      // Delete the session itself
      await db.sessions.delete(sessionId);
    }
  );
}

// ---------------------------------------------------------------------------
// Finish session
// ---------------------------------------------------------------------------

/**
 * Finish an active session.
 *
 * Sets status to "finished", sets finishedAt, and advances the source
 * routine's nextDayId using the session's dayOrderSnapshot.
 *
 * Invariant 3: nextDayId is updated only on finish.
 * Spec: "The user may finish a session even if some prescribed sets were not logged."
 *
 * Day override rotation rule (spec section 10):
 * - Session used dayId "A" (override or suggested)
 * - On finish, nextDayId becomes the day AFTER "A" in dayOrderSnapshot
 * - Wraps around: if "A" is the last day, next becomes the first day
 */
export async function finishSession(
  db: ExerciseLoggerDB,
  sessionId: string
): Promise<void> {
  await db.transaction("rw", db.sessions, db.routines, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    if (session.status !== "active") {
      throw new Error(
        `Cannot finish session "${sessionId}": status is "${session.status}", expected "active"`
      );
    }

    const now = nowISO();

    // Update session status
    await db.sessions.update(sessionId, {
      status: "finished" as const,
      finishedAt: now,
    });

    // Advance rotation on the source routine (if it still exists)
    if (session.routineId) {
      const routine = await db.routines.get(session.routineId);
      if (routine) {
        const dayOrder = session.dayOrderSnapshot;
        const currentIndex = dayOrder.indexOf(session.dayId);
        const nextIndex = (currentIndex + 1) % dayOrder.length;
        const nextDayId = dayOrder[nextIndex]!;

        await db.routines.update(session.routineId, { nextDayId });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Add extra exercise
// ---------------------------------------------------------------------------

/**
 * Add an extra exercise to an active session.
 *
 * Creates a sessionExercise with origin="extra", no setBlocksSnapshot,
 * appended at the end of orderIndex.
 *
 * Enforces invariant 6: extras only during active session.
 */
export async function addExtraExercise(
  db: ExerciseLoggerDB,
  sessionId: string,
  exerciseId: string
): Promise<SessionExercise> {
  // Look up the exercise from catalog
  const exercise = await db.exercises.get(exerciseId);
  if (!exercise) {
    throw new Error(`Exercise "${exerciseId}" not found in catalog`);
  }

  let sessionExercise: SessionExercise | null = null;

  await db.transaction("rw", db.sessions, db.sessionExercises, async () => {
    const session = await db.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    if (session.status !== "active") {
      throw new Error(
        `Cannot add extra exercise: session "${sessionId}" is "${session.status}", expected "active" (invariant 6)`
      );
    }

    // Find the current max orderIndex for this session
    const existing = await db.sessionExercises
      .where("sessionId")
      .equals(sessionId)
      .toArray();
    const maxOrder = existing.reduce(
      (max, se) => Math.max(max, se.orderIndex),
      -1
    );

    const now = nowISO();

    sessionExercise = {
      id: generateId(),
      sessionId,
      routineEntryId: null,
      exerciseId: exercise.id,
      exerciseNameSnapshot: exercise.name,
      origin: "extra" as SessionExerciseOrigin,
      orderIndex: maxOrder + 1,
      groupType: "single" as GroupType,
      supersetGroupId: null,
      supersetPosition: null,
      instanceLabel: "",
      effectiveType: exercise.type,
      effectiveEquipment: exercise.equipment,
      notesSnapshot: null,
      setBlocksSnapshot: [],
      createdAt: now,
      unitOverride: null,
    };

    await db.sessionExercises.add(sessionExercise);
  });

  return sessionExercise!;
}
