"""Tests for database schema — constraints, cascades, valid/invalid data."""
import pytest
import sqlite3


class TestSchemaCreation:
    def test_tables_exist(self, db_conn):
        """All 5 tables are created."""
        cursor = db_conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = {row["name"] for row in cursor.fetchall()}
        assert "settings" in tables
        assert "workout_sessions" in tables
        assert "session_exercises" in tables
        assert "logged_sets" in tables
        assert "benchmark_results" in tables

    def test_no_exercise_table(self, db_conn):
        """Exercises live in registries, not SQLite."""
        cursor = db_conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='exercises'"
        )
        assert cursor.fetchone() is None

    def test_no_routine_tables(self, db_conn):
        """Routines live in registries, not SQLite."""
        cursor = db_conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'routine%'"
        )
        assert cursor.fetchone() is None

    def test_idempotent_init(self, db_conn):
        """Calling init_db twice doesn't fail."""
        from src.db.schema import init_db
        init_db(db_conn)  # Second call


class TestSettingsConstraints:
    def test_insert_and_read(self, db_conn):
        db_conn.execute("INSERT INTO settings (key, value) VALUES ('unit', 'lb')")
        row = db_conn.execute("SELECT value FROM settings WHERE key = 'unit'").fetchone()
        assert row["value"] == "lb"

    def test_duplicate_key_replaces(self, db_conn):
        db_conn.execute("INSERT INTO settings (key, value) VALUES ('unit', 'lb')")
        db_conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('unit', 'kg')"
        )
        row = db_conn.execute("SELECT value FROM settings WHERE key = 'unit'").fetchone()
        assert row["value"] == "kg"

    def test_null_value_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute("INSERT INTO settings (key, value) VALUES ('unit', NULL)")


class TestWorkoutSessionConstraints:
    def _insert_in_progress(self, db_conn):
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status, started_at)
               VALUES ('ppl', 'Push Pull Legs', 'push', 'A', 'Push',
                       'in_progress', '2026-03-26T10:00:00')"""
        )
        return db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    def test_in_progress_session(self, db_conn):
        sid = self._insert_in_progress(db_conn)
        row = db_conn.execute("SELECT * FROM workout_sessions WHERE id = ?", (sid,)).fetchone()
        assert row["status"] == "in_progress"
        assert row["completed_fully"] is None
        assert row["finished_at"] is None

    def test_finished_session(self, db_conn):
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status, completed_fully,
                started_at, finished_at)
               VALUES ('ppl', 'Push Pull Legs', 'push', 'A', 'Push',
                       'finished', 1, '2026-03-26T10:00:00', '2026-03-26T11:00:00')"""
        )

    def test_invalid_status_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                    day_label_snapshot, day_name_snapshot, status, started_at)
                   VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                           'canceled', '2026-03-26T10:00:00')"""
            )

    def test_in_progress_with_finished_at_rejected(self, db_conn):
        """in_progress must have NULL finished_at and NULL completed_fully."""
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                    day_label_snapshot, day_name_snapshot, status,
                    started_at, finished_at)
                   VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                           'in_progress', '2026-03-26T10:00:00', '2026-03-26T11:00:00')"""
            )

    def test_finished_without_completed_fully_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                    day_label_snapshot, day_name_snapshot, status,
                    started_at, finished_at)
                   VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                           'finished', '2026-03-26T10:00:00', '2026-03-26T11:00:00')"""
            )

    def test_finished_without_finished_at_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                    day_label_snapshot, day_name_snapshot, status, completed_fully,
                    started_at)
                   VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                           'finished', 1, '2026-03-26T10:00:00')"""
            )


class TestSessionExerciseConstraints:
    def _insert_session(self, db_conn):
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status, started_at)
               VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                       'in_progress', '2026-03-26T10:00:00')"""
        )
        return db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    def test_planned_exercise(self, db_conn):
        sid = self._insert_session(db_conn)
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, scheme_snapshot, planned_sets,
                target_reps_min, target_reps_max)
               VALUES (?, 0, 'bench', 'Bench Press', 'reps_weight', 'planned',
                       'uniform', 3, 8, 12)""",
            (sid,),
        )

    def test_ad_hoc_exercise(self, db_conn):
        sid = self._insert_session(db_conn)
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source)
               VALUES (?, 0, 'curl', 'Dumbbell Curl', 'reps_weight', 'ad_hoc')""",
            (sid,),
        )

    def test_ad_hoc_with_targets_rejected(self, db_conn):
        """Ad-hoc exercises must have NULL for all target fields."""
        sid = self._insert_session(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source, planned_sets)
                   VALUES (?, 0, 'curl', 'Curl', 'reps_weight', 'ad_hoc', 3)""",
                (sid,),
            )

    def test_planned_without_planned_sets_rejected(self, db_conn):
        """Planned exercises must have planned_sets."""
        sid = self._insert_session(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source)
                   VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned')""",
                (sid,),
            )

    def test_duplicate_sort_order_rejected(self, db_conn):
        sid = self._insert_session(db_conn)
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, planned_sets)
               VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned', 3)""",
            (sid,),
        )
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source, planned_sets)
                   VALUES (?, 0, 'squat', 'Squat', 'reps_weight', 'planned', 3)""",
                (sid,),
            )

    def test_invalid_exercise_type_rejected(self, db_conn):
        sid = self._insert_session(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source, planned_sets)
                   VALUES (?, 0, 'bench', 'Bench', 'reps_only', 'planned', 3)""",
                (sid,),
            )

    def test_reps_min_greater_than_max_rejected(self, db_conn):
        sid = self._insert_session(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source, planned_sets,
                    target_reps_min, target_reps_max)
                   VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned', 3, 12, 8)""",
                (sid,),
            )

    def test_cascade_delete_session(self, db_conn):
        """Deleting a session cascades to session_exercises."""
        sid = self._insert_session(db_conn)
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, planned_sets)
               VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned', 3)""",
            (sid,),
        )
        db_conn.execute("DELETE FROM workout_sessions WHERE id = ?", (sid,))
        count = db_conn.execute("SELECT COUNT(*) FROM session_exercises").fetchone()[0]
        assert count == 0


class TestLoggedSetConstraints:
    def _setup_exercise(self, db_conn):
        """Create a session and session_exercise, return session_exercise_id."""
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status, started_at)
               VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                       'in_progress', '2026-03-26T10:00:00')"""
        )
        sid = db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, planned_sets)
               VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned', 3)""",
            (sid,),
        )
        return db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    def test_valid_reps_weight_set(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 60.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_valid_time_set(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, duration_seconds, logged_at)
               VALUES (?, 1, 60, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_valid_cardio_set_distance_only(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, distance_km, logged_at)
               VALUES (?, 1, 5.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_valid_cardio_set_both(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, duration_seconds, distance_km, logged_at)
               VALUES (?, 1, 600, 2.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_all_null_measurements_rejected(self, db_conn):
        """At least one measurement field must be non-NULL."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, logged_at)
                   VALUES (?, 1, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_zero_reps_rejected(self, db_conn):
        """reps >= 1 enforced."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, reps, weight, logged_at)
                   VALUES (?, 1, 0, 60.0, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_negative_weight_rejected(self, db_conn):
        """weight >= 0 enforced."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, reps, weight, logged_at)
                   VALUES (?, 1, 10, -5.0, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_zero_weight_allowed(self, db_conn):
        """weight=0 valid for bodyweight exercises."""
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 0.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_zero_duration_rejected(self, db_conn):
        """duration_seconds >= 1 enforced."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, duration_seconds, logged_at)
                   VALUES (?, 1, 0, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_zero_distance_rejected(self, db_conn):
        """distance_km > 0 enforced."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, distance_km, logged_at)
                   VALUES (?, 1, 0.0, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_duplicate_set_number_rejected(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 60.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, reps, weight, logged_at)
                   VALUES (?, 1, 8, 65.0, '2026-03-26T10:06:00')""",
                (se_id,),
            )

    def test_cascade_delete_session_exercise(self, db_conn):
        """Deleting a session_exercise cascades to logged_sets."""
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 60.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )
        db_conn.execute("DELETE FROM session_exercises WHERE id = ?", (se_id,))
        count = db_conn.execute("SELECT COUNT(*) FROM logged_sets").fetchone()[0]
        assert count == 0

    def test_cascade_delete_session_to_sets(self, db_conn):
        """Deleting a workout_session cascades through to logged_sets."""
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 60.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )
        # Get session_id from session_exercise
        row = db_conn.execute("SELECT session_id FROM session_exercises WHERE id = ?", (se_id,)).fetchone()
        db_conn.execute("DELETE FROM workout_sessions WHERE id = ?", (row["session_id"],))
        count = db_conn.execute("SELECT COUNT(*) FROM logged_sets").fetchone()[0]
        assert count == 0


class TestBenchmarkResultConstraints:
    def test_valid_result(self, db_conn):
        db_conn.execute(
            """INSERT INTO benchmark_results
               (exercise_key_snapshot, exercise_name_snapshot, method,
                result_value, bodyweight, tested_at)
               VALUES ('bench', 'Bench Press', 'max_weight', 100.0, 80.0,
                       '2026-03-26')"""
        )

    def test_null_bodyweight_allowed(self, db_conn):
        db_conn.execute(
            """INSERT INTO benchmark_results
               (exercise_key_snapshot, exercise_name_snapshot, method,
                result_value, tested_at)
               VALUES ('pull_up', 'Pull-Up', 'max_reps', 15.0, '2026-03-26')"""
        )

    def test_zero_result_value_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO benchmark_results
                   (exercise_key_snapshot, exercise_name_snapshot, method,
                    result_value, tested_at)
                   VALUES ('bench', 'Bench', 'max_weight', 0.0, '2026-03-26')"""
            )

    def test_negative_result_value_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO benchmark_results
                   (exercise_key_snapshot, exercise_name_snapshot, method,
                    result_value, tested_at)
                   VALUES ('bench', 'Bench', 'max_weight', -1.0, '2026-03-26')"""
            )

    def test_invalid_method_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO benchmark_results
                   (exercise_key_snapshot, exercise_name_snapshot, method,
                    result_value, tested_at)
                   VALUES ('bench', 'Bench', 'one_rep_max', 100.0, '2026-03-26')"""
            )

    def test_zero_bodyweight_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO benchmark_results
                   (exercise_key_snapshot, exercise_name_snapshot, method,
                    result_value, bodyweight, tested_at)
                   VALUES ('bench', 'Bench', 'max_weight', 100.0, 0.0, '2026-03-26')"""
            )
