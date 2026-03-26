# Exercise Logger v2 — Simplified Rewrite

## Overview

Mobile workout logger for Android. Kivy + KivyMD frontend, SQLite backend, fully offline. Clean-break rewrite of v1, removing all editor/management UI in favor of dev-managed data (CSV exercise catalog, YAML routine templates, YAML benchmark config). The user's job is to pick a routine and log workouts — nothing else.

## Tech Stack

- Python 3.10+, Kivy 2.3.1, KivyMD 2.x (pinned commit), SQLite3 (stdlib), pytest
- Buildozer → APK (GitHub Actions CI)
- PyYAML for template loading

## Architecture

```
Screens → Services → Repositories → SQLite
```

Each layer only calls the layer directly below it. Services use constructor injection. Repos return dataclasses. All models use `dataclasses`. Raw SQL via `sqlite3` with `?` placeholders.

---

## Exercise Types

Three types. v1's `reps_only` type is eliminated — all rep-based exercises are `reps_weight`; bodyweight exercises simply default weight to 0.

| Type | What the user logs per set | Routine defines |
|------|---------------------------|-----------------|
| `reps_weight` | reps + weight (weight defaults to 0 for bodyweight) | sets, reps (exact or range) |
| `time` | duration in seconds | sets, target duration |
| `cardio` | duration + distance (both optional) | sets, target duration and/or distance (both optional) |

Bodyweight exercises (push-ups, pull-ups) are `reps_weight` with weight defaulting to 0. The user CAN enter weight for weighted variations (weighted pull-ups, weighted dips).

Isometric exercises (plank, wall sit) are `time`.

---

## Data Model

### Ordering conventions

- `sort_order` columns are 0-based (0, 1, 2, ...).
- `set_number` columns are 1-based (1, 2, 3, ...).
- Both must form contiguous sequences with no gaps within their parent.
- Ad-hoc exercises appended at `MAX(sort_order) + 1`.

### exercises

Seeded from `src/data/exercises.csv` on first run. Not user-editable. A new simplified CSV is created from the source catalog at `docs/exercises/gym_exercises_catalog.csv`, containing only the 4 columns below. Type mapping from the source: `Weight` → `reps_weight`, `Bodyweight` → `reps_weight`, `Isometric` → `time`. Cardio exercises added manually.

```sql
CREATE TABLE exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK(type IN ('reps_weight', 'time', 'cardio')),
    equipment TEXT,
    muscle_group TEXT
);
```

### routines

Loaded from YAML templates in `src/data/routines/`. User selects which one is active.

```sql
CREATE TABLE routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

`UNIQUE(name)` prevents duplicate routine loads.

### routine_days

```sql
CREATE TABLE routine_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    UNIQUE(routine_id, sort_order),
    UNIQUE(routine_id, label)
);
```

### routine_day_exercises

One row per exercise in a day. Carries all target info directly — no separate set_targets table.

```sql
CREATE TABLE routine_day_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_day_id INTEGER NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    sort_order INTEGER NOT NULL,
    scheme TEXT NOT NULL DEFAULT 'uniform' CHECK(scheme IN ('uniform', 'progressive')),
    num_sets INTEGER NOT NULL DEFAULT 3 CHECK(num_sets >= 1),
    target_reps_min INTEGER CHECK(target_reps_min IS NULL OR target_reps_min >= 1),
    target_reps_max INTEGER CHECK(target_reps_max IS NULL OR target_reps_max >= 1),
    target_duration_seconds INTEGER CHECK(target_duration_seconds IS NULL OR target_duration_seconds >= 1),
    target_distance REAL CHECK(target_distance IS NULL OR target_distance > 0),
    notes TEXT,
    CHECK(target_reps_min IS NULL OR target_reps_max IS NULL OR target_reps_min <= target_reps_max),
    UNIQUE(routine_day_id, sort_order)
);
```

`notes` is optional — used for coaching cues like "slow eccentric" or "use narrow grip". Populated from YAML `notes` field.

**Scheme rules by exercise type:**

| Exercise type | Valid schemes | Target fields used |
|---------------|--------------|-------------------|
| `reps_weight` | `uniform`, `progressive` | `target_reps_min`, `target_reps_max` (NULL for progressive) |
| `time` | `uniform` only | `target_duration_seconds` |
| `cardio` | `uniform` only | `target_duration_seconds` and/or `target_distance` (both optional) |

**Uniform exercises:** `target_reps_min` and `target_reps_max` set (equal for exact, different for range). All sets have the same target.

**Progressive exercises:** `target_reps_min` and `target_reps_max` are NULL. The protocol is implicit: ~15 reps (3 RIR) → ~8 reps (1-2 RIR) → 4+ reps (to failure). An info tooltip (ⓘ) explains this in the UI.

**Time exercises:** `target_duration_seconds` set, reps NULL. Scheme is always `uniform`.

**Cardio exercises:** `target_duration_seconds` and/or `target_distance` set (both optional — routine can just say "run"). `num_sets` can be >1 for intervals (e.g., 3 × 2km rows). Scheme is always `uniform`.

### workout_sessions

Routine sessions only. Benchmarks are sessionless (see benchmark_results below).

```sql
CREATE TABLE workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
    routine_day_id INTEGER REFERENCES routine_days(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    completed_fully INTEGER,
    day_label_snapshot TEXT,
    day_name_snapshot TEXT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    notes TEXT,
    CHECK(
        (status = 'in_progress' AND completed_fully IS NULL AND finished_at IS NULL)
        OR
        (status = 'finished' AND completed_fully IS NOT NULL AND completed_fully IN (0, 1) AND finished_at IS NOT NULL)
    )
);
```

Dropped from v1: `session_type` (no benchmark sessions — benchmarks are sessionless).

Sessions are never deleted (kept for audit). But ON DELETE CASCADE is set on children for referential integrity.

### session_exercises

```sql
CREATE TABLE session_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    routine_day_exercise_id INTEGER REFERENCES routine_day_exercises(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL,
    exercise_name_snapshot TEXT NOT NULL,
    notes TEXT,
    UNIQUE(session_id, sort_order)
);
```

`routine_day_exercise_id = NULL` means ad-hoc (user added exercise not in the plan).

### logged_sets

```sql
CREATE TABLE logged_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL CHECK(set_number >= 1),
    reps INTEGER CHECK(reps IS NULL OR reps >= 1),
    weight REAL CHECK(weight IS NULL OR weight >= 0),
    duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds >= 1),
    distance REAL CHECK(distance IS NULL OR distance > 0),
    notes TEXT,
    logged_at TEXT NOT NULL,
    UNIQUE(session_exercise_id, set_number)
);
```

Dropped from v1: `set_kind`, `exercise_set_target_id`. The exercise type (from the exercises table) determines which fields are relevant. Plan-vs-actual comparison joins through `session_exercises.routine_day_exercise_id` → `routine_day_exercises`.

**Failed set handling:** If a user fails on rep 0 or a timed hold fails immediately, the set should be deleted rather than logged with 0. The CHECK constraints enforce reps >= 1 and duration >= 1.

### benchmark_results

Benchmarks are **sessionless** — no formal session lifecycle, no `workout_sessions` record. The UI flow is a bottom sheet triggered from the Home screen, not a full session.

```sql
CREATE TABLE benchmark_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    method TEXT NOT NULL CHECK(method IN ('max_weight', 'max_reps', 'timed_hold')),
    result_value REAL NOT NULL,
    bodyweight REAL,
    tested_at TEXT NOT NULL
);
```

`bodyweight` is the user's bodyweight at the time of the benchmark (entered once per benchmark flow, stored on each result row for simplicity).

### routine_cycle_state

```sql
CREATE TABLE routine_cycle_state (
    routine_id INTEGER PRIMARY KEY REFERENCES routines(id) ON DELETE CASCADE,
    current_routine_day_id INTEGER NOT NULL REFERENCES routine_days(id)
);
```

### settings

```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## Dev-Managed Data Files

### Exercise Catalog: `src/data/exercises.csv`

A new simplified CSV with 4 columns, derived from `docs/exercises/gym_exercises_catalog.csv`:

```csv
Name,Type,Equipment,Muscle Group
Barbell Back Squat,reps_weight,Barbell,Legs
Barbell Deadlift,reps_weight,Barbell,Back / Legs
Pull-Up,reps_weight,Bodyweight,Back
Push-Up,reps_weight,Bodyweight,Chest
Plank,time,Bodyweight,Core
Wall Sit,time,Bodyweight,Legs
Running,cardio,None,Cardio
Rowing Machine,cardio,Rowing Machine,Cardio
2km Rowing,cardio,Rowing Machine,Cardio
...
```

The `Type` column uses DB enum values directly. Source type mapping: `Weight` → `reps_weight`, `Bodyweight` → `reps_weight`, `Isometric` → `time`. Cardio exercises added manually.

Seeded on first app launch. If an exercise already exists (by name, case-insensitive), it is skipped. This makes re-seeding safe.

### Routine Templates: `src/data/routines/*.yaml`

One file per routine template. All templates loaded on first run. User picks which to activate.

```yaml
name: Push Pull Legs
description: 3-day split focusing on push, pull, and leg movements
days:
  - label: A
    name: Push
    exercises:
      - name: Barbell Bench Press
        scheme: progressive
        sets: 3
      - name: Dumbbell Shoulder Press
        scheme: uniform
        sets: 4
        reps: 8-12
      - name: Cable Crossover
        scheme: uniform
        sets: 3
        reps: 12-15
        notes: Squeeze at peak contraction
      - name: Plank
        sets: 3
        duration: 60
      - name: Running
        sets: 1

  - label: B
    name: Pull
    exercises:
      - name: Barbell Deadlift
        scheme: progressive
        sets: 3
      - name: Pull-Up
        scheme: uniform
        sets: 4
        reps: 6-10
      - name: Seated Cable Row
        scheme: uniform
        sets: 3
        reps: 8-12
      - name: 2km Rowing
        sets: 3
        distance: 2.0

  - label: C
    name: Legs
    exercises:
      - name: Barbell Back Squat
        scheme: progressive
        sets: 3
      - name: Leg Press
        scheme: uniform
        sets: 4
        reps: 10-15
      - name: Leg Curl
        scheme: uniform
        sets: 3
        reps: 10-12
      - name: Calf Raise Machine
        scheme: uniform
        sets: 4
        reps: 12-15
```

**YAML rules:**
- `scheme` defaults to `uniform` if omitted. Only valid for `reps_weight` exercises — `time` and `cardio` exercises ignore this field (always uniform).
- `reps` can be exact (`8`) or range (`8-12`), parsed to `target_reps_min`/`target_reps_max`.
- Progressive exercises: just `sets`, no `reps` (NULL in DB).
- `duration` in seconds (for `time` and `cardio`).
- `distance` in km (for `cardio`).
- Both `duration` and `distance` are optional for cardio (routine can just say "run").
- `notes` optional — coaching cues stored on `routine_day_exercises.notes`.
- Exercise names must match the seeded catalog (case-insensitive).

**YAML validation rules (template_loader enforces):**
- Name mismatch (exercise not in catalog) → fatal load error, routine not loaded.
- `reps` on a `time` or `cardio` exercise → warning, ignored.
- `duration` on a `reps_weight` exercise → warning, ignored.
- `distance` on a non-`cardio` exercise → warning, ignored.
- `scheme: progressive` on a `time` or `cardio` exercise → warning, treated as uniform.
- Duplicate routine `name` across YAML files → second file skipped with warning.

### Benchmark Config: `src/data/benchmarks.yaml`

```yaml
frequency_weeks: 6
exercises:
  - name: Barbell Bench Press
    method: max_weight
  - name: Barbell Back Squat
    method: max_weight
  - name: Barbell Deadlift
    method: max_weight
  - name: Pull-Up
    method: max_reps
  - name: Plank
    method: timed_hold
```

Loaded at app init. Benchmark is due when: no results exist for any listed exercise, OR the most recent `tested_at` across all results is older than `frequency_weeks * 7` days. The Home screen alert shows when any exercise is overdue.

---

## Screens

### Three tabs + settings gear

Bottom navigation: Home (home icon), Workout (dumbbell icon), Dashboard (chart-line icon). No Manage tab.

### Home Screen

- Active routine name + current day label/name (hero text, centered)
- "Start Workout" button (green, full-width)
- Last workout summary (date, day, duration — single line, muted)
- Benchmark due alert (amber card, shown when due): "Benchmark due — tap to start"
- Settings gear icon (top-right) → opens settings bottom sheet

**Settings bottom sheet:**
- Routine picker: list of loaded templates, tap to activate (confirmation if switching mid-cycle)
- Unit toggle: lbs ↔ kg with conversion confirmation ("This will convert all historical weights. You can convert back later.")

**Empty state (no routine selected):** "Select a routine to get started" + list of available templates.

**Benchmark flow (triggered from Home alert):**
- Bottom sheet opens with bodyweight input field at top
- List of benchmark exercises with their method (e.g., "Bench Press — Max Weight")
- Tap exercise → stepper to log result (weight, reps, or duration depending on method)
- Each result saved individually to `benchmark_results` with the entered bodyweight
- No formal session lifecycle — just individual result rows

### Workout Screen

**Pre-session view:**
- Day label + name header
- Exercise list preview (name + sets × reps/duration/distance for each)
- "Start Workout" button

**Active session view:**
- Header: "Day {label} — {name}"
- Scrollable exercise cards (accordion — one expanded at a time)
- Each card:
  - Collapsed: exercise name + progress (e.g., "2/4") + logged set chips
  - Expanded: chips row + stepper row + "Repeat Last" / "LOG SET" buttons
  - Progressive exercises: info tooltip (ⓘ) explaining the protocol
- Bottom bar: "+ Add Exercise" (left), "End Early" (text, muted), "Finish Workout" (green, filled)
- "+ Add Exercise" opens exercise picker (searchable list from catalog, no create/edit)

**Stepper fields by exercise type:**
- `reps_weight`: reps stepper + weight stepper
- `time`: duration stepper
- `cardio`: duration stepper + distance stepper

**Stepper pre-fill behavior:**
- Uniform exercises: pre-fill from routine targets (reps from `target_reps_min`, duration, distance).
- Progressive exercises: first set starts blank (no target). Subsequent sets in the same session pre-fill from the previous set's logged values.
- All exercises after first session: if no target pre-fill, use last session's logged values for the same exercise as starting point.
- Weight stepper always starts at last logged weight for that exercise (or 0 if first time).

**"Repeat Last" button:**
- Copies values from the previous set within the current session exercise.
- Hidden/disabled on the first set of an exercise (no previous set to copy).

### Dashboard Screen

- Session count (this week / this month) — shown even if counts are 0, as long as any historical session exists
- Volume trend chart (4 weeks, bar chart) — volume = `SUM(weight * reps)` for `reps_weight` sets. `time` and `cardio` exercises are excluded from volume.
- Personal bests (top 3, type-appropriate formatting)
- Exercise list → tap for detail drill-in
- Benchmark history link

**Empty state (no sessions):** "No workouts yet" + "Start Workout" button.

**Exercise detail (drill-in):**
- Type-appropriate chart (weight/reps/duration/distance over time)
- Personal best card (formatted by type)
- Plan-vs-actual comparison (latest session) — joins `session_exercises.routine_day_exercise_id` to `routine_day_exercises` for targets

**Benchmark history (drill-in):**
- Grouped by exercise
- Trend chart per exercise (result_value over time)
- Bodyweight history alongside

---

## Session Lifecycle

- Only one `in_progress` session at a time
- `completed_fully`: NULL while in progress, 1 on Finish, 0 on End Early
- Finish always advances cycle to next day
- End Early advances cycle only if ≥1 set logged
- Zero-set End Early = cancel (no cycle change, session saved for audit)
- Every logged set committed to DB immediately (crash safety)
- Zero-set sessions excluded from all stats
- Sessions are never deleted

## Cycle Management

- `routine_cycle_state` tracks next day by ID (not index)
- Advance: find next day by sort_order, wrap to first at end
- Switching routines initializes cycle to first day

## Stats

All stats derived from current data, never cached:
- `get_session_count(since)` — finished sessions with ≥1 set
- `get_last_workout_summary()` — most recent finished session with sets
- `get_exercise_history(exercise_id)` — type-aware aggregation by session date
- `get_exercise_best_set(exercise_id)` — type-aware best (weight for reps_weight, duration for time, distance-then-duration for cardio)
- `get_personal_bests(limit)` — across all exercise types
- `get_total_volume_trend(weeks)` — weekly `SUM(weight * reps)` for `reps_weight` sets only
- `get_benchmark_history(exercise_name, method)` — results over time with bodyweight
- Plan-vs-actual: JOIN through `session_exercises.routine_day_exercise_id` to `routine_day_exercises`

## Weight Units

Single unit across entire app (lbs or kg). On toggle: convert ALL historical weights in `logged_sets.weight` and `benchmark_results.result_value` (for `max_weight` method only) in one transaction. Confirmation dialog: "This will convert all historical weights. You can convert back later."

---

## UI Components (carried forward from v1)

These are battle-tested on Android and reused as-is:
- `AppBottomSheet` — modal bottom sheet with drag handle, title, content, action buttons
- `ValueStepper` — large +/- touch targets for numeric input
- `SetChip` — logged (green filled) or target (gray outlined) set indicator
- `ExerciseCard` — accordion card with chips, steppers, log/repeat buttons
- `ChartWidget` — Kivy canvas line and bar charts (no matplotlib)
- `ExercisePicker` — searchable exercise list bottom sheet (no create/edit capability)

## Theme

Dark industrial minimalism (carried forward):
- Background: #121212, Surface: #1E1E1E
- Primary: #4ADE80 (green), Secondary: #60A5FA (blue)
- Destructive: #F87171 (red, text-style only in bottom sheets)
- All transitions under 200ms

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
│       ├── ppl.yaml
│       └── upper_lower.yaml
├── db/
│   ├── connection.py
│   └── schema.py
├── models/
│   ├── exercise.py
│   ├── routine.py
│   ├── workout.py
│   └── benchmark.py
├── repositories/
│   ├── base.py
│   ├── exercise_repo.py
│   ├── routine_repo.py
│   ├── cycle_repo.py
│   ├── workout_repo.py
│   ├── benchmark_repo.py
│   └── settings_repo.py
├── services/
│   ├── exercise_service.py
│   ├── routine_service.py
│   ├── cycle_service.py
│   ├── workout_service.py
│   ├── benchmark_service.py
│   ├── stats_service.py
│   ├── settings_service.py
│   └── template_loader.py
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
├── test_exercise_service.py
├── test_routine_service.py
├── test_cycle_service.py
├── test_workout_service.py
├── test_benchmark_service.py
├── test_stats_service.py
├── test_settings_and_units.py
└── test_template_loader.py
```

---

## What's NOT in scope

- Routine editing by user (dev-managed YAML)
- Exercise catalog editing by user (dev-managed CSV)
- Benchmark setup by user (dev-managed YAML)
- Import/export (routines are templates)
- Full DB backup/restore
- Standalone bodyweight tracking (only during benchmarks)
- True PR detection as time-series events (best-per-exercise snapshot only)
- Multi-method benchmark charts per exercise
- Per-exercise coaching notes UI (notes come from YAML, not user-editable)
- Optional exercises / `is_optional` flag (all exercises in a day are expected)
- Day picker override (always follows the cycle)
