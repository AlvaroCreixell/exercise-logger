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
- `DEFAULT_SETTINGS` — `{ id: "user", activeRoutineId: null, units: "kg", theme: "system" }`
- `initializeSettings(db)` — Idempotent: creates default settings if none exist

### Critical: compound indexes and null

Dexie/IndexedDB silently excludes rows from compound indexes when any key component is `null`. The `[exerciseId+instanceLabel+blockSignature+loggedAt]` index is critical for progression matching. This is why `instanceLabel` must always be `string` (`""` for no label), never `null`.

## Dependencies

Imports from: `domain/types`
Imported by: all services, all hooks
