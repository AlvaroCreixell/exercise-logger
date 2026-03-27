"""Database schema definitions for Exercise Logger v2.

Only 5 tables — mutable user data only.
Bundled data (exercises, routines, benchmarks) lives in registries, not SQLite.
"""
import sqlite3

_SCHEMA_SQL = [
    """CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS workout_sessions (
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
            (status = 'finished' AND completed_fully IS NOT NULL AND completed_fully IN (0, 1) AND finished_at IS NOT NULL)
        )
    )""",

    """CREATE TABLE IF NOT EXISTS session_exercises (
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
    )""",

    """CREATE TABLE IF NOT EXISTS logged_sets (
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
    )""",

    """CREATE TABLE IF NOT EXISTS benchmark_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_key_snapshot TEXT NOT NULL,
        exercise_name_snapshot TEXT NOT NULL,
        method TEXT NOT NULL CHECK(method IN ('max_weight', 'max_reps', 'timed_hold')),
        result_value REAL NOT NULL CHECK(result_value > 0),
        bodyweight REAL CHECK(bodyweight IS NULL OR bodyweight > 0),
        tested_at TEXT NOT NULL
    )""",
]


def init_db(conn: sqlite3.Connection) -> None:
    """Create all tables. Safe to call multiple times (IF NOT EXISTS)."""
    for sql in _SCHEMA_SQL:
        conn.execute(sql)
    conn.commit()
