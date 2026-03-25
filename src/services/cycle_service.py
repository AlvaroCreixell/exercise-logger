"""Cycle service — manages routine day cycling."""
from typing import Optional
from src.models.routine import RoutineDay
from src.repositories.cycle_repo import CycleRepo
from src.repositories.routine_repo import RoutineRepo


class CycleService:
    """Manages routine day cycling.

    Note: CycleService methods write to the DB but do NOT commit.
    They are designed to be called within a larger transaction managed
    by the calling service (e.g., RoutineService, WorkoutService).
    The caller is responsible for committing.
    """

    def __init__(self, cycle_repo: CycleRepo, routine_repo: RoutineRepo):
        self._cycle_repo = cycle_repo
        self._routine_repo = routine_repo

    def initialize(self, routine_id: int) -> None:
        """Set cycle to first day by sort_order. Clears state if no days."""
        days = self._routine_repo.get_days(routine_id)
        if days:
            self._cycle_repo.set_current_day(routine_id, days[0].id)
        else:
            self._cycle_repo.delete_state(routine_id)

    def get_current_day(self, routine_id: int) -> Optional[RoutineDay]:
        day_id = self._cycle_repo.get_current_day_id(routine_id)
        if day_id is None:
            return None
        return self._routine_repo.get_day(day_id)

    def advance(self, routine_id: int) -> Optional[RoutineDay]:
        """Advance to next day by sort_order, wrap at end. Returns new current day."""
        current_day_id = self._cycle_repo.get_current_day_id(routine_id)
        days = self._routine_repo.get_days(routine_id)

        if not days:
            return None

        if current_day_id is None:
            self._cycle_repo.set_current_day(routine_id, days[0].id)
            return days[0]

        # Find current position
        current_idx = None
        for i, day in enumerate(days):
            if day.id == current_day_id:
                current_idx = i
                break

        if current_idx is None:
            # Current day no longer exists — reset to first
            self._cycle_repo.set_current_day(routine_id, days[0].id)
            return days[0]

        next_idx = (current_idx + 1) % len(days)
        next_day = days[next_idx]
        self._cycle_repo.set_current_day(routine_id, next_day.id)
        return next_day

    def set_day(self, routine_id: int, day_id: int) -> None:
        """Manual override. Validates day belongs to routine."""
        self._validate_day_belongs_to_routine(routine_id, day_id)
        self._cycle_repo.set_current_day(routine_id, day_id)

    def handle_day_deleted(self, routine_id: int, deleted_day_id: int) -> None:
        """Adjust cycle state when a day is about to be deleted.

        Call this BEFORE the actual delete so the day still exists for lookup.
        If deleted day is current: pick next by sort_order, or wrap to first.
        If deleted day is not current: no change.
        """
        current_day_id = self._cycle_repo.get_current_day_id(routine_id)
        if current_day_id != deleted_day_id:
            return

        days = self._routine_repo.get_days(routine_id)
        remaining = [d for d in days if d.id != deleted_day_id]

        if not remaining:
            self._cycle_repo.delete_state(routine_id)
            return

        deleted_day = next(d for d in days if d.id == deleted_day_id)
        after = [d for d in remaining if d.sort_order > deleted_day.sort_order]

        if after:
            self._cycle_repo.set_current_day(routine_id, after[0].id)
        else:
            self._cycle_repo.set_current_day(routine_id, remaining[0].id)

    def _validate_day_belongs_to_routine(self, routine_id: int, day_id: int) -> None:
        day = self._routine_repo.get_day(day_id)
        if not day or day.routine_id != routine_id:
            raise ValueError(f"Day {day_id} does not belong to routine {routine_id}")
