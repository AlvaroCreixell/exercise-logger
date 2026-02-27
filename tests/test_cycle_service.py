"""Tests for CycleService: advance, wrap-around, override, reset."""
from __future__ import annotations

import sqlite3

from services.cycle_service import CycleService
from services.workout_service import WorkoutService


def _seed_routine(conn: sqlite3.Connection, num_days: int = 3) -> int:
    """Insert a minimal routine with num_days days. Returns routine_id."""
    cur = conn.execute(
        "INSERT INTO routines (name, is_active) VALUES ('Test Routine', 1)"
    )
    routine_id = cur.lastrowid

    for i in range(num_days):
        conn.execute(
            "INSERT INTO routine_days (routine_id, day_index, name) VALUES (?, ?, ?)",
            (routine_id, i, f"Day {i}"),
        )

    conn.execute(
        "INSERT INTO routine_cycle_state (routine_id, current_day_index) VALUES (?, 0)",
        (routine_id,),
    )
    conn.commit()
    return routine_id


class TestAdvanceCycle:
    def test_advance_increments_day(self, db_conn: sqlite3.Connection) -> None:
        svc = CycleService(db_conn)
        workout_svc = WorkoutService(db_conn)
        routine_id = _seed_routine(db_conn, num_days=3)

        session = workout_svc.start_session(routine_id=routine_id)
        workout_svc.finish_session(session.id)
        svc.advance(routine_id, session.id)

        assert svc.get_current_index(routine_id) == 1

    def test_advance_wraps_around(self, db_conn: sqlite3.Connection) -> None:
        svc = CycleService(db_conn)
        workout_svc = WorkoutService(db_conn)
        routine_id = _seed_routine(db_conn, num_days=3)

        # Complete 3 sessions → should wrap back to day 0
        for _ in range(3):
            s = workout_svc.start_session(routine_id=routine_id)
            workout_svc.finish_session(s.id)
            svc.advance(routine_id, s.id)

        assert svc.get_current_index(routine_id) == 0

    def test_advance_single_day_routine_stays_at_zero(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = CycleService(db_conn)
        workout_svc = WorkoutService(db_conn)
        routine_id = _seed_routine(db_conn, num_days=1)

        s = workout_svc.start_session(routine_id=routine_id)
        workout_svc.finish_session(s.id)
        svc.advance(routine_id, s.id)

        assert svc.get_current_index(routine_id) == 0

    def test_cycle_does_not_advance_on_abandon(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = CycleService(db_conn)
        workout_svc = WorkoutService(db_conn)
        routine_id = _seed_routine(db_conn, num_days=3)

        # abandon without calling advance
        s = workout_svc.start_session(routine_id=routine_id)
        workout_svc.abandon_session(s.id)
        # cycle stays at day 0
        assert svc.get_current_index(routine_id) == 0


class TestOverrideCycle:
    def test_override_sets_day_index(self, db_conn: sqlite3.Connection) -> None:
        svc = CycleService(db_conn)
        routine_id = _seed_routine(db_conn, num_days=3)

        svc.override_day(routine_id, 2)
        assert svc.get_current_index(routine_id) == 2

    def test_advance_after_override_is_relative_to_override(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = CycleService(db_conn)
        workout_svc = WorkoutService(db_conn)
        routine_id = _seed_routine(db_conn, num_days=3)

        svc.override_day(routine_id, 2)
        s = workout_svc.start_session(routine_id=routine_id)
        workout_svc.finish_session(s.id)
        svc.advance(routine_id, s.id)

        # Day 2 + 1 = Day 0 (wrap)
        assert svc.get_current_index(routine_id) == 0


class TestGetCurrentDay:
    def test_returns_correct_day(self, db_conn: sqlite3.Connection) -> None:
        svc = CycleService(db_conn)
        routine_id = _seed_routine(db_conn, num_days=3)

        day = svc.get_current_day(routine_id)
        assert day is not None
        assert day.day_index == 0
        assert day.name == "Day 0"

    def test_returns_none_for_unknown_routine(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = CycleService(db_conn)
        day = svc.get_current_day(routine_id=9999)
        assert day is None


class TestResetCycle:
    def test_reset_returns_to_day_zero(self, db_conn: sqlite3.Connection) -> None:
        svc = CycleService(db_conn)
        workout_svc = WorkoutService(db_conn)
        routine_id = _seed_routine(db_conn, num_days=3)

        s = workout_svc.start_session(routine_id=routine_id)
        workout_svc.finish_session(s.id)
        svc.advance(routine_id, s.id)
        assert svc.get_current_index(routine_id) == 1

        svc.reset(routine_id)
        assert svc.get_current_index(routine_id) == 0
