from __future__ import annotations

import sqlite3
from typing import Optional

from models.workout import LoggedCardio, LoggedSet, SessionStatus, WorkoutSession
from repositories.base import BaseRepository


def _row_to_session(row: sqlite3.Row) -> WorkoutSession:
    return WorkoutSession(
        id=row["id"],
        routine_id=row["routine_id"],
        routine_day_id=row["routine_day_id"],
        status=SessionStatus(row["status"]),
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        notes=row["notes"],
    )


def _row_to_set(row: sqlite3.Row) -> LoggedSet:
    return LoggedSet(
        id=row["id"],
        session_id=row["session_id"],
        exercise_id=row["exercise_id"],
        routine_day_exercise_id=row["routine_day_exercise_id"],
        set_index=row["set_index"],
        reps=row["reps"],
        weight=row["weight"],
        is_warmup=bool(row["is_warmup"]),
        is_failure=bool(row["is_failure"]),
        notes=row["notes"],
        logged_at=row["logged_at"],
    )


def _row_to_cardio(row: sqlite3.Row) -> LoggedCardio:
    return LoggedCardio(
        id=row["id"],
        session_id=row["session_id"],
        exercise_id=row["exercise_id"],
        routine_day_exercise_id=row["routine_day_exercise_id"],
        duration_min=row["duration_min"],
        distance_km=row["distance_km"],
        intensity=row["intensity"],
        notes=row["notes"],
        logged_at=row["logged_at"],
    )


class WorkoutRepo(BaseRepository):
    # --- Sessions ---

    def get_in_progress(self) -> Optional[WorkoutSession]:
        row = self._fetchone(
            "SELECT * FROM workout_sessions"
            " WHERE status = 'in_progress' ORDER BY started_at DESC LIMIT 1"
        )
        return _row_to_session(row) if row else None

    def get_by_id(self, session_id: int) -> Optional[WorkoutSession]:
        row = self._fetchone(
            "SELECT * FROM workout_sessions WHERE id = ?", (session_id,)
        )
        return _row_to_session(row) if row else None

    def insert_session(self, session: WorkoutSession) -> int:
        return self._insert(
            "INSERT INTO workout_sessions (routine_id, routine_day_id, status)"
            " VALUES (?, ?, ?)",
            (session.routine_id, session.routine_day_id, session.status.value),
        )

    def update_session_status(
        self,
        session_id: int,
        status: SessionStatus,
        finished_at: Optional[str] = None,
    ) -> None:
        self._execute(
            "UPDATE workout_sessions SET status = ?, finished_at = ? WHERE id = ?",
            (status.value, finished_at, session_id),
        )

    # --- Logged sets ---

    def insert_set(self, logged_set: LoggedSet) -> int:
        return self._insert(
            "INSERT INTO logged_sets"
            " (session_id, exercise_id, routine_day_exercise_id, set_index,"
            "  reps, weight, is_warmup, is_failure, notes)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                logged_set.session_id,
                logged_set.exercise_id,
                logged_set.routine_day_exercise_id,
                logged_set.set_index,
                logged_set.reps,
                logged_set.weight,
                int(logged_set.is_warmup),
                int(logged_set.is_failure),
                logged_set.notes,
            ),
        )

    def get_sets_for_session(self, session_id: int) -> list[LoggedSet]:
        rows = self._fetchall(
            "SELECT * FROM logged_sets WHERE session_id = ?"
            " ORDER BY exercise_id, set_index ASC",
            (session_id,),
        )
        return [_row_to_set(r) for r in rows]

    def count_sets_for_exercise_in_session(
        self, session_id: int, exercise_id: int
    ) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) AS cnt FROM logged_sets"
            " WHERE session_id = ? AND exercise_id = ?",
            (session_id, exercise_id),
        )
        return row["cnt"] if row else 0

    def get_last_session_sets_for_exercise(
        self, exercise_id: int, exclude_session_id: Optional[int] = None
    ) -> list[LoggedSet]:
        """Return sets from the most recent finished session for this exercise."""
        params: list = [exercise_id]
        exclude_clause = ""
        if exclude_session_id is not None:
            exclude_clause = " AND ws.id != ?"
            params.append(exclude_session_id)

        row = self._fetchone(
            f"""
            SELECT ws.id
            FROM logged_sets ls
            JOIN workout_sessions ws ON ws.id = ls.session_id
            WHERE ls.exercise_id = ?
              AND ws.status = 'finished'
              {exclude_clause}
            ORDER BY ws.started_at DESC
            LIMIT 1
            """,
            params,
        )
        if not row:
            return []

        last_session_id = row["id"]
        rows = self._fetchall(
            "SELECT * FROM logged_sets WHERE session_id = ? AND exercise_id = ?"
            " ORDER BY set_index ASC",
            (last_session_id, exercise_id),
        )
        return [_row_to_set(r) for r in rows]

    # --- Logged cardio ---

    def insert_cardio(self, cardio: LoggedCardio) -> int:
        return self._insert(
            "INSERT INTO logged_cardio"
            " (session_id, exercise_id, routine_day_exercise_id,"
            "  duration_min, distance_km, intensity, notes)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                cardio.session_id,
                cardio.exercise_id,
                cardio.routine_day_exercise_id,
                cardio.duration_min,
                cardio.distance_km,
                cardio.intensity,
                cardio.notes,
            ),
        )

    def get_cardio_for_session(self, session_id: int) -> list[LoggedCardio]:
        rows = self._fetchall(
            "SELECT * FROM logged_cardio WHERE session_id = ? ORDER BY logged_at ASC",
            (session_id,),
        )
        return [_row_to_cardio(r) for r in rows]
