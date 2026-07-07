# Database Layer

Dexie.js wrapper over IndexedDB. Single file, single export.

## `database.ts`

### Schema (version 1)

```
exercises:      "id"
routines:       "id"
sessions:       "id, status, [routineId+startedAt]"
sessionExercises: "id, sessionId, [sessionId+orderIndex]"
loggedSets:     "id, sessionId, [sessionExerciseId+blockIndex+setIndex], [exerciseId+loggedAt], [exerciseId+instanceLabel+blockSignature+loggedAt]"
settings:       "id"
```

### Schema (version 2)

Adds `unitOverride: UnitSystem | null` to `sessionExercises`. No index change — the field is not indexed. Existing rows get `unitOverride = undefined` (treated as `null`, i.e. inherit global). Note: this is the Dexie DB schema version and is distinct from the backup envelope `schemaVersion` (which stays at 1).

### Schema (version 3)

Adds 6 nullable fields to the `settings` record for the first-run onboarding
feature. No index change — all new fields are unindexed, so the
compound-index null trap does not apply (see below).

New fields on `Settings`:

- `userName: string | null` — user's preferred name for the Today greeting.
- `onboardingCompletedAt: string | null` — ISO timestamp, set on successful YAML import from the handoff screen.
- `onboardingSkippedAt: string | null` — ISO timestamp, set by "Maybe later" on the welcome screen. **Existing v2 users are backfilled with `nowISO()` here** (Decision D3) so the first-run gate does not trigger for testers already using the app.
- `lastGeneratedPrompt: string | null` — **removed at the type level** in the embedded-LLM-generation change (see version 5 below). Was the last questionnaire-derived prompt for the copy/paste custom-GPT flow.
- `lastGeneratedPromptAt: string | null` — **removed at the type level** alongside `lastGeneratedPrompt`.
- `onboardingBannerDismissedAt: string | null` — ISO timestamp when the user dismissed the Today "Finish setting up your routine" banner. Nothing resets it back to null; it stands until the wizard sessionStorage state clears or onboarding completes.

Defaults on fresh v3 installs: all six are `null` (via `DEFAULT_SETTINGS`).

### Schema (version 4)

Adds 3 unindexed gym-proofing booleans to the `settings` record:

- `keepScreenOn: boolean` — hold a screen wake lock during active sessions. Default/backfill `true`.
- `restCueHaptic: boolean` — vibrate when the rest timer completes. Default/backfill `true`.
- `restCueSound: boolean` — short beep on rest complete. Default/backfill `false`.

Existing users are backfilled with the same defaults as fresh installs. Backup import normalizes missing fields to these defaults (`backup-service.importBackup`).

### Schema (version 5)

Adds `llmApiKey: string` to the `settings` record for in-app routine generation
(Anthropic API key, entered in Settings). Unindexed, so the `.stores(...)`
signature is identical to v4. Default/backfill is `""` (the "not configured"
sentinel — never `null`, per the compound-index convention established at v3,
even though this field isn't itself indexed).

This version also predates the removal of `lastGeneratedPrompt` /
`lastGeneratedPromptAt` from the `Settings` TypeScript type (the custom-GPT
copy/paste flow they supported was replaced by in-app generation). Rows
written under v3/v4 may still carry those two properties in IndexedDB —
Dexie does not strip stale properties on upgrade, and nothing reads them
anymore, so they are harmless dead weight on existing installs. No migration
was added to delete them.

Backup export strips `llmApiKey` (replaced with `""`) so exported JSON never
carries the key off-device; backup import ignores any `llmApiKey` in the
envelope and preserves the importing device's own key (`backup-service.ts`).

### Key indexes and their consumers

| Index | Used by | Purpose |
|---|---|---|
| `sessions.status` | session-service, settings-service | Find active session |
| `[routineId+startedAt]` | (future queries) | Session history by routine |
| `[sessionId+orderIndex]` | hooks/useSessionExercises | Ordered exercise display |
| `[sessionExerciseId+blockIndex+setIndex]` | set-service | Unique set slot lookup (invariant 9) |
| `[exerciseId+loggedAt]` | progression-service | Exercise history across sessions |
| `[exerciseId+instanceLabel+blockSignature+loggedAt]` | progression-service | Exact block progression matching |

### Exports

- `ExerciseLoggerDB` — Dexie subclass with typed tables
- `db` — Singleton instance
- `DEFAULT_SETTINGS` — `{ id: "user", activeRoutineId: null, units: "kg" }`
- `initializeSettings(db)` — Idempotent: creates default settings if none exist

### Critical: compound indexes and null

Dexie/IndexedDB silently excludes rows from compound indexes when any key component is `null`. The `[exerciseId+instanceLabel+blockSignature+loggedAt]` index is critical for progression matching. This is why `instanceLabel` must always be `string` (`""` for no label), never `null`.

## Dependencies

Imports from: `domain/types`
Imported by: all services, all hooks
