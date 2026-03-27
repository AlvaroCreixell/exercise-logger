# Exercise Logger v2 — Simplified Rewrite

## Overview

Mobile workout logger for Android. Kivy + KivyMD frontend, SQLite backend, fully offline. Clean-break rewrite of v1.

**Core product decision:** Bundled program data (exercises, routines, benchmarks) lives in files and is treated as application code. The SQLite database stores only mutable user data: settings, workout history, and benchmark history. This removes seeding logic, template sync problems, and 4 database tables.

The user's job: pick a routine, log workouts, review progress.

## Tech Stack

- Python 3.10+, Kivy 2.3.1, KivyMD 2.x (pinned commit), SQLite3 (stdlib), pytest
- Buildozer → APK (GitHub Actions CI)
- PyYAML for template loading

## Architecture

```
Screens → Services → Repositories / Registries → SQLite / Bundled Files
```

**Registries** hold validated, immutable bundled data (exercises, routines, benchmarks). Loaded once at startup, read-only at runtime.

**Repositories** own SQLite access for mutable user data (settings, sessions, logged sets, benchmark results). Return dataclasses, use `?` parameterized SQL.

**Services** use constructor injection. Each layer only calls the layer directly below it.

---

## Exercise Types

Three types. v1's `reps_only` is eliminated — all rep-based exercises are `reps_weight`; bodyweight exercises default weight to 0.

| Type | What the user logs per set | Routine defines |
|------|---------------------------|-----------------|
| `reps_weight` | reps + weight (weight defaults 0 for bodyweight) | sets, reps (exact or range), or progressive scheme |
| `time` | duration in seconds | sets, target duration |
| `cardio` | duration + distance (both optional) | sets, target duration and/or distance (both optional) |

Bodyweight exercises (push-ups, pull-ups) are `reps_weight` with weight=0. User CAN enter weight for weighted variations.

Isometric exercises (plank, wall sit) are `time`.

---

## Bundled Data (In-Memory Registries, NOT in SQLite)

Bundled data is immutable at runtime. The app reads it from files at startup and exposes it through in-memory registries. No database tables for exercises, routines, or routine structure.

### Exercise Catalog: `src/data/exercises.csv`

```csv
key,name,type,equipment,muscle_group
barbell_back_squat,Barbell Back Squat,reps_weight,Barbell,Legs
barbell_deadlift,Barbell Deadlift,reps_weight,Barbell,Back / Legs
pull_up,Pull-Up,reps_weight,Bodyweight,Back
push_up,Push-Up,reps_weight,Bodyweight,Chest
plank,Plank,time,Bodyweight,Core
wall_sit,Wall Sit,time,Bodyweight,Legs
running,Running,cardio,None,Cardio
rowing_machine,Rowing Machine,cardio,Rowing Machine,Cardio
2km_rowing,2km Rowing,cardio,Rowing Machine,Cardio
... (truncated — full catalog has ~80 exercises)
```

Rules:
- `key` is a stable identifier used in templates and historical records. Must be unique.
- `name` is user-facing display text.
- `type` must be one of `reps_weight`, `time`, `cardio`.
- Derived from `docs/exercises/gym_exercises_catalog.csv` with type mapping: `Weight` → `reps_weight`, `Bodyweight` → `reps_weight`, `Isometric` → `time`. Cardio exercises added manually.

### Routine Templates: `src/data/routines/*.yaml`

One file per routine template. All templates loaded at startup.

```yaml
key: push_pull_legs
name: Push Pull Legs
description: 3-day split focused on basic compounds and accessories
days:
  - key: push
    label: A
    name: Push
    exercises:
      - exercise_key: barbell_bench_press
        scheme: progressive
        sets: 3
      - exercise_key: dumbbell_shoulder_press
        scheme: uniform
        sets: 4
        reps: 8-12
      - exercise_key: cable_crossover
        sets: 3
        reps: 12-15
        notes: Squeeze at peak contraction
      - exercise_key: plank
        sets: 3
        duration_seconds: 60
      - exercise_key: running
        sets: 1

  - key: pull
    label: B
    name: Pull
    exercises:
      - exercise_key: barbell_deadlift
        scheme: progressive
        sets: 3
      - exercise_key: pull_up
        sets: 4
        reps: 6-10
      - exercise_key: seated_cable_row
        sets: 3
        reps: 8-12
      - exercise_key: 2km_rowing
        sets: 3
        distance_km: 2.0

  - key: legs
    label: C
    name: Legs
    exercises:
      - exercise_key: barbell_back_squat
        scheme: progressive
        sets: 3
      - exercise_key: leg_press
        sets: 4
        reps: 10-15
      - exercise_key: leg_curl
        sets: 3
        reps: 10-12
      - exercise_key: calf_raise_machine
        sets: 4
        reps: 12-15
```

YAML rules:
- `key` required for routine and every day. Must be unique.
- `label` is user-facing, unique within a routine.
- Exercises reference `exercise_key`, never exercise name.
- `sets` required, must be >= 1.
- `scheme` defaults to `uniform` if omitted. Only meaningful for `reps_weight` exercises.
- `reps` can be exact (`8`) or range (`8-12`).
- Progressive exercises: just `sets`, no `reps` (protocol is implicit).
- `duration_seconds` for `time` and `cardio`.
- `distance_km` for `cardio`.
- Both `duration_seconds` and `distance_km` are optional for cardio.
- `notes` optional — coaching cues, read-only in UI.

**Scheme rules by exercise type:**

| Exercise type | Valid schemes | Target fields |
|---------------|--------------|---------------|
| `reps_weight` | `uniform`, `progressive` | `reps` (NULL for progressive) |
| `time` | `uniform` only | `duration_seconds` required |
| `cardio` | `uniform` only | `duration_seconds` and/or `distance_km` (both optional — routine can just say "run") |

**Progressive scheme = open reps.** No per-set rep targets. The user decides reps and weight each set. The app's ⓘ tooltip *suggests* a common protocol (~15 reps light → ~8 reps moderate → 4+ reps heavy), but this is coaching guidance, not enforced logic. Any number of sets is valid. App behavior for progressive: no reps pre-fill from plan, stepper starts from previous set or last session.

**Cardio planned targets are optional.** A routine can prescribe "run" with no distance or duration — the user decides how far/long. The requirement for "at least one metric" applies only to **logged sets** (see Logged Set Invariants), not to planned targets.

### Benchmark Config: `src/data/benchmarks.yaml`

```yaml
frequency_weeks: 6
items:
  - exercise_key: barbell_bench_press
    method: max_weight
  - exercise_key: barbell_back_squat
    method: max_weight
  - exercise_key: barbell_deadlift
    method: max_weight
  - exercise_key: pull_up
    method: max_reps
  - exercise_key: plank
    method: timed_hold
```

Rules:
- `frequency_weeks` is the cadence for all items.
- `method` must be one of `max_weight`, `max_reps`, `timed_hold`.
- Items reference `exercise_key`.
- Same `exercise_key` may appear only once.

---

## Validation Policy for Bundled Data

Invalid bundled data is fatal. The app must not silently downgrade or ignore invalid files.

Loader failures include:
- Malformed CSV or YAML
- Duplicate exercise keys
- Duplicate routine keys or day keys
- Unknown `exercise_key` in routine or benchmark config
- Invalid exercise type or benchmark method
- Missing `duration_seconds` for `time` exercises (required in plan)
- Note: `cardio` targets are optional in plan — no validation error for targetless cardio
- Invalid rep syntax
- `scheme: progressive` on a `time` or `cardio` exercise

Behavior:
- Dev/CI: fail the test run
- Production: show a blocking error screen with the file and validation message

---

## SQLite Data Model

The database stores ONLY mutable user data. Five tables total. No tables for exercises, routines, or routine structure.

### Ordering conventions

- `sort_order` is 0-based (0, 1, 2, ...).
- `set_number` is 1-based (1, 2, 3, ...).
- Both must be contiguous with no gaps within their parent.
- Ad-hoc exercises appended at `MAX(sort_order) + 1`.

### settings

```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

Known keys:
- `active_routine_key` — references a loaded routine template key
- `current_day_key` — references a day key within the active routine
- `weight_unit` — `lb` or `kg`

Replaces the old `routine_cycle_state` table.

### workout_sessions

```sql
CREATE TABLE workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_key_snapshot TEXT NOT NULL,
    routine_name_snapshot TEXT NOT NULL,
    day_key_snapshot TEXT NOT NULL,
    day_label_snapshot TEXT NOT NULL,
    day_name_snapshot TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('in_progress', 'finished')),
    completed_fully INTEGER CHECK(completed_fully IS NULL OR completed_fully IN (0, 1)),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    CHECK(
        (status = 'in_progress' AND completed_fully IS NULL AND finished_at IS NULL)
        OR
        (status = 'finished' AND completed_fully IN (0, 1) AND finished_at IS NOT NULL)
    )
);
```

Full routine/day snapshots. No FK to templates — history is self-contained.

### session_exercises

```sql
CREATE TABLE session_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL CHECK(sort_order >= 0),
    exercise_key_snapshot TEXT NOT NULL,
    exercise_name_snapshot TEXT NOT NULL,
    exercise_type_snapshot TEXT NOT NULL CHECK(exercise_type_snapshot IN ('reps_weight', 'time', 'cardio')),
    source TEXT NOT NULL CHECK(source IN ('planned', 'ad_hoc')),
    scheme_snapshot TEXT CHECK(scheme_snapshot IN ('uniform', 'progressive')),
    planned_sets INTEGER CHECK(planned_sets IS NULL OR planned_sets >= 1),
    target_reps_min INTEGER CHECK(target_reps_min IS NULL OR target_reps_min >= 1),
    target_reps_max INTEGER CHECK(target_reps_max IS NULL OR target_reps_max >= 1),
    target_duration_seconds INTEGER CHECK(target_duration_seconds IS NULL OR target_duration_seconds >= 1),
    target_distance_km REAL CHECK(target_distance_km IS NULL OR target_distance_km > 0),
    plan_notes_snapshot TEXT,
    UNIQUE(session_id, sort_order),
    CHECK(source = 'ad_hoc' OR planned_sets IS NOT NULL),
    CHECK(target_reps_min IS NULL OR target_reps_max IS NULL OR target_reps_min <= target_reps_max),
    CHECK(
        source = 'planned'
        OR (
            source = 'ad_hoc'
            AND planned_sets IS NULL
            AND target_reps_min IS NULL
            AND target_reps_max IS NULL
            AND target_duration_seconds IS NULL
            AND target_distance_km IS NULL
        )
    )
);
```

Complete plan snapshot per exercise. Ad-hoc exercises have NULL targets. `scheme_snapshot` preserves whether the exercise was progressive (affects UI display and pre-fill).

### logged_sets

```sql
CREATE TABLE logged_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL CHECK(set_number >= 1),
    reps INTEGER CHECK(reps IS NULL OR reps >= 1),
    weight REAL CHECK(weight IS NULL OR weight >= 0),
    duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds >= 1),
    distance_km REAL CHECK(distance_km IS NULL OR distance_km > 0),
    logged_at TEXT NOT NULL,
    UNIQUE(session_exercise_id, set_number),
    CHECK(reps IS NOT NULL OR duration_seconds IS NOT NULL OR distance_km IS NOT NULL)
);
```

The CHECK ensures no row has all measurement fields NULL — at least one actual metric must be recorded.

### benchmark_results

Benchmarks are sessionless — no workout_sessions record, no session lifecycle.

```sql
CREATE TABLE benchmark_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_key_snapshot TEXT NOT NULL,
    exercise_name_snapshot TEXT NOT NULL,
    method TEXT NOT NULL CHECK(method IN ('max_weight', 'max_reps', 'timed_hold')),
    result_value REAL NOT NULL CHECK(result_value > 0),
    bodyweight REAL CHECK(bodyweight IS NULL OR bodyweight > 0),
    tested_at TEXT NOT NULL
);
```

Snapshots of exercise key + name so history survives catalog renames.

---

## Logged Set Invariants

SQLite CHECK constraints prevent obviously invalid data. Services enforce type-specific rules:

| Exercise type | Required fields | Notes |
|---------------|----------------|-------|
| `reps_weight` | `reps` AND `weight` | weight=0 valid for bodyweight |
| `time` | `duration_seconds` | |
| `cardio` | `duration_seconds` OR `distance_km` | at least one |

All values must be positive except weight which may be 0.

**Failed set handling:** If a user fails on rep 0 or a hold fails immediately, the set should be deleted rather than logged with 0. The CHECK constraints enforce reps >= 1 and duration >= 1.

---

## Active Routine and Cycle Behavior

### Single active routine

- One active routine at a time, stored as `active_routine_key` in settings.
- Switching routines resets cycle to the first day of the new routine.
- Switching blocked while a workout is in progress.

### Current day tracking

- Stored as `current_day_key` in settings.
- Finishing a workout advances to the next day (by template order), wraps to first at end.
- End Early (with ≥1 set) also advances.
- Cancel (zero sets) does not advance.

### Startup reconciliation

At app startup:
- If `active_routine_key` references a template that no longer exists → clear both active routine and current day.
- If `current_day_key` is missing from the active routine → reset to first day.
- If an in-progress session exists → show resume/end prompt on Home.

---

## Workout Lifecycle

### Start workout

In one transaction:
1. Verify no other in-progress session exists.
2. Read active routine and current day from registries/settings.
3. Create `workout_sessions` row with full routine/day snapshots.
4. Create `session_exercises` rows for every planned exercise with full target snapshots.

The session is a self-contained plan snapshot. Template changes never affect historical sessions.

### Add ad-hoc exercise

During an in-progress workout, user can add any exercise from the catalog.
- Appended at end of `session_exercises` with `source = 'ad_hoc'`.
- No planned targets.
- Participates in stats once sets are logged.

### Edit and delete logged sets

Current-session and finished-session sets may be edited or deleted.
- `set_number` must stay contiguous after a delete.
- Changing a set rewrites the row in place.
- Exercise type cannot change (comes from catalog snapshot).
- If deleting reduces a finished session to zero sets, the session is deleted (same cleanup as Cancel). This prevents orphaned zero-set finished sessions from polluting stats.

### Finish, End Early, Cancel

- **Finish:** status=finished, completed_fully=1, finished_at=now, advance cycle.
- **End Early:** only when ≥1 set exists. status=finished, completed_fully=0, finished_at=now, advance cycle.
- **Cancel:** only when zero sets exist. Delete the empty session. Cycle unchanged.

Every logged set is committed to DB immediately (crash safety).

---

## Benchmark Behavior

Benchmarks are sessionless — no workout lifecycle, no session state machine. A bottom sheet triggered from Home.

### Due calculation

A benchmark item is due when:
- It has no recorded result, OR
- Its latest `tested_at` is older than `frequency_weeks * 7` days.

Home screen alert appears when one or more items are due.

### Result recording

- Each result saved as its own row immediately.
- Bodyweight entered once per benchmark flow, copied to each result.
- Results carry exercise key + name snapshots so history survives catalog changes.

---

## Screens

### Three tabs + settings gear

Bottom navigation: Home (home icon), Workout (dumbbell icon), Dashboard (chart-line icon).

Settings gear in top-right of Home.

### Home Screen

- Active routine name + current day label/name (hero text)
- "Start Workout" button (green, full-width)
- Last workout summary (date, day, duration)
- Benchmark due alert (amber card, tap to start benchmark flow)
- Settings gear → bottom sheet: routine picker, unit toggle

**Settings bottom sheet:**
- Routine picker: list of bundled templates, tap to activate (confirmation if switching mid-cycle)
- Unit toggle: lbs ↔ kg ("This will convert all historical weights. You can convert back later.")

**No routine selected:** Show available templates, selecting one activates it immediately.

**In-progress session:** Show resume/end prompt instead of Start Workout.

### Workout Screen

**Pre-session:**
- Day header + exercise list preview (name + sets × target)
- "Start Workout" button

**Active session:**
- Header: "Day {label} — {name}"
- Exercise cards (accordion — one expanded at a time)
  - Collapsed: name + progress ("2/4") + logged set chips
  - Expanded: chips + steppers + "Repeat Last" / "LOG SET"
  - Progressive exercises: ⓘ tooltip explaining protocol
- Bottom bar: "+ Add Exercise", "End Early" (text), "Finish Workout" (green)
- Tapping logged chip → edit/delete bottom sheet

**Stepper fields by type:**
- `reps_weight`: reps + weight
- `time`: duration
- `cardio`: duration + distance

**Stepper pre-fill:**
1. Planned target values win when they exist (reps from `target_reps_min`, duration, distance).
2. If no planned target (progressive or ad-hoc): use previous set in current exercise.
3. If no previous set: use latest finished-session set for the same exercise key.
4. If no history: start blank. Weight defaults to 0.

**Repeat Last:** Copies previous set values within the current session exercise. Hidden/disabled on first set.

**Benchmark flow (from Home alert):**
- Bottom sheet with bodyweight input at top
- List of due benchmark exercises with method
- Tap → stepper to log result
- Each result saved immediately

### Dashboard Screen

- Session count (this week / this month) — shown even if 0, as long as any historical session exists
- Volume trend chart (4 weeks, bar) — volume = `SUM(weight * reps)` for `reps_weight` only
- Personal bests (top 3, type-appropriate)
- Exercise list → drill-in
- Benchmark history link

**Empty state (zero finished sessions ever):** "No workouts yet" + "Start Workout" button.

**Exercise detail drill-in:**
- Type-appropriate history chart
- Personal best card
- Plan-vs-actual: uses `session_exercises` snapshot fields directly (no template FK needed)

**Benchmark history drill-in:**
- Grouped by exercise
- Trend chart per method
- Bodyweight shown alongside

---

## Stats

All derived live, never cached.

### Session inclusion

- Include: finished sessions with ≥1 logged set
- Exclude: in-progress sessions, canceled sessions (deleted)

### Core queries

- `get_session_count(since)` — finished sessions with ≥1 set
- `get_last_workout_summary()`
- `get_exercise_history(exercise_key)` — type-aware aggregation by session date
- `get_exercise_best_set(exercise_key)` — reps_weight: highest weight (tie-break by reps), time: longest duration, cardio: highest distance (tie-break by shorter duration) or longest duration if no distance
- `get_personal_bests(limit)` — across all types
- `get_total_volume_trend(weeks)` — weekly `SUM(weight * reps)` for reps_weight only
- `get_benchmark_history(exercise_key, method)` — results over time with bodyweight
- `get_benchmark_due_summary()` — which items are due

---

## Weight Units

Single global unit: `lb` or `kg`.

Conversion covers:
- `logged_sets.weight`
- `benchmark_results.result_value` (for `max_weight` method only)
- `benchmark_results.bodyweight`

Toggle: convert all in one transaction. Update `weight_unit` setting only after successful conversion. Repeated toggling is safe (normal floating-point rounding only).

Distance is always km.

---

## UI Components (carried forward from v1)

Battle-tested on Android, reused as-is:
- `AppBottomSheet` — modal bottom sheet
- `ValueStepper` — large +/- touch targets
- `SetChip` — logged (green) or target (gray) indicator
- `ExerciseCard` — accordion with chips, steppers, log/repeat
- `ExercisePicker` — searchable catalog list (read-only, no create/edit)
- `ChartWidget` — Kivy canvas charts (no matplotlib)

## Theme

Dark industrial minimalism:
- Background: #121212, Surface: #1E1E1E
- Primary: #4ADE80 (green), Secondary: #60A5FA (blue)
- Warning: #F59E0B (amber), Destructive: #F87171 (red, text-style only)
- All transitions under 200ms, minimum touch target 48dp

---

## File Structure

```
src/
├── __init__.py
├── config.py
├── main.py
├── theme.py
├── data/
│   ├── exercises.csv
│   ├── benchmarks.yaml
│   └── routines/
│       ├── push_pull_legs.yaml
│       └── upper_lower.yaml
├── db/
│   ├── connection.py
│   └── schema.py
├── loaders/
│   ├── exercise_loader.py
│   ├── routine_loader.py
│   └── benchmark_loader.py
├── models/
│   ├── bundled.py        (Exercise, Routine, RoutineDay, DayExercise, BenchmarkConfig)
│   ├── workout.py        (WorkoutSession, SessionExercise, LoggedSet)
│   └── benchmark.py      (BenchmarkResult)
├── registries/
│   ├── exercise_registry.py
│   ├── routine_registry.py
│   └── benchmark_registry.py
├── repositories/
│   ├── base.py
│   ├── settings_repo.py
│   ├── workout_repo.py
│   └── benchmark_repo.py
├── services/
│   ├── app_state_service.py   (startup reconciliation, active routine)
│   ├── workout_service.py     (session lifecycle, set logging)
│   ├── benchmark_service.py   (due calculation, result recording)
│   ├── stats_service.py       (dashboard queries)
│   └── settings_service.py    (unit toggle, routine activation)
├── screens/
│   ├── base_screen.py
│   ├── components/
│   │   ├── bottom_sheet.py
│   │   ├── chart_widget.py
│   │   ├── exercise_card.py / .kv
│   │   ├── exercise_picker.py
│   │   ├── set_chip.py / .kv
│   │   └── stepper.py / .kv
│   ├── home/
│   │   ├── home_screen.py / .kv
│   │   └── settings_sheet.py
│   ├── workout/
│   │   └── workout_screen.py / .kv
│   └── dashboard/
│       ├── dashboard_screen.py
│       ├── exercise_detail_screen.py
│       └── benchmark_history_screen.py
└── utils/
    └── unit_conversion.py

tests/
├── conftest.py
├── test_db_schema.py
├── test_loaders.py
├── test_workout_service.py
├── test_benchmark_service.py
├── test_stats_service.py
├── test_settings_service.py
└── test_app_state_service.py
```

---

## What's NOT in scope

- Routine editing by user (dev-managed YAML)
- Exercise catalog editing by user (dev-managed CSV)
- Benchmark setup by user (dev-managed YAML)
- Import/export
- Cloud sync, multi-user
- Standalone bodyweight tracking (only during benchmarks)
- Distance unit toggle (always km)
- Rest timer
- Superset/circuit support
- Optional exercises / `is_optional`
- Manual day override (always follows cycle)
- Per-exercise coaching notes UI (notes from YAML, read-only)
