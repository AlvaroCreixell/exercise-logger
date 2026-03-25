"""Database schema definitions."""
import sqlite3


_SCHEMA_SQL = [
    """CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('reps_weight', 'reps_only', 'time', 'cardio')),
        muscle_group TEXT,
        equipment TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1))
    )""",

    """CREATE TABLE IF NOT EXISTS routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS routine_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        UNIQUE(routine_id, sort_order),
        UNIQUE(routine_id, label)
    )""",

    """CREATE TABLE IF NOT EXISTS routine_day_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_day_id INTEGER NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        sort_order INTEGER NOT NULL,
        set_scheme TEXT NOT NULL CHECK(set_scheme IN ('uniform', 'progressive')),
        notes TEXT,
        is_optional INTEGER NOT NULL DEFAULT 0 CHECK(is_optional IN (0, 1)),
        UNIQUE(routine_day_id, sort_order)
    )""",

    """CREATE TABLE IF NOT EXISTS exercise_set_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_day_exercise_id INTEGER NOT NULL REFERENCES routine_day_exercises(id) ON DELETE CASCADE,
        set_number INTEGER NOT NULL CHECK(set_number >= 1),
        set_kind TEXT NOT NULL CHECK(set_kind IN ('reps_weight', 'reps_only', 'duration', 'cardio', 'amrap')),
        target_reps_min INTEGER CHECK(target_reps_min IS NULL OR target_reps_min >= 1),
        target_reps_max INTEGER CHECK(target_reps_max IS NULL OR target_reps_max >= 1),
        target_weight REAL CHECK(target_weight IS NULL OR target_weight >= 0),
        target_duration_seconds INTEGER CHECK(target_duration_seconds IS NULL OR target_duration_seconds >= 1),
        target_distance REAL CHECK(target_distance IS NULL OR target_distance > 0),
        CHECK(target_reps_min IS NULL OR target_reps_max IS NULL OR target_reps_min <= target_reps_max),
        UNIQUE(routine_day_exercise_id, set_number)
    )""",

    """CREATE TABLE IF NOT EXISTS workout_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
        routine_day_id INTEGER REFERENCES routine_days(id) ON DELETE SET NULL,
        session_type TEXT NOT NULL CHECK(session_type IN ('routine', 'benchmark')),
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
    )""",

    """CREATE TABLE IF NOT EXISTS session_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES workout_sessions(id),
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        routine_day_exercise_id INTEGER REFERENCES routine_day_exercises(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL,
        exercise_name_snapshot TEXT NOT NULL,
        notes TEXT,
        UNIQUE(session_id, sort_order)
    )""",

    """CREATE TABLE IF NOT EXISTS logged_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id),
        exercise_set_target_id INTEGER REFERENCES exercise_set_targets(id) ON DELETE SET NULL,
        set_number INTEGER NOT NULL CHECK(set_number >= 1),
        set_kind TEXT NOT NULL CHECK(set_kind IN ('reps_weight', 'reps_only', 'duration', 'cardio', 'amrap')),
        reps INTEGER CHECK(reps IS NULL OR reps >= 1),
        weight REAL CHECK(weight IS NULL OR weight >= 0),
        duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds >= 1),
        distance REAL CHECK(distance IS NULL OR distance > 0),
        notes TEXT,
        logged_at TEXT NOT NULL,
        UNIQUE(session_exercise_id, set_number)
    )""",

    """CREATE TABLE IF NOT EXISTS routine_cycle_state (
        routine_id INTEGER PRIMARY KEY REFERENCES routines(id) ON DELETE CASCADE,
        current_routine_day_id INTEGER NOT NULL REFERENCES routine_days(id)
    )""",

    """CREATE TABLE IF NOT EXISTS benchmark_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        method TEXT NOT NULL CHECK(method IN ('max_weight', 'max_reps', 'timed_hold')),
        reference_weight REAL,
        frequency_weeks INTEGER NOT NULL DEFAULT 6 CHECK(frequency_weeks >= 1),
        muscle_group_label TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS benchmark_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        benchmark_definition_id INTEGER NOT NULL REFERENCES benchmark_definitions(id) ON DELETE CASCADE,
        session_id INTEGER REFERENCES workout_sessions(id),
        method_snapshot TEXT NOT NULL CHECK(method_snapshot IN ('max_weight', 'max_reps', 'timed_hold')),
        reference_weight_snapshot REAL,
        result_value REAL NOT NULL,
        tested_at TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )""",
]


def init_db(conn: sqlite3.Connection) -> None:
    """Create all tables. Safe to call multiple times (IF NOT EXISTS)."""
    for sql in _SCHEMA_SQL:
        conn.execute(sql)
    conn.commit()
