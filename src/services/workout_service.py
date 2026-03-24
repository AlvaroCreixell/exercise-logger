"""Workout service — session lifecycle, set logging, editing."""
from datetime import datetime, timezone
from typing import List, Optional
from src.models.exercise import Exercise, ExerciseType
from src.models.routine import RoutineDay, RoutineDayExercise, SetKind
from src.models.workout import (
    WorkoutSession, SessionExercise, LoggedSet, SessionStatus, SessionType,
)
from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.routine_repo import RoutineRepo
from src.repositories.workout_repo import WorkoutRepo
from src.services.cycle_service import CycleService
from src.services.validation import validate_set_kind, validate_cardio_fields, validate_amrap_fields


class WorkoutService:
    def __init__(
        self,
        workout_repo: WorkoutRepo,
        routine_repo: RoutineRepo,
        exercise_repo: ExerciseRepo,
        cycle_service: CycleService,
    ):
        self._repo = workout_repo
        self._routine_repo = routine_repo
        self._exercise_repo = exercise_repo
        self._cycle_service = cycle_service

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # --- Session lifecycle ---

    def start_routine_session(self, routine_day_id: int) -> WorkoutSession:
        """Start a new routine workout session for the given day."""
        # Block if another session is in progress
        existing = self._repo.get_in_progress_session()
        if existing:
            raise ValueError("Another session is already in progress")

        day = self._routine_repo.get_day(routine_day_id)
        if not day:
            raise ValueError(f"Routine day {routine_day_id} not found")

        routine = self._routine_repo.get_routine(day.routine_id)
        session = WorkoutSession(
            id=None,
            routine_id=day.routine_id,
            routine_day_id=routine_day_id,
            session_type=SessionType.ROUTINE,
            status=SessionStatus.IN_PROGRESS,
            completed_fully=None,
            day_label_snapshot=day.label,
            day_name_snapshot=day.name,
            started_at=self._now(),
        )
        session.id = self._repo.create_session(session)
        self._repo.commit()
        return session

    def start_benchmark_session(self) -> WorkoutSession:
        """Start a new benchmark session."""
        existing = self._repo.get_in_progress_session()
        if existing:
            raise ValueError("Another session is already in progress")

        session = WorkoutSession(
            id=None,
            routine_id=None,
            routine_day_id=None,
            session_type=SessionType.BENCHMARK,
            status=SessionStatus.IN_PROGRESS,
            completed_fully=None,
            day_label_snapshot=None,
            day_name_snapshot=None,
            started_at=self._now(),
        )
        session.id = self._repo.create_session(session)
        self._repo.commit()
        return session

    def finish_session(self, session_id: int) -> WorkoutSession:
        """Finish a session (completed_fully=True). Advances cycle for routine sessions."""
        session = self._repo.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        self._repo.finish_session(session_id, completed_fully=True, finished_at=self._now())

        # Advance cycle for routine sessions
        if session.session_type == SessionType.ROUTINE and session.routine_id:
            self._cycle_service.advance(session.routine_id)

        self._repo.commit()
        return self._repo.get_session(session_id)

    def end_early(self, session_id: int) -> WorkoutSession:
        """End session early (completed_fully=False). Advances cycle only if ≥1 set logged."""
        session = self._repo.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        self._repo.finish_session(session_id, completed_fully=False, finished_at=self._now())

        # Advance cycle only if at least one set was logged
        total_sets = self._repo.get_session_total_set_count(session_id)
        if (total_sets > 0
                and session.session_type == SessionType.ROUTINE
                and session.routine_id):
            self._cycle_service.advance(session.routine_id)

        self._repo.commit()
        return self._repo.get_session(session_id)

    def get_session(self, session_id: int) -> Optional[WorkoutSession]:
        return self._repo.get_session(session_id)

    def get_in_progress_session(self) -> Optional[WorkoutSession]:
        return self._repo.get_in_progress_session()

    # --- Session exercises ---

    def add_exercise_to_session(
        self,
        session_id: int,
        exercise_id: int,
        routine_day_exercise_id: Optional[int] = None,
    ) -> SessionExercise:
        """Add an exercise to a session. routine_day_exercise_id=None means ad-hoc."""
        session = self._repo.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            raise ValueError(f"Exercise {exercise_id} not found")

        sort_order = self._repo.get_session_exercise_count(session_id)
        se = SessionExercise(
            id=None,
            session_id=session_id,
            exercise_id=exercise_id,
            routine_day_exercise_id=routine_day_exercise_id,
            sort_order=sort_order,
            exercise_name_snapshot=exercise.name,
        )
        se.id = self._repo.add_session_exercise(se)
        self._repo.commit()
        return se

    def get_session_exercises(self, session_id: int) -> List[SessionExercise]:
        return self._repo.get_session_exercises(session_id)

    # --- Logged sets ---

    def log_set(
        self,
        session_exercise_id: int,
        set_kind: SetKind,
        exercise_set_target_id: Optional[int] = None,
        reps: Optional[int] = None,
        weight: Optional[float] = None,
        duration_seconds: Optional[int] = None,
        distance: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> LoggedSet:
        """Log a set. Committed to DB immediately (crash safety)."""
        se = self._repo.get_session_exercise(session_exercise_id)
        if not se:
            raise ValueError(f"Session exercise {session_exercise_id} not found")

        # Validate set_kind compatibility
        exercise = self._exercise_repo.get_by_id(se.exercise_id)
        validate_set_kind(set_kind, exercise.type)
        validate_cardio_fields(set_kind, duration_seconds, distance)
        validate_amrap_fields(set_kind, exercise.type, weight)

        set_number = self._repo.get_logged_set_count(session_exercise_id) + 1
        ls = LoggedSet(
            id=None,
            session_exercise_id=session_exercise_id,
            exercise_set_target_id=exercise_set_target_id,
            set_number=set_number,
            set_kind=set_kind,
            reps=reps,
            weight=weight,
            duration_seconds=duration_seconds,
            distance=distance,
            notes=notes,
            logged_at=self._now(),
        )
        ls.id = self._repo.add_logged_set(ls)
        self._repo.commit()
        return ls

    def update_set(
        self,
        set_id: int,
        reps: Optional[int] = None,
        weight: Optional[float] = None,
        duration_seconds: Optional[int] = None,
        distance: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> LoggedSet:
        """Edit a logged set (past or present). Stats derived from current data, never cached."""
        ls = self._repo.get_logged_set(set_id)
        if not ls:
            raise ValueError(f"Logged set {set_id} not found")

        # Validate updated fields against exercise type
        se = self._repo.get_session_exercise(ls.session_exercise_id)
        exercise = self._exercise_repo.get_by_id(se.exercise_id)

        updated_weight = weight if weight is not None else ls.weight
        updated_duration = duration_seconds if duration_seconds is not None else ls.duration_seconds
        updated_distance = distance if distance is not None else ls.distance

        validate_cardio_fields(ls.set_kind, updated_duration, updated_distance)
        validate_amrap_fields(ls.set_kind, exercise.type, updated_weight)

        if reps is not None:
            ls.reps = reps
        if weight is not None:
            ls.weight = weight
        if duration_seconds is not None:
            ls.duration_seconds = duration_seconds
        if distance is not None:
            ls.distance = distance
        if notes is not None:
            ls.notes = notes

        self._repo.update_logged_set(ls)
        self._repo.commit()
        return ls

    def delete_set(self, set_id: int) -> None:
        """Delete a logged set and resequence. Works on past or current sessions."""
        self._repo.delete_logged_set(set_id)
        self._repo.commit()

    def get_logged_sets(self, session_exercise_id: int) -> List[LoggedSet]:
        return self._repo.get_logged_sets(session_exercise_id)
