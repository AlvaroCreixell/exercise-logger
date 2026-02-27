from __future__ import annotations

import sqlite3

from models.exercise import Exercise, ExerciseCategory
from repositories.exercise_repo import ExerciseRepo


class ExerciseService:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._repo = ExerciseRepo(conn)
        self._conn = conn

    def get_all(self, include_archived: bool = False) -> list[Exercise]:
        return self._repo.get_all(include_archived=include_archived)

    def get_by_category(self, category: ExerciseCategory) -> list[Exercise]:
        return self._repo.get_by_category(category)

    def create(
        self,
        name: str,
        category: ExerciseCategory,
        equipment: str | None = None,
    ) -> Exercise:
        exercise = Exercise(
            id=None,
            name=name,
            category=category,
            equipment=equipment,
            muscle_group=None,
            notes=None,
            is_archived=False,
            created_at=None,
        )
        new_id = self._repo.insert(exercise)
        self._conn.commit()
        return self._repo.get_by_id(new_id)

    def archive(self, exercise_id: int) -> None:
        self._repo.archive(exercise_id)
        self._conn.commit()

    def unarchive(self, exercise_id: int) -> None:
        self._repo.unarchive(exercise_id)
        self._conn.commit()
