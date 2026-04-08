import type { Settings } from "@/domain/types";
import type { ExerciseLoggerDB } from "@/db/database";
import type { UnitSystem, ThemePreference } from "@/domain/enums";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get the current settings record.
 * Throws if no settings record exists (should never happen after app init).
 */
export async function getSettings(db: ExerciseLoggerDB): Promise<Settings> {
  const settings = await db.settings.get("user");
  if (!settings) {
    throw new Error("Settings record not found. Was initializeSettings() called?");
  }
  return settings;
}

// ---------------------------------------------------------------------------
// Active routine management
// ---------------------------------------------------------------------------

/**
 * Check if there is an active session in the database.
 */
export async function hasActiveSession(db: ExerciseLoggerDB): Promise<boolean> {
  const count = await db.sessions.where("status").equals("active").count();
  return count > 0;
}

/**
 * Set the active routine ID.
 *
 * Enforces invariant 13: routine activation is blocked while an active session exists.
 * Throws if an active session exists.
 *
 * [P4-B] Active-session check is INSIDE the transaction to prevent TOCTOU race.
 */
export async function setActiveRoutine(
  db: ExerciseLoggerDB,
  routineId: string
): Promise<void> {
  const routine = await db.routines.get(routineId);
  if (!routine) {
    throw new Error(`Routine "${routineId}" not found`);
  }

  await db.transaction("rw", [db.settings, db.routines, db.sessions], async () => {
    const active = await db.sessions.where("status").equals("active").first();
    if (active) {
      throw new Error(
        "Cannot change active routine while a workout session is active. Finish or discard the session first."
      );
    }

    await db.settings.update("user", { activeRoutineId: routineId });
  });
}

/**
 * Delete a routine by ID.
 *
 * Enforces invariant 13: routine deletion is blocked while an active session exists.
 *
 * Deletion rules from spec section 13:
 * - If deleting the active routine and other routines remain, automatically
 *   activate the earliest remaining routine by importedAt ASC. [P4-H]
 * - If deleting the last remaining routine, set activeRoutineId = null.
 * - Routine deletion must not break history (sessions use snapshots).
 *
 * [P4-B] Active-session check is INSIDE the transaction to prevent TOCTOU race.
 * [P4-C] getSettings read is INSIDE the transaction to avoid stale-data risk.
 */
export async function deleteRoutine(
  db: ExerciseLoggerDB,
  routineId: string
): Promise<void> {
  await db.transaction("rw", [db.routines, db.settings, db.sessions], async () => {
    // [P4-B] Check inside transaction
    const active = await db.sessions.where("status").equals("active").first();
    if (active) {
      throw new Error(
        "Cannot delete a routine while a workout session is active. Finish or discard the session first."
      );
    }

    // [P4-C] Read settings inside transaction
    const settings = await db.settings.get("user");
    if (!settings) {
      throw new Error("Settings record not found.");
    }

    await db.routines.delete(routineId);

    if (settings.activeRoutineId === routineId) {
      // [P4-H] Auto-activate earliest remaining routine by importedAt ASC
      const remaining = await db.routines.toArray();
      if (remaining.length > 0) {
        remaining.sort((a, b) => a.importedAt.localeCompare(b.importedAt));
        await db.settings.update("user", {
          activeRoutineId: remaining[0]!.id,
        });
      } else {
        await db.settings.update("user", { activeRoutineId: null });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

/**
 * Update the display unit preference.
 */
export async function setUnits(
  db: ExerciseLoggerDB,
  units: UnitSystem
): Promise<void> {
  await db.settings.update("user", { units });
}

/**
 * Update the theme preference.
 */
export async function setTheme(
  db: ExerciseLoggerDB,
  theme: ThemePreference
): Promise<void> {
  await db.settings.update("user", { theme });
}

/**
 * Set the unit override for a specific session exercise.
 */
export async function setUnitOverride(
  db: ExerciseLoggerDB,
  sessionExerciseId: string,
  unitOverride: UnitSystem | null
): Promise<void> {
  await db.sessionExercises.update(sessionExerciseId, { unitOverride });
}
