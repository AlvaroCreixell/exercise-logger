import sqlite3
import pytest


class TestSchema:
    def test_all_tables_created(self, db_conn):
        rows = db_conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        table_names = {r["name"] for r in rows}
        expected = {
            "exercises", "routines", "routine_days", "routine_day_exercises",
            "exercise_set_targets", "workout_sessions", "session_exercises",
            "logged_sets", "routine_cycle_state", "benchmark_definitions",
            "benchmark_results", "settings",
        }
        assert expected.issubset(table_names)

    def test_foreign_keys_enabled(self, db_conn):
        row = db_conn.execute("PRAGMA foreign_keys").fetchone()
        assert row[0] == 1

    def test_exercise_type_check_rejects_invalid(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                "INSERT INTO exercises (name, type, is_archived) VALUES (?, ?, ?)",
                ("Test", "invalid_type", 0),
            )

    def test_exercise_name_unique(self, db_conn):
        db_conn.execute(
            "INSERT INTO exercises (name, type, is_archived) VALUES (?, ?, ?)",
            ("Bench Press", "reps_weight", 0),
        )
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                "INSERT INTO exercises (name, type, is_archived) VALUES (?, ?, ?)",
                ("Bench Press", "reps_weight", 0),
            )

    def test_session_lifecycle_valid_in_progress(self, db_conn):
        db_conn.execute(
            """INSERT INTO workout_sessions
               (session_type, status, completed_fully, started_at, finished_at)
               VALUES (?, ?, ?, ?, ?)""",
            ("routine", "in_progress", None, "2026-01-01T00:00:00", None),
        )

    def test_session_lifecycle_valid_finished(self, db_conn):
        db_conn.execute(
            """INSERT INTO workout_sessions
               (session_type, status, completed_fully, started_at, finished_at)
               VALUES (?, ?, ?, ?, ?)""",
            ("routine", "finished", 1, "2026-01-01T00:00:00", "2026-01-01T01:00:00"),
        )

    def test_session_lifecycle_invalid_finished_null_completed(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (session_type, status, completed_fully, started_at, finished_at)
                   VALUES (?, ?, ?, ?, ?)""",
                ("routine", "finished", None, "2026-01-01T00:00:00", "2026-01-01T01:00:00"),
            )

    def test_session_lifecycle_invalid_in_progress_with_completed(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (session_type, status, completed_fully, started_at, finished_at)
                   VALUES (?, ?, ?, ?, ?)""",
                ("routine", "in_progress", 1, "2026-01-01T00:00:00", None),
            )

    def test_set_target_reps_min_lte_max(self, db_conn):
        db_conn.execute(
            "INSERT INTO exercises (name, type, is_archived) VALUES (?, ?, ?)",
            ("Bench", "reps_weight", 0),
        )
        db_conn.execute(
            "INSERT INTO routines (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("R", 0, "2026-01-01", "2026-01-01"),
        )
        db_conn.execute(
            "INSERT INTO routine_days (routine_id, label, name, sort_order) VALUES (?, ?, ?, ?)",
            (1, "A", "Push", 0),
        )
        db_conn.execute(
            """INSERT INTO routine_day_exercises
               (routine_day_id, exercise_id, sort_order, set_scheme, is_optional)
               VALUES (?, ?, ?, ?, ?)""",
            (1, 1, 0, "uniform", 0),
        )
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO exercise_set_targets
                   (routine_day_exercise_id, set_number, set_kind, target_reps_min, target_reps_max)
                   VALUES (?, ?, ?, ?, ?)""",
                (1, 1, "reps_weight", 12, 8),
            )

    def test_cascade_delete_routine_removes_days(self, db_conn):
        db_conn.execute(
            "INSERT INTO routines (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("R", 0, "2026-01-01", "2026-01-01"),
        )
        db_conn.execute(
            "INSERT INTO routine_days (routine_id, label, name, sort_order) VALUES (?, ?, ?, ?)",
            (1, "A", "Push", 0),
        )
        db_conn.execute("DELETE FROM routines WHERE id = 1")
        row = db_conn.execute("SELECT COUNT(*) as cnt FROM routine_days").fetchone()
        assert row["cnt"] == 0

    def test_set_null_on_routine_delete_preserves_session(self, db_conn):
        db_conn.execute(
            "INSERT INTO routines (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("R", 0, "2026-01-01", "2026-01-01"),
        )
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_id, session_type, status, completed_fully, started_at, finished_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (1, "routine", "finished", 1, "2026-01-01T00:00:00", "2026-01-01T01:00:00"),
        )
        db_conn.execute("DELETE FROM routines WHERE id = 1")
        session = db_conn.execute("SELECT * FROM workout_sessions WHERE id = 1").fetchone()
        assert session is not None
        assert session["routine_id"] is None
