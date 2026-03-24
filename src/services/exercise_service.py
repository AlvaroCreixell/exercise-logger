"""Exercise service — CRUD with validation."""
from typing import List, Optional
from src.models.exercise import Exercise, ExerciseType
from src.repositories.exercise_repo import ExerciseRepo


class ExerciseService:
    def __init__(self, exercise_repo: ExerciseRepo):
        self._repo = exercise_repo

    def create_exercise(
        self,
        name: str,
        type: ExerciseType,
        muscle_group: Optional[str] = None,
        equipment: Optional[str] = None,
    ) -> Exercise:
        existing = self._repo.get_by_name_insensitive(name)
        if existing:
            raise ValueError(f"Exercise '{existing.name}' already exists")

        exercise = Exercise(
            id=None, name=name, type=type,
            muscle_group=muscle_group, equipment=equipment,
        )
        exercise.id = self._repo.create(exercise)
        self._repo.commit()
        return exercise

    def get_exercise(self, exercise_id: int) -> Optional[Exercise]:
        return self._repo.get_by_id(exercise_id)

    def list_exercises(self, include_archived: bool = False) -> List[Exercise]:
        return self._repo.list_all(include_archived)

    def update_exercise(self, exercise: Exercise) -> Exercise:
        if exercise.id is None:
            raise ValueError("Exercise must have an id for update")
        existing = self._repo.get_by_id(exercise.id)
        if not existing:
            raise ValueError(f"Exercise {exercise.id} not found")
        if exercise.name != existing.name:
            dup = self._repo.get_by_name_insensitive(exercise.name)
            if dup and dup.id != exercise.id:
                raise ValueError(f"Exercise '{dup.name}' already exists")
        self._repo.update(exercise)
        self._repo.commit()
        return exercise

    def archive_exercise(self, exercise_id: int) -> None:
        self._repo.archive(exercise_id)
        self._repo.commit()

    def unarchive_exercise(self, exercise_id: int) -> None:
        self._repo.unarchive(exercise_id)
        self._repo.commit()
