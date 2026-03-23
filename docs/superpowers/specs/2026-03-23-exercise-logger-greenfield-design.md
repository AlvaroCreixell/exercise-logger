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
- **Charts:** matplotlib or kivy-garden chart widgets

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
│   └── seed.py                 # Default benchmark exercises, sample data
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
│   ├── cycle_service.py        # Auto-advance, manual override
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
| sort_order | INTEGER | |

### routine_day_exercises

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| routine_day_id | INTEGER FK | → routine_days |
| exercise_id | INTEGER FK | → exercises |
| sort_order | INTEGER | |
| set_scheme | TEXT | `uniform` or `progressive` (authoritative — controls UI display and default behavior) |
| notes | TEXT | Nullable. Per-exercise plan notes ("use narrow grip", "slow eccentric") |
| is_optional | INTEGER | 0/1. Optional exercises shown with lower visual priority |

### exercise_set_targets

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| routine_day_exercise_id | INTEGER FK | → routine_day_exercises |
| set_number | INTEGER | 1-indexed |
| set_kind | TEXT | `reps_weight`, `reps_only`, `duration`, `distance`, `amrap` |
| target_reps_min | INTEGER | Nullable. For rep ranges like "8-12" |
| target_reps_max | INTEGER | Nullable. Same as min for exact targets (e.g., both = 10) |
| target_weight | REAL | Nullable |
| target_duration_seconds | INTEGER | Nullable (for time/cardio types) |
| target_distance | REAL | Nullable (for cardio) |

For **uniform** sets: N rows with identical targets.
For **progressive** sets: N rows with different targets per set. Defaults: set 1 = 12 reps (lighter), set 2 = 8 reps (moderate), set 3 = 4 reps (heavier).

**Rep ranges:** When `target_reps_min` = `target_reps_max`, it's an exact target (e.g., "10 reps"). When they differ, it's a range (e.g., min=8, max=12 means "8-12 reps"). UI displays "8-12" for ranges, "10" for exact.

**AMRAP sets:** `set_kind = 'amrap'` with `target_weight` set. Reps left open — user does as many as possible. Common pattern: "3 × 8, then 1 AMRAP" = 3 reps_weight sets + 1 amrap set.

### workout_sessions

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| routine_id | INTEGER FK | Nullable |
| routine_day_id | INTEGER FK | Nullable |
| session_type | TEXT | `routine` or `benchmark` (no standalone ad-hoc sessions — ad-hoc exercises are added within routine sessions) |
| status | TEXT | `in_progress` or `finished` |
| completed_fully | INTEGER | 0/1 — false if ended early |
| day_label_snapshot | TEXT | Nullable. Captures day label at session start (e.g., "A") |
| day_name_snapshot | TEXT | Nullable. Captures day name at session start (e.g., "Push") |
| started_at | TEXT | ISO 8601 |
| finished_at | TEXT | Nullable, ISO 8601 |
| notes | TEXT | Nullable. Session-level notes |

**Snapshots** preserve history: if the user renames "Day A - Push" to "Day A - Chest" next month, past sessions still show what they were called at the time.

### session_exercises

Intermediate table between sessions and logged sets. Tracks which exercises were performed in a session, in what order, and whether they were part of the plan or ad-hoc.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| session_id | INTEGER FK | → workout_sessions |
| exercise_id | INTEGER FK | → exercises |
| routine_day_exercise_id | INTEGER FK | Nullable → routine_day_exercises. Null = ad-hoc exercise |
| sort_order | INTEGER | Order performed in session |
| exercise_name_snapshot | TEXT | Captures exercise name at log time |
| notes | TEXT | Nullable. Per-exercise session notes ("felt shoulder pain") |

### logged_sets

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| session_exercise_id | INTEGER FK | → session_exercises |
| exercise_set_target_id | INTEGER FK | Nullable → exercise_set_targets. Null = no plan target (ad-hoc or extra set) |
| set_number | INTEGER | |
| set_kind | TEXT | `reps_weight`, `reps_only`, `duration`, `distance`, `amrap` |
| reps | INTEGER | Nullable |
| weight | REAL | Nullable |
| duration_seconds | INTEGER | Nullable |
| distance | REAL | Nullable |
| notes | TEXT | Nullable. Per-set notes ("new PR", "form broke down") |
| logged_at | TEXT | ISO 8601 |

**Plan-vs-actual:** `exercise_set_target_id` links each logged set back to the planned target it was fulfilling. This enables direct plan-vs-actual comparison without fragile joins. Null means the set was ad-hoc (extra set, unplanned exercise).

### routine_cycle_state

| Column | Type | Notes |
|--------|------|-------|
| routine_id | INTEGER PK FK | → routines |
| current_routine_day_id | INTEGER FK | → routine_days. The next day to perform. |

**Why ID instead of index:** Storing the day ID directly means reordering days or deleting other days requires no patching of the cycle state. Advance logic: query the current day's sort_order, find the next day by sort_order, wrap to first if at end. Delete current day: pick the next day by sort_order, or first if none after.

### benchmark_definitions

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| exercise_id | INTEGER FK | → exercises |
| method | TEXT | `max_weight`, `max_reps`, or `timed_hold` |
| reference_weight | REAL | Nullable — for max_reps: the weight tested at |
| frequency_weeks | INTEGER | Default 6 |
| muscle_group_label | TEXT | "Upper", "Lower", "Back", "Core" |

### benchmark_results

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| benchmark_definition_id | INTEGER FK | → benchmark_definitions |
| session_id | INTEGER FK | Nullable → workout_sessions |
| result_value | REAL | Weight achieved, reps achieved, or seconds held (polymorphic based on method) |
| tested_at | TEXT | ISO 8601 |

### settings

| Column | Type | Notes |
|--------|------|-------|
| key | TEXT PK | |
| value | TEXT | |

## Exercise Types

Four exercise types, plus AMRAP as a set-level modifier:

| Type | Logged fields | Example exercises |
|------|--------------|-------------------|
| `reps_weight` | reps, weight | Bench press, squat, cable fly, leg press |
| `reps_only` | reps | Pull-ups, push-ups, dips |
| `time` | duration_seconds | Plank, wall sit, dead hang |
| `cardio` | duration_seconds, distance | Treadmill, bike, rowing |

**AMRAP** is a set kind, not an exercise type. Any `reps_weight` or `reps_only` exercise can have an AMRAP set — the user does as many reps as possible at the target weight.

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
- Last workout summary (date, day, duration)
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
- **Overview**: sessions this week/month, total volume trend, recent PRs
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
- **End Early**: session marked as finished, `completed_fully = false`. Cycle advances **only if at least one set was logged.** A zero-set End Early is effectively a cancel — no cycle change, but the session record exists (can be ignored in stats).

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
- **Full restore**: from backup file. Replaces all data. Confirmation required: "This will replace all existing data."
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
        "muscle_group_label": "Upper"
      },
      {
        "exercise_name": "Plank",
        "method": "timed_hold",
        "reference_weight": null,
        "muscle_group_label": "Core"
      }
    ]
  }
}
```

**`schema_version`** is required. The app rejects files with unsupported versions. This enables format evolution without breaking existing importers.

**`benchmarking`** block is optional. If present and `enabled = true`, the import creates benchmark definitions alongside the routine.

### Import Validation Rules

The importer validates:
- File is valid JSON
- `schema_version` is present and supported (currently: 1)
- At least one day exists
- Day labels are unique after normalization
- Each exercise has a `name` and at least one set
- Each set has a valid `set_kind`
- Numeric fields are in sane ranges (reps 1-999, weight 0-9999, duration 1-86400). Reps may be null for AMRAP sets.
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

## Database Conventions

- All datetimes stored as ISO 8601 text.
- Weights stored in user's preferred unit (lbs or kg). No per-row unit column.
- Distances stored in km. Display converts to miles if user prefers imperial. No per-row distance unit column.
- Foreign keys enforced: `PRAGMA foreign_keys=ON`.
- WAL mode: `PRAGMA journal_mode=WAL`.
- Parameterized queries (`?` placeholders) always. Never format SQL strings.
- Default FK behavior: `ON DELETE RESTRICT`. Specific overrides:
  - Exercises use soft-delete (`is_archived`), never hard-deleted.
  - Sessions are never deleted.
  - Routines cascade to days/exercises/targets on delete (`ON DELETE CASCADE` on `routine_days.routine_id`, `routine_day_exercises.routine_day_id`, `exercise_set_targets.routine_day_exercise_id`).
  - Session FKs that reference plan rows use `ON DELETE SET NULL` so workout history survives routine deletion: `workout_sessions.routine_id`, `workout_sessions.routine_day_id`, `session_exercises.routine_day_exercise_id`, `logged_sets.exercise_set_target_id`.
- Use Kivy's `App.get_running_app().user_data_dir` for DB path on Android, fallback to local dir on desktop.

## Testing Strategy

- In-memory SQLite (`:memory:`) for all tests.
- Test services and repositories, not screens (UI tested manually on device).
- Focus areas: cycle logic edge cases (especially ID-based advance/delete), benchmark due-date calculation, session lifecycle (End Early with 0 sets vs ≥1 set), set scheme handling, import/export round-trip with validation, plan-vs-actual queries, unit conversion.

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
