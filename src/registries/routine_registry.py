"""In-memory routine registry — loaded once at startup, read-only at runtime."""
from __future__ import annotations
from typing import List, Optional
from src.models.bundled import Routine, RoutineDay


class RoutineRegistry:
    """Immutable registry of routine templates loaded from YAML."""

    def __init__(self, routines: List[Routine]):
        self._by_key: dict[str, Routine] = {}
        for routine in routines:
            if routine.key in self._by_key:
                raise ValueError(f"Duplicate routine key: {routine.key}")
            self._by_key[routine.key] = routine
        self._all: tuple[Routine, ...] = tuple(routines)

    def get(self, key: str) -> Optional[Routine]:
        """Get routine by key, or None if not found."""
        return self._by_key.get(key)

    def get_or_raise(self, key: str) -> Routine:
        """Get routine by key, or raise KeyError."""
        routine = self._by_key.get(key)
        if routine is None:
            raise KeyError(f"Unknown routine key: '{key}'")
        return routine

    def contains(self, key: str) -> bool:
        """Check if a routine key exists."""
        return key in self._by_key

    def list_all(self) -> tuple[Routine, ...]:
        """Return all routines in load order."""
        return self._all

    def get_day(self, routine_key: str, day_key: str) -> Optional[RoutineDay]:
        """Get a specific day within a routine, or None if not found."""
        routine = self._by_key.get(routine_key)
        if routine is None:
            return None
        for day in routine.days:
            if day.key == day_key:
                return day
        return None

    def get_next_day_key(self, routine_key: str, current_day_key: str) -> str:
        """Get the next day key in the routine cycle (wraps to first).

        Args:
            routine_key: The routine key.
            current_day_key: The current day key.

        Returns:
            The next day's key, wrapping to first if at end.

        Raises:
            KeyError: If routine_key or current_day_key not found.
        """
        routine = self.get_or_raise(routine_key)
        for i, day in enumerate(routine.days):
            if day.key == current_day_key:
                next_idx = (i + 1) % len(routine.days)
                return routine.days[next_idx].key
        raise KeyError(
            f"Day key '{current_day_key}' not found in routine '{routine_key}'"
        )

    def __len__(self) -> int:
        return len(self._all)

    def __contains__(self, key: str) -> bool:
        return key in self._by_key
