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
 * Ensure a default settings record exists.
 * Call this on app startup. If the "user" record already exists, this is a no-op.
 */
export async function initializeSettings(db: ExerciseLoggerDB): Promise<void> {
  const existing = await db.settings.get("user");
  if (!existing) {
    await db.settings.add(DEFAULT_SETTINGS);
  }
}

/** Singleton database instance for the application. */
export const db = new ExerciseLoggerDB();
