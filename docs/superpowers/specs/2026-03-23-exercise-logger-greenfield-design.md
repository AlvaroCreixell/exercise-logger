# Exercise Logger — Greenfield Redesign Spec

## Overview

Mobile gym workout tracker for Android. Users define workout routines with labeled days (A, B, C...), log sets/reps/weight during workouts, run periodic benchmarks, and view progress on a dashboard. All data stored locally via SQLite. No cloud, no accounts, fully offline.

**This is a greenfield rewrite.** The existing Flet-based codebase is being replaced entirely with Kivy + KivyMD. The existing CLAUDE.md reflects the old design — this spec supersedes it for all architectural and behavioral decisions. Key intentional changes from the old design:
- **Framework**: Flet → Kivy + KivyMD (better mobile UI, more mature ecosystem)
- **Session states**: 3 states (in_progress/finished/abandoned) → 2 states (in_progress/finished) with a `completed_fully` flag. Zero-set "End Early" does not advance the cycle.
- **Session type**: inferred from data → explicit `session_type` column (clearer, simpler queries)
- **Cardio logging**: separate `logged_cardio` table → merged into `logged_sets` with nullable fields (simpler model, one table for all set types)
- **Past log editing**: append-only → editable (standard UX, no reason to restrict in a personal tracker). Stats must always be derived from current data, never cached.
- **Logging schema**: flat `logged_sets` → `session_exercises` + `logged_sets` with FK links back to plan templates for plan-vs-actual comparison
- **Cycle state**: index-based → ID-based (stores `current_routine_day_id` instead of sort index, avoids reorder/delete patching)

## Tech Stack

- **Language:** Python 3.10+
- **UI Framework:** Kivy + KivyMD (Material Design components)
- **Database:** SQLite3 (stdlib, no ORM)
- **Build:** Buildozer → APK
- **Testing:** pytest
- **Target:** Android (primary), desktop (development)
- **Charts:** matplotlib (rendered to canvas via Kivy; well-supported by Buildozer, large ecosystem, familiar API)

**Build toolchain note:** Buildozer requires a Linux environment. On Windows, this means WSL2 or a Docker container. Builds must run from the WSL/Linux filesystem, not the Windows partition (see Buildozer docs). Desktop development and testing runs natively on Windows via Kivy; only the APK build step requires Linux.

## Architecture

Three-layer architecture. Each layer only calls the layer directly below it.

```
Screens (Kivy UI) → Services (business logic) → Repositories (data access) → SQLite
```

- **Screens** (`src/screens/`) — Kivy screens with `.py` + `.kv` files. Never run SQL directly.
- **Services** (`src/services/`) — Business logic. Call repositories, never render UI. Screens always call services, never repos directly — even for simple CRUD. This keeps a consistent call pattern.
- **Repositories** (`src/repositories/`) — Raw SQL queries via `sqlite3`. Return dataclasses. All extend `BaseRepository`.
- **Models** (`src/models/`) — Pure dataclasses, 1:1 with DB tables. No behavior.
- **DB** (`src/db/`) — Connection management and schema definitions.

## Project Structure

```
src/
├── main.py                     # App entry, screen manager setup
├── config.py                   # Constants, DB path, defaults
│
├── models/
│   ├── exercise.py             # Exercise, ExerciseType enum
│   ├── routine.py              # Routine, RoutineDay, RoutineDayExercise, SetTarget
│   ├── workout.py              # WorkoutSession, SessionExercise, LoggedSet, SessionStatus enum
│   ├── benchmark.py            # BenchmarkDefinition, BenchmarkResult, BenchmarkMethod enum
│   └── settings.py             # Setting
│
├── db/
│   ├── connection.py           # Singleton connection manager
│   ├── schema.py               # CREATE TABLE statements, init_db()
│   └── seed.py                 # Dev-only sample data and default benchmark exercises. NOT run in production builds.
│
├── repositories/
│   ├── base.py                 # BaseRepository (_execute, _fetchone, _fetchall, _insert)
│   ├── exercise_repo.py        # Exercise CRUD, archiving
│   ├── routine_repo.py         # Routines + days + day_exercises + set_targets
│   ├── workout_repo.py         # Sessions + session_exercises + logged_sets
│   ├── benchmark_repo.py       # Definitions + results
│   ├── cycle_repo.py           # Cycle state management
│   └── settings_repo.py        # Key-value settings
│
├── services/
│   ├── exercise_service.py     # Exercise CRUD, validation
│   ├── routine_service.py      # Routine management, set scheme logic
│   ├── workout_service.py      # Session lifecycle, set logging, recovery
│   ├── cycle_service.py        # Auto-advance, manual override, cross-routine validation
│   ├── benchmark_service.py    # Due calculations, result recording
│   ├── stats_service.py        # Dashboard queries, PR detection, chart data
│   └── import_export_service.py # JSON import/export, validation
│
├── screens/
│   ├── home/
│   │   ├── home_screen.py
│   │   └── home_screen.kv
│   ├── workout/
│   │   ├── workout_screen.py
│   │   └── workout_screen.kv
│   ├── routine_editor/
│   │   ├── routine_editor_screen.py
│   │   └── routine_editor_screen.kv
│   ├── benchmark/
│   │   ├── benchmark_screen.py
│   │   └── benchmark_screen.kv
│   ├── dashboard/
│   │   ├── dashboard_screen.py
│   │   └── dashboard_screen.kv
│   ├── exercises/
│   │   ├── exercise_catalog_screen.py
│   │   └── exercise_catalog_screen.kv
│   ├── settings/
│   │   ├── settings_screen.py
│   │   └── settings_screen.kv
│   └── components/
│       ├── set_logger.py       # Set logging row (reps/weight steppers)
│       ├── exercise_card.py    # Exercise card with logged sets
│       ├── chart_widgets.py    # Wrapped chart components
│       └── nav_bar.py          # Bottom navigation
│
├── utils/
│   └── unit_conversion.py      # lbs/kg conversion
│
└── assets/                     # Icons, images

tests/
├── conftest.py
├── test_routine_service.py
├── test_workout_service.py
├── test_cycle_service.py
├── test_benchmark_service.py
├── test_stats_service.py
├── test_import_export.py
└── test_exercise_service.py
```

## Data Model

### exercises

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | Auto-increment |
| name | TEXT UNIQUE | |
| type | TEXT | `reps_weight`, `reps_only`, `time`, `cardio` |
| muscle_group | TEXT | Optional label |
| equipment | TEXT | Optional label |
| is_archived | INTEGER | 0/1, soft delete |

### routines

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT | |
| is_active | INTEGER | Only one active at a time (app logic) |
| created_at | TEXT | ISO 8601 |
| updated_at | TEXT | ISO 8601, updated on any plan edit |

### routine_days

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| routine_id | INTEGER FK | → routines |
| label | TEXT | "A", "B", "C"... |
| name | TEXT | "Push", "Pull", "Legs"... |
| sort_order | INTEGER | UNIQUE(routine_id, sort_order) |

### routine_day_exercises

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| routine_day_id | INTEGER FK | → routine_days |
| exercise_id | INTEGER FK | → exercises |
| sort_order | INTEGER | UNIQUE(routine_day_id, sort_order) |
| set_scheme | TEXT | `uniform` or `progressive` (authoritative — controls UI display and default behavior) |
| notes | TEXT | Nullable. Per-exercise plan notes ("use narrow grip", "slow eccentric") |
| is_optional | INTEGER | 0/1. Optional exercises shown with lower visual priority |

### exercise_set_targets

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| routine_day_exercise_id | INTEGER FK | → routine_day_exercises |
| set_number | INTEGER | 1-indexed. UNIQUE(routine_day_exercise_id, set_number) |
| set_kind | TEXT | `reps_weight`, `reps_only`, `duration`, `cardio`, `amrap` |
| target_reps_min | INTEGER | Nullable. For rep ranges like "8-12" |
| target_reps_max | INTEGER | Nullable. Same as min for exact targets (e.g., both = 10) |
| target_weight | REAL | Nullable |
| target_duration_seconds | INTEGER | Nullable (for time/cardio types) |
| target_distance | REAL | Nullable (for cardio — may coexist with duration on same row) |

For **uniform** sets: N rows with identical targets.
For **progressive** sets: N rows with different targets per set. Defaults: set 1 = 12 reps (lighter), set 2 = 8 reps (moderate), set 3 = 4 reps (heavier).

**Rep ranges:** When `target_reps_min` = `target_reps_max`, it's an exact target (e.g., "10 reps"). When they differ, it's a range (e.g., min=8, max=12 means "8-12 reps"). UI displays "8-12" for ranges, "10" for exact.

**AMRAP sets:** `set_kind = 'amrap'` with `target_weight` set for `reps_weight` exercises, or `target_weight` null for `reps_only` exercises (bodyweight AMRAP). Reps left open — user does as many as possible. Common pattern: "3 × 8, then 1 AMRAP" = 3 reps_weight sets + 1 amrap set.

**Cardio sets:** `set_kind = 'cardio'` may carry both `target_duration_seconds` and `target_distance` on the same row (e.g., "20 min, 2.0 km"). Either field can be null if the user only cares about one dimension.

### workout_sessions

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| routine_id | INTEGER FK | Nullable. ON DELETE SET NULL |
| routine_day_id | INTEGER FK | Nullable. ON DELETE SET NULL |
| session_type | TEXT | `routine` or `benchmark` (no standalone ad-hoc sessions — ad-hoc exercises are added within routine sessions) |
| status | TEXT | `in_progress` or `finished` |
| completed_fully | INTEGER | Nullable. NULL while `in_progress`. Set to 1 on Finish, 0 on End Early. |
| day_label_snapshot | TEXT | Nullable. Captures day label at session start (e.g., "A") |
| day_name_snapshot | TEXT | Nullable. Captures day name at session start (e.g., "Push") |
| started_at | TEXT | ISO 8601 |
| finished_at | TEXT | Nullable, ISO 8601 |
| notes | TEXT | Nullable. Session-level notes |

**Snapshots** preserve history: if the user renames "Day A - Push" to "Day A - Chest" next month, past sessions still show what they were called at the time.

**`completed_fully` lifecycle:** NULL while status = `in_progress` (no assumption about how session will end). Set to 1 (Finish) or 0 (End Early) atomically when status transitions to `finished`. Services and queries must treat NULL as "session still active, not yet determined."

### session_exercises

Intermediate table between sessions and logged sets. Tracks which exercises were performed in a session, in what order, and whether they were part of the plan or ad-hoc.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| session_id | INTEGER FK | → workout_sessions |
| exercise_id | INTEGER FK | → exercises |
| routine_day_exercise_id | INTEGER FK | Nullable. ON DELETE SET NULL → routine_day_exercises. Null = ad-hoc exercise |
| sort_order | INTEGER | UNIQUE(session_id, sort_order). Order performed in session |
| exercise_name_snapshot | TEXT | Captures exercise name at log time |
| notes | TEXT | Nullable. Per-exercise session notes ("felt shoulder pain") |

### logged_sets

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| session_exercise_id | INTEGER FK | → session_exercises |
| exercise_set_target_id | INTEGER FK | Nullable. ON DELETE SET NULL → exercise_set_targets. Null = no plan target (ad-hoc or extra set) |
| set_number | INTEGER | UNIQUE(session_exercise_id, set_number) |
| set_kind | TEXT | `reps_weight`, `reps_only`, `duration`, `cardio`, `amrap` |
| reps | INTEGER | Nullable |
| weight | REAL | Nullable |
| duration_seconds | INTEGER | Nullable |
| distance | REAL | Nullable (may coexist with duration for cardio) |
| notes | TEXT | Nullable. Per-set notes ("new PR", "form broke down") |
| logged_at | TEXT | ISO 8601 |

**Plan-vs-actual:** `exercise_set_target_id` links each logged set back to the planned target it was fulfilling. This enables direct plan-vs-actual comparison without fragile joins. Null means the set was ad-hoc (extra set, unplanned exercise).

### routine_cycle_state

| Column | Type | Notes |
|--------|------|-------|
| routine_id | INTEGER PK FK | → routines |
| current_routine_day_id | INTEGER FK | → routine_days. The next day to perform. |

**Why ID instead of index:** Storing the day ID directly means reordering days or deleting other days requires no patching of the cycle state. Advance logic: query the current day's sort_order, find the next day by sort_order, wrap to first if at end. Delete current day: pick the next day by sort_order, or first if none after.

**Service invariant:** `CycleService` must validate that `current_routine_day_id` belongs to the same routine as `routine_id`. SQLite cannot enforce this cross-FK constraint. This validation must be checked on every write to `routine_cycle_state` and covered by tests.

### benchmark_definitions

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| exercise_id | INTEGER FK | → exercises |
| method | TEXT | `max_weight`, `max_reps`, or `timed_hold` |
| reference_weight | REAL | Nullable — for max_reps: the weight tested at |
| frequency_weeks | INTEGER | Default 6. Per-exercise override. |
| muscle_group_label | TEXT | "Upper", "Lower", "Back", "Core" |

### benchmark_results

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| benchmark_definition_id | INTEGER FK | → benchmark_definitions |
| session_id | INTEGER FK | Nullable → workout_sessions |
| method_snapshot | TEXT | Captures method at test time (`max_weight`, `max_reps`, `timed_hold`) |
| reference_weight_snapshot | REAL | Nullable. Captures reference_weight at test time (for max_reps context) |
| result_value | REAL | Weight achieved, reps achieved, or seconds held (polymorphic based on method_snapshot) |
| tested_at | TEXT | ISO 8601 |

**Snapshots** preserve benchmark context: if the user changes a max_reps benchmark from 100 lbs to 120 lbs, old results still record that they were tested at 100 lbs. `method_snapshot` + `reference_weight_snapshot` are set at test time and never updated.

### settings

| Column | Type | Notes |
|--------|------|-------|
| key | TEXT PK | |
| value | TEXT | |

## Ordering and Resequencing Rules

All ordered entities use a `sort_order` or `set_number` column with a UNIQUE constraint on `(parent_id, sort_order)`.

### Invariant

Sort order values within a parent must form a contiguous 0-based sequence (for sort_order) or 1-based sequence (for set_number) with no gaps and no duplicates. The UNIQUE constraint enforces no-duplicates at the DB level; gap-free contiguity is enforced by the service layer.

### Resequencing on delete

When an ordered item is deleted, all siblings with a higher sort_order/set_number are decremented by 1 in a single UPDATE. Example: deleting item at sort_order=2 from [0,1,2,3] → remaining items become [0,1,2].

### Resequencing on insert

New items are appended at `MAX(sort_order) + 1` by default. Insert-at-position shifts all items at or above the target position up by 1.

### Reorder (swap/move)

Reorder operations must update all affected sort_order values in a single transaction to avoid violating the UNIQUE constraint mid-operation. Implementations should use a temporary sentinel value or batch UPDATE with CASE expressions.

### Affected tables

| Table | Ordered column | Parent scope | Sequence start |
|-------|---------------|-------------|----------------|
| routine_days | sort_order | routine_id | 0 |
| routine_day_exercises | sort_order | routine_day_id | 0 |
| exercise_set_targets | set_number | routine_day_exercise_id | 1 |
| session_exercises | sort_order | session_id | 0 |
| logged_sets | set_number | session_exercise_id | 1 |

## Exercise Types and Set Kind Compatibility

### Exercise types

Four exercise types determine what an exercise fundamentally is:

| Type | Logged fields | Example exercises |
|------|--------------|-------------------|
| `reps_weight` | reps, weight | Bench press, squat, cable fly, leg press |
| `reps_only` | reps | Pull-ups, push-ups, dips |
| `time` | duration_seconds | Plank, wall sit, dead hang |
| `cardio` | duration_seconds, distance | Treadmill, bike, rowing |

### Set kinds

Set kinds describe what a specific set within an exercise targets:

| Set kind | Required fields | Optional fields | Compatible exercise types |
|----------|----------------|-----------------|--------------------------|
| `reps_weight` | reps, weight | — | `reps_weight` |
| `reps_only` | reps | — | `reps_only` |
| `duration` | duration_seconds | — | `time` |
| `cardio` | — | duration_seconds, distance (at least one) | `cardio` |
| `amrap` | weight (if reps_weight) | reps (logged after completion) | `reps_weight`, `reps_only` |

**AMRAP** is a set kind, not an exercise type. Any `reps_weight` or `reps_only` exercise can have an AMRAP set — the user does as many reps as possible, at the target weight if applicable. For `reps_only` exercises (pull-ups, push-ups), AMRAP means max reps at bodyweight — `weight` is null.

**Cardio** set kind carries both duration and distance as optional fields. A treadmill target of "20 min, 2.0 km" has both populated. A "just run for 20 minutes" target has only duration.

### Validation rule

Services must enforce that `set_kind` is compatible with the parent exercise's `type` on both plan creation and import. The compatibility matrix above is the authoritative reference. This applies to:
- `exercise_set_targets.set_kind` vs `exercises.type` (via routine_day_exercises.exercise_id)
- `logged_sets.set_kind` vs `exercises.type` (via session_exercises.exercise_id)
- Import validation: each set's `set_kind` must be compatible with its exercise's `type`

## Set Schemes

### Uniform

All sets have the same target. User configures: number of sets, target reps (or range), target weight.

Example: Bench Press — 4 sets × 10 reps @ 135 lbs.
Creates 4 `exercise_set_targets` rows, all with reps_min=10, reps_max=10, weight=135.

Example with range: Lat Pulldown — 3 sets × 8-12 reps @ 100 lbs.
Creates 3 rows with reps_min=8, reps_max=12, weight=100.

### Progressive

Each set has its own target. User configures each set individually, with smart defaults.

Default progression for 3 sets: Set 1 = 12 reps (lighter), Set 2 = 8 reps (moderate), Set 3 = 4 reps (heavier).

Example: Incline DB Press — Set 1: 12×50, Set 2: 8×60, Set 3: 4×70.
Creates 3 `exercise_set_targets` rows with different values.

## Navigation

Four-tab bottom navigation bar:

### Home Tab
- Active routine name and current day
- "Start Workout" button
- Last workout summary (date, day, duration) — excludes zero-set sessions
- Benchmark due alerts
- Persistent banner if in-progress session exists: "Unfinished workout — Resume or End?" (ending marks the session as finished with `completed_fully = false`, cycle advances only if ≥1 set was logged)

### Workout Tab
- **Day Picker**: auto-selects current cycle day, user can override
- **Active Workout Screen**: exercise cards stacked vertically
  - Each card shows exercise name, set scheme, progress (e.g., "3/4")
  - Logged sets shown as green chips (tap to edit/delete)
  - Progressive targets shown as dashed gray chips (upcoming)
  - +/- steppers for reps, weight, seconds — pre-filled from targets or last session
  - **"Repeat Last" button** — copies previous set's values and logs immediately. This is the most common action (most sets are identical to the previous one).
  - "LOG SET" button per exercise (commits immediately to DB)
  - Progressive sets auto-advance steppers to next set's targets after logging
- **Bottom bar**: "+ Add Exercise", "End Early", "Finish Workout"
- **Benchmark Session**: pick exercises, log max weight or max reps or timed hold

### Dashboard Tab
- **Overview**: sessions this week/month (excludes zero-set sessions), total volume trend, recent PRs
- **Exercise Detail** (tap an exercise): weight over time chart, volume over time chart, best sets history, plan-vs-actual comparison
- **Benchmark History**: per-exercise trend chart with max weight, max reps, and timed hold lines

### Settings Tab
- **Routine Editor**: create/edit routines, add/reorder days, add exercises, set uniform/progressive targets
- **Exercise Catalog**: create/archive exercises
- **Benchmark Setup**: configure benchmark exercises, set frequency
- **Import/Export**
- **Weight Unit Toggle** (lbs/kg)

## Behavioral Rules

### Session Lifecycle
- Only ONE `in_progress` session at a time.
- On app launch with in-progress session: show persistent banner on Home screen. Don't block with a modal. Only block if user tries to start a new session.
- Every logged set is committed to DB immediately (crash safety).

### Finishing a Workout
- **Finish Workout**: session marked as finished, `completed_fully = true`, cycle advances.
- **End Early**: session marked as finished, `completed_fully = false`. Cycle advances **only if at least one set was logged.** A zero-set End Early is effectively a cancel — no cycle change, session record saved.

### Zero-Set Session Stat Policy
Zero-set finished sessions (End Early with no logged sets) are **excluded** from:
- Session counts (Home "last workout", Dashboard "sessions this week/month")
- Volume calculations
- PR scans
- "Recent activity" lists

They remain in the database for auditability but are filtered out by `stats_service` queries. The filter is: `SELECT ... WHERE session has at least one logged_set`.

### Editing Workouts
- **Edit any session's sets** — past or present. No append-only restriction.
- Tap a logged set chip → edit reps/weight/duration or delete.
- Can add sets to past sessions (e.g., "forgot to log my last set").
- **Stats are always derived from current data, never cached.** Editing a past set immediately affects all stats and charts that include it.

### Routine Cycling
- Cycle advances on **Finish** and on **End Early with ≥1 set logged.**
- Manual day pick → after finishing, advance from the picked day.
- **Don't reset cycle on routine edits.** Only adjust when:
  - A day is **deleted** and it was the current day → pick next day by sort_order, or first if none after.
  - Adding/removing/reordering exercises, changing targets, reordering days → no cycle change (cycle stores day ID, not index).

### Weight Units
- Single unit across entire app (lbs or kg).
- On toggle: convert ALL historical weights in one transaction.
- Confirmation dialog before converting: "This will convert all X logged weights from lbs to kg. Continue?"

### Benchmarking
- Due = never tested OR `days_since_last >= frequency_weeks * 7`.
- Benchmark sessions are separate from routine sessions (don't advance routine cycle).
- Each benchmark exercise logged individually (not forced to do all at once).
- Default frequency: 6 weeks, configurable per exercise.
- App shows due alerts on Home screen.

### Default Benchmark Exercises

**Upper:** Chest Press, Shoulder Press, Bicep Curl Machine, Cable Tricep Pushdown.
**Lower:** Leg Extension, Leg Curl, Adductor, Leg Press, Calf Raise.
**Back:** Lat Pulldown, Seated Row.
**Core:** Plank (timed_hold), Cable/Machine Crunch (reps+weight).

Three benchmark methods per exercise:
- `max_weight` — max weight at 3-4 reps
- `max_reps` — max reps at a fixed reference weight
- `timed_hold` — max duration (for time-based exercises like plank, dead hang)

## Import/Export

### Export
- **Full backup**: everything (routines, logs, benchmarks, settings). JSON file. For phone migration / data safety.
- **Routine only**: just the plan structure (routine, days, exercises, set targets). JSON file. For sharing.

### Import
- **Full restore**: from backup file. Replaces all data by replacing the entire DB file (not row-by-row mutation). This is compatible with "sessions are never deleted" because restore is a wholesale replacement, not a selective delete. Confirmation required: "This will replace all existing data."
- **Routine import**: adds a new routine from JSON file. Doesn't touch existing data. This is the path for GPT-generated workout plans.

### Import JSON Format (Routine)

```json
{
  "schema_version": 1,
  "name": "PPL Program",
  "days": [
    {
      "label": "A",
      "name": "Push",
      "exercises": [
        {
          "name": "Bench Press",
          "type": "reps_weight",
          "set_scheme": "uniform",
          "notes": null,
          "is_optional": false,
          "sets": [
            {
              "set_kind": "reps_weight",
              "reps_min": 10,
              "reps_max": 10,
              "weight": 135
            },
            {
              "set_kind": "reps_weight",
              "reps_min": 10,
              "reps_max": 10,
              "weight": 135
            }
          ]
        },
        {
          "name": "Incline DB Press",
          "type": "reps_weight",
          "set_scheme": "progressive",
          "notes": "slow eccentric",
          "is_optional": false,
          "sets": [
            {
              "set_kind": "reps_weight",
              "reps_min": 12,
              "reps_max": 12,
              "weight": 50
            },
            {
              "set_kind": "reps_weight",
              "reps_min": 8,
              "reps_max": 8,
              "weight": 60
            },
            {
              "set_kind": "amrap",
              "reps_min": null,
              "reps_max": null,
              "weight": 70
            }
          ]
        }
      ]
    }
  ],
  "benchmarking": {
    "enabled": true,
    "frequency_weeks": 6,
    "items": [
      {
        "exercise_name": "Bench Press",
        "method": "max_weight",
        "reference_weight": null,
        "muscle_group_label": "Upper",
        "frequency_weeks": null
      },
      {
        "exercise_name": "Plank",
        "method": "timed_hold",
        "reference_weight": null,
        "muscle_group_label": "Core",
        "frequency_weeks": 8
      }
    ]
  }
}
```

**`schema_version`** is required. The app rejects files with unsupported versions. This enables format evolution without breaking existing importers.

**`benchmarking`** block is optional. If present and `enabled = true`, the import creates benchmark definitions alongside the routine.

**`benchmarking.frequency_weeks`** is the default for all items. Each item may override with its own `frequency_weeks` (null = use the top-level default).

### Import Validation Rules

The importer validates:
- File is valid JSON
- `schema_version` is present and supported (currently: 1)
- At least one day exists
- Day labels are unique after normalization
- Each exercise has a `name` and at least one set
- Each set has a valid `set_kind`
- Each set's `set_kind` is compatible with its exercise's `type` (see compatibility matrix in Exercise Types section)
- Numeric fields are in sane ranges (reps 1-999, weight 0-9999, duration 1-86400). Reps may be null for AMRAP sets. Cardio sets require at least one of duration/distance.
- Benchmark items reference exercise names that exist in the plan's exercises or the local catalog

### Import Exercise Matching

When the file references exercises that don't exist locally:
1. **Exact name match** — use the existing exercise
2. **Case-insensitive normalized match** — use the existing exercise
3. **No match** — show in the import preview. User can:
   - Create as new exercise (with type from the file)
   - Map to an existing exercise
   - Cancel import

### Import Preview

Before importing, the app shows:
- Plan name and day count
- Exercises per day
- Benchmark settings (if present)
- Warnings (unknown exercises, unsupported fields ignored)
- User chooses: "Import as draft" or "Import and activate"

Imported plans never silently overwrite the active plan.

## Database Constraints

### UNIQUE constraints

| Table | Constraint |
|-------|-----------|
| exercises | UNIQUE(name) |
| routine_days | UNIQUE(routine_id, sort_order) |
| routine_days | UNIQUE(routine_id, label) |
| routine_day_exercises | UNIQUE(routine_day_id, sort_order) |
| exercise_set_targets | UNIQUE(routine_day_exercise_id, set_number) |
| session_exercises | UNIQUE(session_id, sort_order) |
| logged_sets | UNIQUE(session_exercise_id, set_number) |

### CHECK constraints

| Table | Constraint |
|-------|-----------|
| exercises | CHECK(type IN ('reps_weight', 'reps_only', 'time', 'cardio')) |
| exercises | CHECK(is_archived IN (0, 1)) |
| routine_day_exercises | CHECK(set_scheme IN ('uniform', 'progressive')) |
| routine_day_exercises | CHECK(is_optional IN (0, 1)) |
| exercise_set_targets | CHECK(set_kind IN ('reps_weight', 'reps_only', 'duration', 'cardio', 'amrap')) |
| exercise_set_targets | CHECK(set_number >= 1) |
| exercise_set_targets | CHECK(target_reps_min IS NULL OR target_reps_min >= 1) |
| exercise_set_targets | CHECK(target_reps_max IS NULL OR target_reps_max >= 1) |
| exercise_set_targets | CHECK(target_reps_min IS NULL OR target_reps_max IS NULL OR target_reps_min <= target_reps_max) |
| exercise_set_targets | CHECK(target_weight IS NULL OR target_weight >= 0) |
| exercise_set_targets | CHECK(target_duration_seconds IS NULL OR target_duration_seconds >= 1) |
| exercise_set_targets | CHECK(target_distance IS NULL OR target_distance > 0) |
| workout_sessions | CHECK(session_type IN ('routine', 'benchmark')) |
| workout_sessions | CHECK((status = 'in_progress' AND completed_fully IS NULL AND finished_at IS NULL) OR (status = 'finished' AND completed_fully IN (0, 1) AND finished_at IS NOT NULL)) |
| logged_sets | CHECK(set_kind IN ('reps_weight', 'reps_only', 'duration', 'cardio', 'amrap')) |
| logged_sets | CHECK(set_number >= 1) |
| logged_sets | CHECK(reps IS NULL OR reps >= 1) |
| logged_sets | CHECK(weight IS NULL OR weight >= 0) |
| logged_sets | CHECK(duration_seconds IS NULL OR duration_seconds >= 1) |
| logged_sets | CHECK(distance IS NULL OR distance > 0) |
| benchmark_definitions | CHECK(method IN ('max_weight', 'max_reps', 'timed_hold')) |
| benchmark_definitions | CHECK(frequency_weeks >= 1) |
| benchmark_results | CHECK(method_snapshot IN ('max_weight', 'max_reps', 'timed_hold')) |

### FK actions

| FK column | Action | Rationale |
|-----------|--------|-----------|
| routine_days.routine_id | CASCADE | Deleting a routine removes its days |
| routine_day_exercises.routine_day_id | CASCADE | Deleting a day removes its exercises |
| exercise_set_targets.routine_day_exercise_id | CASCADE | Deleting a plan exercise removes its targets |
| workout_sessions.routine_id | SET NULL | History survives routine deletion |
| workout_sessions.routine_day_id | SET NULL | History survives day deletion |
| session_exercises.routine_day_exercise_id | SET NULL | History survives plan exercise deletion |
| logged_sets.exercise_set_target_id | SET NULL | History survives target deletion |
| routine_cycle_state.routine_id | CASCADE | Deleting a routine removes its cycle state |
| routine_cycle_state.current_routine_day_id | NO ACTION | CycleService.handle_day_deleted repairs state before delete; DB blocks accidental orphans |

### Service-level invariants (not enforceable by SQLite)

- `routine_cycle_state.current_routine_day_id` must belong to the same routine as `routine_cycle_state.routine_id`. Validated by CycleService on every write. Covered by tests.
- `set_kind` must be compatible with the exercise's `type` per the compatibility matrix. Validated by RoutineService (plan creation), WorkoutService (set logging and editing), and ImportExportService (import).
- Cardio sets (`set_kind = 'cardio'`) must have at least one of `duration_seconds` or `distance` populated. Validated by RoutineService (plan creation), WorkoutService (set logging and editing), and ImportExportService (import). Too complex for a single CHECK constraint due to conditional dependency on set_kind.
- AMRAP sets (`set_kind = 'amrap'`) require `weight` when the parent exercise type is `reps_weight`, and `weight` is null when the parent exercise type is `reps_only`. Validated by RoutineService, WorkoutService, and ImportExportService.
- Only one routine may have `is_active = 1` at a time. Enforced by RoutineService: deactivate current before activating new.

## Database Conventions

- All datetimes stored as ISO 8601 text.
- Weights stored in user's preferred unit (lbs or kg). No per-row unit column.
- Distances stored in km. Display converts to miles if user prefers imperial. No per-row distance unit column.
- Foreign keys enforced: `PRAGMA foreign_keys=ON`.
- WAL mode: `PRAGMA journal_mode=WAL`.
- Parameterized queries (`?` placeholders) always. Never format SQL strings.
- Use Kivy's `App.get_running_app().user_data_dir` for DB path on Android, fallback to local dir on desktop.

## Testing Strategy

- In-memory SQLite (`:memory:`) for all tests.
- Test services and repositories, not screens (UI tested manually on device).
- Focus areas:
  - Cycle logic: ID-based advance, wrap-around, delete current day, cross-routine validation invariant
  - Session lifecycle: Finish, End Early with ≥1 set, End Early with 0 sets (no cycle advance), `completed_fully` NULL → 0/1 transition
  - Set scheme handling: uniform creation, progressive creation with defaults, AMRAP sets
  - Ordering: resequence on delete, insert-at-position, reorder within UNIQUE constraints
  - Import/export: round-trip, schema_version validation, exercise matching cascade, set_kind compatibility, benchmark frequency override, malformed JSON rejection
  - Plan-vs-actual: queries with and without exercise_set_target_id links
  - Edit-after-finish: delete a set from past session, add extra set to past session, edit past session → verify dashboard output changes
  - Routine deletion: ON DELETE SET NULL preserves session data, ON DELETE CASCADE removes plan hierarchy
  - Stats: zero-set sessions excluded from all stat queries
  - Unit conversion: full-DB weight conversion, distance km↔miles display

## Deferred (Not in This Spec)

- LLM integration (handled via external ChatGPT GPT generating import files)
- RPE / heart rate tracking
- Rest timer
- Streak / gamification stats
- Cloud sync
- Bodyweight tracking
- CSV export
- Multiple active routines
- Full plan versioning / immutable snapshots (lightweight snapshots on session rows are sufficient for V1)

---

## Frontend Design Addendum — Minimalist Design Notes

### Design Direction

**Aesthetic:** Industrial minimalism. Dark, dense where it counts, spacious where it breathes. The app is a tool used mid-workout — every pixel earns its place. No decoration, no illustration, no playfulness. Clean data, big touch targets, obvious hierarchy.

**Core principle:** Only two levels of emphasis on any screen — the thing you're doing now (bold/large/primary color) and everything else (smaller/secondary/muted). No intermediate states.

### Color Palette (Dark Theme)

```
Background:        #121212  (pure dark, not gray)
Surface/Cards:     #1E1E1E  (subtle lift from background)
Primary accent:    #4ADE80  (fresh green — logged/success/active states)
Secondary accent:  #60A5FA  (cool blue — targets/info/benchmarks)
Destructive:       #F87171  (red — delete/end early, used sparingly)
Text primary:      #F5F5F5
Text secondary:    #9CA3AF
Dividers/borders:  #2A2A2A  (barely visible separation)
```

**Rationale:** Green as primary accent ties directly to the core action loop — logging a set turns a chip green. This creates a visceral sense of progress as the screen fills with green during a workout. Blue for planned targets creates an immediate plan-vs-actual color language without needing labels. Two accent colors plus red for destructive actions — nothing more.

### Typography Hierarchy

KivyMD uses Roboto by default. Roboto works well for a utility app — just enforce strict hierarchy discipline:

```
Screen titles:       Headline Small, medium weight, text-primary
Section labels:      Title Medium, text-secondary
Exercise names:      Title Small, text-primary, medium weight
Set values:          Body Large, tabular figures (monospaced digits)
Chip text:           Label Medium
Stepper values:      Headline Medium (current reps/weight must be BIG — readable mid-set, one arm holding a dumbbell)
Timestamps/meta:     Body Small, text-secondary
```

### Spacing & Touch Targets

```
Minimum touch target:    48dp (Material guideline, non-negotiable)
Stepper +/- buttons:     56dp diameter (sweaty fingers, mid-set urgency)
Card padding:            16dp horizontal, 12dp vertical
Card gap:                8dp (tight — cards feel like a continuous flow)
Bottom nav height:       56dp
Screen edge padding:     16dp
Bottom sheet radius:     12dp top corners
```

**Rule:** Generous touch targets on interactive elements, tight spacing on informational elements. The contrast between spacious buttons and compact data rows creates visual rhythm.

### Screen-by-Screen Notes

#### Home Screen

**One-glance test:** User unlocks phone between sets and sees: what day is next + start button.

- Active routine name and current day label/name — this is the hero text, large and centered
- "Start Workout" — full-width primary button, green, impossible to miss
- Last workout summary below: single line, muted text ("Mar 21 — Day B Push — 47 min")
- Benchmark due alerts: small amber-tinted cards below, only shown when due. Don't clutter the screen when nothing is due.
- In-progress session banner: top of screen, surface-colored with green left border. "Resume" button primary, "End" button text-only/muted. Non-blocking — user can still navigate to other tabs.

**Empty state (no routine):** Centered single line "No routine yet" in text-secondary + "Create Routine" outlined button below. No illustration, no emoji, no paragraph of explanation.

#### Workout Screen — Active Session

This is the most complex and most-used screen. Density management is critical.

**Accordion pattern for exercise cards:**
- Only the currently-focused exercise card is expanded with steppers and logging controls
- All other cards show a single compact row: exercise name (left) + chip row (right) + progress fraction ("3/4")
- Tapping a collapsed card expands it and collapses the previously active one
- The expanded card has a subtle elevation (shadow) to separate it from the flat collapsed cards

**Expanded exercise card layout (top to bottom):**
1. Exercise name + set scheme label ("Bench Press — Uniform") + progress ("2/4")
2. Chip row: logged sets as green filled chips ("135×10"), upcoming targets as dashed gray outlined chips
3. Stepper row: large `-` / value / `+` for reps and weight (or duration/distance for cardio/time types)
4. Action row: "Repeat Last" button (primary, green, prominent) and "LOG SET" button (outlined)

**"Repeat Last" prominence:** This should be the most visually dominant action on the expanded card. It represents the 80% use case. Consider making it a full-width green button, with LOG SET as a secondary outlined button below or beside it. Alternatively: single-tap on the card logs a repeat, and the stepper UI is a secondary "modify before logging" mode.

**Stepper behavior:**
- The current value (reps/weight) should be the largest text element in the stepper area
- Tapping the number itself opens a keyboard for direct entry (important for large weight values — nobody wants to tap + 30 times to reach 315 lbs)
- Long-press on +/- should auto-repeat with acceleration

**Bottom bar:**
- "+ Add Exercise" — left-aligned, text button or small outlined button
- "End Early" — right side, text-only, text-secondary color (de-emphasized)
- "Finish Workout" — right side, filled green button (primary action)

**Empty state (no exercises on day):** "No exercises planned for Day A" + "Add Exercise" button. Shouldn't normally happen if routine is set up, but handle it.

#### Dashboard Screen

**Overview section (above fold):**
- Sessions this week: large number + "this week" label. Simple.
- Total volume trend: micro sparkline or simple up/down arrow with percentage
- Recent PRs: list of 2-3 recent PRs, each a single line ("Bench Press — 185 lbs × 8 — Mar 20")

**Exercise detail (drill-in on tap):**
- Slide-left transition to detail screen
- Weight-over-time chart (primary)
- Volume-over-time chart (secondary)
- Best sets list
- Plan-vs-actual comparison (if linked to a plan)

**Benchmark history (separate section or tab within dashboard):**
- Grouped by muscle group label
- Per-exercise trend line

**Empty state (no sessions):** "No workouts logged yet" + "Start your first workout" button linking to Workout tab.

#### Settings / Manage Tab

**Recommendation:** Rename this tab to "Manage" — it contains first-class features (routine editing, exercise catalog), not just settings.

**Layout:** Flat list of sections, each a tappable row with icon + label + chevron. No inline expansion, no preview data. Clean, scannable.

```
Sections:
- Routines           (→ routine list → editor)
- Exercise Catalog   (→ exercise list → create/archive)
- Benchmarks         (→ benchmark setup)
- Import / Export    (→ options)
- Units              (→ lbs/kg toggle with conversion confirmation)
```

Each section opens as a full sub-screen (slide-left transition), not an in-page expansion.

### Component Specifications

#### Set Chips

| State | Style | Example |
|-------|-------|---------|
| Logged | Filled, `#4ADE80` bg, `#121212` text | `135×10` |
| Upcoming target | Outlined, dashed border `#9CA3AF`, `#9CA3AF` text | `135×10` |
| AMRAP logged | Filled, `#4ADE80` bg, `#121212` text | `135×AMRAP 12` |
| AMRAP target | Outlined, dashed border `#9CA3AF` | `135×AMRAP` |

- Tapping a logged chip opens a bottom sheet with edit/delete options
- Subtle press animation on tap: scale to 0.95 for 100ms
- Chip height: 32dp, horizontal padding: 12dp

#### Bottom Navigation

- 4 tabs: Home, Workout, Dashboard, Manage
- Icons only, no text labels (4 tabs is few enough to identify by icon alone)
- Active tab: `#4ADE80` icon + thin 2dp top indicator bar
- Inactive tabs: `#9CA3AF` icons
- No filled background on active tab — color change only

#### Dialogs & Sheets

Use bottom sheets exclusively — no centered Material dialogs. Bottom sheets are:
- Thumb-reachable on tall phones
- Native-feeling on Android
- Better for forms (more vertical space)

**Style:**
- 12dp rounded top corners
- Slight backdrop dim (40% black overlay)
- Drag handle: small centered pill, `#9CA3AF`, 4dp × 32dp
- Full-width action buttons pinned to bottom of sheet
- Destructive actions: `#F87171` text or outlined button (never filled red — too aggressive for a utility app)

#### Confirmation Dialogs

For destructive or irreversible actions (delete set, end early, unit conversion, data import):
- Bottom sheet with clear description of what will happen
- Two buttons at bottom: Cancel (text, left) + Confirm (filled, right)
- Destructive confirms use `#F87171` fill

### Transitions & Animation

| Action | Transition | Duration |
|--------|-----------|----------|
| Tab switch | Crossfade or none | 150ms |
| Drill-in (list → detail) | Slide left | 200ms |
| Back (detail → list) | Slide right | 200ms |
| Bottom sheet open | Slide up from bottom | 200ms |
| Bottom sheet close | Slide down | 150ms |
| Card expand/collapse | Height animation | 200ms, ease-out |
| Chip logged (set committed) | Quick scale pulse (1.0 → 1.1 → 1.0) | 150ms |

**Rule:** All transitions under 200ms. Snappy over smooth — this is a gym app, not a meditation app.

### Empty States

Every screen that can be empty gets the same pattern:
- Centered vertically in available space
- Single line of text, `text-secondary`, Body Large
- One action button below (outlined, not filled), if there's a logical next step
- No illustrations, no icons, no multi-paragraph explanations

| Screen | Text | Action |
|--------|------|--------|
| Home (no routine) | "No routine set up" | "Create Routine" |
| Workout (no active routine) | "Set up a routine to start" | "Go to Routines" |
| Workout (day has no exercises) | "No exercises on this day" | "Add Exercise" |
| Dashboard (no sessions) | "No workouts yet" | "Start Workout" |
| Exercise Catalog (empty) | "No exercises created" | "Add Exercise" |
| Benchmark (none configured) | "No benchmarks set up" | "Add Benchmark" |

### Chart Styling (Matplotlib)

Matplotlib must be aggressively de-chromed to feel native in the dark theme. Apply these rcParams globally:

```python
CHART_STYLE = {
    "figure.facecolor": "#1E1E1E",
    "axes.facecolor": "#1E1E1E",
    "axes.edgecolor": "#2A2A2A",
    "axes.labelcolor": "#9CA3AF",
    "axes.grid": True,
    "grid.color": "#2A2A2A",
    "grid.linewidth": 0.5,
    "text.color": "#F5F5F5",
    "xtick.color": "#9CA3AF",
    "ytick.color": "#9CA3AF",
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "lines.linewidth": 2,
    "lines.color": "#4ADE80",
    "figure.autolayout": True,
    "axes.spines.top": False,
    "axes.spines.right": False,
}
```

- Primary data line: `#4ADE80` (green)
- Secondary data line: `#60A5FA` (blue)
- Benchmark reference line: `#9CA3AF` dashed
- No axis borders on top/right (spines off)
- Minimal tick labels — dates abbreviated ("Mar 20"), weights rounded
- No chart titles inside the figure — use Kivy labels above the chart widget instead

For simple metrics (session counts, volume bars), consider drawing directly on Kivy Canvas instead of matplotlib. Reserve matplotlib for trend lines and scatter plots where it adds real value.

### Accessibility Notes

- All interactive elements meet 48dp minimum touch target
- Color is never the sole indicator — chips use fill vs outline in addition to green vs gray
- Text contrast ratios: primary text on `#121212` background = 15.3:1 (exceeds AAA). Secondary text `#9CA3AF` on `#121212` = 7.5:1 (exceeds AA).
- Stepper values are large enough to read without glasses in a dim gym
