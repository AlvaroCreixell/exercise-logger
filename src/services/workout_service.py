# src/services/workout_service.py
"""WorkoutService — session lifecycle, set logging, editing."""
from datetime import datetime, timezone
from typing import List, Optional

from src.models.enums import ExerciseType, ExerciseSource, SessionStatus
from src.models.workout import (
    WorkoutSession, SessionExercise, LoggedSet,
)
from src.registries.exercise_registry import ExerciseRegistry
from src.registries.routine_registry import RoutineRegistry
from src.repositories.settings_repo import SettingsRepo
from src.repositories.workout_repo import WorkoutRepo
from src.services.app_state_service import AppStateService


class WorkoutService:
    def __init__(
        self,
        workout_repo: WorkoutRepo,
        settings_repo: SettingsRepo,
        exercise_registry: ExerciseRegistry,
        routine_registry: RoutineRegistry,
        app_state_service: AppStateService,
    ):
        self._repo = workout_repo
        self._settings = settings_repo
        self._exercises = exercise_registry
        self._routines = routine_registry
        self._app_state = app_state_service

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    def start_session(self) -> WorkoutSession:
        """Start a new workout session.

        Creates session + snapshots all planned exercises in one transaction.
        Always reads the current day from settings via app_state_service.

        Raises ValueError if:
        - No active routine set
        - Another session is already in progress
        - No current day set
        """
        # Check no in-progress session
        if self._repo.get_in_progress_session() is not None:
            raise ValueError("A session is already in progress")

        # Get active routine
        routine = self._app_state.get_active_routine()
        if routine is None:
            raise ValueError("No active routine set")

        # Resolve day from settings
        day = self._app_state.get_current_day()
        if day is None:
            raise ValueError("No current day set")

        # Create session
        session = WorkoutSession(
            id=None,
            routine_key_snapshot=routine.key,
            routine_name_snapshot=routine.name,
            day_key_snapshot=day.key,
            day_label_snapshot=day.label,
            day_name_snapshot=day.name,
            status=SessionStatus.IN_PROGRESS,
            completed_fully=None,
            started_at=self._now(),
        )
        session.id = self._repo.create_session(session)

        # Snapshot planned exercises
        for i, de in enumerate(day.exercises):
            exercise = self._exercises.get(de.exercise_key)
            if exercise is None:
                continue  # skip if exercise removed from catalog

            se = SessionExercise(
                id=None,
                session_id=session.id,
                sort_order=i,
                exercise_key_snapshot=exercise.key,
                exercise_name_snapshot=exercise.name,
                exercise_type_snapshot=exercise.type,
                source=ExerciseSource.PLANNED,
                scheme_snapshot=de.scheme,
                planned_sets=de.sets,
                target_reps_min=de.reps_min,
                target_reps_max=de.reps_max,
                target_duration_seconds=de.duration_seconds,
                target_distance_km=de.distance_km,
                plan_notes_snapshot=de.notes,
            )
            self._repo.add_session_exercise(se)

        self._repo.commit()
        return session

    def finish_session(self, session_id: int) -> WorkoutSession:
        """Finish a workout. completed_fully=True. Advances cycle.

        Raises ValueError if session not found or not in progress.
        """
        session = self._repo.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        self._repo.finish_session(session_id, completed_fully=True,
                                  finished_at=self._now())
        self._app_state.advance_day()
        self._repo.commit()
        return self._repo.get_session(session_id)

    def end_early(self, session_id: int) -> WorkoutSession:
        """End session early. completed_fully=False.
        Requires >=1 logged set. Advances cycle.

        Raises ValueError if session not found, not in progress,
        or has zero sets.
        """
        session = self._repo.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        total_sets = self._repo.get_session_total_set_count(session_id)
        if total_sets == 0:
            raise ValueError("Cannot end early — session has no logged sets. "
                             "Use cancel for sessions with at least one set.")

        self._repo.finish_session(session_id, completed_fully=False,
                                  finished_at=self._now())
        self._app_state.advance_day()
        self._repo.commit()
        return self._repo.get_session(session_id)

    def cancel_session(self, session_id: int) -> None:
        """Cancel a workout. Deletes the empty session. Does not advance cycle.

        Raises ValueError if session not found, not in progress,
        or has logged sets.
        """
        session = self._repo.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        total_sets = self._repo.get_session_total_set_count(session_id)
        if total_sets > 0:
            raise ValueError("Cannot cancel — session has logged sets. "
                             "Use end_early instead.")

        self._repo.delete_session(session_id)
        self._repo.commit()

    # ------------------------------------------------------------------
    # Session exercises
    # ------------------------------------------------------------------

    def get_session_exercises(self, session_id: int) -> List[SessionExercise]:
        return self._repo.get_session_exercises(session_id)

    def add_ad_hoc_exercise(self, session_id: int,
                            exercise_key: str) -> SessionExercise:
        """Add an ad-hoc exercise to an in-progress session.

        Raises ValueError if session not in progress or exercise not found.
        """
        session = self._repo.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        exercise = self._exercises.get(exercise_key)
        if exercise is None:
            raise ValueError(f"Exercise '{exercise_key}' not found in catalog")

        max_order = self._repo.get_max_sort_order(session_id)
        next_order = (max_order + 1) if max_order is not None else 0

        se = SessionExercise(
            id=None,
            session_id=session_id,
            sort_order=next_order,
            exercise_key_snapshot=exercise.key,
            exercise_name_snapshot=exercise.name,
            exercise_type_snapshot=exercise.type,
            source=ExerciseSource.AD_HOC,
            scheme_snapshot=None,
            planned_sets=None,
            target_reps_min=None,
            target_reps_max=None,
            target_duration_seconds=None,
            target_distance_km=None,
            plan_notes_snapshot=None,
        )
        se.id = self._repo.add_session_exercise(se)
        self._repo.commit()
        return se

    # ------------------------------------------------------------------
    # Set logging
    # ------------------------------------------------------------------

    def log_set(
        self,
        session_exercise_id: int,
        reps: Optional[int] = None,
        weight: Optional[float] = None,
        duration_seconds: Optional[int] = None,
        distance_km: Optional[float] = None,
    ) -> LoggedSet:
        """Log a set. Validates fields against exercise type.
        Committed immediately (crash safety).
        """
        se = self._repo.get_session_exercise(session_exercise_id)
        if se is None:
            raise ValueError(
                f"Session exercise {session_exercise_id} not found")

        self._validate_set_fields(se.exercise_type_snapshot,
                                  reps, weight, duration_seconds, distance_km)

        set_number = self._repo.get_next_set_number(session_exercise_id)
        ls = LoggedSet(
            id=None,
            session_exercise_id=session_exercise_id,
            set_number=set_number,
            reps=reps,
            weight=weight,
            duration_seconds=duration_seconds,
            distance_km=distance_km,
            logged_at=self._now(),
        )
        ls.id = self._repo.add_logged_set(ls)
        self._repo.commit()
        return ls

    def edit_set(
        self,
        set_id: int,
        reps: Optional[int] = ...,
        weight: Optional[float] = ...,
        duration_seconds: Optional[int] = ...,
        distance_km: Optional[float] = ...,
    ) -> LoggedSet:
        """Edit a logged set. Only updates fields that are explicitly passed.
        Uses ... (Ellipsis) as sentinel for "not provided".
        """
        ls = self._repo.get_logged_set(set_id)
        if ls is None:
            raise ValueError(f"Logged set {set_id} not found")

        se = self._repo.get_session_exercise(ls.session_exercise_id)

        # Apply updates (Ellipsis means "not provided")
        if reps is not ...:
            ls.reps = reps
        if weight is not ...:
            ls.weight = weight
        if duration_seconds is not ...:
            ls.duration_seconds = duration_seconds
        if distance_km is not ...:
            ls.distance_km = distance_km

        # Validate the final state
        self._validate_set_fields(se.exercise_type_snapshot,
                                  ls.reps, ls.weight,
                                  ls.duration_seconds, ls.distance_km)

        self._repo.update_logged_set(ls)
        self._repo.commit()
        return ls

    def delete_set(self, set_id: int) -> None:
        """Delete a logged set and resequence.

        If this was the last set in a finished session, deletes the session
        (no cycle rewind).
        """
        ls = self._repo.get_logged_set(set_id)
        if ls is None:
            raise ValueError(f"Logged set {set_id} not found")

        se = self._repo.get_session_exercise(ls.session_exercise_id)
        session = self._repo.get_session(se.session_id)

        self._repo.delete_logged_set(set_id)

        # Check if session is now empty and finished
        if session.status == SessionStatus.FINISHED:
            total_remaining = self._repo.get_session_total_set_count(
                session.id)
            if total_remaining == 0:
                self._repo.delete_session(session.id)

        self._repo.commit()

    def get_logged_sets(self, session_exercise_id: int) -> List[LoggedSet]:
        return self._repo.get_logged_sets(session_exercise_id)

    def get_in_progress_session(self) -> Optional[WorkoutSession]:
        """Return the current in-progress session, or None."""
        return self._repo.get_in_progress_session()

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_set_fields(
        exercise_type: ExerciseType,
        reps: Optional[int],
        weight: Optional[float],
        duration_seconds: Optional[int],
        distance_km: Optional[float],
    ) -> None:
        """Validate logged set fields match the exercise type.

        Raises ValueError with descriptive message on failure.
        """
        # Normalize: accept both ExerciseType enum and string values
        if isinstance(exercise_type, ExerciseType):
            type_val = exercise_type.value
        else:
            type_val = exercise_type

        if type_val == "reps_weight":
            if reps is None:
                raise ValueError(
                    "reps_weight exercise requires reps")
            if weight is None:
                raise ValueError(
                    "reps_weight exercise requires weight (use 0 for bodyweight)")
        elif type_val == "time":
            if duration_seconds is None:
                raise ValueError(
                    "time exercise requires duration_seconds")
        elif type_val == "cardio":
            if duration_seconds is None and distance_km is None:
                raise ValueError(
                    "cardio exercise requires duration_seconds and/or "
                    "distance_km (at least one)")
