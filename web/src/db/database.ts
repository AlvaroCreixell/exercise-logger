import Dexie, { type EntityTable } from "dexie";
import type {
  Exercise,
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
  Settings,
} from "@/domain/types";
import { nowISO } from "@/domain/timestamp";

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

    // Version 2: Add unitOverride to sessionExercises.
    // No index change — unitOverride is not indexed.
    // Note: this is the Dexie DB version, distinct from the backup
    // envelope schemaVersion which stays at 1.
    this.version(2).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    }).upgrade(tx => {
      // Backfill existing sessionExercises with unitOverride: null
      return tx.table("sessionExercises").toCollection().modify(se => {
        if (se.unitOverride === undefined) {
          se.unitOverride = null;
        }
      });
    });

    // Version 3: Add 6 onboarding-related fields to the settings record.
    // None of the new fields are indexed, so the `.stores(...)` signature is
    // identical to v2. (Dexie requires a stores() call even when nothing
    // changes, because .upgrade() attaches to the version.)
    //
    // D3: existing users are silently marked as *skipped* so they don't see
    // the first-run gate. New v3 installs get all-null defaults via
    // DEFAULT_SETTINGS / initializeSettings().
    //
    // Compound-index + null trap: these six fields are unindexed, so storing
    // null here is safe. If a future schema adds any of them to a compound
    // index, switch to a sentinel (e.g. "") the way instanceLabel does.
    this.version(3).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    }).upgrade(async (trans) => {
      const existing = await trans.table("settings").get("user");
      if (existing) {
        await trans.table("settings").update("user", {
          userName: null,
          onboardingCompletedAt: null,
          onboardingSkippedAt: nowISO(),
          lastGeneratedPrompt: null,
          lastGeneratedPromptAt: null,
          onboardingBannerDismissedAt: null,
        });
      }
    });

    // Version 4: gym-proofing preferences on the settings record. Unindexed
    // booleans, so the `.stores(...)` signature is identical to v3. Existing
    // users get the same defaults as fresh installs: wake lock and haptic cue
    // on, sound off (gyms don't need another beeping phone).
    this.version(4).stores({
      exercises: "id",
      routines: "id",
      sessions: "id, status, [routineId+startedAt]",
      sessionExercises: "id, sessionId, [sessionId+orderIndex]",
      loggedSets:
        "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]",
      settings: "id",
    }).upgrade(async (trans) => {
      const existing = await trans.table("settings").get("user");
      if (existing) {
        await trans.table("settings").update("user", {
          keepScreenOn: true,
          restCueHaptic: true,
          restCueSound: false,
        });
      }
    });
  }
}

/** Default settings record created on first launch. */
export const DEFAULT_SETTINGS: Settings = {
  id: "user",
  activeRoutineId: null,
  units: "kg",
  userName: null,
  onboardingCompletedAt: null,
  onboardingSkippedAt: null,
  lastGeneratedPrompt: null,
  lastGeneratedPromptAt: null,
  onboardingBannerDismissedAt: null,
  keepScreenOn: true,
  restCueHaptic: true,
  restCueSound: false,
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
