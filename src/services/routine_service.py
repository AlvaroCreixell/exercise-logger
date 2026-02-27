from __future__ import annotations

import sqlite3
from typing import Optional

from models.exercise import Exercise
from models.routine import Routine, RoutineDay, RoutineDayExercise
from repositories.routine_repo import RoutineRepo
from repositories.cycle_repo import CycleRepo


class RoutineService:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._repo = RoutineRepo(conn)
        self._cycle_repo = CycleRepo(conn)
        self._conn = conn

    # ── Read ─────────────────────────────────────────────────────

    def get_active_routine(self) -> Optional[Routine]:
        return self._repo.get_active()

    def get_all_routines(self) -> list[Routine]:
        return self._repo.get_all()

    def get_days(self, routine_id: int) -> list[RoutineDay]:
        return self._repo.get_days(routine_id)

    def get_day_exercises(
        self, day_id: int
    ) -> list[tuple[RoutineDayExercise, Exercise]]:
        return self._repo.get_day_exercises_with_detail(day_id)

    # ── Routine write ─────────────────────────────────────────────

    def create_routine(
        self, name: str, description: Optional[str] = None
    ) -> Routine:
        """Create a new (inactive) routine and return it."""
        routine = Routine(
            id=None,
            name=name,
            description=description,
            is_active=False,
            created_at=None,
        )
        new_id = self._repo.insert_routine(routine)
        self._conn.commit()
        return self._repo.get_by_id(new_id)

    def rename_routine(self, routine_id: int, name: str) -> None:
        self._repo.update_routine_name(routine_id, name)
        self._conn.commit()

    def set_active_routine(self, routine_id: int) -> None:
        """Make this the one active routine (deactivates all others)."""
        self._repo.deactivate_all()
        self._repo.set_active(routine_id)
        self._cycle_repo.create_for_routine(routine_id)
        self._conn.commit()

    # ── Day write ─────────────────────────────────────────────────

    def add_day(self, routine_id: int, name: str) -> RoutineDay:
        """Append a new day at the end of the routine."""
        next_index = self._repo.count_days(routine_id)
        day = RoutineDay(
            id=None,
            routine_id=routine_id,
            day_index=next_index,
            name=name,
        )
        new_id = self._repo.insert_day(day)
        self._conn.commit()
        return self._repo.get_day(new_id)

    def rename_day(self, day_id: int, name: str) -> None:
        self._repo.update_day_name(day_id, name)
        self._conn.commit()

    def delete_day(self, day_id: int) -> None:
        """Delete a day, re-sequence siblings, and clamp cycle state."""
        day = self._repo.get_day(day_id)
        if day is None:
            return
        self._repo.delete_day(day_id)
        self._repo.resequence_days_after_delete(day.routine_id, day.day_index)
        # Clamp cycle state if it now points beyond the last day
        total = self._repo.count_days(day.routine_id)
        state = self._cycle_repo.get_state(day.routine_id)
        if state and state.current_day_index >= total:
            from models.routine import RoutineCycleState
            clamped = RoutineCycleState(
                id=state.id,
                routine_id=state.routine_id,
                current_day_index=max(0, total - 1),
                last_session_id=state.last_session_id,
                updated_at=state.updated_at,
            )
            self._cycle_repo.upsert_state(clamped)
        self._conn.commit()

    def move_day_up(self, routine_id: int, day_id: int) -> None:
        """Swap this day with the one before it (lower day_index)."""
        day = self._repo.get_day(day_id)
        if day is None or day.day_index == 0:
            return
        other = self._repo.get_day_by_index(routine_id, day.day_index - 1)
        if other is None:
            return
        self._repo.swap_day_indexes(day.id, day.day_index, other.id, other.day_index)
        self._conn.commit()

    def move_day_down(self, routine_id: int, day_id: int) -> None:
        """Swap this day with the one after it (higher day_index)."""
        day = self._repo.get_day(day_id)
        if day is None:
            return
        other = self._repo.get_day_by_index(routine_id, day.day_index + 1)
        if other is None:
            return
        self._repo.swap_day_indexes(day.id, day.day_index, other.id, other.day_index)
        self._conn.commit()

    # ── Exercise write ────────────────────────────────────────────

    def add_exercise_to_day(
        self,
        day_id: int,
        exercise_id: int,
        target_sets: Optional[int] = None,
        target_reps: Optional[int] = None,
        target_weight: Optional[float] = None,
        target_duration_min: Optional[float] = None,
        target_distance_km: Optional[float] = None,
        target_intensity: Optional[str] = None,
    ) -> RoutineDayExercise:
        """Append an exercise to the end of a day's list."""
        existing = self._repo.get_day_exercises(day_id)
        sort_order = len(existing)
        rde = RoutineDayExercise(
            id=None,
            routine_day_id=day_id,
            exercise_id=exercise_id,
            sort_order=sort_order,
            target_sets=target_sets,
            target_reps=target_reps,
            target_weight=target_weight,
            target_duration_min=target_duration_min,
            target_distance_km=target_distance_km,
            target_intensity=target_intensity,
            notes=None,
        )
        new_id = self._repo.insert_day_exercise(rde)
        self._conn.commit()
        rde.id = new_id
        return rde

    def remove_exercise_from_day(self, rde_id: int) -> None:
        rde = self._repo.get_day_exercise_by_id(rde_id)
        if rde is None:
            return
        self._repo.delete_day_exercise(rde_id)
        self._repo.resequence_exercises_after_delete(rde.routine_day_id, rde.sort_order)
        self._conn.commit()
