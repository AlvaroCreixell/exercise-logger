# Exercise Logger - Design Document

> Last updated: 2026-02-27
> Status: Refined after plan review. Ready for implementation.

## 1. Product Vision

A simple, phone-first workout logger that removes friction from gym sessions. You define your routine once, then at the gym you just open the app, see today's workout, and tap through your sets. Every few weeks it prompts you to benchmark your progress.

### User Stories

1. **As a gym-goer**, I want to define a multi-day workout routine so I don't have to remember what to do each day.
2. **As a gym-goer**, I want the app to auto-cycle to the next day so I just show up and follow along.
3. **As a gym-goer**, I want to log sets/reps/weight quickly with minimal typing (pre-filled from targets, +/- buttons).
4. **As a gym-goer**, I want to see my previous numbers for each exercise so I know what to beat.
5. **As a gym-goer**, I want visual progress charts to see trends over time.
6. **As a gym-goer**, I want periodic benchmarks to objectively measure my strength gains.
7. **As a gym-goer**, I want my in-progress workout to survive if my phone locks or the app gets killed.
8. **As a gym-goer**, I want to export my data so I never lose it.

### Non-Goals (MVP)
- No cloud sync or multi-device support
- No social features or sharing
- No automatic routine generation or AI coaching
- No auto-adjustment of weights based on benchmarks (view-only)
- No rest timer (possible future feature)
- No editing past logged workouts (log is append-only in MVP)
- No multiple simultaneous active routines (one active routine at a time)

---

## 2. Behavioral Decisions

These questions were identified during plan review and are now locked.

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | When does cycle advance? | On **Finish Workout** only, never on Start. | If user starts but abandons, cycle shouldn't move. Abandoned sessions stay in DB but don't advance. |
| 2 | Manual day pick → what happens next? | Picking Day 3 manually sets next default to Day 4. | `override_next_day()` updates `current_day_index`. After finishing, advance is relative to the overridden day. |
| 3 | Can a session survive app kill? | Yes. Sessions have `status` field (`in_progress`/`finished`/`abandoned`). On app launch, check for `in_progress` sessions and offer to resume or abandon. | Critical for mobile. Phone locks, calls interrupt, app gets killed. |
| 4 | Multi-day benchmark completion? | Yes. Due benchmarks remain pending until each is individually completed. No requirement to do all in one session. | Some users have 6+ benchmarks. Forcing all in one session is impractical. |
| 5 | Benchmark frequency: global vs per-item? | Per-item, with 6-week default. Each `benchmark_definition` has its own `frequency_weeks`. | Different exercises may need different frequencies. Default covers most cases. |
| 6 | Benchmark due anchor date? | **Last completion date**. If never tested, due immediately. | Due-from-creation would cause phantom deadlines for benchmarks defined but never used. |
| 7 | Ad-hoc exercises during routine workout? | **Yes**. User can add any exercise not in the template. Logged with `routine_day_exercise_id=NULL`. | Real workouts are messy. Someone might want to throw in extra curls. |
| 8 | Can users edit past logged sets? | **No** in MVP. Log is append-only. | Simplifies data model and eliminates audit concerns. Can add corrections later if needed. |
| 9 | Weight unit change policy? | **Convert all history**. When user switches lbs↔kg, multiply all historical weights by conversion factor (2.20462 or 0.453592). Show confirmation dialog first. | User chose this. Rounding drift is minimal for practical gym weights. |
| 10 | Minimum Android version? | Android 6.0+ (API 23). | Flet/Flutter minimum. Covers 97%+ of active Android devices. |
| 11 | Data export in MVP? | **Yes**. JSON export of all data. | Low effort, prevents data loss anxiety. Critical for user trust. |

---

## 3. Technology Choices

| Choice | Decision | Rationale |
|--------|----------|-----------|
| Language | Python 3.10+ | User preference, rapid development |
| Framework | Flet | Flutter-rendered UI, direct APK builds on Windows, built-in charts |
| Database | SQLite3 (stdlib) | Offline-first, zero config, perfect for single-user mobile |
| ORM | None (raw SQL + dataclasses) | Full query control, no magic, keeps it simple |
| Charts | flet-charts (fl_chart) | Built into Flet, line/bar/pie charts, no extra dependencies |
| Testing | pytest | Standard, simple |
| Android build | `flet build apk` | Auto-installs JDK 17 + Android SDK |

---

## 4. MVP Scope Definition

### In MVP (must ship)

| Feature | Details |
|---------|---------|
| Routine editor | Create one active routine with N days, each with ordered exercises |
| Cardio in routines | Optional cardio exercises with duration/distance targets |
| Workout logging | Follow routine day, log sets/reps/weight per exercise |
| Auto-cycle | Next day auto-selected after finishing, manual override available |
| Session recovery | In-progress sessions survive app kill, resumable on next launch |
| Previous numbers | Show last session's values as reference during logging |
| Ad-hoc exercises | Add exercises not in template during a workout |
| Benchmark system | Define benchmarks (3 methods), due detection, result logging |
| Multi-day benchmarks | Due benchmarks stay pending until completed across sessions |
| Basic progress | Weight trend chart per exercise, benchmark trend chart |
| Data export | Full JSON export of all data |
| Weight unit toggle | lbs/kg preference with full history conversion |
| Dark theme | Default and only theme in MVP |

### Deferred (post-MVP)

| Feature | Why deferred |
|---------|--------------|
| RPE tracking | Nice-to-have, not core to logging flow |
| Heart rate tracking | Requires extra input with minimal MVP value |
| Streak/gamification stats | Vanity metrics, not core functionality |
| Rich exercise taxonomy UI | `equipment`/`muscle_group` stay in schema but no filtering UI yet |
| Dashboard stats | "Workouts this week" etc. — polish, not core |
| Edit past logs | Adds complexity, audit concerns. Append-only is simpler. |
| Multiple active routines | One routine at a time is sufficient for MVP |
| Rest timer | Useful but independent feature, can layer on later |
| Cloud sync | Major architectural addition, explicitly out of scope |
| CSV export | JSON is sufficient for MVP backup |

---

## 5. Data Model

### 5.1 Entity Relationship Overview

```
exercises (catalog)
    ├── routine_day_exercises (planned in routines)
    ├── logged_sets (actual workout logs)
    ├── logged_cardio (actual cardio logs)
    └── benchmark_definitions (benchmark setup)
            └── benchmark_results (benchmark history)

routines
    ├── routine_days
    │       └── routine_day_exercises
    └── routine_cycle_state

workout_sessions (has status: in_progress / finished / abandoned)
    ├── logged_sets
    └── logged_cardio

settings (key-value)
```

### 5.2 Complete SQL Schema

```sql
-- ============================================================
-- EXERCISE CATALOG
-- Central registry of all known exercises.
-- equipment and muscle_group are optional metadata, not used
-- in MVP filtering but available for future exercise picker UI.
-- ============================================================
CREATE TABLE exercises (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL UNIQUE,
    category        TEXT    NOT NULL CHECK (category IN ('weight', 'cardio')),
    equipment       TEXT,           -- "barbell", "dumbbell", "machine", "bodyweight"
    muscle_group    TEXT,           -- "chest", "legs", "back", etc. (optional, for future use)
    notes           TEXT,
    is_archived     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- ROUTINE STRUCTURE
-- ============================================================
CREATE TABLE routines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    description     TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,  -- enforced in app: only one active at a time
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE routine_days (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id      INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    day_index       INTEGER NOT NULL,       -- 0-based position in cycle
    name            TEXT    NOT NULL,        -- "Push Day", "Leg Day"
    UNIQUE (routine_id, day_index)
);

CREATE TABLE routine_day_exercises (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_day_id      INTEGER NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
    exercise_id         INTEGER NOT NULL REFERENCES exercises(id),
    sort_order          INTEGER NOT NULL DEFAULT 0,

    -- Weight exercise targets (NULL for cardio)
    target_sets         INTEGER,
    target_reps         INTEGER,
    target_weight       REAL,

    -- Cardio exercise targets (NULL for weight)
    target_duration_min REAL,
    target_distance_km  REAL,
    target_intensity    TEXT,       -- "low", "moderate", "high", or free text

    notes               TEXT,
    UNIQUE (routine_day_id, sort_order)
);

-- ============================================================
-- WORKOUT LOG
-- ============================================================
CREATE TABLE workout_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id      INTEGER REFERENCES routines(id),       -- NULL for ad-hoc
    routine_day_id  INTEGER REFERENCES routine_days(id),   -- NULL for ad-hoc
    status          TEXT    NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'finished', 'abandoned')),
    started_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    finished_at     TEXT,
    notes           TEXT
);

-- One row per SET for weight exercises.
-- rpe and is_failure are deferred from MVP UI but columns exist for future use.
CREATE TABLE logged_sets (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id             INTEGER NOT NULL REFERENCES exercises(id),
    routine_day_exercise_id INTEGER REFERENCES routine_day_exercises(id),  -- NULL for ad-hoc exercises
    set_index               INTEGER NOT NULL,       -- 0-based within this exercise in this session
    reps                    INTEGER,
    weight                  REAL,
    is_warmup               INTEGER NOT NULL DEFAULT 0,
    is_failure              INTEGER NOT NULL DEFAULT 0,
    notes                   TEXT,
    logged_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per cardio effort.
CREATE TABLE logged_cardio (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id             INTEGER NOT NULL REFERENCES exercises(id),
    routine_day_exercise_id INTEGER REFERENCES routine_day_exercises(id),  -- NULL for ad-hoc
    duration_min            REAL,
    distance_km             REAL,
    intensity               TEXT,
    notes                   TEXT,
    logged_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- BENCHMARK SYSTEM
-- frequency_weeks is per-item with a default of 6.
-- Due = never tested OR last_tested + (frequency_weeks * 7 days) <= now.
-- ============================================================
CREATE TABLE benchmark_definitions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id     INTEGER NOT NULL REFERENCES exercises(id),
    name            TEXT    NOT NULL,       -- "Bench Press 1RM", "Plank Hold"
    method          TEXT    NOT NULL CHECK (method IN ('max_weight', 'reps_to_failure', 'timed_hold')),
    target_reps     INTEGER,               -- for max_weight: how many reps (1 = 1RM, 5 = 5RM)
    target_weight   REAL,                  -- for reps_to_failure: fixed test weight
    frequency_weeks INTEGER NOT NULL DEFAULT 6,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE benchmark_results (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    benchmark_definition_id INTEGER NOT NULL REFERENCES benchmark_definitions(id) ON DELETE CASCADE,
    session_id              INTEGER REFERENCES workout_sessions(id),
    result_weight           REAL,           -- max_weight result
    result_reps             INTEGER,        -- reps_to_failure result
    result_duration_sec     REAL,           -- timed_hold result
    notes                   TEXT,
    tested_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- ROUTINE CYCLING STATE
-- Advances only on Finish Workout, never on Start.
-- Manual override updates current_day_index directly.
-- ============================================================
CREATE TABLE routine_cycle_state (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id          INTEGER NOT NULL UNIQUE REFERENCES routines(id) ON DELETE CASCADE,
    current_day_index   INTEGER NOT NULL DEFAULT 0,
    last_session_id     INTEGER REFERENCES workout_sessions(id),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- USER SETTINGS
-- Known keys: weight_unit ("lbs" or "kg")
-- ============================================================
CREATE TABLE settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_logged_sets_exercise     ON logged_sets(exercise_id, logged_at);
CREATE INDEX idx_logged_sets_session      ON logged_sets(session_id);
CREATE INDEX idx_logged_cardio_session    ON logged_cardio(session_id);
CREATE INDEX idx_sessions_routine        ON workout_sessions(routine_id, started_at);
CREATE INDEX idx_sessions_started        ON workout_sessions(started_at);
CREATE INDEX idx_sessions_status         ON workout_sessions(status);
CREATE INDEX idx_benchmark_results_def   ON benchmark_results(benchmark_definition_id, tested_at);
CREATE INDEX idx_routine_exercises_day   ON routine_day_exercises(routine_day_id, sort_order);
```

### 5.3 Schema Changes from v1 (post-review)

| Change | Reason |
|--------|--------|
| Added `status` to `workout_sessions` | Session recovery: detect `in_progress` on app launch, offer resume/abandon. |
| Removed `rpe` from `logged_sets` | Deferred from MVP. Column can be added later via migration. |
| Removed `avg_heart_rate` from `logged_cardio` | Deferred from MVP. Not core to logging. |
| Added `idx_sessions_status` index | Fast lookup of in-progress sessions on app launch. |
| Added inline comments on benchmark frequency | Clarifies per-item frequency and due calculation anchor. |
| Added inline comments on cycle state | Documents advance-on-finish-only rule. |

### 5.4 Design Rationale

| Decision | Why |
|----------|-----|
| **Per-set rows** in `logged_sets` | `MAX(weight)`, `SUM(reps * weight)`, and trend queries are trivial. No string parsing needed. |
| **Separate `logged_cardio`** | Cardio columns (duration, distance) are completely different from weight columns (reps, weight). Combined table = half NULLs per row. |
| **Wide row for `routine_day_exercises`** | A routine day's exercise list is one ordered list in the UI. One query with a JOIN to `exercises` renders the whole list. The `category` field tells the UI which columns to show. |
| **`routine_cycle_state` is separate** | Separates routine definition from mutable runtime state. Cycle can be reset without touching the routine. |
| **`is_archived` on exercises** | Can't DELETE exercises with logged data pointing to them. Archive hides from pickers while preserving history. |
| **Template-Log separation** | `routine_day_exercises` = what you plan. `logged_sets` = what you did. Editing a routine never alters history. |
| **Single `method` enum for benchmarks** | Only 3 benchmark types. Polymorphic tables would be overengineering. |
| **`status` on sessions** | Enables crash recovery. Detect `in_progress` on launch, resume or abandon. |
| **No `session_type` column** | A session's purpose (routine vs benchmark) is inferred from its data: if it has `benchmark_results`, it's a benchmark session. Avoids redundant state. |
| **No `next_due_at` on benchmarks** | Computed from `MAX(tested_at) + frequency_weeks`. Stored dates get stale if frequency changes. Computing is one simple query. |

---

## 6. Key Queries

### Exercise history (last 10 sessions)
```sql
SELECT ws.started_at, ls.set_index, ls.reps, ls.weight, ls.is_failure
FROM logged_sets ls
JOIN workout_sessions ws ON ws.id = ls.session_id
WHERE ls.exercise_id = ?
  AND ls.is_warmup = 0
  AND ws.status = 'finished'
  AND ws.id IN (
      SELECT DISTINCT ws2.id
      FROM logged_sets ls2
      JOIN workout_sessions ws2 ON ws2.id = ls2.session_id
      WHERE ls2.exercise_id = ? AND ws2.status = 'finished'
      ORDER BY ws2.started_at DESC
      LIMIT 10
  )
ORDER BY ws.started_at DESC, ls.set_index ASC;
```

### Weight progression (for charts)
```sql
SELECT ws.started_at AS date, MAX(ls.weight) AS max_weight
FROM logged_sets ls
JOIN workout_sessions ws ON ws.id = ls.session_id
WHERE ls.exercise_id = ? AND ls.is_warmup = 0 AND ws.status = 'finished'
GROUP BY ws.id
ORDER BY ws.started_at ASC;
```

### Volume over time (for charts)
```sql
SELECT ws.started_at AS date, SUM(ls.reps * ls.weight) AS total_volume
FROM logged_sets ls
JOIN workout_sessions ws ON ws.id = ls.session_id
WHERE ls.exercise_id = ? AND ls.is_warmup = 0 AND ws.status = 'finished'
GROUP BY ws.id
ORDER BY ws.started_at ASC;
```

### Due benchmarks
```sql
SELECT bd.id, bd.name, bd.method, bd.frequency_weeks,
       bd.exercise_id, e.name AS exercise_name,
       MAX(br.tested_at) AS last_tested,
       JULIANDAY('now') - JULIANDAY(MAX(br.tested_at)) AS days_since
FROM benchmark_definitions bd
JOIN exercises e ON e.id = bd.exercise_id
LEFT JOIN benchmark_results br ON br.benchmark_definition_id = bd.id
WHERE bd.is_active = 1
GROUP BY bd.id
HAVING last_tested IS NULL OR days_since >= (bd.frequency_weeks * 7);
```

### Next routine day
```sql
SELECT rd.id, rd.day_index, rd.name
FROM routine_cycle_state rcs
JOIN routine_days rd ON rd.routine_id = rcs.routine_id
  AND rd.day_index = rcs.current_day_index
WHERE rcs.routine_id = ?;
```

### Find in-progress session (for crash recovery)
```sql
SELECT id, routine_id, routine_day_id, started_at
FROM workout_sessions
WHERE status = 'in_progress'
ORDER BY started_at DESC
LIMIT 1;
```

### Today's exercises with targets
```sql
SELECT rde.sort_order, e.name, e.category, e.id AS exercise_id,
       rde.id AS routine_day_exercise_id,
       rde.target_sets, rde.target_reps, rde.target_weight,
       rde.target_duration_min, rde.target_distance_km, rde.target_intensity,
       rde.notes
FROM routine_day_exercises rde
JOIN exercises e ON e.id = rde.exercise_id
WHERE rde.routine_day_id = ?
ORDER BY rde.sort_order ASC;
```

---

## 7. Routine Cycling Logic

### Algorithm
```
current_day_index stored in routine_cycle_state (0-based)
total_days = count of routine_days for this routine

On Finish Workout (only):
    next_index = (current_day_index + 1) % total_days
    Update routine_cycle_state with next_index and last_session_id

On Start Workout:
    Read current_day_index -> load that day's exercises
    Do NOT advance cycle (advance happens only on finish)

On Manual Day Pick:
    Update current_day_index to chosen day
    Start session as normal
    After finish, advance from the picked day (not the original)
```

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Finish workout | Advance cycle. `status` → `finished`, `finished_at` stamped. |
| Abandon workout | `status` → `abandoned`. Cycle does NOT advance. Logged sets are preserved. |
| Resume after app kill | On launch, find `status='in_progress'` session. Offer resume or abandon. |
| Skip a day | `override_next_day(day_index)` to jump forward. No phantom sessions. |
| Repeat a day | `override_next_day()` back to same index, or start session with `day_override`. |
| Extra exercise not in template | `logged_sets` row with `routine_day_exercise_id=NULL`. Allowed in MVP. |
| Fewer sets than planned | Only actual sets get rows. Template unchanged. |
| Routine modified mid-cycle | App warns user, offers to reset cycle to day 0. |
| New routine replaces old | Deactivate old, activate new. New cycle starts at day 0. Old logs preserved. |
| Ad-hoc workout (no routine) | Session with `routine_id=NULL`. No cycle advancement. |
| Benchmark session | Independent of routine cycle. Can happen anytime. |

---

## 8. Benchmark System

### Three Methods

| Method | What it measures | Config params | Result stored in |
|--------|-----------------|---------------|-----------------|
| `max_weight` | Heaviest weight for N reps | `target_reps` (e.g., 1 for 1RM) | `result_weight` |
| `reps_to_failure` | Max reps at a fixed weight | `target_weight` (fixed test weight) | `result_reps` |
| `timed_hold` | How long you hold a position | None needed | `result_duration_sec` |

### Due Calculation
- Anchor: **last completion date** (`MAX(tested_at)` for that benchmark definition)
- If never tested: due immediately
- Due when: `days_since_last_test >= frequency_weeks * 7`
- Each benchmark has its own `frequency_weeks` (default 6)

### Multi-Day Completion
- Due benchmarks are computed independently per definition
- User can complete some benchmarks in one session and others later
- A benchmark stops being "due" as soon as a result is recorded for it
- No concept of a "benchmark batch" — each is independent

### Flow
1. App checks for due benchmarks on Home screen launch
2. If any are due, show "Benchmarks Due" alert with count
3. User taps alert → sees list of due benchmarks
4. User can start a session and complete some or all
5. Results saved to `benchmark_results` with timestamp
6. Completed benchmarks disappear from due list
7. Progress viewable in charts (result value over time)

---

## 9. Session Recovery

### Problem
At the gym, the phone locks, a call comes in, or the OS kills the app. The user's in-progress workout must survive.

### Solution
- `workout_sessions.status` field: `in_progress` → `finished` or `abandoned`
- Sets/cardio are committed to DB immediately as logged (no in-memory-only state)
- On app launch: query for `status = 'in_progress'`
- If found: show dialog → "Resume workout?" or "Abandon?"
- Resume: reopen the workout view with all previously logged sets visible
- Abandon: set `status = 'abandoned'`, do NOT advance cycle

### Rules
- Only ONE session can be `in_progress` at a time (enforced in service layer)
- Starting a new session when one is in-progress: prompt to finish/abandon the existing one first
- Abandoned sessions and their logged sets are kept in DB (not deleted) for data completeness

---

## 10. Weight Unit Conversion

### Policy
- User can switch between lbs and kg at any time via Settings
- On switch: **all historical weights are converted** using the standard factor
  - lbs → kg: multiply by 0.453592
  - kg → lbs: multiply by 2.20462
- Applies to: `logged_sets.weight`, `routine_day_exercises.target_weight`, `benchmark_definitions.target_weight`, `benchmark_results.result_weight`
- Confirmation dialog shown before conversion
- Conversion is a single transaction (all-or-nothing)
- Setting stored in `settings` table: `key='weight_unit', value='lbs'` or `'kg'`

---

## 11. Data Export

### MVP Scope
- Full JSON export of all tables
- Triggered from Settings screen
- File saved to device's Downloads/shared storage
- Includes: exercises, routines (with days and exercises), all workout sessions (with sets and cardio), benchmarks (definitions and results), settings

### Format
```json
{
  "export_version": 1,
  "exported_at": "2026-03-15T14:30:00",
  "weight_unit": "lbs",
  "exercises": [...],
  "routines": [...],
  "workout_sessions": [...],
  "benchmark_definitions": [...],
  "benchmark_results": [...],
  "settings": [...]
}
```

### Future (post-MVP)
- JSON import for restore
- CSV export for spreadsheet analysis

---

## 12. UI Design

### Navigation (Bottom Bar)
```
[ Home ]  [ Workout ]  [ Progress ]  [ Settings ]
```

### Screen Flow
```
Home
├── "Resume Workout" (if in-progress session exists)
├── "Start Workout" → Workout View (current routine day)
├── "Benchmarks Due (3)" alert → Benchmark list
└── Current routine + day info

Workout View
├── Exercise list (cards, ordered by routine)
├── Each exercise → set logger (expandable)
├── Set logger: [reps ±] [weight ±] [✓ log set]
├── Previous session's numbers shown as reference
├── "Add Exercise" button (ad-hoc)
├── "Finish Workout" → advance cycle → Home
└── "Abandon Workout" → no cycle advance → Home

Progress View
├── Exercise picker (dropdown)
├── Weight trend line chart
├── Volume trend line chart
└── Benchmark progress charts

Settings
├── Routine Editor
│   ├── Create/edit routine name
│   ├── Add/reorder/delete days
│   └── Per day: add/reorder/delete exercises with targets
├── Benchmark Setup
│   ├── Add/edit benchmark definitions
│   └── Set per-benchmark frequency (default 6 weeks)
├── Exercise Catalog (add/archive exercises)
├── Weight unit (lbs/kg with conversion)
└── Export Data (JSON)
```

### Mobile UX Principles
- **Large touch targets** — buttons at least 48x48dp, for use with gym gloves
- **Number steppers** — +/- buttons for reps and weight, not just text fields
- **Auto-fill** — pre-populate from routine targets and last session's values
- **Visual cues** — green highlight when setting a PR, neutral when matching previous
- **Dark theme** — default and only theme in MVP
- **Minimal navigation** — 2 taps max to start logging
- **Immediate persistence** — each logged set is committed to DB instantly (no "save" button)

---

## 13. Implementation Phases

### Phase 0: Decisions + Project Setup
- Lock all behavioral decisions (done — see Section 2)
- Define MVP scope (done — see Section 4)
- Project scaffold: pyproject.toml, .gitignore, git init
- Flet "hello world" APK build to validate toolchain

**Exit criteria:** Empty Flet app builds to APK and runs on phone.

### Phase 1: Vertical Slice — Core Workout Loop
Build the minimum end-to-end flow on real hardware:
1. Data models (all dataclasses)
2. DB connection + full schema + `init_db()`
3. Repositories: ExerciseRepo, RoutineRepo, WorkoutRepo, CycleRepo
4. Services: WorkoutService, CycleService
5. UI: minimal routine display + set logging + finish workout
6. **Build APK and test on phone**

Flow: `Hardcoded routine → Start workout → Log sets → Finish → Next day auto-selected`

**Exit criteria:** Core flow works on physical Android device with no crashes.

### Phase 2: Routine Editor + Session Recovery
1. Routine editor UI (create routine, add days, add exercises)
2. Exercise catalog management (add/search/archive)
3. Session recovery (detect in-progress, resume/abandon dialog)
4. Manual day override

**Exit criteria:** User can create a routine from scratch and use it reliably, including app interruptions.

### Phase 3: Benchmark System
1. BenchmarkRepo + BenchmarkService
2. Benchmark definition UI (add benchmarks, pick method, set params)
3. Due detection + alert on Home screen
4. Benchmark logging session
5. Multi-day completion support

**Exit criteria:** At least one full benchmark cycle works end-to-end (define → due → test → record).

### Phase 4: Progress + Export
1. ProgressService (trend queries)
2. Weight trend chart per exercise
3. Benchmark progress chart
4. JSON data export
5. Weight unit toggle with conversion

**Exit criteria:** User can view exercise trends, export data, and switch weight units safely.

### Phase 5: Polish + Ship
1. UI polish (PR indicators, auto-fill refinement)
2. Ad-hoc exercise support in workout view
3. Cardio logging in workout view
4. Edge case testing (cycle wrapping, routine editing mid-cycle)
5. Final APK build + full device testing

**Exit criteria:** MVP feature-complete, stable on Android, data is safe.

---

## 14. Future Considerations (Post-MVP)

These are explicitly out of scope but worth keeping in mind architecturally:

- **RPE tracking** — add `rpe REAL` column to `logged_sets`
- **Heart rate tracking** — add `avg_heart_rate INTEGER` to `logged_cardio`
- **Rest timer** between sets (with notification)
- **Exercise library** with pre-populated common exercises
- **Superset support** (grouping exercises to alternate between)
- **Body measurements** tracking (weight, body fat, etc.)
- **Auto-suggest weights** based on benchmark results
- **Streak/gamification** stats on dashboard
- **JSON import** for data restore
- **CSV export** for spreadsheet analysis
- **Edit past logs** with optional audit trail
- **Multiple active routines** support
- **Cloud sync** (would require remote data layer)
