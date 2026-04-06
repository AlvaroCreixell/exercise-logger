import Dexie, { type EntityTable } from "dexie";
import type {
  Exercise,
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
  Settings,
} from "@/domain/types";

export class ExerciseLoggerDB extends Dexie {
  exercises!: EntityTable<Exercise, "id">;
  routines!: EntityTable<Routine, "id">;
  sessions!: EntityTable<Session, "id">;
  sessionExercises!: EntityTable<SessionExercise, "id">;
  loggedSets!: EntityTable<LoggedSet, "id">;
  settings!: EntityTable<Settings, "id">;

  constructor() {
    super("ExerciseLoggerDB");

    this.version(1).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    });
  }
}

/** Default settings record created on first launch. */
export const DEFAULT_SETTINGS: Settings = {
  id: "user",
  activeRoutineId: null,
  units: "kg",
  theme: "system",
};

/**
 * Ensure a default settings record exists without overwriting user data.
 * Call this on app startup. Uses put() instead of add() so concurrent calls
 * are safe: React StrictMode double-mounts in dev cause two concurrent calls
 * that both see no record and then both try to write — put() is idempotent,
 * whereas add() would throw a ConstraintError on the second write.
 */
export async function initializeSettings(db: ExerciseLoggerDB): Promise<void> {
  const existing = await db.settings.get("user");
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS);
  }
}

/** Singleton database instance for the application. */
export const db = new ExerciseLoggerDB();
