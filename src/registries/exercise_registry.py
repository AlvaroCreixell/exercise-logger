"""In-memory exercise registry — loaded once at startup, read-only at runtime."""
from __future__ import annotations
from typing import List, Optional
from src.models.bundled import Exercise
from src.models.enums import ExerciseType


class ExerciseRegistry:
    """Immutable registry of exercises loaded from CSV.

    Provides O(1) lookup by key and filtered listing.
    """

    def __init__(self, exercises: List[Exercise]):
        self._by_key: dict[str, Exercise] = {}
        for ex in exercises:
            if ex.key in self._by_key:
                raise ValueError(f"Duplicate exercise key: {ex.key}")
            self._by_key[ex.key] = ex
        self._all: tuple[Exercise, ...] = tuple(exercises)

    def get(self, key: str) -> Optional[Exercise]:
        """Get exercise by key, or None if not found."""
        return self._by_key.get(key)

    def get_or_raise(self, key: str) -> Exercise:
        """Get exercise by key, or raise KeyError."""
        ex = self._by_key.get(key)
        if ex is None:
            raise KeyError(f"Unknown exercise key: '{key}'")
        return ex

    def contains(self, key: str) -> bool:
        """Check if an exercise key exists."""
        return key in self._by_key

    def list_all(self) -> tuple[Exercise, ...]:
        """Return all exercises in load order."""
        return self._all

    def list_by_type(self, exercise_type: ExerciseType) -> List[Exercise]:
        """Return exercises filtered by type."""
        return [ex for ex in self._all if ex.type == exercise_type]

    def list_by_muscle_group(self, muscle_group: str) -> List[Exercise]:
        """Return exercises filtered by muscle group (case-sensitive)."""
        return [ex for ex in self._all if ex.muscle_group == muscle_group]

    def __len__(self) -> int:
        return len(self._all)

    def __contains__(self, key: str) -> bool:
        return key in self._by_key
