# Gym Routine Tracker - Tightened Design Spec

Status: Draft for implementation planning
Last updated: 2026-03-29

This document supersedes the earlier loose draft. It is the working source of truth for implementation plans.

## 1. Product Goal

A local-first Progressive Web App for logging gym workouts quickly, reliably, and offline.

Primary use case:
- one user
- phone-first
- used during real workouts with minimal friction

The app must optimize for:
- fast set logging
- clear routine guidance
- trustworthy history and suggestions
- no server dependency

## 2. Repo and Delivery Assumptions

- v2 is a new web app, not an in-place evolution of the legacy Python/Kivy app.
- Implement the web app in a new top-level `web/` directory so the legacy app can remain untouched during migration.
- The legacy Python/Kivy code is out of scope for v1 except for coexistence in the repo.
- Primary target: installable Android PWA in modern Chromium browsers.
- Secondary target: desktop Chromium, Firefox, and Safari with equivalent core functionality where browser support allows.
- No auth, accounts, cloud sync, or multi-user support in v1.

This is a concrete planning decision. If the repo strategy changes later, plans must be regenerated.

## 3. Scope

### In scope for v1

- Seed the exercise catalog from CSV
- Import routine templates from YAML
- Load multiple routines and select one active routine
- Preserve rotation state per routine
- Start, resume, discard, and finish workout sessions
- Log, edit, and delete sets
- Add off-routine exercises during an active session
- Show per-exercise history and session history
- Run a non-blocking rest timer
- Export and import all user data as JSON
- Work offline after initial load

### Out of scope for v1

- Routine editing inside the app
- Cloud backup or sync
- WearOS or watch companion
- Charts, PR dashboards, or volume analytics
- Plate calculator
- Social sharing
- Coach collaboration
- Multi-device conflict resolution
- Fuzzy exercise-name matching at runtime

## 4. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React + Vite + TypeScript | Greenfield v2 web app |
| UI | shadcn/ui + Tailwind CSS | Accessible components with local ownership |
| Persisted data | Dexie.js over IndexedDB | Local-first source of truth |
| Ephemeral UI state | Zustand | Timer, modal state, filters, draft inputs |
| PWA | vite-plugin-pwa | Installability and offline shell |
| Testing | Vitest + React Testing Library + Playwright | Unit, integration, and critical-flow smoke tests |
| Deployment | GitHub Pages | Static hosting |

## 5. Architecture Decisions

- Dexie is the persisted source of truth.
- Zustand must only hold ephemeral UI state. It must not become a second database.
- All timestamps are stored as ISO 8601 UTC strings, not `Date` objects.
- All weights are stored canonically in kilograms in persisted records.
- History and progression read from finished sessions only.
- Session structure is snapshotted at session start so later routine deletion does not break history.
- The app supports at most one active session at a time.
- Rotation advances when a session is finished, not when it is started.
- Rotation state is per routine, not global.

The finish-time rotation decision is intentional. It avoids corrupted state when a workout is started and later abandoned.

## 6. Domain Invariants

These are non-negotiable unless the spec is updated.

1. There can be zero or one active session. Never more than one.
2. If an active session exists, Today must prioritize `Resume Workout` over showing a new suggested day.
3. The active routine's `nextDayId` is updated only when a session is finished.
4. Discarding an active session must not advance rotation.
5. Every finished session must remain renderable even if the source routine is later deleted.
6. Extra exercises may be added only to an active session.
7. Extra exercise logs never drive automatic routine progression suggestions.
8. Automated progression is calculated per set block, not per exercise as a whole.
9. A set log edits an existing slot if that slot already exists. It does not create duplicates for the same session exercise, block, and set index.
10. Supersets in v1 always contain exactly two exercises and both sides must have the same total number of working sets.
11. Muscle-group filtering must support exercises that belong to more than one group.
12. Export and import must be versioned and transactional: either the full import succeeds or nothing is changed.
13. Routine activation and deletion are blocked while an active session exists.

## 7. Data Model

### Overview

Use six Dexie tables:

1. `exercises`
2. `routines`
3. `sessions`
4. `sessionExercises`
5. `loggedSets`
6. `settings`

### `exercises`

Seeded from `docs/exercises/gym_exercises_catalog.csv`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Canonical slug, example `barbell-back-squat` |
| `name` | string | Display name |
| `type` | enum | `weight`, `bodyweight`, `isometric`, `cardio` |
| `equipment` | enum | `barbell`, `dumbbell`, `machine`, `cable`, `kettlebell`, `bodyweight`, `cardio`, `medicine-ball`, `other` |
| `muscleGroups` | string[] | Normalized from CSV, split on `/` and trimmed |

Notes:
- `muscleGroups` replaces the looser single `muscleGroup` field from the earlier draft.
- The catalog is authoritative for exercise existence and default type/equipment metadata.

### `routines`

Imported from YAML and stored in normalized form.

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `schemaVersion` | number | Start at `1` |
| `name` | string | Display name |
| `restDefaultSec` | number | Normal set rest |
| `restSupersetSec` | number | Superset round rest |
| `dayOrder` | string[] | Explicit ordered rotation, example `["A", "B", "C"]` |
| `nextDayId` | string | Per-routine rotation state, initialized to the first day in `dayOrder` |
| `days` | `Record<string, RoutineDay>` | Normalized routine payload |
| `notes` | string[] | Optional routine-level notes |
| `cardio` | object or null | Optional informational cardio section |
| `importedAt` | string | ISO UTC timestamp |

`RoutineDay`:
- `id: string`
- `label: string`
- `entries: RoutineEntry[]`

`RoutineEntry` is normalized to one of:
- `kind: "exercise"`
  - `entryId: string`
  - `exerciseId: string`
  - `instanceLabel?: string`
  - `typeOverride?: ExerciseType`
  - `equipmentOverride?: ExerciseEquipment`
  - `notes?: string`
  - `setBlocks: SetBlock[]`
- `kind: "superset"`
  - `groupId: string`
  - `items: [RoutineExerciseEntry, RoutineExerciseEntry]`

`RoutineExerciseEntry`:
- `entryId: string`
- `exerciseId: string`
- `instanceLabel?: string`
- `typeOverride?: ExerciseType`
- `equipmentOverride?: ExerciseEquipment`
- `notes?: string`
- `setBlocks: SetBlock[]`

`ExerciseType`:
- `weight`
- `bodyweight`
- `isometric`
- `cardio`

`ExerciseEquipment`:
- `barbell`
- `dumbbell`
- `machine`
- `cable`
- `kettlebell`
- `bodyweight`
- `cardio`
- `medicine-ball`
- `other`

`SetBlock`:
- `targetKind: "reps" | "duration" | "distance"`
- `minValue?: number`
- `maxValue?: number`
- `exactValue?: number`
- `count: number`
- `tag?: "top" | "amrap"`

Rules:
- Exactly one of `reps`, `duration`, or `distance` is allowed in the authoring YAML per set block.
- `entryId` and `groupId` are generated deterministically at import time from day order and entry position.
- Imported routines are content-immutable in v1. The only mutable field on a routine record is `nextDayId`.

### `sessions`

One record per workout attempt.

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `routineId` | string or null | Original source routine |
| `routineNameSnapshot` | string | Copied at session start |
| `dayId` | string | Selected day, example `A` |
| `dayLabelSnapshot` | string | Copied at session start |
| `dayOrderSnapshot` | string[] | Copied at session start for rotation advancement |
| `restDefaultSecSnapshot` | number | Copied at session start |
| `restSupersetSecSnapshot` | number | Copied at session start |
| `status` | enum | `active`, `finished`, `discarded` |
| `startedAt` | string | ISO UTC timestamp |
| `finishedAt` | string or null | ISO UTC timestamp |

Notes:
- `discarded` sessions may exist briefly during transaction handling but should not be shown in History. The preferred implementation is hard delete on discard. The status enum still exists so code paths stay explicit.
- Only `finished` sessions are valid inputs for history summaries, `last time` display, and progression.

### `sessionExercises`

Immutable session snapshot rows plus runtime extras.

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `sessionId` | string | FK to `sessions` |
| `routineEntryId` | string or null | Null for extras |
| `exerciseId` | string | FK to `exercises` |
| `exerciseNameSnapshot` | string | Copied at creation time |
| `origin` | enum | `routine`, `extra` |
| `orderIndex` | number | Stable display order within the session |
| `groupType` | enum | `single`, `superset` |
| `supersetGroupId` | string or null | Shared by both members of a superset |
| `supersetPosition` | number or null | `0` or `1` for supersets |
| `instanceLabel` | string or null | Optional disambiguator |
| `effectiveType` | ExerciseType | Catalog default or routine override |
| `effectiveEquipment` | ExerciseEquipment | Catalog default or routine override |
| `notesSnapshot` | string or null | Copied from routine entry or user input |
| `setBlocksSnapshot` | `SetBlock[]` | Copied normalized prescription |
| `createdAt` | string | ISO UTC timestamp |

Notes:
- Routine exercises are snapshotted when the session starts.
- Extra exercises are appended during an active session as `origin = "extra"` rows with empty `setBlocksSnapshot`.

### `loggedSets`

One row per logged set slot.

| Field | Type | Notes |
|---|---|---|
| `id` | string | UUID |
| `sessionId` | string | FK to `sessions` |
| `sessionExerciseId` | string | FK to `sessionExercises` |
| `exerciseId` | string | Denormalized for querying |
| `origin` | enum | `routine`, `extra` |
| `blockIndex` | number | Index within `setBlocksSnapshot`; `0` for extras |
| `blockSignature` | string | Normalized signature for progression matching |
| `setIndex` | number | Zero-based within the block |
| `tag` | enum or null | `top`, `amrap`, or null |
| `performedWeightKg` | number or null | External load only |
| `performedReps` | number or null | Null when not applicable |
| `performedDurationSec` | number or null | Null when not applicable |
| `performedDistanceM` | number or null | Null when not applicable |
| `loggedAt` | string | ISO UTC timestamp |
| `updatedAt` | string | ISO UTC timestamp |

Notes:
- Weighted bodyweight movements store added external load in `performedWeightKg`.
- Unweighted bodyweight sets store `performedWeightKg = null`.
- For unilateral movements, reps are logged per side if that is how the routine is written. The app does not multiply or derive totals.

### `settings`

Single-record table.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Always `"user"` |
| `activeRoutineId` | string or null | Null when no routine is active |
| `units` | enum | `kg`, `lbs` |
| `theme` | enum | `light`, `dark`, `system` |

### Indexes

Minimum required indexes:

- `sessions`: `status`
- `sessions`: `[routineId+startedAt]`
- `sessionExercises`: `sessionId`
- `sessionExercises`: `[sessionId+orderIndex]`
- `loggedSets`: `sessionId`
- `loggedSets`: `[sessionExerciseId+blockIndex+setIndex]`
- `loggedSets`: `[exerciseId+loggedAt]`
- `loggedSets`: `[exerciseId+blockSignature+loggedAt]`

## 8. Exercise Catalog Contract

### Source

`docs/exercises/gym_exercises_catalog.csv`

### CSV fields used

- `Name`
- `Type`
- `Equipment`
- `Muscle Group`

### Canonical ID generation

Slugify `Name`.

Example:
- `Barbell Back Squat` -> `barbell-back-squat`

### Required catalog additions

These exercises are referenced by the target routine and must exist before routine import works:

| Name | Type | Equipment | Muscle Group |
|---|---|---|---|
| Pallof Press | Weight | Cable | Core |
| Cable Woodchop | Weight | Cable | Core |
| Medicine Ball Rotational Slam | Weight | Medicine Ball | Core |
| Wrist Roller | Weight | Other | Arms |
| Reverse Lunge | Bodyweight | Bodyweight | Legs |
| Dumbbell Reverse Lunge | Weight | Dumbbell | Legs |
| Single-Leg Romanian Deadlift | Weight | Dumbbell | Legs |
| Dumbbell Pullover | Weight | Dumbbell | Chest |

### Alias handling

The runtime importer does not fuzzy-match names. YAML must use canonical exercise IDs.

Legacy naming differences from `docs/exercises/workout-routine.jsx` are a one-time content-migration problem, not a runtime feature. If needed, maintain a small explicit alias map in the content-migration layer only.

## 9. Routine YAML Contract

### Authoring format

YAML is the import format. The app normalizes it into the `routines` table shape above.

```yaml
version: 1
name: "Full Body 3-Day Rotation"
rest_default_sec: 90
rest_superset_sec: 60
day_order: [A, B, C]

days:
  A:
    label: "Heavy Squat + Horizontal Push/Pull"
    entries:
      - exercise_id: barbell-back-squat
        sets:
          - { reps: [6, 8], count: 1, tag: top }
          - { reps: [8, 12], count: 3 }
        notes: "Warm up with 2 lighter sets"

      - exercise_id: leg-curl
        sets:
          - { reps: [8, 12], count: 2 }
        notes: "Slow eccentric, 2-3 sec"

      - exercise_id: adductor-machine
        sets:
          - { reps: [12, 15], count: 3 }

      - superset:
          - exercise_id: dumbbell-bench-press
            sets:
              - { reps: [8, 12], count: 3 }
          - exercise_id: dumbbell-row
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "Each arm"

      - exercise_id: tricep-pushdown
        sets:
          - { reps: [8, 12], count: 2 }

      - exercise_id: pallof-press
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each side. Slow rotation at full extension"

  B:
    label: "Moderate Hinge + Vertical Push/Pull"
    entries:
      - exercise_id: dumbbell-romanian-deadlift
        sets:
          - { reps: [6, 8], count: 1, tag: top }
          - { reps: [8, 12], count: 2 }
        notes: "Top set first, then back-off work"

      - exercise_id: dumbbell-lunge
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each leg"

      - exercise_id: leg-extension
        sets:
          - { reps: [8, 12], count: 2 }

      - superset:
          - exercise_id: dumbbell-shoulder-press
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "Seated or standing"
          - exercise_id: lat-pulldown
            sets:
              - { reps: [8, 12], count: 3 }

      - exercise_id: dumbbell-curl
        sets:
          - { reps: [8, 12], count: 2 }

      - exercise_id: cable-woodchop
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each side. Alternate angle weekly"

      - exercise_id: wrist-roller
        sets:
          - { duration: [30, 60], count: 2 }
        notes: "One up, one down"

  C:
    label: "Unilateral + Accessories"
    entries:
      - exercise_id: single-leg-romanian-deadlift
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each leg"

      - exercise_id: reverse-lunge
        sets:
          - { reps: [8, 12], count: 3 }
        notes: "Each leg"

      - exercise_id: adductor-machine
        sets:
          - { reps: [12, 15], count: 3 }

      - superset:
          - exercise_id: incline-dumbbell-press
            sets:
              - { reps: [8, 12], count: 3 }
            notes: "30-45 degree incline"
          - exercise_id: seated-cable-row
            sets:
              - { reps: [8, 12], count: 3 }

      - exercise_id: dumbbell-pullover
        sets:
          - { reps: [8, 12], count: 2 }

      - exercise_id: medicine-ball-rotational-slam
        sets:
          - { reps: 8, count: 3 }
        notes: "Each side"

cardio:
  notes: "After lifting, or as a separate session"
  options:
    - { name: "Walk", detail: "20-30 min brisk pace" }
    - { name: "Rowing 2K Sprints", detail: "3 x 2K with 3-4 min rest" }
    - { name: "Mix", detail: "1-2 rowing sprints + 10-15 min walk" }

notes:
  - "Rotation is continuous: A-B-C regardless of training days per week."
  - "Rest after both exercises in a superset round."
  - "Progression is per set block, not a single number for the whole exercise."
```

### Authoring rules

- `version` is required and must be `1` in v1.
- `day_order` is required and defines rotation order explicitly.
- Each `days.<id>` key must exist exactly once and must appear exactly once in `day_order`.
- Each `entries` item must be either:
  - a single exercise with `exercise_id`
  - a `superset` array with exactly 2 exercise items
- Each exercise item must have at least one set block.
- Each set block must define exactly one target:
  - `reps`
  - `duration`
  - `distance`
- Range syntax:
  - `reps: [8, 12]`
  - `duration: [30, 45]`
- Exact syntax:
  - `reps: 8`
  - `distance: 2000`
- `count` must be an integer `>= 1`.
- `tag` may be `top` or `amrap`.
- Exercise items may optionally define:
  - `instance_label`
  - `type_override`
  - `equipment_override`
- Duplicate `exercise_id` values in the same day are allowed only when each duplicate defines a distinct `instance_label`.
- In v1, both members of a superset must have the same total number of working sets after expanding all set blocks.

### Validation on import

Reject the YAML with clear, field-specific errors if any of the following are true:

- unknown `version`
- missing or duplicate day IDs
- `day_order` does not match the declared days exactly
- an `exercise_id` does not exist in the catalog
- a range has `min >= max`
- `count < 1`
- more than one of `reps`, `duration`, or `distance` is set in a block
- a superset does not have exactly 2 items
- a superset pair does not have equal total working set count
- duplicate same-day exercise entries without `instance_label`
- unsupported `type_override` or `equipment_override`

## 10. Session Lifecycle

### No active routine

If no routine is active:
- Today shows an empty state with `Import Routine` and `Set Active Routine`
- Workout shows no active session
- History and Settings still work

### Starting a session

1. If an active session already exists, the app must resume it instead of creating a new one.
2. The user starts from Today using the active routine's suggested `nextDayId` or a manual override.
3. The app creates:
   - one `sessions` row with `status = "active"`
   - one `sessionExercises` row for each routine-entry leaf in display order
4. The session stores snapshots of:
   - routine name
   - day label
   - day order
   - rest values
   - exercise names
   - effective type and equipment
   - notes
   - set blocks
5. The routine's `nextDayId` is not changed yet.

### Day override

If the suggested day is `B` and the user starts `A` instead:
- the session uses `dayId = "A"`
- on finish, the routine's `nextDayId` becomes `B`
- there is no special penalty or override flag needed in v1

### Resume behavior

- App relaunch with an active session must reopen the active session.
- The rest timer is not persisted across reloads. Session data is persisted; timer UI is best-effort only.

### Adding extra exercises

- Available only during an active session
- The picker uses catalog data and muscle-group filters
- Selecting an exercise appends a `sessionExercises` row at the end with `origin = "extra"`
- Extra exercises have no prescribed set blocks
- Extra exercises may still show recent history for convenience, but they never feed routine progression

### Logging a set

A set log is tied to:
- `sessionExerciseId`
- `blockIndex`
- `setIndex`

Rules:
- Logging into an empty slot creates a `loggedSets` row.
- Logging into an already-filled slot updates the existing row in place.
- The input form is prefilled from the best available source:
  - current session value for that slot, if editing
  - otherwise the most recent finished matching block
  - otherwise blank
- For routine exercises, the block prescription determines which fields are shown.
- For extras, show flexible manual input based on `effectiveType`.

### Editing and deleting a set

- The user may edit or delete logged sets from:
  - the active workout screen
  - finished session detail in History
- Editing updates `updatedAt`.
- Deleting removes the row for that slot.
- Editing or deleting never changes the session snapshot structure.
- Editing or deleting does not automatically start or cancel the timer.

### Finishing a session

- The user may finish a session even if some prescribed sets were not logged.
- Finishing sets:
  - `sessions.status = "finished"`
  - `finishedAt = now`
  - the source routine's `nextDayId` advances to the next day after the actual `dayId`, using `dayOrderSnapshot`
- History includes the session immediately after commit.

### Discarding a session

- The user may discard an active session.
- Discarding deletes:
  - the session
  - its `sessionExercises`
  - its `loggedSets`
- Discarding does not modify any routine's `nextDayId`.

## 11. Progression, Suggestions, and History Semantics

### Core rule

Automated progression is evaluated per set block, not per exercise card.

Example:
- `Barbell Back Squat`
  - block 0: `1 x 6-8`, `tag = top`
  - block 1: `3 x 8-12`, normal back-off work

These blocks have separate suggestions and separate history matching.

### Matching strategy

For a routine block, use the most recent finished session that contains:
- the same `exerciseId`
- the same `origin = "routine"`
- the same `blockSignature`

Fallback if no exact block-signature match exists:
- same `exerciseId`
- same `origin = "routine"`
- same `tag`
- same `targetKind`

If no fallback exists, there is no automatic suggestion.

### `blockSignature`

`blockSignature` is a deterministic string derived from:
- target kind
- target min/max or exact value
- block count
- tag

Examples:
- `reps:6-8:count1:tagtop`
- `reps:8-12:count3:tagnormal`
- `duration:30-60:count2:tagnormal`

### Automated progression applies only when all of the following are true

- the block target is a range, not an exact value
- the exercise type is `weight` or a weighted `bodyweight` override
- the most recent matching finished session has all expected sets logged for that block
- all matching sets hit the top of the range

If all are true:
- suggest `lastWeightKg * 1.05`
- round to the nearest practical increment based on effective equipment and current display unit
- store only the final canonical kg value after conversion back from display units if needed

Otherwise:
- suggest the same weight used in the most recent matching finished block

### Practical rounding

| Equipment | kg increment | lbs increment |
|---|---|---|
| Barbell | 2.5 | 5 |
| Dumbbell | 2 | 5 |
| Machine | 5 | 10 |
| Cable | 5 | 10 |
| Kettlebell | 2 | 5 |
| Bodyweight | 2.5 | 5 |
| Medicine Ball | 2 | 5 |
| Other | 2 | 5 |

### Cases with no automated increase

Show history only, without an increase suggestion, for:
- exact-rep blocks like `3 x 8`
- exact-distance blocks like `2000m`
- cardio entries
- extras
- blocks with partial previous completion
- blocks without a reliable previous match

### `Last time` display

The UI should show the most recent finished-session data for the exercise card.

For multi-block exercises, render per block.

Example:
- `Top: 80kg x 7`
- `Back-off: 70kg x 12, 11, 10`

For extras, render the most recent sets for that exercise irrespective of routine position, labeled as manual history if needed.

## 12. Rest Timer

### Source of truth

The timer is UI state only. It is not persisted to Dexie.

### Start behavior

- Single exercise: start or restart the timer after each newly logged set.
- Superset: start or restart the timer only when both members have logged the same round index.
- Logging out of order is allowed. A superset round is complete when both sides have a logged set for that round index.

### Duration

- Single exercise uses `restDefaultSecSnapshot`
- Superset round uses `restSupersetSecSnapshot`

### Controls

- dismiss
- add 30 seconds
- restart from default duration for the current context

### Non-blocking behavior

- The user may continue browsing and logging while the timer is running.
- Logging another qualifying set restarts the timer from the relevant duration.
- Editing or deleting an existing set does not affect the timer automatically.

### Alerts

- Vibrate when the countdown reaches zero if the platform supports it.
- If vibration is unsupported, fail silently.

## 13. Screen Requirements

### Today

When no active session exists:
- show active routine name
- show suggested day from the active routine's `nextDayId`
- show day preview
- allow day override
- show last finished session summary for the active routine
- show cardio notes if present

When an active session exists:
- replace the normal start card with a resume card for the active session
- do not show a second `Start Workout` path

### Workout

When no active session exists:
- show `No active workout. Start one from Today.`

When active:
- render all `sessionExercises` in order
- each exercise card must show:
  - exercise name
  - notes
  - prescribed set blocks, if any
  - per-block last-time data
  - per-block suggestion, when applicable
  - tap targets for each set slot
- supersets render as a visually connected pair
- extras render like normal exercise cards but without prescription blocks
- footer actions:
  - `Add Exercise`
  - `Finish Workout`
  - `Discard Workout`

### History

- list only finished sessions
- show date, day, duration, exercise count, set count
- tapping a session opens session detail
- session detail supports set edit and delete
- tapping an exercise name opens per-exercise history across finished sessions only

### Settings

Sections:
- Routines
- Preferences
- Data

Routines:
- list loaded routines
- highlight active routine
- activate a routine
- import routine YAML
- delete routine with confirmation

Activation rules:
- activating a routine uses that routine's own stored `nextDayId`
- if a newly imported routine has never been used, its initial `nextDayId` is `dayOrder[0]`

Deletion rules:
- if deleting the active routine and other routines remain, prompt the user to confirm and automatically activate the first remaining routine by stable sort order
- if deleting the last remaining routine, allow it and set `activeRoutineId = null`
- routine deletion must not break existing history because sessions use snapshots

Preferences:
- units `kg` / `lbs`
- theme `light` / `dark` / `system`

Data:
- export JSON
- import JSON
- clear all data with double confirmation

## 14. Import and Export

### Backup JSON format

Use a versioned envelope:

```json
{
  "app": "exercise-logger",
  "schemaVersion": 1,
  "exportedAt": "2026-03-29T18:00:00.000Z",
  "data": {
    "routines": [],
    "sessions": [],
    "sessionExercises": [],
    "loggedSets": [],
    "settings": {}
  }
}
```

Notes:
- `exercises` are not exported because they come from the seeded catalog.
- All timestamps in exports are ISO UTC strings.
- Exports include active sessions if one exists at export time.

### Export rules

- Filename: `exercise-logger-backup-YYYY-MM-DD.json`
- Export must include all persisted user data except the catalog.
- Export is allowed even with an active session.

### Import rules

- Import is full overwrite only.
- Import must validate the full payload before mutating IndexedDB.
- Import must fail if:
  - `app` is not `exercise-logger`
  - `schemaVersion` is unsupported
  - required top-level collections are missing
  - a referenced `exerciseId` does not exist in the current catalog
  - more than one imported session is `active`
  - any row fails structural validation
- Import is blocked while a current local active session exists. The user must finish or discard it first.
- A successful import replaces all routines, sessions, sessionExercises, loggedSets, and settings in one transaction.
- If imported data contains one active session, the app must resume it after import.

## 15. Error Handling and Empty States

### User-visible errors

The app must show explicit messages for:
- invalid YAML routine file
- invalid JSON backup file
- unknown exercise IDs
- unsupported schema version
- failed file parsing
- duplicate active-session creation attempt
- missing active routine when trying to start a workout

### Empty states

- no routines loaded
- no active routine
- no history yet
- no exercise history for this exercise
- no previous data for this block suggestion

Do not use generic `Something went wrong` copy when a specific validation error exists.

## 16. Testing and Acceptance Criteria

Plans must cover at least these scenarios:

1. Catalog seed succeeds, including the newly required exercises and expanded equipment enum.
2. Valid routine YAML imports successfully, initializes `nextDayId` to the first day, and normalizes into stored routine records.
3. Invalid routine YAML fails with field-specific messages.
4. Starting a workout creates one active session and a full session snapshot.
5. Relaunching the app during an active session resumes the same session.
6. Day override works: suggested `B`, started `A`, finished `A`, next suggestion becomes `B`.
7. Switching active routines preserves each routine's own `nextDayId`.
8. A multi-block exercise shows separate top-set and back-off history and suggestions.
9. Extra exercises can be added and logged but are excluded from routine progression.
10. Superset timer starts only after both sides of a round are logged.
11. Editing or deleting a set updates history correctly without duplicating slots.
12. Discarding an active session removes its records and does not advance rotation.
13. Finishing a partial workout is allowed and history remains valid.
14. Deleting a routine does not break historical session rendering.
15. Export followed by import round-trips all persisted user data.
16. Import is blocked while a current local active session exists.

## 17. Subagent-Driven Implementation Constraints

This spec is meant to support parallel implementation. Plans should respect these boundaries.

### Shared contracts must land first

Before parallel feature work, define and freeze:
- TypeScript domain types
- Dexie schema
- routine YAML validation schema
- backup JSON schema
- progression helper contracts

No UI worker should invent its own version of these structures.

### Recommended workstream boundaries

These are suggested plan slices, not execution steps:

1. App bootstrap and repo scaffolding
   - create `web/`
   - Vite, React, TypeScript, Tailwind, shadcn, PWA, test stack

2. Domain contracts and storage
   - shared types
   - Dexie tables and indexes
   - repositories and transactional helpers

3. Catalog and routine import
   - CSV loader
   - YAML parser and validator
   - routine normalization

4. Session domain commands
   - start, resume, discard, finish
   - add extra exercise
   - log, edit, delete set
   - rotation advancement

5. Progression and timer logic
   - block matching
   - suggestion engine
   - superset round detection
   - timer state machine

6. UI surfaces
   - Today
   - Workout
   - History
   - Settings

7. Backup and restore
   - export envelope
   - import validation
   - transactional overwrite

8. Test coverage
   - acceptance scenarios
   - smoke flows

### Ownership rule

Each subagent should own a disjoint file or module area. Cross-cutting contract changes must be made in the shared domain layer first, then consumed by feature workers.

### Planning rule

Implementation plans should sequence:
1. contracts and storage
2. import and normalization
3. session domain commands
4. UI
5. backup and restore
6. PWA polish and test hardening

Do not start with screen-by-screen UI work before the session and data contracts are stable.
