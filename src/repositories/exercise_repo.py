from __future__ import annotations

import sqlite3
from typing import Optional

from models.exercise import Exercise, ExerciseCategory
from repositories.base import BaseRepository


def _row_to_exercise(row: sqlite3.Row) -> Exercise:
    return Exercise(
        id=row["id"],
        name=row["name"],
        category=ExerciseCategory(row["category"]),
        equipment=row["equipment"],
        muscle_group=row["muscle_group"],
        notes=row["notes"],
        is_archived=bool(row["is_archived"]),
        created_at=row["created_at"],
    )


class ExerciseRepo(BaseRepository):
    def get_all(self, include_archived: bool = False) -> list[Exercise]:
        if include_archived:
            rows = self._fetchall("SELECT * FROM exercises ORDER BY name ASC")
        else:
            rows = self._fetchall(
                "SELECT * FROM exercises WHERE is_archived = 0 ORDER BY name ASC"
            )
        return [_row_to_exercise(r) for r in rows]

    def get_by_id(self, exercise_id: int) -> Optional[Exercise]:
        row = self._fetchone(
            "SELECT * FROM exercises WHERE id = ?", (exercise_id,)
        )
        return _row_to_exercise(row) if row else None

    def get_by_category(self, category: ExerciseCategory) -> list[Exercise]:
        rows = self._fetchall(
            "SELECT * FROM exercises WHERE category = ? AND is_archived = 0"
            " ORDER BY name ASC",
            (category.value,),
        )
        return [_row_to_exercise(r) for r in rows]

    def insert(self, exercise: Exercise) -> int:
        return self._insert(
            "INSERT INTO exercises (name, category, equipment, muscle_group, notes)"
            " VALUES (?, ?, ?, ?, ?)",
            (
                exercise.name,
                exercise.category.value,
                exercise.equipment,
                exercise.muscle_group,
                exercise.notes,
            ),
        )

    def archive(self, exercise_id: int) -> None:
        self._execute(
            "UPDATE exercises SET is_archived = 1 WHERE id = ?", (exercise_id,)
        )

    def unarchive(self, exercise_id: int) -> None:
        self._execute(
            "UPDATE exercises SET is_archived = 0 WHERE id = ?", (exercise_id,)
        )
