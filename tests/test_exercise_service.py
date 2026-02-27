"""Tests for ExerciseService: create, archive, unarchive, list."""
from __future__ import annotations

import sqlite3

from models.exercise import ExerciseCategory
from services.exercise_service import ExerciseService


class TestCreateExercise:
    def test_create_returns_exercise_with_id(self, db_conn: sqlite3.Connection) -> None:
        svc = ExerciseService(db_conn)
        ex = svc.create("Bench Press", ExerciseCategory.WEIGHT)
        assert ex.id is not None
        assert ex.name == "Bench Press"
        assert ex.category == ExerciseCategory.WEIGHT
        assert ex.is_archived is False

    def test_create_persisted(self, db_conn: sqlite3.Connection) -> None:
        svc = ExerciseService(db_conn)
        ex = svc.create("Squat", ExerciseCategory.WEIGHT)
        row = db_conn.execute(
            "SELECT name, category FROM exercises WHERE id = ?", (ex.id,)
        ).fetchone()
        assert row["name"] == "Squat"
        assert row["category"] == "weight"


class TestArchiveUnarchive:
    def test_archive_hides_from_default_list(self, db_conn: sqlite3.Connection) -> None:
        svc = ExerciseService(db_conn)
        ex = svc.create("Bench Press", ExerciseCategory.WEIGHT)
        svc.archive(ex.id)
        exercises = svc.get_all()
        assert all(e.id != ex.id for e in exercises)

    def test_archived_visible_with_flag(self, db_conn: sqlite3.Connection) -> None:
        svc = ExerciseService(db_conn)
        ex = svc.create("Bench Press", ExerciseCategory.WEIGHT)
        svc.archive(ex.id)
        exercises = svc.get_all(include_archived=True)
        assert any(e.id == ex.id for e in exercises)

    def test_unarchive_restores_to_list(self, db_conn: sqlite3.Connection) -> None:
        svc = ExerciseService(db_conn)
        ex = svc.create("Bench Press", ExerciseCategory.WEIGHT)
        svc.archive(ex.id)
        svc.unarchive(ex.id)
        exercises = svc.get_all()
        assert any(e.id == ex.id for e in exercises)

    def test_archived_flag_persisted(self, db_conn: sqlite3.Connection) -> None:
        svc = ExerciseService(db_conn)
        ex = svc.create("Bench Press", ExerciseCategory.WEIGHT)
        svc.archive(ex.id)
        row = db_conn.execute(
            "SELECT is_archived FROM exercises WHERE id = ?", (ex.id,)
        ).fetchone()
        assert row["is_archived"] == 1


class TestGetAll:
    def test_get_all_returns_active_only_by_default(
        self, db_conn: sqlite3.Connection
    ) -> None:
        svc = ExerciseService(db_conn)
        active = svc.create("Active", ExerciseCategory.WEIGHT)
        archived = svc.create("Archived", ExerciseCategory.WEIGHT)
        svc.archive(archived.id)
        exercises = svc.get_all()
        names = [e.name for e in exercises]
        assert "Active" in names
        assert "Archived" not in names

    def test_get_by_category_filters(self, db_conn: sqlite3.Connection) -> None:
        svc = ExerciseService(db_conn)
        svc.create("Bench", ExerciseCategory.WEIGHT)
        svc.create("Running", ExerciseCategory.CARDIO)
        weight = svc.get_by_category(ExerciseCategory.WEIGHT)
        assert all(e.category == ExerciseCategory.WEIGHT for e in weight)
