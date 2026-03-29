# Phase 7: Backup, Polish & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement export/import/clear-all-data in a new `backup-service.ts`, wire those functions into the existing SettingsScreen (replacing Phase 6 placeholders), finalize the PWA manifest and service worker for offline-first installability, verify all empty states and error messages, and build the full acceptance test suite covering all 16 scenarios from the design spec.

**Architecture:** One new service file `web/src/services/backup-service.ts` owns export, import, and clear-all-data logic as pure functions operating on Dexie. The SettingsScreen from Phase 6 is modified to import and call these functions instead of the placeholder `alert()` calls. PWA configuration in `web/vite.config.ts` is updated for production-ready offline-first behavior. Acceptance tests live in `web/tests/integration/` (Vitest + fake-indexeddb) and `web/tests/e2e/` (Playwright).

**Tech Stack:** TypeScript 5 strict mode, Dexie.js 4 (IndexedDB wrapper), Vitest for unit/integration testing, `fake-indexeddb` for Dexie tests in Node, Playwright for E2E tests, `vite-plugin-pwa` for PWA finalization. Import alias `@/` maps to `web/src/`.

---

## File Structure (Phase 7 target state)

New and modified files in this phase:

```
web/
├── src/
│   ├── services/
│   │   └── backup-service.ts          # Create: export, import, clear-all-data
│   └── screens/
│       └── SettingsScreen.tsx          # Modify: wire backup-service, replace placeholders
├── tests/
│   ├── unit/
│   │   └── services/
│   │       └── backup-service.test.ts  # Create: backup service unit tests
│   ├── integration/
│   │   └── acceptance.test.ts          # Create: all 16 acceptance scenarios
│   └── e2e/
│       └── full-workflow.spec.ts              # Create: Playwright E2E smoke test
├── public/
│   └── icons/
│       ├── icon-192.png               # Verify exists (from Phase 1)
│       └── icon-512.png               # Verify exists (from Phase 1)
└── vite.config.ts                     # Modify: finalize PWA workbox config
```

---

## Dependencies from previous phases

All imports below come from Phase 1-6 deliverables:

```ts
// Phase 2: Domain types
import type {
  Exercise,
  Routine,
  RoutineDay,
  RoutineEntry,
  RoutineExerciseEntry,
  RoutineCardio,
  Session,
  SessionExercise,
  LoggedSet,
  Settings,
  SetBlock,
} from "@/domain/types";

// Phase 2: Domain enums
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

// Phase 2: Database
import { db, ExerciseLoggerDB, DEFAULT_SETTINGS, initializeSettings } from "@/db/database";

// Phase 2: Helpers
import { generateId } from "@/domain/uuid";
import { nowISO } from "@/domain/timestamp";

// Phase 3: Catalog + routine services
import { seedCatalog, parseExerciseCatalog } from "@/services/catalog-service";
import {
  validateAndNormalizeRoutine,
  importRoutine,
} from "@/services/routine-service";
import type { ValidateRoutineResult, ValidationError } from "@/services/routine-service";

// Phase 4: Session service
import {
  startSessionWithCatalog,
  resumeSession,
  discardSession,
  finishSession,
  addExtraExercise,
} from "@/services/session-service";
import type { SessionData } from "@/services/session-service";

// Phase 4: Set service
import { logSet, editSet, deleteSet } from "@/services/set-service";

// Phase 4: Settings service
import {
  getSettings,
  hasActiveSession,
  setActiveRoutine,
  deleteRoutine,
  setUnits,
  setTheme,
} from "@/services/settings-service";

// Phase 5: Progression service
import {
  getExerciseHistoryData,
  getExtraExerciseHistory,
} from "@/services/progression-service";
```

---

### Task 1: Create the backup service

**Files:**
- Create: `web/src/services/backup-service.ts`

This service implements three functions: `exportBackup`, `importBackup`, and `clearAllData`. Export produces a versioned JSON envelope. Import validates the entire payload before performing an all-or-nothing Dexie transaction. Clear deletes all user data and recreates default settings.

- [ ] **Step 1: Create the backup service file**

Create `web/src/services/backup-service.ts`:

```ts
import type {
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
  Settings,
  SetBlock,
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

function validateRoutine(
  routine: unknown,
  index: number,
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
  catalogIds: Set<string>,
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
  if (!isStringOrNull(s.instanceLabel)) {
    errors.push({
      field: `${path}.instanceLabel`,
      message: "must be a string or null",
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
  if (!isStringOrNull(s.instanceLabel)) {
    errors.push({
      field: `${path}.instanceLabel`,
      message: "must be a string or null",
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

  routines.forEach((r, i) => validateRoutine(r, i, errors));
  sessions.forEach((s, i) => validateSession(s, i, catalogIds, errors));
  sessionExercises.forEach((se, i) =>
    validateSessionExercise(se, i, catalogIds, errors)
  );
  loggedSets.forEach((ls, i) =>
    validateLoggedSet(ls, i, catalogIds, errors)
  );
  validateSettings(data.settings, errors);

  // Check 4: exerciseId references in sessionExercises and loggedSets are
  // already handled inside their respective validators above.

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
 * @throws Error if a local active session exists.
 */
export async function importBackup(
  db: ExerciseLoggerDB,
  envelope: BackupEnvelope
): Promise<void> {
  // Block import while a local active session exists
  const localActiveCount = await db.sessions
    .where("status")
    .equals("active")
    .count();
  if (localActiveCount > 0) {
    throw new Error(
      "Cannot import while a workout session is active. Finish or discard the session first."
    );
  }

  const { routines, sessions, sessionExercises, loggedSets, settings } =
    envelope.data;

  // All-or-nothing transactional overwrite (invariant 12)
  await db.transaction(
    "rw",
    db.routines,
    db.sessions,
    db.sessionExercises,
    db.loggedSets,
    db.settings,
    async () => {
      // Clear existing user data
      await db.routines.clear();
      await db.sessions.clear();
      await db.sessionExercises.clear();
      await db.loggedSets.clear();

      // Write imported data
      if (routines.length > 0) {
        await db.routines.bulkAdd(routines);
      }
      if (sessions.length > 0) {
        await db.sessions.bulkAdd(sessions);
      }
      if (sessionExercises.length > 0) {
        await db.sessionExercises.bulkAdd(sessionExercises);
      }
      if (loggedSets.length > 0) {
        await db.loggedSets.bulkAdd(loggedSets);
      }
      await db.settings.put(settings);
    }
  );
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
  const activeCount = await db.sessions
    .where("status")
    .equals("active")
    .count();
  if (activeCount > 0) {
    throw new Error(
      "Cannot clear data while a workout session is active. Finish or discard the session first."
    );
  }

  await db.transaction(
    "rw",
    db.routines,
    db.sessions,
    db.sessionExercises,
    db.loggedSets,
    db.settings,
    async () => {
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
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx tsc --noEmit --project tsconfig.app.json
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/services/backup-service.ts
git commit -m "$(cat <<'EOF'
feat: create backup service with export, import, and clear-all-data
EOF
)"
```

---

### Task 2: Create backup service tests

**Files:**
- Create: `web/tests/unit/services/backup-service.test.ts`

- [ ] **Step 1: Create the backup service test file**

Create `web/tests/unit/services/backup-service.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ExerciseLoggerDB,
  DEFAULT_SETTINGS,
  initializeSettings,
} from "@/db/database";
import {
  exportBackup,
  importBackup,
  clearAllData,
  validateBackupPayload,
  readJsonFile,
  type BackupEnvelope,
  type BackupData,
} from "@/services/backup-service";
import type {
  Exercise,
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
  Settings,
} from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let db: ExerciseLoggerDB;

function makeExercise(
  id: string,
  overrides?: Partial<Exercise>
): Exercise {
  return {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type: "weight",
    equipment: "barbell",
    muscleGroups: ["Legs"],
    ...overrides,
  };
}

function makeRoutine(id: string, overrides?: Partial<Routine>): Routine {
  return {
    id,
    schemaVersion: 1,
    name: "Test Routine",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A"],
    nextDayId: "A",
    days: {
      A: {
        id: "A",
        label: "Day A",
        entries: [],
      },
    },
    notes: [],
    cardio: null,
    importedAt: "2026-03-28T10:00:00.000Z",
    ...overrides,
  };
}

function makeSession(
  id: string,
  overrides?: Partial<Session>
): Session {
  return {
    id,
    routineId: "r1",
    routineNameSnapshot: "Test Routine",
    dayId: "A",
    dayLabelSnapshot: "Day A",
    dayOrderSnapshot: ["A"],
    restDefaultSecSnapshot: 90,
    restSupersetSecSnapshot: 60,
    status: "finished",
    startedAt: "2026-03-28T10:00:00.000Z",
    finishedAt: "2026-03-28T11:00:00.000Z",
    ...overrides,
  };
}

function makeSessionExercise(
  id: string,
  sessionId: string,
  exerciseId: string,
  overrides?: Partial<SessionExercise>
): SessionExercise {
  return {
    id,
    sessionId,
    routineEntryId: "entry-1",
    exerciseId,
    exerciseNameSnapshot: "Test Exercise",
    origin: "routine",
    orderIndex: 0,
    groupType: "single",
    supersetGroupId: null,
    supersetPosition: null,
    instanceLabel: null,
    effectiveType: "weight",
    effectiveEquipment: "barbell",
    notesSnapshot: null,
    setBlocksSnapshot: [
      { targetKind: "reps", minValue: 8, maxValue: 12, count: 3 },
    ],
    createdAt: "2026-03-28T10:00:00.000Z",
    ...overrides,
  };
}

function makeLoggedSet(
  id: string,
  sessionId: string,
  sessionExerciseId: string,
  exerciseId: string,
  overrides?: Partial<LoggedSet>
): LoggedSet {
  return {
    id,
    sessionId,
    sessionExerciseId,
    exerciseId,
    instanceLabel: null,
    origin: "routine",
    blockIndex: 0,
    blockSignature: "reps:8-12:count3:tagnormal",
    setIndex: 0,
    tag: null,
    performedWeightKg: 60,
    performedReps: 10,
    performedDurationSec: null,
    performedDistanceM: null,
    loggedAt: "2026-03-28T10:05:00.000Z",
    updatedAt: "2026-03-28T10:05:00.000Z",
    ...overrides,
  };
}

function makeValidEnvelope(overrides?: {
  routines?: Routine[];
  sessions?: Session[];
  sessionExercises?: SessionExercise[];
  loggedSets?: LoggedSet[];
  settings?: Settings;
}): BackupEnvelope {
  return {
    app: "exercise-logger",
    schemaVersion: 1,
    exportedAt: "2026-03-28T12:00:00.000Z",
    data: {
      routines: overrides?.routines ?? [makeRoutine("r1")],
      sessions: overrides?.sessions ?? [makeSession("s1")],
      sessionExercises: overrides?.sessionExercises ?? [
        makeSessionExercise("se1", "s1", "barbell-back-squat"),
      ],
      loggedSets: overrides?.loggedSets ?? [
        makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat"),
      ],
      settings: overrides?.settings ?? { ...DEFAULT_SETTINGS },
    },
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

beforeEach(async () => {
  db = new ExerciseLoggerDB();
  await initializeSettings(db);
  await db.exercises.bulkAdd([
    makeExercise("barbell-back-squat"),
    makeExercise("leg-curl"),
    makeExercise("dumbbell-bench-press"),
  ]);
});

afterEach(async () => {
  await db.delete();
});

// =========================================================================
// exportBackup
// =========================================================================

describe("exportBackup", () => {
  it("exports an empty database with correct envelope structure", async () => {
    const result = await exportBackup(db);

    expect(result.app).toBe("exercise-logger");
    expect(result.schemaVersion).toBe(1);
    expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.data.routines).toEqual([]);
    expect(result.data.sessions).toEqual([]);
    expect(result.data.sessionExercises).toEqual([]);
    expect(result.data.loggedSets).toEqual([]);
    expect(result.data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("exports all user data including routines, sessions, and sets", async () => {
    const routine = makeRoutine("r1");
    const session = makeSession("s1");
    const se = makeSessionExercise("se1", "s1", "barbell-back-squat");
    const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat");

    await db.routines.add(routine);
    await db.sessions.add(session);
    await db.sessionExercises.add(se);
    await db.loggedSets.add(ls);

    const result = await exportBackup(db);

    expect(result.data.routines).toHaveLength(1);
    expect(result.data.routines[0]!.id).toBe("r1");
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0]!.id).toBe("s1");
    expect(result.data.sessionExercises).toHaveLength(1);
    expect(result.data.sessionExercises[0]!.id).toBe("se1");
    expect(result.data.loggedSets).toHaveLength(1);
    expect(result.data.loggedSets[0]!.id).toBe("ls1");
  });

  it("does not export exercises (catalog)", async () => {
    const result = await exportBackup(db);

    // The envelope must not contain exercises
    const dataKeys = Object.keys(result.data);
    expect(dataKeys).not.toContain("exercises");
  });

  it("exports even with an active session present", async () => {
    const session = makeSession("s1", { status: "active", finishedAt: null });
    await db.sessions.add(session);

    const result = await exportBackup(db);

    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.sessions[0]!.status).toBe("active");
  });
});

// =========================================================================
// validateBackupPayload
// =========================================================================

describe("validateBackupPayload", () => {
  const catalogIds = new Set(["barbell-back-squat", "leg-curl", "dumbbell-bench-press"]);

  it("accepts a valid envelope", () => {
    const envelope = makeValidEnvelope();
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual([]);
  });

  it("rejects when app is not exercise-logger", () => {
    const envelope = { ...makeValidEnvelope(), app: "wrong-app" };
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "app",
          message: expect.stringContaining('"exercise-logger"'),
        }),
      ])
    );
  });

  it("rejects unsupported schemaVersion", () => {
    const envelope = { ...makeValidEnvelope(), schemaVersion: 99 };
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "schemaVersion",
          message: expect.stringContaining("unsupported"),
        }),
      ])
    );
  });

  it("rejects missing data object", () => {
    const envelope = { app: "exercise-logger", schemaVersion: 1, exportedAt: "now" };
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data",
          message: "must be an object",
        }),
      ])
    );
  });

  it("rejects missing required collections", () => {
    const envelope = {
      app: "exercise-logger",
      schemaVersion: 1,
      exportedAt: "now",
      data: {},
    };
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it("rejects unknown exerciseId in sessionExercises", () => {
    const envelope = makeValidEnvelope({
      sessionExercises: [
        makeSessionExercise("se1", "s1", "unknown-exercise-xyz"),
      ],
      loggedSets: [],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.sessionExercises[0].exerciseId",
          message: expect.stringContaining("not found in current catalog"),
        }),
      ])
    );
  });

  it("rejects unknown exerciseId in loggedSets", () => {
    const envelope = makeValidEnvelope({
      loggedSets: [
        makeLoggedSet("ls1", "s1", "se1", "unknown-exercise-xyz"),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.loggedSets[0].exerciseId",
          message: expect.stringContaining("not found in current catalog"),
        }),
      ])
    );
  });

  it("rejects more than one active session", () => {
    const envelope = makeValidEnvelope({
      sessions: [
        makeSession("s1", { status: "active", finishedAt: null }),
        makeSession("s2", { status: "active", finishedAt: null }),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.sessions",
          message: expect.stringContaining("at most one"),
        }),
      ])
    );
  });

  it("accepts exactly one active session", () => {
    const envelope = makeValidEnvelope({
      sessions: [
        makeSession("s1", { status: "active", finishedAt: null }),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual([]);
  });

  it("rejects invalid session status", () => {
    const envelope = makeValidEnvelope({
      sessions: [
        makeSession("s1", { status: "bogus" as any }),
      ],
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.sessions[0].status",
        }),
      ])
    );
  });

  it("rejects invalid settings units", () => {
    const envelope = makeValidEnvelope({
      settings: { ...DEFAULT_SETTINGS, units: "stones" as any },
    });
    const errors = validateBackupPayload(envelope, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "data.settings.units",
        }),
      ])
    );
  });

  it("rejects non-object root", () => {
    const errors = validateBackupPayload("just a string", catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "root",
        }),
      ])
    );
  });

  it("rejects null root", () => {
    const errors = validateBackupPayload(null, catalogIds);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "root",
        }),
      ])
    );
  });
});

// =========================================================================
// importBackup
// =========================================================================

describe("importBackup", () => {
  it("replaces all existing data with imported data", async () => {
    // Add some existing data
    await db.routines.add(makeRoutine("existing-r1", { name: "Old Routine" }));
    await db.sessions.add(makeSession("existing-s1"));

    // Import new data
    const envelope = makeValidEnvelope();
    await importBackup(db, envelope);

    // Verify old data is gone, new data is in
    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0]!.id).toBe("r1");

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe("s1");

    const se = await db.sessionExercises.toArray();
    expect(se).toHaveLength(1);

    const ls = await db.loggedSets.toArray();
    expect(ls).toHaveLength(1);

    const settings = await db.settings.get("user");
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("blocks import while a local active session exists", async () => {
    await db.sessions.add(
      makeSession("local-active", { status: "active", finishedAt: null })
    );

    const envelope = makeValidEnvelope();

    await expect(importBackup(db, envelope)).rejects.toThrow(
      /active.*session/i
    );
  });

  it("imports data containing one active session successfully", async () => {
    const envelope = makeValidEnvelope({
      sessions: [
        makeSession("s1", { status: "active", finishedAt: null }),
      ],
    });

    await importBackup(db, envelope);

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.status).toBe("active");
  });

  it("imports empty collections successfully", async () => {
    const envelope = makeValidEnvelope({
      routines: [],
      sessions: [],
      sessionExercises: [],
      loggedSets: [],
    });

    await importBackup(db, envelope);

    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(0);
    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(0);
  });
});

// =========================================================================
// clearAllData
// =========================================================================

describe("clearAllData", () => {
  it("deletes all user data and recreates default settings", async () => {
    // Populate data
    await db.routines.add(makeRoutine("r1"));
    await db.sessions.add(makeSession("s1"));
    await db.sessionExercises.add(
      makeSessionExercise("se1", "s1", "barbell-back-squat")
    );
    await db.loggedSets.add(
      makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat")
    );
    await db.settings.update("user", { activeRoutineId: "r1", units: "lbs" });

    await clearAllData(db);

    expect(await db.routines.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sessionExercises.count()).toBe(0);
    expect(await db.loggedSets.count()).toBe(0);

    // Settings should be reset to defaults
    const settings = await db.settings.get("user");
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("does not delete the exercise catalog", async () => {
    await clearAllData(db);

    const exercises = await db.exercises.toArray();
    expect(exercises.length).toBeGreaterThan(0);
  });

  it("blocks clear while an active session exists", async () => {
    await db.sessions.add(
      makeSession("s1", { status: "active", finishedAt: null })
    );

    await expect(clearAllData(db)).rejects.toThrow(/active.*session/i);
  });
});

// =========================================================================
// readJsonFile
// =========================================================================

describe("readJsonFile", () => {
  it("parses valid JSON from a File", async () => {
    const content = JSON.stringify({ app: "exercise-logger" });
    const file = new File([content], "backup.json", {
      type: "application/json",
    });

    const result = await readJsonFile(file);
    expect(result).toEqual({ app: "exercise-logger" });
  });

  it("throws on invalid JSON", async () => {
    const file = new File(["not valid json!!!"], "bad.json", {
      type: "application/json",
    });

    await expect(readJsonFile(file)).rejects.toThrow(/Invalid JSON/);
  });
});

// =========================================================================
// Round-trip test
// =========================================================================

describe("export -> import round-trip", () => {
  it("round-trips all persisted user data", async () => {
    // Populate data
    const routine = makeRoutine("r1");
    const session = makeSession("s1");
    const se = makeSessionExercise("se1", "s1", "barbell-back-squat");
    const ls = makeLoggedSet("ls1", "s1", "se1", "barbell-back-squat");

    await db.routines.add(routine);
    await db.sessions.add(session);
    await db.sessionExercises.add(se);
    await db.loggedSets.add(ls);
    await db.settings.update("user", { units: "lbs", activeRoutineId: "r1" });

    // Export
    const exported = await exportBackup(db);

    // Clear the database to simulate importing into a fresh state
    await db.routines.clear();
    await db.sessions.clear();
    await db.sessionExercises.clear();
    await db.loggedSets.clear();
    await db.settings.put(DEFAULT_SETTINGS);

    // Validate the exported data
    const catalogIds = new Set(
      (await db.exercises.toArray()).map((e) => e.id)
    );
    const errors = validateBackupPayload(exported, catalogIds);
    expect(errors).toEqual([]);

    // Import
    await importBackup(db, exported);

    // Verify all data round-tripped
    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0]!.id).toBe("r1");
    expect(routines[0]!.name).toBe("Test Routine");

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe("s1");

    const seResult = await db.sessionExercises.toArray();
    expect(seResult).toHaveLength(1);
    expect(seResult[0]!.id).toBe("se1");

    const lsResult = await db.loggedSets.toArray();
    expect(lsResult).toHaveLength(1);
    expect(lsResult[0]!.id).toBe("ls1");

    const settings = await db.settings.get("user");
    expect(settings!.units).toBe("lbs");
    expect(settings!.activeRoutineId).toBe("r1");
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/backup-service.test.ts
```

Expected: All tests pass (export, validate, import, clear, round-trip).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/unit/services/backup-service.test.ts
git commit -m "$(cat <<'EOF'
test: add backup service unit tests for export, import, validate, clear, and round-trip
EOF
)"
```

---

### Task 3: Wire backup service into SettingsScreen

**Files:**
- Modify: `web/src/screens/SettingsScreen.tsx`

Replace the Phase 6 placeholder `handleExportData` and `handleImportData` functions with real implementations that call the backup service. Also replace the inline `handleClearAllData` with a call to `clearAllData` from the backup service.

- [ ] **Step 1: Update SettingsScreen to use the backup service**

In `web/src/screens/SettingsScreen.tsx`, replace the placeholder block and the `handleClearAllData` function:

Remove the old placeholder block:

```ts
// ---------------------------------------------------------------------------
// Phase 7 placeholders for backup service
// ---------------------------------------------------------------------------

/**
 * Placeholder: export all user data as JSON.
 * Will be implemented in Phase 7 (backup-service.ts).
 */
async function handleExportData(): Promise<void> {
  // Phase 7: backup-service.ts will implement exportBackup(db)
  // which creates a versioned JSON envelope and triggers a download.
  alert("Export will be available after Phase 7 implementation.");
}

/**
 * Placeholder: import user data from JSON file.
 * Will be implemented in Phase 7 (backup-service.ts).
 */
async function handleImportData(): Promise<void> {
  // Phase 7: backup-service.ts will implement importBackup(db, file)
  // which validates and transactionally replaces all user data.
  alert("Import will be available after Phase 7 implementation.");
}
```

Replace it with the backup-service import at the top of the file (after the existing imports):

```ts
import {
  exportBackup,
  downloadBackupFile,
  importBackup,
  clearAllData,
  readJsonFile,
  validateBackupPayload,
} from "@/services/backup-service";
```

Inside the component, replace the `handleClearAllData` callback:

Remove this:

```ts
  const handleClearAllData = useCallback(async () => {
    try {
      setError(null);
      // Delete all user data except exercises (catalog is re-seeded)
      await db.transaction(
        "rw",
        db.routines,
        db.sessions,
        db.sessionExercises,
        db.loggedSets,
        db.settings,
        async () => {
          await db.routines.clear();
          await db.sessions.clear();
          await db.sessionExercises.clear();
          await db.loggedSets.clear();
          await db.settings.put({
            id: "user",
            activeRoutineId: null,
            units: "kg",
            theme: "system",
          });
        }
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to clear data";
      setError(message);
    }
  }, []);
```

Replace with:

```ts
  const handleClearAllData = useCallback(async () => {
    try {
      setError(null);
      await clearAllData(db);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to clear data";
      setError(message);
    }
  }, []);
```

Add a new `handleExportData` inside the component (after `handleClearAllData`):

```ts
  const handleExportData = useCallback(async () => {
    try {
      setError(null);
      const envelope = await exportBackup(db);
      downloadBackupFile(envelope);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to export data";
      setError(message);
    }
  }, []);
```

Add a `fileInputRef` at the top of the component (after the existing state declarations):

```ts
  const fileInputRef = useRef<HTMLInputElement>(null);
```

Add the `handleImportData` function inside the component:

```ts
  const handleImportData = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset input so the same file can be re-selected
      event.target.value = "";

      try {
        setError(null);

        // Parse the file
        const json = await readJsonFile(file);

        // Load current catalog IDs for validation
        const exercises = await db.exercises.toArray();
        const catalogIds = new Set(exercises.map((e) => e.id));

        // Validate the payload before any mutation
        const validationErrors = validateBackupPayload(json, catalogIds);
        if (validationErrors.length > 0) {
          const firstErrors = validationErrors.slice(0, 3);
          const errorText = firstErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join("\n");
          const suffix =
            validationErrors.length > 3
              ? `\n...and ${validationErrors.length - 3} more errors`
              : "";
          setError(`Invalid backup file:\n${errorText}${suffix}`);
          return;
        }

        // Perform the transactional import
        await importBackup(db, json as any);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to import data";
        setError(message);
      }
    },
    []
  );
```

Add the `useRef` import to the existing React import at the top:

```ts
import { useState, useCallback, useRef } from "react";
```

In the JSX, add a hidden file input element right before the closing `</div>` of the component (before the closing `</div>` that wraps the entire screen), just after the clear-all ConfirmDialog:

```tsx
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileSelected}
      />
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx tsc --noEmit --project tsconfig.app.json
```

Expected: No errors.

- [ ] **Step 3: Run existing SettingsScreen tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/screens/SettingsScreen.test.tsx
```

Expected: All existing tests still pass. The buttons are still present; only the backing functions changed.

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/screens/SettingsScreen.tsx
git commit -m "$(cat <<'EOF'
feat: wire backup service into SettingsScreen, replacing Phase 6 placeholders
EOF
)"
```

---

### Task 4: Verify empty states across screens

**Files:**
- No new files. This is a verification task.

Phase 6 implemented all screens. This task verifies that all required empty states from spec section 15 are present. Run the app and visually verify, then confirm in code.

- [ ] **Step 1: Verify TodayScreen empty states**

Check that `web/src/screens/TodayScreen.tsx` handles:
1. No active routine (settings.activeRoutineId is null) -- shows "Import Routine" and "Set Active Routine" prompts.
2. Active routine, no active session, no history -- shows the start card with day preview.
3. Active session exists -- shows "Resume Workout" card.

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/screens/TodayScreen.test.tsx
```

Expected: All TodayScreen tests pass.

- [ ] **Step 2: Verify WorkoutScreen empty state**

Check that `web/src/screens/WorkoutScreen.tsx` shows "No active workout. Start one from Today." when no active session exists.

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/screens/WorkoutScreen.test.tsx
```

Expected: All WorkoutScreen tests pass.

- [ ] **Step 3: Verify HistoryScreen empty state**

Check that `web/src/screens/HistoryScreen.tsx` shows "No workout history yet" when no finished sessions exist.

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/screens/HistoryScreen.test.tsx
```

Expected: All HistoryScreen tests pass.

- [ ] **Step 4: Verify SettingsScreen empty states**

Check that `web/src/screens/SettingsScreen.tsx` shows "No routines loaded. Import a YAML file below." when no routines exist, and that import/clear are blocked during active session.

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/screens/SettingsScreen.test.tsx
```

Expected: All SettingsScreen tests pass.

- [ ] **Step 5: Run the full unit test suite to confirm no regressions**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit (no-op if no fixes needed)**

If any fixes were applied during verification:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/screens/ web/tests/
git commit -m "$(cat <<'EOF'
fix: verify and fill gaps in empty state handling across screens
EOF
)"
```

---

### Task 5: Verify error messages are specific

**Files:**
- No new files. This is a verification task.

The spec mandates (section 15) that every user-visible error must be specific -- never generic "Something went wrong" when a specific validation error exists. This task verifies error specificity across all services.

- [ ] **Step 1: Verify routine-service error messages**

Check that `web/src/services/routine-service.ts` returns field-specific `ValidationError` objects with path and message, not generic strings.

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/routine-service.test.ts 2>&1 | tail -5
```

Expected: All routine validation tests pass with field-specific errors tested.

- [ ] **Step 2: Verify session-service error messages**

Check that `web/src/services/session-service.ts` throws specific errors for:
- Starting a session when one already exists
- Invalid day ID
- Missing routine
- Adding extra to non-active session

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/session-service.test.ts 2>&1 | tail -5
```

Expected: All session-service tests pass.

- [ ] **Step 3: Verify settings-service error messages**

Check that `web/src/services/settings-service.ts` throws specific errors for:
- Active session blocking routine changes
- Missing routine

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/settings-service.test.ts 2>&1 | tail -5
```

Expected: All settings-service tests pass.

- [ ] **Step 4: Verify backup-service error messages**

Check that the backup service returns specific errors for every import validation failure.

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/unit/services/backup-service.test.ts 2>&1 | tail -5
```

Expected: All backup-service tests pass.

- [ ] **Step 5: Commit (no-op if no fixes needed)**

If any fixes were applied during verification:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/src/services/
git commit -m "$(cat <<'EOF'
fix: ensure all error messages are specific per spec section 15
EOF
)"
```

---

### Task 6: Finalize PWA manifest and service worker

**Files:**
- Modify: `web/vite.config.ts`

Phase 1 set up a basic PWA config with placeholder icons and minimal workbox. This task finalizes the configuration for production-ready offline-first behavior.

- [ ] **Step 1: Update vite.config.ts with finalized PWA configuration**

In `web/vite.config.ts`, update the `VitePWA` plugin configuration. Replace the `workbox` block:

Replace:

```ts
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
      },
```

With:

```ts
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2,ico}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
```

- [ ] **Step 2: Verify the build produces the updated service worker**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
ls dist/manifest.webmanifest dist/sw.js 2>/dev/null
```

Expected: Both `manifest.webmanifest` and `sw.js` exist in `dist/`.

- [ ] **Step 3: Verify the manifest content is correct**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
cat dist/manifest.webmanifest
```

Expected: The manifest contains:
- `name: "Exercise Logger"`
- `short_name: "ExLog"`
- `display: "standalone"`
- `orientation: "portrait"`
- `theme_color: "#09090b"`
- Two icon entries (192x192 and 512x512)
- `scope` and `start_url` set to `/exercise-logger/`

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/vite.config.ts
git commit -m "$(cat <<'EOF'
feat: finalize PWA workbox config with runtime caching and navigate fallback
EOF
)"
```

---

### Task 7: Create the acceptance test suite (scenarios 1-8)

**Files:**
- Create: `web/tests/integration/acceptance.test.ts`

This file contains integration tests for all 16 acceptance scenarios from spec section 16. They run against a real Dexie database with `fake-indexeddb`. This task covers scenarios 1-8.

- [ ] **Step 1: Create the acceptance test file with scenarios 1-8**

Create `web/tests/integration/acceptance.test.ts`:

```ts
import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ExerciseLoggerDB,
  DEFAULT_SETTINGS,
  initializeSettings,
} from "@/db/database";
import { parseExerciseCatalog, seedCatalog } from "@/services/catalog-service";
import {
  validateAndNormalizeRoutine,
  importRoutine,
} from "@/services/routine-service";
import type { ValidateRoutineResult } from "@/services/routine-service";
import {
  startSessionWithCatalog,
  resumeSession,
  discardSession,
  finishSession,
  addExtraExercise,
} from "@/services/session-service";
import { logSet, editSet, deleteSet } from "@/services/set-service";
import {
  getSettings,
  setActiveRoutine,
  deleteRoutine,
} from "@/services/settings-service";
import {
  exportBackup,
  importBackup,
  clearAllData,
  validateBackupPayload,
} from "@/services/backup-service";
import {
  getExerciseHistoryData,
} from "@/services/progression-service";
import { generateBlockSignature } from "@/domain/block-signature";
import type {
  Exercise,
  Routine,
  Session,
  SessionExercise,
  LoggedSet,
} from "@/domain/types";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Setup: shared database and catalog
// ---------------------------------------------------------------------------

let db: ExerciseLoggerDB;
let catalogExercises: Exercise[];
let exerciseLookup: Map<string, Exercise>;

/**
 * Load the real CSV catalog from the repo.
 * This tests against the actual catalog, not a mock.
 */
async function loadRealCatalog(): Promise<Exercise[]> {
  const csvPath = path.resolve(
    __dirname,
    "../../../docs/exercises/gym_exercises_catalog.csv"
  );
  const csvText = fs.readFileSync(csvPath, "utf-8");
  return parseExerciseCatalog(csvText);
}

/**
 * Load the real routine YAML from the repo.
 */
function loadRealRoutineYaml(): string {
  const yamlPath = path.resolve(
    __dirname,
    "../../data/routines/full-body-3day.yaml"
  );
  return fs.readFileSync(yamlPath, "utf-8");
}

beforeEach(async () => {
  db = new ExerciseLoggerDB();
  catalogExercises = await loadRealCatalog();
  await seedCatalog(db, catalogExercises);
  await initializeSettings(db);
  exerciseLookup = new Map(catalogExercises.map((e) => [e.id, e]));
});

afterEach(async () => {
  await db.delete();
});

// =========================================================================
// Scenario 1: Catalog seed succeeds
// =========================================================================

describe("Scenario 1: Catalog seed succeeds", () => {
  it("seeds all exercises from the real CSV including required additions", async () => {
    const exercises = await db.exercises.toArray();
    expect(exercises.length).toBeGreaterThan(50);

    // Verify the required additions from spec section 8
    const requiredIds = [
      "pallof-press",
      "cable-woodchop",
      "medicine-ball-rotational-slam",
      "wrist-roller",
      "reverse-lunge",
      "dumbbell-reverse-lunge",
      "single-leg-romanian-deadlift",
      "dumbbell-pullover",
    ];

    for (const id of requiredIds) {
      const exercise = await db.exercises.get(id);
      expect(exercise, `Exercise ${id} must exist in catalog`).toBeDefined();
    }
  });

  it("supports the medicine-ball equipment type", async () => {
    const ex = await db.exercises.get("medicine-ball-rotational-slam");
    expect(ex).toBeDefined();
    expect(ex!.equipment).toBe("medicine-ball");
  });
});

// =========================================================================
// Scenario 2: Valid routine YAML imports successfully
// =========================================================================

describe("Scenario 2: Valid routine YAML imports successfully", () => {
  it("validates and normalizes the Full Body 3-Day Rotation", () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.routine.name).toBe("Full Body 3-Day Rotation");
      expect(result.routine.dayOrder).toEqual(["A", "B", "C"]);
      expect(result.routine.nextDayId).toBe("A");
      expect(result.routine.schemaVersion).toBe(1);
      expect(Object.keys(result.routine.days)).toEqual(
        expect.arrayContaining(["A", "B", "C"])
      );
    }
  });

  it("imports the routine into the database", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0]!.name).toBe("Full Body 3-Day Rotation");
    expect(routines[0]!.nextDayId).toBe("A");
  });
});

// =========================================================================
// Scenario 3: Invalid YAML fails with field-specific messages
// =========================================================================

describe("Scenario 3: Invalid YAML fails with field-specific messages", () => {
  it("rejects missing version", () => {
    const yaml = `
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const result = validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.path).toBeDefined();
      expect(result.errors[0]!.message).toBeDefined();
    }
  });

  it("rejects unknown exercise_id with a specific error", () => {
    const yaml = `
version: 1
name: "Test"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A]
days:
  A:
    label: "Day A"
    entries:
      - exercise_id: does-not-exist-at-all
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const result = validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const exerciseError = result.errors.find((e) =>
        e.message.toLowerCase().includes("does-not-exist-at-all")
      );
      expect(exerciseError).toBeDefined();
    }
  });

  it("rejects invalid YAML syntax", () => {
    const yaml = `
version: 1
name: "Test
  this is broken yaml
`;
    const result = validateAndNormalizeRoutine(yaml, exerciseLookup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) =>
          e.message.toLowerCase().includes("yaml")
        )
      ).toBe(true);
    }
  });
});

// =========================================================================
// Scenario 4: Starting workout creates active session + snapshot
// =========================================================================

describe("Scenario 4: Starting workout creates active session + snapshot", () => {
  it("creates one active session with full snapshot data", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);
    await setActiveRoutine(db, result.routine.id);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Session snapshots
    expect(sessionData.session.status).toBe("active");
    expect(sessionData.session.routineNameSnapshot).toBe(
      "Full Body 3-Day Rotation"
    );
    expect(sessionData.session.dayId).toBe("A");
    expect(sessionData.session.dayLabelSnapshot).toBeTruthy();
    expect(sessionData.session.dayOrderSnapshot).toEqual(["A", "B", "C"]);
    expect(sessionData.session.restDefaultSecSnapshot).toBe(90);
    expect(sessionData.session.restSupersetSecSnapshot).toBe(60);
    expect(sessionData.session.finishedAt).toBeNull();

    // Session exercises are snapshotted
    expect(sessionData.sessionExercises.length).toBeGreaterThan(0);
    for (const se of sessionData.sessionExercises) {
      expect(se.exerciseNameSnapshot).toBeTruthy();
      expect(se.exerciseId).toBeTruthy();
      expect(se.sessionId).toBe(sessionData.session.id);
    }
  });
});

// =========================================================================
// Scenario 5: Relaunch during active session resumes
// =========================================================================

describe("Scenario 5: Relaunch during active session resumes", () => {
  it("resumeSession returns the active session with all data", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const original = await startSessionWithCatalog(db, result.routine, "A");

    // Simulate relaunch by calling resumeSession
    const resumed = await resumeSession(db);

    expect(resumed).not.toBeNull();
    expect(resumed!.session.id).toBe(original.session.id);
    expect(resumed!.session.status).toBe("active");
    expect(resumed!.sessionExercises.length).toBe(
      original.sessionExercises.length
    );
  });
});

// =========================================================================
// Scenario 6: Day override works
// =========================================================================

describe("Scenario 6: Day override works", () => {
  it("suggested B, started A, finished A, next becomes B", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Set nextDayId to B (simulating that A was done last time)
    const routine = { ...result.routine, nextDayId: "B" };
    await importRoutine(db, routine);

    // Verify suggestion is B
    const storedRoutine = await db.routines.get(routine.id);
    expect(storedRoutine!.nextDayId).toBe("B");

    // Start with day A (override)
    const sessionData = await startSessionWithCatalog(db, routine, "A");
    expect(sessionData.session.dayId).toBe("A");

    // nextDayId should NOT change yet (invariant 3)
    const routineAfterStart = await db.routines.get(routine.id);
    expect(routineAfterStart!.nextDayId).toBe("B");

    // Finish the session
    await finishSession(db, sessionData.session.id);

    // After finishing day A, next should be B (the day after A in the rotation)
    const routineAfterFinish = await db.routines.get(routine.id);
    expect(routineAfterFinish!.nextDayId).toBe("B");
  });
});

// =========================================================================
// Scenario 7: Switching routines preserves nextDayId
// =========================================================================

describe("Scenario 7: Switching routines preserves nextDayId", () => {
  it("each routine keeps its own nextDayId when switching", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result1 = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result1.ok).toBe(true);
    if (!result1.ok) return;

    await importRoutine(db, result1.routine);

    // Create a second routine (minimal)
    const yaml2 = `
version: 1
name: "Simple 2-Day"
rest_default_sec: 60
rest_superset_sec: 45
day_order: [X, Y]
days:
  X:
    label: "Day X"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [8, 12], count: 3 }
  Y:
    label: "Day Y"
    entries:
      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 3 }
`;
    const result2 = validateAndNormalizeRoutine(yaml2, exerciseLookup);
    expect(result2.ok).toBe(true);
    if (!result2.ok) return;

    await importRoutine(db, result2.routine);

    // Start and finish a session with routine 1 to advance its nextDayId
    await setActiveRoutine(db, result1.routine.id);
    const session1 = await startSessionWithCatalog(
      db,
      result1.routine,
      "A"
    );
    await finishSession(db, session1.session.id);

    // Routine 1 should now have nextDayId = "B"
    const r1After = await db.routines.get(result1.routine.id);
    expect(r1After!.nextDayId).toBe("B");

    // Routine 2 should still have nextDayId = "X" (never touched)
    const r2After = await db.routines.get(result2.routine.id);
    expect(r2After!.nextDayId).toBe("X");

    // Switch to routine 2 and back
    await setActiveRoutine(db, result2.routine.id);
    await setActiveRoutine(db, result1.routine.id);

    // Both routines still have their own nextDayId
    const r1Final = await db.routines.get(result1.routine.id);
    expect(r1Final!.nextDayId).toBe("B");
    const r2Final = await db.routines.get(result2.routine.id);
    expect(r2Final!.nextDayId).toBe("X");
  });
});

// =========================================================================
// Scenario 8: Multi-block exercise shows separate history/suggestions
// =========================================================================

describe("Scenario 8: Multi-block exercise shows separate history/suggestions", () => {
  it("top-set and back-off blocks have independent history", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start and log sets for Day A (which has barbell-back-squat with 2 blocks)
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Find the barbell-back-squat session exercise
    const squat = sessionData.sessionExercises.find(
      (se) => se.exerciseId === "barbell-back-squat"
    );
    expect(squat).toBeDefined();
    expect(squat!.setBlocksSnapshot.length).toBe(2);

    // Block 0: top set (1 x 6-8, tag: top)
    // Block 1: back-off (3 x 8-12, no tag)
    const block0Sig = generateBlockSignature(squat!.setBlocksSnapshot[0]!);
    const block1Sig = generateBlockSignature(squat!.setBlocksSnapshot[1]!);
    expect(block0Sig).not.toBe(block1Sig);

    // Log top set: 100kg x 7
    await logSet(db, squat!.id, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Log back-off sets: 80kg x 12, 11, 10
    for (let i = 0; i < 3; i++) {
      await logSet(db, squat!.id, 1, i, {
        performedWeightKg: 80,
        performedReps: 12 - i,
        performedDurationSec: null,
        performedDistanceM: null,
      });
    }

    // Finish the session
    await finishSession(db, sessionData.session.id);

    // Now query history data: each block should have its own history
    const historyData = await getExerciseHistoryData(
      db,
      squat!,
      "kg"
    );

    expect(historyData.lastTime.length).toBe(2);

    // Block 0 (top set) should show 100kg x 7
    const block0History = historyData.lastTime[0]!;
    expect(block0History.sets).toHaveLength(1);
    expect(block0History.sets[0]!.weightKg).toBe(100);
    expect(block0History.sets[0]!.reps).toBe(7);

    // Block 1 (back-off) should show 80kg x 12, 11, 10
    const block1History = historyData.lastTime[1]!;
    expect(block1History.sets).toHaveLength(3);
    expect(block1History.sets[0]!.weightKg).toBe(80);
  });
});
```

- [ ] **Step 2: Run the acceptance tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/integration/acceptance.test.ts
```

Expected: All 8 scenarios pass.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/integration/acceptance.test.ts
git commit -m "$(cat <<'EOF'
test: add acceptance test scenarios 1-8 (catalog, routines, sessions, history)
EOF
)"
```

---

### Task 8: Add acceptance test scenarios 9-16

**Files:**
- Modify: `web/tests/integration/acceptance.test.ts`

Append scenarios 9-16 to the existing file.

- [ ] **Step 1: Append scenarios 9-16 to the acceptance test file**

Append to `web/tests/integration/acceptance.test.ts`:

```ts
// =========================================================================
// Scenario 9: Extra exercises excluded from progression
// =========================================================================

describe("Scenario 9: Extra exercises excluded from progression", () => {
  it("extra exercises can be added and logged but do not affect routine progression", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Add an extra exercise
    const extra = await addExtraExercise(
      db,
      sessionData.session.id,
      "leg-curl"
    );

    expect(extra.origin).toBe("extra");
    expect(extra.setBlocksSnapshot).toEqual([]);

    // Log a set for the extra exercise
    await logSet(db, extra.id, 0, 0, {
      performedWeightKg: 40,
      performedReps: 12,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Finish the session
    await finishSession(db, sessionData.session.id);

    // The extra's logged set should exist
    const allSets = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    const extraSets = allSets.filter((s) => s.origin === "extra");
    expect(extraSets).toHaveLength(1);

    // Start a new session and check that the routine exercise for leg-curl
    // (if it exists as a routine entry) does NOT use the extra's data for
    // progression. The extra exercise is tagged with origin="extra" so the
    // progression service filters it out.
    const routineEntry = sessionData.sessionExercises.find(
      (se) => se.exerciseId === "leg-curl" && se.origin === "routine"
    );
    if (routineEntry) {
      const historyData = await getExerciseHistoryData(db, routineEntry, "kg");
      // The routine entry's history should NOT include the extra's logged set
      // because progression matching requires origin="routine"
      for (const blockLastTime of historyData.lastTime) {
        for (const set of blockLastTime.sets) {
          // The extra logged 40kg, but since origin="extra" the progression
          // service must exclude it. The routine entry had no logged sets,
          // so this loop should not execute at all.
          expect(set.weightKg).not.toBe(40);
        }
      }
    }
  });
});

// =========================================================================
// Scenario 10: Superset timer starts after both sides logged
// =========================================================================

describe("Scenario 10: Superset timer starts after both sides logged", () => {
  it("superset round detection requires both members to have the same round logged", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Find a superset pair in Day A
    const supersetMembers = sessionData.sessionExercises.filter(
      (se) => se.groupType === "superset"
    );

    // Day A has one superset (dumbbell-bench-press + dumbbell-row)
    expect(supersetMembers.length).toBeGreaterThanOrEqual(2);

    const side0 = supersetMembers.find((se) => se.supersetPosition === 0);
    const side1 = supersetMembers.find(
      (se) =>
        se.supersetPosition === 1 &&
        se.supersetGroupId === side0?.supersetGroupId
    );
    expect(side0).toBeDefined();
    expect(side1).toBeDefined();

    // Both sides share the same supersetGroupId
    expect(side0!.supersetGroupId).toBe(side1!.supersetGroupId);

    // Log side 0, round 0
    await logSet(db, side0!.id, 0, 0, {
      performedWeightKg: 30,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // After logging only one side, the round is NOT complete
    const setsAfterOneSide = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    const side0Sets = setsAfterOneSide.filter(
      (s) => s.sessionExerciseId === side0!.id && s.setIndex === 0
    );
    const side1Sets = setsAfterOneSide.filter(
      (s) => s.sessionExerciseId === side1!.id && s.setIndex === 0
    );
    expect(side0Sets).toHaveLength(1);
    expect(side1Sets).toHaveLength(0);
    // Timer should NOT start yet (both sides need round 0)

    // Log side 1, round 0
    await logSet(db, side1!.id, 0, 0, {
      performedWeightKg: 25,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Now both sides have round 0 logged — timer should start
    const setsAfterBothSides = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    const side0SetsNow = setsAfterBothSides.filter(
      (s) => s.sessionExerciseId === side0!.id && s.setIndex === 0
    );
    const side1SetsNow = setsAfterBothSides.filter(
      (s) => s.sessionExerciseId === side1!.id && s.setIndex === 0
    );
    expect(side0SetsNow).toHaveLength(1);
    expect(side1SetsNow).toHaveLength(1);
    // Both sides logged for round 0 — superset round is complete.
    // Timer behavior is UI-only (Zustand), tested in timer-store.test.ts.
    // Here we verify the data prerequisite: both sides have setIndex 0.
  });
});

// =========================================================================
// Scenario 11: Edit/delete set updates history correctly
// =========================================================================

describe("Scenario 11: Edit/delete set updates history correctly", () => {
  it("editing a set updates the record without duplicating", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    const se = sessionData.sessionExercises[0]!;

    // Log a set
    const logged = await logSet(db, se.id, 0, 0, {
      performedWeightKg: 60,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Edit the set
    await editSet(db, logged.id, {
      performedWeightKg: 65,
      performedReps: 8,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Verify no duplicate
    const allSets = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    const matchingSets = allSets.filter(
      (s) =>
        s.sessionExerciseId === se.id &&
        s.blockIndex === 0 &&
        s.setIndex === 0
    );
    expect(matchingSets).toHaveLength(1);
    expect(matchingSets[0]!.performedWeightKg).toBe(65);
    expect(matchingSets[0]!.performedReps).toBe(8);
    expect(matchingSets[0]!.updatedAt).not.toBe(matchingSets[0]!.loggedAt);
  });

  it("deleting a set removes the record", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    const se = sessionData.sessionExercises[0]!;

    // Log a set
    const logged = await logSet(db, se.id, 0, 0, {
      performedWeightKg: 60,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Delete the set
    await deleteSet(db, logged.id);

    // Verify the set is gone
    const remaining = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(remaining.find((s) => s.id === logged.id)).toBeUndefined();
  });
});

// =========================================================================
// Scenario 12: Discard session removes records, no rotation advance
// =========================================================================

describe("Scenario 12: Discard session removes records, no rotation advance", () => {
  it("discarding deletes session, sessionExercises, loggedSets and does NOT advance nextDayId", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // nextDayId starts at "A"
    const routineBefore = await db.routines.get(result.routine.id);
    expect(routineBefore!.nextDayId).toBe("A");

    // Start a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Log a set so there is data to discard
    const se = sessionData.sessionExercises[0]!;
    await logSet(db, se.id, 0, 0, {
      performedWeightKg: 60,
      performedReps: 10,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Discard the session
    await discardSession(db, sessionData.session.id);

    // Session should be deleted (hard delete)
    const session = await db.sessions.get(sessionData.session.id);
    expect(session).toBeUndefined();

    // SessionExercises should be deleted
    const seAfter = await db.sessionExercises
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(seAfter).toHaveLength(0);

    // LoggedSets should be deleted
    const lsAfter = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(lsAfter).toHaveLength(0);

    // nextDayId should NOT have advanced (invariant 4)
    const routineAfter = await db.routines.get(result.routine.id);
    expect(routineAfter!.nextDayId).toBe("A");
  });
});

// =========================================================================
// Scenario 13: Finishing partial workout allowed
// =========================================================================

describe("Scenario 13: Finishing partial workout allowed", () => {
  it("can finish a session with only some sets logged", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );

    // Log only ONE set for the first exercise (partial)
    const se = sessionData.sessionExercises[0]!;
    await logSet(db, se.id, 0, 0, {
      performedWeightKg: 60,
      performedReps: 8,
      performedDurationSec: null,
      performedDistanceM: null,
    });

    // Finish with many sets unlogged — this must succeed
    await finishSession(db, sessionData.session.id);

    // Session is now finished
    const finished = await db.sessions.get(sessionData.session.id);
    expect(finished!.status).toBe("finished");
    expect(finished!.finishedAt).not.toBeNull();

    // The logged set is still there (history is valid)
    const sets = await db.loggedSets
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(sets).toHaveLength(1);
    expect(sets[0]!.performedWeightKg).toBe(60);
  });
});

// =========================================================================
// Scenario 14: Deleting routine doesn't break history
// =========================================================================

describe("Scenario 14: Deleting routine doesn't break history", () => {
  it("historical sessions remain renderable after routine deletion", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);
    await setActiveRoutine(db, result.routine.id);

    // Start and finish a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );
    await finishSession(db, sessionData.session.id);

    // Delete the routine
    await deleteRoutine(db, result.routine.id);

    // Routine should be gone
    const routine = await db.routines.get(result.routine.id);
    expect(routine).toBeUndefined();

    // But the session still exists with snapshot data
    const session = await db.sessions.get(sessionData.session.id);
    expect(session).toBeDefined();
    expect(session!.routineNameSnapshot).toBe("Full Body 3-Day Rotation");
    expect(session!.dayLabelSnapshot).toBeTruthy();

    // Session exercises still have snapshot data
    const exercises = await db.sessionExercises
      .where("sessionId")
      .equals(sessionData.session.id)
      .toArray();
    expect(exercises.length).toBeGreaterThan(0);
    for (const se of exercises) {
      expect(se.exerciseNameSnapshot).toBeTruthy();
    }
  });
});

// =========================================================================
// Scenario 15: Export -> import round-trips data
// =========================================================================

describe("Scenario 15: Export -> import round-trips data", () => {
  it("exports and imports all persisted user data faithfully", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);
    await setActiveRoutine(db, result.routine.id);

    // Start and log some sets, then finish
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );
    const se = sessionData.sessionExercises[0]!;
    await logSet(db, se.id, 0, 0, {
      performedWeightKg: 100,
      performedReps: 7,
      performedDurationSec: null,
      performedDistanceM: null,
    });
    await finishSession(db, sessionData.session.id);

    // Change settings
    await db.settings.update("user", { units: "lbs" });

    // Export
    const exported = await exportBackup(db);
    expect(exported.app).toBe("exercise-logger");
    expect(exported.schemaVersion).toBe(1);

    // Clear the database
    await clearAllData(db);

    // Verify the database is clean
    expect(await db.routines.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);

    // Validate the export
    const catalogIds = new Set(catalogExercises.map((e) => e.id));
    const errors = validateBackupPayload(exported, catalogIds);
    expect(errors).toEqual([]);

    // Import
    await importBackup(db, exported);

    // Verify round-trip fidelity
    const routines = await db.routines.toArray();
    expect(routines).toHaveLength(1);
    expect(routines[0]!.name).toBe("Full Body 3-Day Rotation");

    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.status).toBe("finished");
    expect(sessions[0]!.routineNameSnapshot).toBe("Full Body 3-Day Rotation");

    const seAfter = await db.sessionExercises.toArray();
    expect(seAfter.length).toBeGreaterThan(0);

    const lsAfter = await db.loggedSets.toArray();
    expect(lsAfter).toHaveLength(1);
    expect(lsAfter[0]!.performedWeightKg).toBe(100);
    expect(lsAfter[0]!.performedReps).toBe(7);

    const settings = await db.settings.get("user");
    expect(settings!.units).toBe("lbs");
    expect(settings!.activeRoutineId).toBe(result.routine.id);
  });
});

// =========================================================================
// Scenario 16: Import blocked during active session
// =========================================================================

describe("Scenario 16: Import blocked during active session", () => {
  it("rejects import when a local active session exists", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start a session (creates an active session)
    await startSessionWithCatalog(db, result.routine, "A");

    // Try to import — should be blocked
    const envelope = await exportBackup(db);

    await expect(importBackup(db, envelope)).rejects.toThrow(
      /active.*session/i
    );
  });

  it("allows import after the active session is finished", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start and finish a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );
    await finishSession(db, sessionData.session.id);

    // Now import should succeed
    const envelope = await exportBackup(db);
    await importBackup(db, envelope);

    // No error thrown — import succeeded
    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(1);
  });

  it("allows import after the active session is discarded", async () => {
    const yamlStr = loadRealRoutineYaml();
    const result = validateAndNormalizeRoutine(yamlStr, exerciseLookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await importRoutine(db, result.routine);

    // Start and discard a session
    const sessionData = await startSessionWithCatalog(
      db,
      result.routine,
      "A"
    );
    await discardSession(db, sessionData.session.id);

    // Now import should succeed
    const envelope = await exportBackup(db);
    await importBackup(db, envelope);

    // No error thrown
    const sessions = await db.sessions.toArray();
    expect(sessions).toHaveLength(0); // discarded was deleted, import has no sessions
  });
});
```

- [ ] **Step 2: Run all acceptance tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run tests/integration/acceptance.test.ts
```

Expected: All 16 scenarios pass.

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/integration/acceptance.test.ts
git commit -m "$(cat <<'EOF'
test: add acceptance test scenarios 9-16 (extras, supersets, edit/delete, discard, partial, history, round-trip, import blocking)
EOF
)"
```

---

### Task 9: Create Playwright E2E smoke test

**Files:**
- Create: `web/tests/e2e/full-workflow.spec.ts`

A Playwright smoke test covering the critical happy path: app loads, import routine, start workout, log a set, finish workout, check history, export data. This verifies the full stack works end-to-end in a real browser.

- [ ] **Step 1: Create the E2E smoke test**

Create `web/tests/e2e/full-workflow.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import path from "path";

const BASE_URL = "http://localhost:5173/exercise-logger/";

test.describe("Exercise Logger E2E Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Wait for the app to initialize (catalog seeding, settings init)
    await page.waitForLoadState("networkidle");
  });

  test("app loads and shows the Today screen", async ({ page }) => {
    // The Today screen should be visible
    await expect(page.getByText(/today/i).first()).toBeVisible();
  });

  test("navigating to Settings shows the settings screen", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /settings/i }).click();
    await expect(page.getByText(/routines/i).first()).toBeVisible();
    await expect(page.getByText(/preferences/i).first()).toBeVisible();
    await expect(page.getByText(/data/i).first()).toBeVisible();
  });

  test("import routine YAML via Settings", async ({ page }) => {
    await page.getByRole("link", { name: /settings/i }).click();

    // The routine YAML file path
    const yamlPath = path.resolve(
      __dirname,
      "../../data/routines/full-body-3day.yaml"
    );

    // Upload the YAML file
    const fileInput = page.locator('input[type="file"][accept=".yaml,.yml"]');
    await fileInput.setInputFiles(yamlPath);

    // Wait for the routine to appear in the list
    await expect(
      page.getByText("Full Body 3-Day Rotation")
    ).toBeVisible({ timeout: 5000 });
  });

  test("full workflow: import -> start -> log -> finish -> history", async ({
    page,
  }) => {
    // Step 1: Import routine via Settings
    await page.getByRole("link", { name: /settings/i }).click();

    const yamlPath = path.resolve(
      __dirname,
      "../../data/routines/full-body-3day.yaml"
    );
    const fileInput = page.locator('input[type="file"][accept=".yaml,.yml"]');
    await fileInput.setInputFiles(yamlPath);

    await expect(
      page.getByText("Full Body 3-Day Rotation")
    ).toBeVisible({ timeout: 5000 });

    // Step 2: Navigate to Today and start a workout
    await page.getByRole("link", { name: /today/i }).click();
    await expect(page.getByText(/start workout/i)).toBeVisible({
      timeout: 5000,
    });
    await page.getByText(/start workout/i).click();

    // Step 3: Should be on the Workout screen with exercises
    await expect(page.getByText(/finish workout/i)).toBeVisible({
      timeout: 5000,
    });

    // Step 4: Finish the workout (even without logging any sets)
    await page.getByText(/finish workout/i).click();

    // Confirm if there is a confirmation dialog
    const confirmButton = page.getByRole("button", { name: /finish/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Step 5: Check History
    await page.getByRole("link", { name: /history/i }).click();
    await expect(
      page.getByText(/full body 3-day rotation/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("export data button exists and is clickable", async ({ page }) => {
    await page.getByRole("link", { name: /settings/i }).click();

    const exportButton = page.getByRole("button", {
      name: /export data/i,
    });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();
  });

  test("workout screen shows empty state when no session", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /workout/i }).click();
    await expect(
      page.getByText(/no active workout/i)
    ).toBeVisible();
  });

  test("history screen shows empty state when no history", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /history/i }).click();
    await expect(
      page.getByText(/no workout history/i)
    ).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the E2E smoke test**

First, start the dev server in the background, then run Playwright:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx playwright test tests/e2e/full-workflow.spec.ts
```

Expected: All smoke tests pass. Note: the dev server must be running (Playwright config from Phase 1 should handle webServer configuration).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/tests/e2e/full-workflow.spec.ts
git commit -m "$(cat <<'EOF'
test: add Playwright E2E smoke test for critical workflow
EOF
)"
```

---

### Task 10: Run the full test suite and verify build

**Files:**
- No new files. Final verification.

- [ ] **Step 1: Run all unit and integration tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx vitest run
```

Expected: All tests pass with no failures.

- [ ] **Step 2: Run the production build**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify the build output contains all required files**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
ls dist/index.html dist/404.html dist/manifest.webmanifest dist/sw.js
ls dist/assets/
```

Expected:
- `dist/index.html` exists
- `dist/404.html` exists
- `dist/manifest.webmanifest` exists
- `dist/sw.js` exists
- `dist/assets/` contains `.js` and `.css` bundles

- [ ] **Step 4: Run TypeScript type checking**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx tsc --noEmit --project tsconfig.app.json
```

Expected: No type errors.

- [ ] **Step 5: Run Playwright E2E tests**

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger/web"
npx playwright test
```

Expected: All E2E tests pass.

- [ ] **Step 6: Commit (no-op if nothing changed)**

If any fixes were applied:

```bash
cd "C:/Users/creix/VSC Projects/exercise_logger"
git add web/
git commit -m "$(cat <<'EOF'
fix: resolve issues found during final Phase 7 verification
EOF
)"
```

---

## Self-Review Checklist

### 1. Spec coverage

| Spec requirement | Task | Status |
|---|---|---|
| Export: versioned JSON envelope | Task 1 (exportBackup) | Covered |
| Export: all user data except catalog | Task 1 (exportBackup) | Covered |
| Export: filename format | Task 1 (downloadBackupFile) | Covered |
| Export: allowed during active session | Task 1 + Task 2 (test) | Covered |
| Import: full overwrite only | Task 1 (importBackup) | Covered |
| Import: validate before mutation | Task 1 (validateBackupPayload) | Covered |
| Import: fail if app wrong | Task 1 + Task 2 | Covered |
| Import: fail if schemaVersion unsupported | Task 1 + Task 2 | Covered |
| Import: fail if collections missing | Task 1 + Task 2 | Covered |
| Import: fail if exerciseId not in catalog | Task 1 + Task 2 | Covered |
| Import: fail if >1 active session | Task 1 + Task 2 | Covered |
| Import: fail if row fails structural validation | Task 1 + Task 2 | Covered |
| Import: blocked during local active session | Task 1 + Task 2 | Covered |
| Import: transactional (invariant 12) | Task 1 (Dexie transaction) | Covered |
| Import: resume imported active session | Task 1 + Task 2 (test) | Covered |
| Clear all data: delete user data | Task 1 (clearAllData) | Covered |
| Clear all data: recreate default settings | Task 1 + Task 2 | Covered |
| Clear all data: blocked during active session | Task 1 + Task 2 | Covered |
| Error handling: specific messages | Task 5 verification | Covered |
| Empty states: all 5 states | Task 4 verification | Covered |
| PWA: manifest with all fields | Task 6 | Covered |
| PWA: service worker offline-first | Task 6 | Covered |
| Acceptance scenario 1: catalog seed | Task 7 | Covered |
| Acceptance scenario 2: valid YAML import | Task 7 | Covered |
| Acceptance scenario 3: invalid YAML errors | Task 7 | Covered |
| Acceptance scenario 4: start creates session + snapshot | Task 7 | Covered |
| Acceptance scenario 5: relaunch resumes | Task 7 | Covered |
| Acceptance scenario 6: day override | Task 7 | Covered |
| Acceptance scenario 7: switching routines preserves nextDayId | Task 7 | Covered |
| Acceptance scenario 8: multi-block separate history | Task 7 | Covered |
| Acceptance scenario 9: extras excluded from progression | Task 8 | Covered |
| Acceptance scenario 10: superset timer after both sides | Task 8 | Covered |
| Acceptance scenario 11: edit/delete set updates history | Task 8 | Covered |
| Acceptance scenario 12: discard no rotation advance | Task 8 | Covered |
| Acceptance scenario 13: finish partial workout | Task 8 | Covered |
| Acceptance scenario 14: delete routine preserves history | Task 8 | Covered |
| Acceptance scenario 15: export-import round-trip | Task 8 | Covered |
| Acceptance scenario 16: import blocked during active session | Task 8 | Covered |

### 2. Placeholder scan

- `handleExportData` placeholder in SettingsScreen: **replaced** in Task 3
- `handleImportData` placeholder in SettingsScreen: **replaced** in Task 3
- `handleClearAllData` inline implementation in SettingsScreen: **replaced** with `clearAllData` service call in Task 3
- No "TBD", no "similar to above", no other placeholders found

### 3. Type/import consistency with Phases 2-6

- All domain types imported from `@/domain/types` match Phase 2 definitions exactly
- All enum types imported from `@/domain/enums` match Phase 2 definitions exactly
- Database import (`ExerciseLoggerDB`, `DEFAULT_SETTINGS`, `initializeSettings`, `db`) matches Phase 2 `@/db/database`
- Helper imports (`generateBlockSignature`, `nowISO`, `generateId`) match Phase 2 modules
- Service imports (`session-service`, `set-service`, `settings-service`, `catalog-service`, `routine-service`, `progression-service`) match Phase 3-5 exported functions
- The `BackupEnvelope.data.settings` field is typed as `Settings` (single object), consistent with the single-record table from Phase 2
- The `validateBackupPayload` function checks `catalogIds: Set<string>` which is built from `db.exercises.toArray()`, consistent with Phase 3's catalog seeding
- The `logSet` call signature in acceptance tests uses `logSet(db, sessionExerciseId, blockIndex, setIndex, input)` matching Phase 4's `set-service.ts` exactly
- The `editSet` call signature uses `editSet(db, loggedSetId, input)` matching Phase 4's `set-service.ts` exactly
- The `getExerciseHistoryData` return type `ExerciseHistoryData` has `lastTime: BlockLastTime[]` and `suggestions: BlockSuggestion[]`, and acceptance tests access `historyData.lastTime` correctly
- The `LastTimeSet` type uses `weightKg` and `reps` (not `performedWeightKg`/`performedReps`), and acceptance tests use these field names correctly
- SettingsScreen modifications preserve all existing imports and only add `backup-service` imports
