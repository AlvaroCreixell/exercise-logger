import type {
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
  Settings,
} from "@/domain/types";
import type {
  ExerciseType,
  ExerciseEquipment,
  SessionStatus,
  SessionExerciseOrigin,
  GroupType,
  TargetKind,
  SetTag,
  UnitSystem,
  ThemePreference,
} from "@/domain/enums";
import { DEFAULT_SETTINGS, type ExerciseLoggerDB } from "@/db/database";
import { nowISO } from "@/domain/timestamp";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_IDENTIFIER = "exercise-logger";
const SUPPORTED_SCHEMA_VERSIONS = [1];

// ---------------------------------------------------------------------------
// Backup envelope type
// ---------------------------------------------------------------------------

export interface BackupEnvelope {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  data: BackupData;
}

export interface BackupData {
  routines: Routine[];
  sessions: Session[];
  sessionExercises: SessionExercise[];
  loggedSets: LoggedSet[];
  settings: Settings;
}

// ---------------------------------------------------------------------------
// Validation error type
// ---------------------------------------------------------------------------

export interface BackupValidationError {
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export all user data as a versioned JSON backup.
 *
 * Spec rules:
 * - Exercises (catalog) are NOT exported (re-seeded from CSV on app init).
 * - Export is allowed even with an active session.
 * - Filename: exercise-logger-backup-YYYY-MM-DD.json
 *
 * @returns The backup envelope object.
 */
export async function exportBackup(
  db: ExerciseLoggerDB
): Promise<BackupEnvelope> {
  const [routines, sessions, sessionExercises, loggedSets, settings] =
    await Promise.all([
      db.routines.toArray(),
      db.sessions.toArray(),
      db.sessionExercises.toArray(),
      db.loggedSets.toArray(),
      db.settings.get("user"),
    ]);

  if (!settings) {
    throw new Error(
      "Settings record not found. Was initializeSettings() called?"
    );
  }

  return {
    app: APP_IDENTIFIER,
    schemaVersion: 1,
    exportedAt: nowISO(),
    data: {
      routines,
      sessions,
      sessionExercises,
      loggedSets,
      settings,
    },
  };
}

/**
 * Trigger a browser download of the backup JSON file.
 *
 * @param envelope - The backup envelope from exportBackup().
 */
export function downloadBackupFile(envelope: BackupEnvelope): void {
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const filename = `exercise-logger-backup-${yyyy}-${mm}-${dd}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import validation helpers
// ---------------------------------------------------------------------------

const VALID_EXERCISE_TYPES: ExerciseType[] = [
  "weight",
  "bodyweight",
  "isometric",
  "cardio",
];

const VALID_EQUIPMENT: ExerciseEquipment[] = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "kettlebell",
  "bodyweight",
  "cardio",
  "medicine-ball",
  "other",
];

const VALID_SESSION_STATUSES: SessionStatus[] = [
  "active",
  "finished",
  "discarded",
];

const VALID_ORIGINS: SessionExerciseOrigin[] = ["routine", "extra"];

const VALID_GROUP_TYPES: GroupType[] = ["single", "superset"];

const VALID_TARGET_KINDS: TargetKind[] = ["reps", "duration", "distance"];

const VALID_TAGS: SetTag[] = ["top", "amrap"];

const VALID_UNITS: UnitSystem[] = ["kg", "lbs"];

const VALID_THEMES: ThemePreference[] = ["light", "dark", "system"];

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

function isStringOrNull(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

function isNumberOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && !Number.isNaN(v));
}

function isArrayOf<T>(v: unknown, guard: (item: unknown) => item is T): v is T[] {
  return Array.isArray(v) && v.every(guard);
}

// ---------------------------------------------------------------------------
// Structural validators for each record type
// ---------------------------------------------------------------------------

function validateSetBlock(
  block: unknown,
  path: string,
  errors: BackupValidationError[]
): void {
  if (typeof block !== "object" || block === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const b = block as Record<string, unknown>;

  if (!VALID_TARGET_KINDS.includes(b.targetKind as TargetKind)) {
    errors.push({
      field: `${path}.targetKind`,
      message: `must be one of: ${VALID_TARGET_KINDS.join(", ")}`,
    });
  }

  if (b.minValue !== undefined && !isNumber(b.minValue)) {
    errors.push({ field: `${path}.minValue`, message: "must be a number" });
  }
  if (b.maxValue !== undefined && !isNumber(b.maxValue)) {
    errors.push({ field: `${path}.maxValue`, message: "must be a number" });
  }
  if (b.exactValue !== undefined && !isNumber(b.exactValue)) {
    errors.push({ field: `${path}.exactValue`, message: "must be a number" });
  }
  if (!isNumber(b.count) || b.count < 1) {
    errors.push({ field: `${path}.count`, message: "must be an integer >= 1" });
  }
  if (b.tag !== undefined && !VALID_TAGS.includes(b.tag as SetTag)) {
    errors.push({
      field: `${path}.tag`,
      message: `must be one of: ${VALID_TAGS.join(", ")}`,
    });
  }
}

/**
 * ERRATA P7-B: Validate a RoutineExerciseEntry inside a day.
 */
function validateRoutineExerciseEntry(
  entry: unknown,
  path: string,
  catalogIds: Set<string>,
  errors: BackupValidationError[]
): void {
  if (typeof entry !== "object" || entry === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const e = entry as Record<string, unknown>;

  if (!isString(e.entryId)) {
    errors.push({ field: `${path}.entryId`, message: "must be a string" });
  }
  if (!isString(e.exerciseId)) {
    errors.push({ field: `${path}.exerciseId`, message: "must be a string" });
  } else if (!catalogIds.has(e.exerciseId as string)) {
    // ERRATA P7-A: check exerciseId against catalog
    errors.push({
      field: `${path}.exerciseId`,
      message: `exercise "${e.exerciseId}" not found in current catalog`,
    });
  }
  if (!Array.isArray(e.setBlocks)) {
    errors.push({ field: `${path}.setBlocks`, message: "must be an array" });
  } else {
    (e.setBlocks as unknown[]).forEach((block, bi) => {
      validateSetBlock(block, `${path}.setBlocks[${bi}]`, errors);
    });
  }
}

/**
 * ERRATA P7-B: Validate a RoutineEntry (either exercise or superset).
 */
function validateRoutineEntry(
  entry: unknown,
  path: string,
  catalogIds: Set<string>,
  errors: BackupValidationError[]
): void {
  if (typeof entry !== "object" || entry === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const e = entry as Record<string, unknown>;

  if (e.kind !== "exercise" && e.kind !== "superset") {
    errors.push({
      field: `${path}.kind`,
      message: 'must be "exercise" or "superset"',
    });
    return;
  }

  if (e.kind === "exercise") {
    validateRoutineExerciseEntry(entry, path, catalogIds, errors);
  } else {
    // superset
    if (!isString(e.groupId)) {
      errors.push({ field: `${path}.groupId`, message: "must be a string" });
    }
    if (!Array.isArray(e.items) || (e.items as unknown[]).length !== 2) {
      errors.push({
        field: `${path}.items`,
        message: "must be an array of exactly 2 exercise entries",
      });
    } else {
      (e.items as unknown[]).forEach((item, ii) => {
        validateRoutineExerciseEntry(
          item,
          `${path}.items[${ii}]`,
          catalogIds,
          errors
        );
      });
    }
  }
}

function validateRoutine(
  routine: unknown,
  index: number,
  catalogIds: Set<string>,
  errors: BackupValidationError[]
): void {
  const path = `data.routines[${index}]`;
  if (typeof routine !== "object" || routine === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const r = routine as Record<string, unknown>;

  if (!isString(r.id)) {
    errors.push({ field: `${path}.id`, message: "must be a string" });
  }
  if (!isNumber(r.schemaVersion)) {
    errors.push({
      field: `${path}.schemaVersion`,
      message: "must be a number",
    });
  }
  if (!isString(r.name)) {
    errors.push({ field: `${path}.name`, message: "must be a string" });
  }
  if (!isNumber(r.restDefaultSec)) {
    errors.push({
      field: `${path}.restDefaultSec`,
      message: "must be a number",
    });
  }
  if (!isNumber(r.restSupersetSec)) {
    errors.push({
      field: `${path}.restSupersetSec`,
      message: "must be a number",
    });
  }
  if (!isArrayOf(r.dayOrder, isString)) {
    errors.push({
      field: `${path}.dayOrder`,
      message: "must be an array of strings",
    });
  }
  if (!isString(r.nextDayId)) {
    errors.push({ field: `${path}.nextDayId`, message: "must be a string" });
  }
  if (typeof r.days !== "object" || r.days === null) {
    errors.push({ field: `${path}.days`, message: "must be an object" });
  } else {
    // ERRATA P7-B: Deep-validate each RoutineDay and its entries
    const days = r.days as Record<string, unknown>;
    for (const [dayId, day] of Object.entries(days)) {
      const dayPath = `${path}.days.${dayId}`;
      if (typeof day !== "object" || day === null) {
        errors.push({ field: dayPath, message: "must be an object" });
        continue;
      }
      const d = day as Record<string, unknown>;
      if (!isString(d.id)) {
        errors.push({ field: `${dayPath}.id`, message: "must be a string" });
      }
      if (!isString(d.label)) {
        errors.push({ field: `${dayPath}.label`, message: "must be a string" });
      }
      if (!Array.isArray(d.entries)) {
        errors.push({
          field: `${dayPath}.entries`,
          message: "must be an array",
        });
      } else {
        (d.entries as unknown[]).forEach((entry, ei) => {
          validateRoutineEntry(
            entry,
            `${dayPath}.entries[${ei}]`,
            catalogIds,
            errors
          );
        });
      }
    }
  }
  if (!Array.isArray(r.notes)) {
    errors.push({ field: `${path}.notes`, message: "must be an array" });
  }
  if (!isString(r.importedAt)) {
    errors.push({
      field: `${path}.importedAt`,
      message: "must be a string",
    });
  }
}

function validateSession(
  session: unknown,
  index: number,
  _catalogIds: Set<string>,
  errors: BackupValidationError[]
): void {
  const path = `data.sessions[${index}]`;
  if (typeof session !== "object" || session === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const s = session as Record<string, unknown>;

  if (!isString(s.id)) {
    errors.push({ field: `${path}.id`, message: "must be a string" });
  }
  if (!isStringOrNull(s.routineId)) {
    errors.push({
      field: `${path}.routineId`,
      message: "must be a string or null",
    });
  }
  if (!isString(s.routineNameSnapshot)) {
    errors.push({
      field: `${path}.routineNameSnapshot`,
      message: "must be a string",
    });
  }
  if (!isString(s.dayId)) {
    errors.push({ field: `${path}.dayId`, message: "must be a string" });
  }
  if (!isString(s.dayLabelSnapshot)) {
    errors.push({
      field: `${path}.dayLabelSnapshot`,
      message: "must be a string",
    });
  }
  if (!isArrayOf(s.dayOrderSnapshot, isString)) {
    errors.push({
      field: `${path}.dayOrderSnapshot`,
      message: "must be an array of strings",
    });
  }
  if (!isNumber(s.restDefaultSecSnapshot)) {
    errors.push({
      field: `${path}.restDefaultSecSnapshot`,
      message: "must be a number",
    });
  }
  if (!isNumber(s.restSupersetSecSnapshot)) {
    errors.push({
      field: `${path}.restSupersetSecSnapshot`,
      message: "must be a number",
    });
  }
  if (!VALID_SESSION_STATUSES.includes(s.status as SessionStatus)) {
    errors.push({
      field: `${path}.status`,
      message: `must be one of: ${VALID_SESSION_STATUSES.join(", ")}`,
    });
  }
  if (!isString(s.startedAt)) {
    errors.push({
      field: `${path}.startedAt`,
      message: "must be a string",
    });
  }
  if (!isStringOrNull(s.finishedAt)) {
    errors.push({
      field: `${path}.finishedAt`,
      message: "must be a string or null",
    });
  }
}

function validateSessionExercise(
  se: unknown,
  index: number,
  catalogIds: Set<string>,
  errors: BackupValidationError[]
): void {
  const path = `data.sessionExercises[${index}]`;
  if (typeof se !== "object" || se === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const s = se as Record<string, unknown>;

  if (!isString(s.id)) {
    errors.push({ field: `${path}.id`, message: "must be a string" });
  }
  if (!isString(s.sessionId)) {
    errors.push({ field: `${path}.sessionId`, message: "must be a string" });
  }
  if (!isStringOrNull(s.routineEntryId)) {
    errors.push({
      field: `${path}.routineEntryId`,
      message: "must be a string or null",
    });
  }
  if (!isString(s.exerciseId)) {
    errors.push({ field: `${path}.exerciseId`, message: "must be a string" });
  } else if (!catalogIds.has(s.exerciseId as string)) {
    errors.push({
      field: `${path}.exerciseId`,
      message: `exercise "${s.exerciseId}" not found in current catalog`,
    });
  }
  if (!isString(s.exerciseNameSnapshot)) {
    errors.push({
      field: `${path}.exerciseNameSnapshot`,
      message: "must be a string",
    });
  }
  if (!VALID_ORIGINS.includes(s.origin as SessionExerciseOrigin)) {
    errors.push({
      field: `${path}.origin`,
      message: `must be one of: ${VALID_ORIGINS.join(", ")}`,
    });
  }
  if (!isNumber(s.orderIndex)) {
    errors.push({
      field: `${path}.orderIndex`,
      message: "must be a number",
    });
  }
  if (!VALID_GROUP_TYPES.includes(s.groupType as GroupType)) {
    errors.push({
      field: `${path}.groupType`,
      message: `must be one of: ${VALID_GROUP_TYPES.join(", ")}`,
    });
  }
  if (!isStringOrNull(s.supersetGroupId)) {
    errors.push({
      field: `${path}.supersetGroupId`,
      message: "must be a string or null",
    });
  }
  if (!isNumberOrNull(s.supersetPosition)) {
    errors.push({
      field: `${path}.supersetPosition`,
      message: "must be a number or null",
    });
  }
  if (!isString(s.instanceLabel)) {
    errors.push({
      field: `${path}.instanceLabel`,
      message: "must be a string",
    });
  }
  if (!VALID_EXERCISE_TYPES.includes(s.effectiveType as ExerciseType)) {
    errors.push({
      field: `${path}.effectiveType`,
      message: `must be one of: ${VALID_EXERCISE_TYPES.join(", ")}`,
    });
  }
  if (!VALID_EQUIPMENT.includes(s.effectiveEquipment as ExerciseEquipment)) {
    errors.push({
      field: `${path}.effectiveEquipment`,
      message: `must be one of: ${VALID_EQUIPMENT.join(", ")}`,
    });
  }
  if (!isStringOrNull(s.notesSnapshot)) {
    errors.push({
      field: `${path}.notesSnapshot`,
      message: "must be a string or null",
    });
  }
  if (!Array.isArray(s.setBlocksSnapshot)) {
    errors.push({
      field: `${path}.setBlocksSnapshot`,
      message: "must be an array",
    });
  } else {
    (s.setBlocksSnapshot as unknown[]).forEach((block, bi) => {
      validateSetBlock(block, `${path}.setBlocksSnapshot[${bi}]`, errors);
    });
  }
  if (!isString(s.createdAt)) {
    errors.push({
      field: `${path}.createdAt`,
      message: "must be a string",
    });
  }
  // unitOverride: optional, must be "kg", "lbs", or null/undefined
  if (
    s.unitOverride !== undefined &&
    s.unitOverride !== null &&
    !VALID_UNITS.includes(s.unitOverride as UnitSystem)
  ) {
    errors.push({
      field: `${path}.unitOverride`,
      message: `must be one of: ${VALID_UNITS.join(", ")}, or null`,
    });
  }
}

function validateLoggedSet(
  ls: unknown,
  index: number,
  catalogIds: Set<string>,
  errors: BackupValidationError[]
): void {
  const path = `data.loggedSets[${index}]`;
  if (typeof ls !== "object" || ls === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const s = ls as Record<string, unknown>;

  if (!isString(s.id)) {
    errors.push({ field: `${path}.id`, message: "must be a string" });
  }
  if (!isString(s.sessionId)) {
    errors.push({ field: `${path}.sessionId`, message: "must be a string" });
  }
  if (!isString(s.sessionExerciseId)) {
    errors.push({
      field: `${path}.sessionExerciseId`,
      message: "must be a string",
    });
  }
  if (!isString(s.exerciseId)) {
    errors.push({ field: `${path}.exerciseId`, message: "must be a string" });
  } else if (!catalogIds.has(s.exerciseId as string)) {
    errors.push({
      field: `${path}.exerciseId`,
      message: `exercise "${s.exerciseId}" not found in current catalog`,
    });
  }
  if (!isString(s.instanceLabel)) {
    errors.push({
      field: `${path}.instanceLabel`,
      message: "must be a string",
    });
  }
  if (!VALID_ORIGINS.includes(s.origin as SessionExerciseOrigin)) {
    errors.push({
      field: `${path}.origin`,
      message: `must be one of: ${VALID_ORIGINS.join(", ")}`,
    });
  }
  if (!isNumber(s.blockIndex)) {
    errors.push({
      field: `${path}.blockIndex`,
      message: "must be a number",
    });
  }
  if (!isString(s.blockSignature)) {
    errors.push({
      field: `${path}.blockSignature`,
      message: "must be a string",
    });
  }
  if (!isNumber(s.setIndex)) {
    errors.push({
      field: `${path}.setIndex`,
      message: "must be a number",
    });
  }
  if (s.tag !== null && s.tag !== undefined && !VALID_TAGS.includes(s.tag as SetTag)) {
    errors.push({
      field: `${path}.tag`,
      message: `must be one of: ${VALID_TAGS.join(", ")}, or null`,
    });
  }
  if (!isNumberOrNull(s.performedWeightKg)) {
    errors.push({
      field: `${path}.performedWeightKg`,
      message: "must be a number or null",
    });
  }
  if (!isNumberOrNull(s.performedReps)) {
    errors.push({
      field: `${path}.performedReps`,
      message: "must be a number or null",
    });
  }
  if (!isNumberOrNull(s.performedDurationSec)) {
    errors.push({
      field: `${path}.performedDurationSec`,
      message: "must be a number or null",
    });
  }
  if (!isNumberOrNull(s.performedDistanceM)) {
    errors.push({
      field: `${path}.performedDistanceM`,
      message: "must be a number or null",
    });
  }
  if (!isString(s.loggedAt)) {
    errors.push({ field: `${path}.loggedAt`, message: "must be a string" });
  }
  if (!isString(s.updatedAt)) {
    errors.push({
      field: `${path}.updatedAt`,
      message: "must be a string",
    });
  }
}

function validateSettings(
  settings: unknown,
  errors: BackupValidationError[]
): void {
  const path = "data.settings";
  if (typeof settings !== "object" || settings === null) {
    errors.push({ field: path, message: "must be an object" });
    return;
  }
  const s = settings as Record<string, unknown>;

  if (s.id !== "user") {
    errors.push({
      field: `${path}.id`,
      message: 'must be "user"',
    });
  }
  if (!isStringOrNull(s.activeRoutineId)) {
    errors.push({
      field: `${path}.activeRoutineId`,
      message: "must be a string or null",
    });
  }
  if (!VALID_UNITS.includes(s.units as UnitSystem)) {
    errors.push({
      field: `${path}.units`,
      message: `must be one of: ${VALID_UNITS.join(", ")}`,
    });
  }
  if (!VALID_THEMES.includes(s.theme as ThemePreference)) {
    errors.push({
      field: `${path}.theme`,
      message: `must be one of: ${VALID_THEMES.join(", ")}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Validate an import payload without mutating the database.
 *
 * Checks performed (from spec section 14):
 * 1. `app` must be "exercise-logger"
 * 2. `schemaVersion` must be supported
 * 3. Required top-level data collections must be present
 * 4. Every referenced exerciseId must exist in the current catalog
 * 5. At most one imported session may be "active"
 * 6. Every row must pass structural validation
 * 7. (ERRATA P7-C) Cross-record FK integrity checks
 *
 * @param json - The parsed JSON object to validate.
 * @param catalogIds - Set of exercise IDs from the current seeded catalog.
 * @returns Array of validation errors. Empty array means the payload is valid.
 */
export function validateBackupPayload(
  json: unknown,
  catalogIds: Set<string>
): BackupValidationError[] {
  const errors: BackupValidationError[] = [];

  // Top-level must be an object
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    errors.push({ field: "root", message: "Backup must be a JSON object" });
    return errors;
  }

  const envelope = json as Record<string, unknown>;

  // Check 1: app identifier
  if (envelope.app !== APP_IDENTIFIER) {
    errors.push({
      field: "app",
      message: `must be "${APP_IDENTIFIER}", got "${String(envelope.app)}"`,
    });
  }

  // Check 2: schema version
  if (
    !isNumber(envelope.schemaVersion) ||
    !SUPPORTED_SCHEMA_VERSIONS.includes(envelope.schemaVersion)
  ) {
    errors.push({
      field: "schemaVersion",
      message: `unsupported schema version: ${String(envelope.schemaVersion)}. Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(", ")}`,
    });
  }

  // Check 3: required data collections
  if (typeof envelope.data !== "object" || envelope.data === null) {
    errors.push({ field: "data", message: "must be an object" });
    return errors;
  }

  const data = envelope.data as Record<string, unknown>;
  const requiredCollections = [
    "routines",
    "sessions",
    "sessionExercises",
    "loggedSets",
    "settings",
  ] as const;

  for (const collection of requiredCollections) {
    if (
      collection === "settings"
        ? typeof data[collection] !== "object" || data[collection] === null
        : !Array.isArray(data[collection])
    ) {
      errors.push({
        field: `data.${collection}`,
        message: collection === "settings"
          ? "must be an object"
          : "must be an array",
      });
    }
  }

  // If structural requirements fail, skip row-level validation
  if (errors.length > 0) {
    return errors;
  }

  // Check 6: structural validation of each record type
  const routines = data.routines as unknown[];
  const sessions = data.sessions as unknown[];
  const sessionExercises = data.sessionExercises as unknown[];
  const loggedSets = data.loggedSets as unknown[];

  // ERRATA P7-A/P7-B: pass catalogIds to validateRoutine for deep exerciseId checks
  routines.forEach((r, i) => validateRoutine(r, i, catalogIds, errors));
  sessions.forEach((s, i) => validateSession(s, i, catalogIds, errors));
  sessionExercises.forEach((se, i) =>
    validateSessionExercise(se, i, catalogIds, errors)
  );
  loggedSets.forEach((ls, i) =>
    validateLoggedSet(ls, i, catalogIds, errors)
  );
  validateSettings(data.settings, errors);

  // Check 5: at most one active session
  const activeSessions = sessions.filter(
    (s) =>
      typeof s === "object" &&
      s !== null &&
      (s as Record<string, unknown>).status === "active"
  );
  if (activeSessions.length > 1) {
    errors.push({
      field: "data.sessions",
      message: `at most one session may be "active", found ${activeSessions.length}`,
    });
  }

  // -------------------------------------------------------------------------
  // ERRATA P7-C: Cross-record FK integrity checks
  // -------------------------------------------------------------------------

  // Build ID sets from the imported data
  const routineIds = new Set<string>();
  for (const r of routines) {
    if (typeof r === "object" && r !== null && isString((r as Record<string, unknown>).id)) {
      routineIds.add((r as Record<string, unknown>).id as string);
    }
  }

  const sessionIds = new Set<string>();
  for (const s of sessions) {
    if (typeof s === "object" && s !== null && isString((s as Record<string, unknown>).id)) {
      sessionIds.add((s as Record<string, unknown>).id as string);
    }
  }

  const sessionExerciseIds = new Set<string>();
  for (const se of sessionExercises) {
    if (typeof se === "object" && se !== null && isString((se as Record<string, unknown>).id)) {
      sessionExerciseIds.add((se as Record<string, unknown>).id as string);
    }
  }

  // settings.activeRoutineId -> must match an imported routine (or be null)
  const settingsObj = data.settings as Record<string, unknown>;
  if (
    isString(settingsObj.activeRoutineId) &&
    settingsObj.activeRoutineId !== null &&
    !routineIds.has(settingsObj.activeRoutineId as string)
  ) {
    errors.push({
      field: "data.settings.activeRoutineId",
      message: `references routine "${settingsObj.activeRoutineId}" which is not in the imported routines`,
    });
  }

  // sessionExercises.sessionId -> must match an imported session
  sessionExercises.forEach((se, i) => {
    if (typeof se === "object" && se !== null) {
      const seObj = se as Record<string, unknown>;
      if (isString(seObj.sessionId) && !sessionIds.has(seObj.sessionId as string)) {
        errors.push({
          field: `data.sessionExercises[${i}].sessionId`,
          message: `references session "${seObj.sessionId}" which is not in the imported sessions`,
        });
      }
    }
  });

  // loggedSets.sessionExerciseId -> must match an imported sessionExercise
  loggedSets.forEach((ls, i) => {
    if (typeof ls === "object" && ls !== null) {
      const lsObj = ls as Record<string, unknown>;
      if (
        isString(lsObj.sessionExerciseId) &&
        !sessionExerciseIds.has(lsObj.sessionExerciseId as string)
      ) {
        errors.push({
          field: `data.loggedSets[${i}].sessionExerciseId`,
          message: `references sessionExercise "${lsObj.sessionExerciseId}" which is not in the imported sessionExercises`,
        });
      }
    }
  });

  return errors;
}

/**
 * Import a validated backup payload into the database.
 *
 * Spec rules:
 * - Import is full overwrite only.
 * - Import is blocked while a local active session exists.
 * - Transactional: all-or-nothing Dexie transaction (invariant 12).
 * - If imported data contains one active session, the app resumes it after import.
 *
 * The caller must validate the payload with `validateBackupPayload` first.
 * This function performs the transactional overwrite.
 *
 * @param db - Dexie database instance.
 * @param envelope - The validated backup envelope.
 * @returns Whether the imported data contains an active session.
 * @throws Error if a local active session exists.
 */
export async function importBackup(
  db: ExerciseLoggerDB,
  envelope: BackupEnvelope
): Promise<{ hasActiveSession: boolean }> {
  const { routines, sessions, sessionExercises, loggedSets, settings } =
    envelope.data;

  // All-or-nothing transactional overwrite (invariant 12)
  // Active-session guard is INSIDE the transaction to prevent TOCTOU races
  await db.transaction(
    "rw",
    [db.routines, db.sessions, db.sessionExercises, db.loggedSets, db.settings],
    async () => {
      const localActiveCount = await db.sessions
        .where("status")
        .equals("active")
        .count();
      if (localActiveCount > 0) {
        throw new Error(
          "Cannot import while a workout session is active. Finish or discard the session first."
        );
      }

      await db.routines.clear();
      await db.sessions.clear();
      await db.sessionExercises.clear();
      await db.loggedSets.clear();

      if (routines.length > 0) await db.routines.bulkAdd(routines);
      if (sessions.length > 0) await db.sessions.bulkAdd(sessions);
      if (sessionExercises.length > 0) await db.sessionExercises.bulkAdd(sessionExercises);
      if (loggedSets.length > 0) await db.loggedSets.bulkAdd(loggedSets);
      await db.settings.put(settings);
    }
  );

  const importedActiveSession = sessions.some((s) => s.status === "active");
  return { hasActiveSession: importedActiveSession };
}

// ---------------------------------------------------------------------------
// Clear all data
// ---------------------------------------------------------------------------

/**
 * Delete all user data and recreate default settings.
 *
 * Spec rules:
 * - Deletes routines, sessions, sessionExercises, loggedSets, settings.
 * - Does NOT delete the exercise catalog (re-seeded from CSV on app init).
 * - Recreates default settings (activeRoutineId=null, units="kg", theme="system").
 * - Blocked while an active session exists.
 *
 * @param db - Dexie database instance.
 * @throws Error if an active session exists.
 */
export async function clearAllData(db: ExerciseLoggerDB): Promise<void> {
  await db.transaction(
    "rw",
    [db.routines, db.sessions, db.sessionExercises, db.loggedSets, db.settings],
    async () => {
      const activeCount = await db.sessions
        .where("status")
        .equals("active")
        .count();
      if (activeCount > 0) {
        throw new Error(
          "Cannot clear data while a workout session is active. Finish or discard the session first."
        );
      }

      await db.routines.clear();
      await db.sessions.clear();
      await db.sessionExercises.clear();
      await db.loggedSets.clear();
      await db.settings.put({ ...DEFAULT_SETTINGS });
    }
  );
}

// ---------------------------------------------------------------------------
// File reading helper
// ---------------------------------------------------------------------------

/**
 * Read a File object as parsed JSON.
 *
 * @param file - A File from a file input element.
 * @returns The parsed JSON value.
 * @throws Error if the file cannot be read or parsed.
 */
export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Invalid JSON backup file. The file could not be parsed as JSON."
    );
  }
}
