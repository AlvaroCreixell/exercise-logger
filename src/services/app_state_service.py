# src/services/app_state_service.py
"""AppStateService — startup reconciliation, active routine, cycle management."""
from typing import Optional

from src.models.bundled import Routine, RoutineDay
from src.registries.routine_registry import RoutineRegistry
from src.repositories.settings_repo import SettingsRepo
from src.repositories.workout_repo import WorkoutRepo


class AppStateService:
    def __init__(
        self,
        settings_repo: SettingsRepo,
        routine_registry: RoutineRegistry,
        workout_repo: WorkoutRepo,
    ):
        self._settings = settings_repo
        self._routines = routine_registry
        self._workouts = workout_repo

    # ------------------------------------------------------------------
    # Startup reconciliation
    # ------------------------------------------------------------------

    def reconcile_on_startup(self) -> dict:
        """Validate settings against current registries.

        Returns dict:
            routine_cleared: bool — active routine was invalid, cleared
            day_reset: bool — day key was invalid, reset to first day
            has_in_progress_session: bool — an in-progress session exists
        """
        routine_cleared = False
        day_reset = False

        routine_key = self._settings.get("active_routine_key")
        if routine_key is not None:
            routine = self._routines.get(routine_key)
            if routine is None:
                # Stale routine — clear both
                self._settings.delete("active_routine_key")
                self._settings.delete("current_day_key")
                self._settings.commit()
                routine_cleared = True
            else:
                # Routine valid — check day
                day_key = self._settings.get("current_day_key")
                day_keys = [d.key for d in routine.days]
                if day_key not in day_keys:
                    self._settings.set("current_day_key", routine.days[0].key)
                    self._settings.commit()
                    day_reset = True

        has_in_progress = self._workouts.get_in_progress_session() is not None

        return {
            "routine_cleared": routine_cleared,
            "day_reset": day_reset,
            "has_in_progress_session": has_in_progress,
        }

    # ------------------------------------------------------------------
    # Active routine
    # ------------------------------------------------------------------

    def get_active_routine(self) -> Optional[Routine]:
        """Return the active routine, or None if none is set."""
        key = self._settings.get("active_routine_key")
        if key is None:
            return None
        return self._routines.get(key)

    def get_current_day(self) -> Optional[RoutineDay]:
        """Return the current day of the active routine, or None."""
        routine = self.get_active_routine()
        if routine is None:
            return None
        day_key = self._settings.get("current_day_key")
        if day_key is None:
            return None
        for day in routine.days:
            if day.key == day_key:
                return day
        return None

    def set_active_routine(self, routine_key: str) -> None:
        """Set the active routine and reset current day to its first day.

        Raises ValueError if routine_key is not in registry or a workout
        is in progress.
        """
        # Block if workout in progress
        if self._workouts.get_in_progress_session() is not None:
            raise ValueError("Cannot switch routines while a workout is in progress")

        routine = self._routines.get(routine_key)
        if routine is None:
            raise ValueError(f"Routine '{routine_key}' not found in registry")

        if not routine.days:
            raise ValueError(f"Routine '{routine_key}' has no days")

        self._settings.set("active_routine_key", routine_key)
        self._settings.set("current_day_key", routine.days[0].key)
        self._settings.commit()

    # ------------------------------------------------------------------
    # Cycle management
    # ------------------------------------------------------------------

    def advance_day(self) -> str:
        """Advance current_day_key to the next day. Wraps at end.

        Returns the new day key.
        Raises ValueError if no active routine.
        """
        routine = self.get_active_routine()
        if routine is None:
            raise ValueError("No active routine set")

        current_key = self._settings.get("current_day_key")
        day_keys = [d.key for d in routine.days]

        try:
            idx = day_keys.index(current_key)
        except ValueError:
            idx = -1  # Will wrap to 0

        next_idx = (idx + 1) % len(day_keys)
        new_key = day_keys[next_idx]

        self._settings.set("current_day_key", new_key)
        self._settings.commit()
        return new_key

    def has_in_progress_session(self) -> bool:
        """Check if there is an in-progress workout session."""
        return self._workouts.get_in_progress_session() is not None
