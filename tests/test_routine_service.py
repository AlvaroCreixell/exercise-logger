"""Tests for RoutineService: create, days, exercises, reordering, active."""
from __future__ import annotations

import sqlite3

import pytest

from services.routine_service import RoutineService
from services.exercise_service import ExerciseService
from models.exercise import ExerciseCategory


def _make_exercise(conn: sqlite3.Connection, name: str = "Bench Press") -> int:
    cur = conn.execute(
        "INSERT INTO exercises (name, category) VALUES (?, 'weight')", (name,)
    )
    conn.commit()
    return cur.lastrowid


class TestCreateRoutine:
    def test_create_returns_routine_with_id(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("PPL")
        assert r.id is not None
        assert r.name == "PPL"
        assert r.is_active is False

    def test_create_persisted(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("My Routine")
        row = db_conn.execute(
            "SELECT name FROM routines WHERE id = ?", (r.id,)
        ).fetchone()
        assert row["name"] == "My Routine"

    def test_new_routine_inactive_by_default(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("Unused")
        assert r.is_active is False


class TestSetActiveRoutine:
    def test_set_active_activates_routine(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("A")
        svc.set_active_routine(r.id)
        active = svc.get_active_routine()
        assert active is not None
        assert active.id == r.id

    def test_set_active_deactivates_previous(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r1 = svc.create_routine("A")
        r2 = svc.create_routine("B")
        svc.set_active_routine(r1.id)
        svc.set_active_routine(r2.id)
        active = svc.get_active_routine()
        assert active.id == r2.id
        row = db_conn.execute(
            "SELECT is_active FROM routines WHERE id = ?", (r1.id,)
        ).fetchone()
        assert row["is_active"] == 0

    def test_only_one_active_at_a_time(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r1 = svc.create_routine("A")
        r2 = svc.create_routine("B")
        svc.set_active_routine(r1.id)
        svc.set_active_routine(r2.id)
        count = db_conn.execute(
            "SELECT COUNT(*) AS cnt FROM routines WHERE is_active = 1"
        ).fetchone()["cnt"]
        assert count == 1


class TestDays:
    def test_add_day_appends(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("PPL")
        d0 = svc.add_day(r.id, "Push")
        d1 = svc.add_day(r.id, "Pull")
        assert d0.day_index == 0
        assert d1.day_index == 1

    def test_get_days_ordered(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("PPL")
        svc.add_day(r.id, "Push")
        svc.add_day(r.id, "Pull")
        svc.add_day(r.id, "Legs")
        days = svc.get_days(r.id)
        assert [d.name for d in days] == ["Push", "Pull", "Legs"]

    def test_delete_day_resequences(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("PPL")
        d0 = svc.add_day(r.id, "Push")
        d1 = svc.add_day(r.id, "Pull")
        d2 = svc.add_day(r.id, "Legs")
        svc.delete_day(d1.id)
        days = svc.get_days(r.id)
        assert len(days) == 2
        assert days[0].name == "Push"
        assert days[0].day_index == 0
        assert days[1].name == "Legs"
        assert days[1].day_index == 1

    def test_move_day_up(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("A")
        d0 = svc.add_day(r.id, "Day0")
        d1 = svc.add_day(r.id, "Day1")
        svc.move_day_up(r.id, d1.id)
        days = svc.get_days(r.id)
        assert days[0].name == "Day1"
        assert days[1].name == "Day0"

    def test_move_day_down(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("A")
        d0 = svc.add_day(r.id, "Day0")
        d1 = svc.add_day(r.id, "Day1")
        svc.move_day_down(r.id, d0.id)
        days = svc.get_days(r.id)
        assert days[0].name == "Day1"
        assert days[1].name == "Day0"

    def test_move_first_day_up_is_noop(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("A")
        d0 = svc.add_day(r.id, "Day0")
        svc.add_day(r.id, "Day1")
        svc.move_day_up(r.id, d0.id)  # already at top
        days = svc.get_days(r.id)
        assert days[0].name == "Day0"

    def test_rename_day(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        r = svc.create_routine("A")
        d = svc.add_day(r.id, "Old Name")
        svc.rename_day(d.id, "New Name")
        days = svc.get_days(r.id)
        assert days[0].name == "New Name"


class TestDayExercises:
    def test_add_exercise_to_day(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        ex_id = _make_exercise(db_conn)
        r = svc.create_routine("A")
        d = svc.add_day(r.id, "Push")
        rde = svc.add_exercise_to_day(
            d.id, ex_id, target_sets=3, target_reps=8, target_weight=135.0
        )
        assert rde.id is not None
        assert rde.target_sets == 3
        assert rde.target_reps == 8
        assert rde.target_weight == 135.0

    def test_exercises_appended_in_order(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        ex1 = _make_exercise(db_conn, "Bench")
        ex2 = _make_exercise(db_conn, "OHP")
        r = svc.create_routine("A")
        d = svc.add_day(r.id, "Push")
        rde1 = svc.add_exercise_to_day(d.id, ex1)
        rde2 = svc.add_exercise_to_day(d.id, ex2)
        assert rde1.sort_order == 0
        assert rde2.sort_order == 1

    def test_remove_exercise_from_day(self, db_conn: sqlite3.Connection) -> None:
        svc = RoutineService(db_conn)
        ex_id = _make_exercise(db_conn)
        r = svc.create_routine("A")
        d = svc.add_day(r.id, "Push")
        rde = svc.add_exercise_to_day(d.id, ex_id)
        svc.remove_exercise_from_day(rde.id)
        pairs = svc.get_day_exercises(d.id)
        assert len(pairs) == 0
