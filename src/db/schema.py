from __future__ import annotations

import sqlite3

_SCHEMA_SQL = """
-- ============================================================
-- EXERCISE CATALOG
-- ============================================================
CREATE TABLE IF NOT EXISTS exercises (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL UNIQUE,
    category        TEXT    NOT NULL CHECK (category IN ('weight', 'cardio')),
    equipment       TEXT,
    muscle_group    TEXT,
    notes           TEXT,
    is_archived     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- ROUTINE STRUCTURE
-- ============================================================
CREATE TABLE IF NOT EXISTS routines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    description     TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routine_days (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id      INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
    day_index       INTEGER NOT NULL,
    name            TEXT    NOT NULL,
    UNIQUE (routine_id, day_index)
);

CREATE TABLE IF NOT EXISTS routine_day_exercises (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_day_id      INTEGER NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
    exercise_id         INTEGER NOT NULL REFERENCES exercises(id),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    target_sets         INTEGER,
    target_reps         INTEGER,
    target_weight       REAL,
    target_duration_min REAL,
    target_distance_km  REAL,
    target_intensity    TEXT,
    notes               TEXT,
    UNIQUE (routine_day_id, sort_order)
);

-- ============================================================
-- WORKOUT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS workout_sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id      INTEGER REFERENCES routines(id),
    routine_day_id  INTEGER REFERENCES routine_days(id),
    status          TEXT    NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'finished', 'abandoned')),
    started_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    finished_at     TEXT,
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS logged_sets (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id             INTEGER NOT NULL REFERENCES exercises(id),
    routine_day_exercise_id INTEGER REFERENCES routine_day_exercises(id),
    set_index               INTEGER NOT NULL,
    reps                    INTEGER,
    weight                  REAL,
    is_warmup               INTEGER NOT NULL DEFAULT 0,
    is_failure              INTEGER NOT NULL DEFAULT 0,
    notes                   TEXT,
    logged_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logged_cardio (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id              INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id             INTEGER NOT NULL REFERENCES exercises(id),
    routine_day_exercise_id INTEGER REFERENCES routine_day_exercises(id),
    duration_min            REAL,
    distance_km             REAL,
    intensity               TEXT,
    notes                   TEXT,
    logged_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- BENCHMARK SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS benchmark_definitions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id     INTEGER NOT NULL REFERENCES exercises(id),
    name            TEXT    NOT NULL,
    method          TEXT    NOT NULL CHECK (method IN ('max_weight', 'reps_to_failure', 'timed_hold')),
    target_reps     INTEGER,
    target_weight   REAL,
    frequency_weeks INTEGER NOT NULL DEFAULT 6,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS benchmark_results (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    benchmark_definition_id INTEGER NOT NULL REFERENCES benchmark_definitions(id) ON DELETE CASCADE,
    session_id              INTEGER REFERENCES workout_sessions(id),
    result_weight           REAL,
    result_reps             INTEGER,
    result_duration_sec     REAL,
    notes                   TEXT,
    tested_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- ROUTINE CYCLING STATE
-- Advances only on Finish Workout, never on Start.
-- ============================================================
CREATE TABLE IF NOT EXISTS routine_cycle_state (
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
CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_logged_sets_exercise   ON logged_sets(exercise_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_logged_sets_session    ON logged_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_logged_cardio_session  ON logged_cardio(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_routine       ON workout_sessions(routine_id, started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_started       ON workout_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status        ON workout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_benchmark_results_def  ON benchmark_results(benchmark_definition_id, tested_at);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_day  ON routine_day_exercises(routine_day_id, sort_order);
"""

_DEFAULT_SETTINGS_SQL = """
INSERT OR IGNORE INTO settings (key, value) VALUES ('weight_unit', 'lbs');
"""


def init_db(conn: sqlite3.Connection) -> None:
    """Create all tables, indexes, and default settings if they don't exist."""
    conn.executescript(_SCHEMA_SQL)
    conn.executescript(_DEFAULT_SETTINGS_SQL)
    conn.commit()
