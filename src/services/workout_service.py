from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Optional

from models.workout import LoggedCardio, LoggedSet, SessionStatus, WorkoutSession
from repositories.workout_repo import WorkoutRepo


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


class WorkoutService:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._repo = WorkoutRepo(conn)
        self._conn = conn

    def get_in_progress_session(self) -> Optional[WorkoutSession]:
        return self._repo.get_in_progress()

    def start_session(
        self,
        routine_id: Optional[int] = None,
        routine_day_id: Optional[int] = None,
    ) -> WorkoutSession:
        """Create and persist a new in-progress session.

        Raises RuntimeError if another session is already in progress.
        Only one in-progress session is allowed at a time.
        """
        existing = self._repo.get_in_progress()
        if existing:
            raise RuntimeError(
                f"Session {existing.id} is already in progress. "
                "Finish or abandon it before starting a new one."
            )
        session = WorkoutSession(
            id=None,
            routine_id=routine_id,
            routine_day_id=routine_day_id,
        )
        session_id = self._repo.insert_session(session)
        self._conn.commit()
        session.id = session_id
        return session

    def log_set(
        self,
        session_id: int,
        exercise_id: int,
        reps: Optional[int],
        weight: Optional[float],
        routine_day_exercise_id: Optional[int] = None,
        is_warmup: bool = False,
    ) -> LoggedSet:
        """Append a set to the session and commit immediately."""
        set_index = self._repo.count_sets_for_exercise_in_session(
            session_id, exercise_id
        )
        logged = LoggedSet(
            id=None,
            session_id=session_id,
            exercise_id=exercise_id,
            routine_day_exercise_id=routine_day_exercise_id,
            set_index=set_index,
            reps=reps,
            weight=weight,
            is_warmup=is_warmup,
        )
        set_id = self._repo.insert_set(logged)
        self._conn.commit()  # Immediate persistence — crash-safe
        logged.id = set_id
        return logged

    def log_cardio(
        self,
        session_id: int,
        exercise_id: int,
        duration_min: Optional[float] = None,
        distance_km: Optional[float] = None,
        intensity: Optional[str] = None,
        routine_day_exercise_id: Optional[int] = None,
    ) -> LoggedCardio:
        """Append a cardio effort and commit immediately."""
        cardio = LoggedCardio(
            id=None,
            session_id=session_id,
            exercise_id=exercise_id,
            routine_day_exercise_id=routine_day_exercise_id,
            duration_min=duration_min,
            distance_km=distance_km,
            intensity=intensity,
        )
        cardio_id = self._repo.insert_cardio(cardio)
        self._conn.commit()
        cardio.id = cardio_id
        return cardio

    def finish_session(self, session_id: int) -> None:
        """Mark a session as finished. Caller must advance the cycle separately."""
        self._repo.update_session_status(
            session_id, SessionStatus.FINISHED, _now_iso()
        )
        self._conn.commit()

    def abandon_session(self, session_id: int) -> None:
        """Mark a session as abandoned. Cycle does NOT advance."""
        self._repo.update_session_status(
            session_id, SessionStatus.ABANDONED, _now_iso()
        )
        self._conn.commit()

    def get_session_sets(self, session_id: int) -> list[LoggedSet]:
        return self._repo.get_sets_for_session(session_id)

    def get_previous_sets(
        self, exercise_id: int, exclude_session_id: Optional[int] = None
    ) -> list[LoggedSet]:
        """Return sets from the last finished session for this exercise."""
        return self._repo.get_last_session_sets_for_exercise(
            exercise_id, exclude_session_id
        )
