"""Exercise repository — CRUD and archiving."""
from typing import List, Optional
from src.models.exercise import Exercise, ExerciseType
from src.repositories.base import BaseRepository


class ExerciseRepo(BaseRepository):

    def create(self, exercise: Exercise) -> int:
        return self._insert(
            """INSERT INTO exercises (name, type, muscle_group, equipment, is_archived)
               VALUES (?, ?, ?, ?, ?)""",
            (exercise.name, exercise.type.value, exercise.muscle_group,
             exercise.equipment, int(exercise.is_archived)),
        )

    def get_by_id(self, exercise_id: int) -> Optional[Exercise]:
        row = self._fetchone("SELECT * FROM exercises WHERE id = ?", (exercise_id,))
        return self._to_model(row) if row else None

    def get_by_name(self, name: str) -> Optional[Exercise]:
        row = self._fetchone("SELECT * FROM exercises WHERE name = ?", (name,))
        return self._to_model(row) if row else None

    def get_by_name_insensitive(self, name: str) -> Optional[Exercise]:
        row = self._fetchone(
            "SELECT * FROM exercises WHERE LOWER(name) = LOWER(?)", (name,)
        )
        return self._to_model(row) if row else None

    def list_all(self, include_archived: bool = False) -> List[Exercise]:
        if include_archived:
            rows = self._fetchall("SELECT * FROM exercises ORDER BY name")
        else:
            rows = self._fetchall(
                "SELECT * FROM exercises WHERE is_archived = 0 ORDER BY name"
            )
        return [self._to_model(r) for r in rows]

    def update(self, exercise: Exercise) -> None:
        self._execute(
            """UPDATE exercises SET name = ?, type = ?, muscle_group = ?,
               equipment = ?, is_archived = ? WHERE id = ?""",
            (exercise.name, exercise.type.value, exercise.muscle_group,
             exercise.equipment, int(exercise.is_archived), exercise.id),
        )

    def archive(self, exercise_id: int) -> None:
        self._execute(
            "UPDATE exercises SET is_archived = 1 WHERE id = ?", (exercise_id,)
        )

    def unarchive(self, exercise_id: int) -> None:
        self._execute(
            "UPDATE exercises SET is_archived = 0 WHERE id = ?", (exercise_id,)
        )

    def _to_model(self, row) -> Exercise:
        return Exercise(
            id=row["id"],
            name=row["name"],
            type=ExerciseType(row["type"]),
            muscle_group=row["muscle_group"],
            equipment=row["equipment"],
            is_archived=bool(row["is_archived"]),
        )
