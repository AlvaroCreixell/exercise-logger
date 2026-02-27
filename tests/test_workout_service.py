"""Tests for WorkoutService: start, log_set, finish, abandon, session recovery."""
from __future__ import annotations

import sqlite3

import pytest

from models.workout import SessionStatus
from services.workout_service import WorkoutService


def _seed_exercise(conn: sqlite3.Connection, name: str = "Bench Press") -> int:
    cur = conn.execute(
        "INSERT INTO exercises (name, category) VALUES (?, 'weight')", (name,)
    )
    conn.commit()
    return cur.lastrowid


class TestStartSession:
    def test_creates_in_progress_session(self, db_conn: sqlite3.Connection) -> None:
        svc = WorkoutService(db_conn)
        session = svc.start_session()
        assert session.id is not None
        assert session.status == SessionStatus.IN_PROGRESS

    def test_persisted_immediately(self, db_conn: sqlite3.Connection) -> None:
        svc = WorkoutService(db_conn)
        session = svc.start_session()
        row = db_conn.execute(
            "SELECT status FROM workout_sessions WHERE id = ?", (session.id,)
        ).fetchone()
        assert row["status"] == "in_progress"

    def test_raises_if_already_in_progress(self, db_conn: sqlite3.Connection) -> None:
        svc = WorkoutService(db_conn)
        svc.start_session()
        with pytest.raises(RuntimeError, match="already in progress"):
            svc.start_session()

    def test_can_start_after_finish(self, db_conn: sqlite3.Connection) -> None:
        svc = WorkoutService(db_conn)
        s1 = svc.start_session()
        svc.finish_session(s1.id)
        s2 = svc.start_session()
        assert s2.id != s1.id


class TestLogSet:
    def test_log_set_increments_set_index(self, db_conn: sqlite3.Connection) -> None:
        svc = WorkoutService(db_conn)
        ex_id = _seed_exercise(db_conn)
        session = svc.start_session()

        s1 = svc.log_set(session.id, ex_id, reps=8, weight=135.0)
        s2 = svc.log_set(session.id, ex_id, reps=8, weight=135.0)
        s3 = svc.log_set(session.id, ex_id, reps=6, weight=145.0)

        assert s1.set_index == 0
        assert s2.set_index == 1
        assert s3.set_index == 2

    def test_log_set_committed_immediately(self, db_conn: sqlite3.Connection) -> None:
        svc = WorkoutService(db_conn)
        ex_id = _seed_exercise(db_conn)
        session = svc.start_session()
        logged = svc.log_set(session.id, ex_id, reps=5, weight=225.0)

        row = db_conn.execute(
            "SELECT reps, weight FROM logged_sets WHERE id = ?", (logged.id,)
        ).fetchone()
        assert row["reps"] == 5
        assert row["weight"] == 225.0

    def test_sets_per_exercise_are_independent(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = WorkoutService(db_conn)
        ex1 = _seed_exercise(db_conn, "Bench Press")
        ex2 = _seed_exercise(db_conn, "Squat")
        session = svc.start_session()

        a = svc.log_set(session.id, ex1, reps=8, weight=135.0)
        b = svc.log_set(session.id, ex2, reps=5, weight=185.0)
        c = svc.log_set(session.id, ex1, reps=8, weight=135.0)

        # Each exercise's index resets independently
        assert a.set_index == 0
        assert b.set_index == 0
        assert c.set_index == 1


class TestFinishAbandon:
    def test_finish_marks_session_finished(self, db_conn: sqlite3.Connection) -> None:
        svc = WorkoutService(db_conn)
        session = svc.start_session()
        svc.finish_session(session.id)

        row = db_conn.execute(
            "SELECT status, finished_at FROM workout_sessions WHERE id = ?",
            (session.id,),
        ).fetchone()
        assert row["status"] == "finished"
        assert row["finished_at"] is not None

    def test_abandon_marks_session_abandoned(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = WorkoutService(db_conn)
        session = svc.start_session()
        svc.abandon_session(session.id)

        row = db_conn.execute(
            "SELECT status FROM workout_sessions WHERE id = ?", (session.id,)
        ).fetchone()
        assert row["status"] == "abandoned"

    def test_abandon_does_not_set_finished_at(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = WorkoutService(db_conn)
        session = svc.start_session()
        svc.abandon_session(session.id)

        row = db_conn.execute(
            "SELECT finished_at FROM workout_sessions WHERE id = ?", (session.id,)
        ).fetchone()
        assert row["finished_at"] is None

    def test_finish_sets_finished_at(self, db_conn: sqlite3.Connection) -> None:
        svc = WorkoutService(db_conn)
        session = svc.start_session()
        svc.finish_session(session.id)

        row = db_conn.execute(
            "SELECT finished_at FROM workout_sessions WHERE id = ?", (session.id,)
        ).fetchone()
        assert row["finished_at"] is not None

    def test_abandon_preserves_logged_sets(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = WorkoutService(db_conn)
        ex_id = _seed_exercise(db_conn)
        session = svc.start_session()
        svc.log_set(session.id, ex_id, reps=8, weight=135.0)
        svc.abandon_session(session.id)

        count = db_conn.execute(
            "SELECT COUNT(*) AS cnt FROM logged_sets WHERE session_id = ?",
            (session.id,),
        ).fetchone()["cnt"]
        assert count == 1


class TestSessionRecovery:
    def test_get_in_progress_returns_open_session(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = WorkoutService(db_conn)
        session = svc.start_session()
        found = svc.get_in_progress_session()
        assert found is not None
        assert found.id == session.id

    def test_no_in_progress_after_finish(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = WorkoutService(db_conn)
        session = svc.start_session()
        svc.finish_session(session.id)
        assert svc.get_in_progress_session() is None

    def test_no_in_progress_after_abandon(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = WorkoutService(db_conn)
        session = svc.start_session()
        svc.abandon_session(session.id)
        assert svc.get_in_progress_session() is None
