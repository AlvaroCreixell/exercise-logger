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

- `getSettings(db)`, `setUnits(db, units)` — CRUD.
- `hasActiveSession(db)` — Boolean check.
- `setActiveRoutine(db, routineId)` — Blocked during active session (invariant 10, inside transaction).
- `deleteRoutine(db, routineId)` — Blocked during active session. Auto-activates earliest remaining routine by `importedAt` ASC. All checks inside transaction to prevent TOCTOU races.
- `setUnitOverride(db, sessionExerciseId, unitOverride)` — Set per-exercise unit override (`UnitSystem | null`) on a `SessionExercise`.
- `setKeepScreenOn(db, bool)` / `setRestCueHaptic(db, bool)` / `setRestCueSound(db, bool)` — Gym-proofing preference setters (Dexie v4 fields).

### `onboarding-service.ts` — Onboarding state transitions

All three functions are thin `db.settings.update("user", …)` calls. No transactions — the single-record updates don't interact with sessions, so no active-session guard is needed. (Two prior functions, `saveGeneratedPrompt` and `clearLastPrompt`, were removed with the custom-GPT copy/paste flow — the fields they wrote no longer exist on the `Settings` type. See `docs/custom-gpt/DEPRECATED.md`.)

- `markOnboardingCompleted(db)` — sets `onboardingCompletedAt = nowISO()`. Called by `GenerationScreen.handleAccept` on first-run only (re-entry from Settings must not re-stamp completion).
- `markOnboardingSkipped(db)` — sets `onboardingSkippedAt = nowISO()`. Called by "Maybe later" on the welcome screen.
- `dismissOnboardingBanner(db)` — sets `onboardingBannerDismissedAt = nowISO()`. Nothing resets this back to `null`.

Also extended in this feature:

- `settings-service.setUserName(db, name)` — trims, truncates to 40 codepoints (surrogate-safe), accepts `null` to clear.
- `settings-service.setLlmApiKey(db, key)` — trims outer whitespace; `""` clears the key ("not configured").

### `generation-service.ts` — Orchestrates one LLM routine generation

- `generateRoutine(db, answers, provider)` → `GenerationResult` (`{ ok: true, routine } | { ok: false, failure: GenerationFailure }`) — Never throws. Builds the system prompt from the live exercise catalog (`llm/system-prompt.ts`), builds the user prompt from questionnaire `Answers` (`features/onboarding/lib/prompt-builder.ts`), then round-trips with the injected `LlmProvider`. The provider's structured output is converted to the YAML-contract object shape (`llm/routine-schema.ts:toRawRoutine`) and run through `validateRoutineObject` (routine-service). On validation failure, appends the assistant's raw output plus a repair-request message (listing the validation errors) to the conversation and retries, up to `MAX_REPAIR_ATTEMPTS = 2` additional round trips (3 attempts total). If all attempts fail validation, returns a `"validation"` failure carrying the last `ValidationError[]`. Provider errors (auth/network/rate-limit) short-circuit immediately as their own failure kind — no repair attempt.
- Pure orchestration: no React; the provider is injected so tests can fake it; `db` is only read (the `exercises` table), never written.

### `llm/` — Provider abstraction and Anthropic implementation

- `types.ts` — `LlmProvider` interface (`generateRoutine(system, messages) => Promise<GeneratedRoutine>`), `ProviderMessage`, and `GenerationFailure` (an `Error` subclass carrying a `kind`: `"no-api-key" | "auth" | "rate-limit" | "network" | "validation" | "unknown"`, plus `validationErrors` for the `"validation"` kind). `GenerationScreen`'s error UI switches on `failure.kind`.
- `anthropic-provider.ts` — `createAnthropicProvider(apiKey)` implements `LlmProvider` by calling `api.anthropic.com` directly from the browser (`dangerouslyAllowBrowser: true` — the SDK's documented bring-your-own-key opt-in) with model `ANTHROPIC_MODEL = "claude-haiku-4-5"`, `max_tokens: 8192`, one automatic SDK retry on 429/5xx, using `client.messages.parse(...)` with a `zodOutputFormat(generatedRoutineSchema)` structured-output config. The `@anthropic-ai/sdk` package and its zod helper are dynamically imported (`loadSdk()`, memoized) to keep them out of the main bundle — they load only when generation actually runs. `mapProviderError(err)` maps thrown errors to a typed `GenerationFailure` by HTTP status (401/403 → auth, 429/503/529 → rate-limit, no status → network, otherwise unknown). `testAnthropicKey(apiKey)` is a cheap free `models.retrieve` ping used by the Settings "Test connection" button.
- `routine-schema.ts` — `generatedRoutineSchema` (zod): the structured-output schema mirrors the YAML contract but with `days` as an array (not a record — strict JSON schemas forbid dynamic keys) and no `version` field. `toRawRoutine(generated)` converts a schema-valid `GeneratedRoutine` into the YAML-contract raw object shape (deriving `day_order` from array order, injecting `version: 1`), for `validateRoutineObject` to validate/normalize. Constraints the zod schema can't express (min < max, positive values, count ≥ 1, catalog-ID membership, superset arity/balance, duplicate-label rules) are left to `validateRoutineObject`; `toRawRoutine` is total and never throws on schema-valid input.
- `system-prompt.ts` — `buildSystemPrompt(exercises)` builds the model's system prompt from the live `exercises` table (so the catalog section can never drift from the seeded catalog) plus fixed structural/programming rules and a repair-request instruction. Successor to `docs/custom-gpt/workout-routine-gpt.instructions.md`.

### `backup-service.ts` — Export/import/clear

- `exportBackup(db)` → BackupEnvelope — Excludes exercises (re-seeded from CSV). Allowed with active session. Strips `settings.llmApiKey` to `""` so the device-local Anthropic key never leaves the device in an exported file.
- `validateBackupPayload(json, catalogIds)` → errors[] — Deep validation: schema version, exerciseId refs, FK integrity, structural checks.
- `importBackup(db, envelope)` → `{ hasActiveSession }` — Full overwrite in one transaction. Blocked if local active session. Ignores any `llmApiKey` in the incoming envelope and preserves the importing device's own key (read before the transaction, written back into the settings record that replaces the imported one) — the key is device-local, not part of the portable backup.
- `clearAllData(db)` → void — Deletes all except exercises. Recreates default settings. Blocked if active session.
- `downloadBackupFile(envelope)` — Triggers browser download.

### `catalog-service.ts` — Exercise catalog

- `loadEmbeddedCatalog()` — Parse bundled CSV via Vite `?raw` import.
- `parseExerciseCatalog(csv)` — Validates type, equipment (against enum), muscle groups. Equipment normalization: "Machine / Cable" → "machine" (first value wins).
- `seedCatalog(db, exercises)` — `bulkPut` for idempotent upsert.

### `routine-service.ts` — YAML validation and normalization

- `validateAndNormalizeRoutine(yaml, exerciseLookup)` → `Promise<{ ok, routine } | { ok, errors }>` — async (dynamic-imports yaml to keep the ~50kB library out of the main bundle). Parses the YAML string, then delegates to `validateRoutineObject`.
- `validateRoutineObject(rawInput, exerciseLookup)` → `ValidateRoutineResult` — synchronous. The actual 11-rule validation/normalization engine (deterministic entryId/groupId generation, all errors collected with field paths); works on an already-parsed object, not a YAML string. Shared by `validateAndNormalizeRoutine` (YAML import path) and `generation-service.generateRoutine` (LLM path, which produces JSON directly and never touches YAML).
- `importRoutine(db, routine)` — Simple `db.routines.put` (low-level; no settings mutation).
- `importAndActivateRoutine(db, routine)` → `Promise<{ ok: true } | { ok: false, message: string }>` — Transactional: blocks with a message when a session is active (invariant 10), otherwise puts the routine and sets it as the active routine in one `rw` transaction. Used by the Settings Import screen.

## Transaction patterns

All multi-step mutations use `db.transaction("rw", [...tables], async () => { ... })`. Active-session guards are INSIDE transactions (not before) to prevent TOCTOU races. The transaction table list must include `db.sessions` when checking for active sessions.

## Dependencies

Imports from: `domain/*`, `db/database`
Imported by: `hooks/*`, `screens/*`, `components/*`
