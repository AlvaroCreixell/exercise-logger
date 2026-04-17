# Services Layer

Pure business logic functions. Every function takes `db: ExerciseLoggerDB` as its first argument. No React, no Zustand, no UI concerns. Services enforce all domain invariants.

## Files and responsibilities

### `session-service.ts` — Session lifecycle

- `startSessionWithCatalog(db, routine, dayId)` → SessionData — Creates session + snapshots all exercises from catalog. Enforces invariant 1 (one active session). Does NOT advance rotation. Carries forward `unitOverride` from the most recent finished session via `findPreviousUnitOverride`. Extra exercises use `matchAnyLabel: true` when looking up previous overrides.
- `resumeSession(db)` → SessionData | null — Returns active session with exercises and sets.
- `discardSession(db, sessionId)` → void — Hard-deletes session + exercises + sets. Does NOT advance rotation (invariant 4).
- `finishSession(db, sessionId)` → void — Sets status=finished, advances `nextDayId` using `dayOrderSnapshot`. Allows partial completion.
- `addExtraExercise(db, sessionId, exerciseId)` → SessionExercise — Appends origin="extra" with empty set blocks. Only during active session (invariant 6).

**Snapshot pattern:** At session start, routine name, day label, day order, rest timers, exercise names, effective types, notes, and set blocks are all copied into session/sessionExercise records. This ensures history survives routine deletion.

### `set-service.ts` — Set logging

- `logSet(db, sessionExerciseId, blockIndex, setIndex, input)` → LoggedSet — Upsert (invariant 9). Validates blockIndex and setIndex bounds. Denormalizes exerciseId, instanceLabel, blockSignature. Weighted bodyweight promotion runs on BOTH create and update paths.
- `editSet(db, loggedSetId, input)` → LoggedSet — Works on active AND finished sessions. Weighted bodyweight promotion runs **only on active sessions** to keep finished-session snapshots immutable.
- `deleteSet(db, loggedSetId)` → void — Hard delete.

**SetLogInput:** `{ performedWeightKg, performedReps, performedDurationSec, performedDistanceM }` — all nullable.

**Weighted bodyweight:** If `performedWeightKg !== null` and `effectiveType === "bodyweight"`, promotes `effectiveType` to `"weight"` on the sessionExercise. One-way promotion — never demotes.

### `progression-service.ts` — History matching and suggestions

- `findMatchingBlock(db, ...)` — Primary match: exerciseId + instanceLabel + blockSignature. Fallback: exerciseId + instanceLabel + tag + targetKind. Only finished sessions, most recent first.
- `calculateBlockSuggestion(...)` — 4 conditions required for +5%: range block, weight-eligible, all sets logged, all hit ceiling. Uses `targetKind`-aware ceiling check.
- `getExerciseHistoryData(db, sessionExercise, units)` — Per-block last-time + suggestions. Invariant 7: extras return empty. Invariant 8: per-block, not per-exercise.
- `getExtraExerciseHistory(db, exerciseId)` — Most recent finished session's sets for an exercise, ignoring routine position.
- `getBlockLabel(...)` — "Top", "AMRAP", "Back-off" (heuristic: follows a top block), or "Set block N".

### `settings-service.ts` — Settings and guards

- `getSettings(db)`, `setUnits(db, units)`, `setTheme(db, theme)` — CRUD.
- `hasActiveSession(db)` — Boolean check.
- `setActiveRoutine(db, routineId)` — Blocked during active session (invariant 10, inside transaction).
- `deleteRoutine(db, routineId)` — Blocked during active session. Auto-activates earliest remaining routine by `importedAt` ASC. All checks inside transaction to prevent TOCTOU races.
- `setUnitOverride(db, sessionExerciseId, unitOverride)` — Set per-exercise unit override (`UnitSystem | null`) on a `SessionExercise`.

### `backup-service.ts` — Export/import/clear

- `exportBackup(db)` → BackupEnvelope — Excludes exercises (re-seeded from CSV). Allowed with active session.
- `validateBackupPayload(json, catalogIds)` → errors[] — Deep validation: schema version, exerciseId refs, FK integrity, structural checks.
- `importBackup(db, envelope)` → `{ hasActiveSession }` — Full overwrite in one transaction. Blocked if local active session.
- `clearAllData(db)` → void — Deletes all except exercises. Recreates default settings. Blocked if active session.
- `downloadBackupFile(envelope)` — Triggers browser download.

### `catalog-service.ts` — Exercise catalog

- `loadEmbeddedCatalog()` — Parse bundled CSV via Vite `?raw` import.
- `parseExerciseCatalog(csv)` — Validates type, equipment (against enum), muscle groups. Equipment normalization: "Machine / Cable" → "machine" (first value wins).
- `seedCatalog(db, exercises)` — `bulkPut` for idempotent upsert.

### `routine-service.ts` — YAML validation and normalization

- `validateAndNormalizeRoutine(yaml, exerciseLookup)` → `{ ok, routine } | { ok, errors }` — 11 validation rules, deterministic entryId/groupId generation, all errors collected with field paths.
- `importRoutine(db, routine)` — Simple `db.routines.put`.

## Transaction patterns

All multi-step mutations use `db.transaction("rw", [...tables], async () => { ... })`. Active-session guards are INSIDE transactions (not before) to prevent TOCTOU races. The transaction table list must include `db.sessions` when checking for active sessions.

## Dependencies

Imports from: `domain/*`, `db/database`
Imported by: `hooks/*`, `screens/*`, `components/*`
