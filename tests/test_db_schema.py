"""Verify that init_db creates all expected tables and indexes."""
from __future__ import annotations

import sqlite3


def _table_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    return {r["name"] for r in rows}


def _index_names(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='index' ORDER BY name"
    ).fetchall()
    return {r["name"] for r in rows}


EXPECTED_TABLES = {
    "exercises",
    "routines",
    "routine_days",
    "routine_day_exercises",
    "workout_sessions",
    "logged_sets",
    "logged_cardio",
    "benchmark_definitions",
    "benchmark_results",
    "routine_cycle_state",
    "settings",
}

EXPECTED_INDEXES = {
    "idx_logged_sets_exercise",
    "idx_logged_sets_session",
    "idx_logged_cardio_session",
    "idx_sessions_routine",
    "idx_sessions_started",
    "idx_sessions_status",
    "idx_benchmark_results_def",
    "idx_routine_exercises_day",
}


def test_all_tables_created(db_conn: sqlite3.Connection) -> None:
    assert EXPECTED_TABLES.issubset(_table_names(db_conn))


def test_all_indexes_created(db_conn: sqlite3.Connection) -> None:
    assert EXPECTED_INDEXES.issubset(_index_names(db_conn))


def test_default_weight_unit_seeded(db_conn: sqlite3.Connection) -> None:
    row = db_conn.execute(
        "SELECT value FROM settings WHERE key = 'weight_unit'"
    ).fetchone()
    assert row is not None
    assert row["value"] == "lbs"


def test_foreign_keys_enforced(db_conn: sqlite3.Connection) -> None:
    """Inserting a routine_day with a non-existent routine_id should fail."""
    import pytest
    with pytest.raises(sqlite3.IntegrityError):
        db_conn.execute(
            "INSERT INTO routine_days (routine_id, day_index, name) VALUES (999, 0, 'Test')"
        )
        db_conn.commit()
