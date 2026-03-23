# Exercise Logger — Greenfield Redesign Spec

## Overview

Mobile gym workout tracker for Android. Users define workout routines with labeled days (A, B, C...), log sets/reps/weight during workouts, run periodic benchmarks, and view progress on a dashboard. All data stored locally via SQLite. No cloud, no accounts, fully offline.

**This is a greenfield rewrite.** The existing Flet-based codebase is being replaced entirely with Kivy + KivyMD. The existing CLAUDE.md reflects the old design — this spec supersedes it for all architectural and behavioral decisions. Key intentional changes from the old design:
- **Framework**: Flet → Kivy + KivyMD (better mobile UI, more mature ecosystem)
- **Session states**: 3 states (in_progress/finished/abandoned) → 2 states (in_progress/finished) with a `completed_fully` flag
- **Session type**: inferred from data → explicit `session_type` column (clearer, simpler queries)
- **Cardio logging**: separate `logged_cardio` table → merged into `logged_sets` with nullable fields (simpler model, one table for all set types)
- **Past log editing**: append-only → editable (standard UX, no reason to restrict in a personal tracker)
- **Cycle on End Early**: only on Finish → advances on both Finish and End Early (you showed up, cycle moves)

## Tech Stack

- **Language:** Python 3.10+
- **UI Framework:** Kivy + KivyMD (Material Design components)
- **Database:** SQLite3 (stdlib, no ORM)
- **Build:** Buildozer → APK
- **Testing:** pytest
- **Target:** Android (primary), desktop (development)
- **Charts:** matplotlib or kivy-garden chart widgets

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
│   ├── workout.py              # WorkoutSession, LoggedSet, SessionStatus enum
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
│   ├── workout_repo.py         # Sessions + logged_sets
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
│   └── import_export_service.py # JSON import/export
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

### exercise_set_targets

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| routine_day_exercise_id | INTEGER FK | → routine_day_exercises |
| set_number | INTEGER | 1-indexed |
| target_reps | INTEGER | Nullable (not used for time/cardio) |
| target_weight | REAL | Nullable |
| target_duration_seconds | INTEGER | Nullable (for time/cardio types) |
| target_distance | REAL | Nullable (for cardio) |

For **uniform** sets: N rows with identical targets.
For **progressive** sets: N rows with different targets per set. Defaults: set 1 = 12 reps, set 2 = 8 reps, set 3 = 4 reps (at increasing weight).

### workout_sessions

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| routine_id | INTEGER FK | Nullable (ad-hoc sessions) |
| routine_day_id | INTEGER FK | Nullable |
| session_type | TEXT | `routine` or `benchmark` (no standalone ad-hoc sessions — ad-hoc exercises are added within routine sessions) |
| status | TEXT | `in_progress` or `finished` |
| completed_fully | INTEGER | 0/1 — false if ended early |
| started_at | TEXT | ISO 8601 |
| finished_at | TEXT | Nullable, ISO 8601 |

### logged_sets

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| session_id | INTEGER FK | → workout_sessions |
| exercise_id | INTEGER FK | → exercises |
| set_number | INTEGER | |
| reps | INTEGER | Nullable |
| weight | REAL | Nullable |
| duration_seconds | INTEGER | Nullable |
| distance | REAL | Nullable |
| logged_at | TEXT | ISO 8601 |

### routine_cycle_state

| Column | Type | Notes |
|--------|------|-------|
| routine_id | INTEGER PK FK | → routines |
| current_day_index | INTEGER | 0-indexed into routine_days by sort_order |

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

Four types, each with specific fields tracked per set:

| Type | Logged fields | Example exercises |
|------|--------------|-------------------|
| `reps_weight` | reps, weight | Bench press, squat, cable fly, leg press |
| `reps_only` | reps | Pull-ups, push-ups, dips |
| `time` | duration_seconds | Plank, wall sit, dead hang |
| `cardio` | duration_seconds, distance | Treadmill, bike, rowing |

## Set Schemes

### Uniform

All sets have the same target. User configures: number of sets, target reps, target weight.

Example: Bench Press — 4 sets × 10 reps @ 135 lbs.
Creates 4 `exercise_set_targets` rows, all with reps=10, weight=135.

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
- Persistent banner if in-progress session exists: "Unfinished workout — Resume or End?" (ending marks the session as finished with `completed_fully = false`)

### Workout Tab
- **Day Picker**: auto-selects current cycle day, user can override
- **Active Workout Screen**: exercise cards stacked vertically
  - Each card shows exercise name, set scheme, progress (e.g., "3/4 ✓")
  - Logged sets shown as green chips (tap to edit/delete)
  - Progressive targets shown as dashed gray chips (upcoming)
  - +/- steppers for reps, weight, seconds — pre-filled from targets or last session
  - "LOG SET" button per exercise (commits immediately to DB)
  - Progressive sets auto-advance steppers to next set's targets after logging
- **Bottom bar**: "+ Add Exercise", "End Early", "Finish Workout"
- **Benchmark Session**: pick exercises, log max weight or max reps

### Dashboard Tab
- **Overview**: sessions this week/month, total volume trend, recent PRs
- **Exercise Detail** (tap an exercise): weight over time chart, volume over time chart, best sets history
- **Benchmark History**: per-exercise trend chart with max weight and max reps lines

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
- **End Early**: session marked as finished, `completed_fully = false`, cycle still advances. All logged data preserved.
- No "abandon/discard" concept. Once sets are logged, the data exists. Starting a session by accident and ending early with zero sets is effectively a discard.

### Editing Workouts
- **Edit any session's sets** — past or present. No append-only restriction.
- Tap a logged set chip → edit reps/weight/duration or delete.
- Can add sets to past sessions (e.g., "forgot to log my last set").

### Routine Cycling
- Cycle advances on **Finish** and **End Early** (any completed session).
- Manual day pick → after finishing, advance from the picked day.
- **Don't reset cycle on routine edits.** Only adjust when:
  - A day is **deleted** and it was the current day → clamp to valid range.
  - Days are **reordered** → update index to follow the same logical day.
  - Adding/removing exercises or changing targets → no cycle change.

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
**Core:** Plank (time), Cable/Machine Crunch (reps+weight).

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
          "sets": [
            {"reps": 10, "weight": 135},
            {"reps": 10, "weight": 135},
            {"reps": 10, "weight": 135},
            {"reps": 10, "weight": 135}
          ]
        },
        {
          "name": "Incline DB Press",
          "type": "reps_weight",
          "set_scheme": "progressive",
          "sets": [
            {"reps": 12, "weight": 50},
            {"reps": 8, "weight": 60},
            {"reps": 4, "weight": 70}
          ]
        }
      ]
    }
  ]
}
```

Exercises referenced by name. On import, match existing exercises by name or create new ones.

## Database Conventions

- All datetimes stored as ISO 8601 text.
- Weights stored in user's preferred unit (lbs or kg). No per-row unit column.
- Foreign keys enforced: `PRAGMA foreign_keys=ON`.
- WAL mode: `PRAGMA journal_mode=WAL`.
- Parameterized queries (`?` placeholders) always. Never format SQL strings.
- Use Kivy's `App.get_running_app().user_data_dir` for DB path on Android, fallback to local dir on desktop.

## Testing Strategy

- In-memory SQLite (`:memory:`) for all tests.
- Test services and repositories, not screens (UI tested manually on device).
- Focus areas: cycle logic edge cases, benchmark due-date calculation, session lifecycle, set scheme handling, import/export round-trip, unit conversion.

## Deferred (Not in This Spec)

- LLM integration (handled via external ChatGPT GPT generating import files)
- RPE / heart rate tracking
- Rest timer
- Streak / gamification stats
- Cloud sync
- Bodyweight tracking
- CSV export
- Multiple active routines
