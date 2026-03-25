"""Workout repository — sessions, session_exercises, logged_sets."""
from typing import List, Optional
from src.models.workout import (
    WorkoutSession, SessionExercise, LoggedSet, SessionStatus, SessionType,
)
from src.models.routine import SetKind
from src.repositories.base import BaseRepository


class WorkoutRepo(BaseRepository):

    # --- Sessions ---

    def create_session(self, session: WorkoutSession) -> int:
        return self._insert(
            """INSERT INTO workout_sessions
               (routine_id, routine_day_id, session_type, status, completed_fully,
                day_label_snapshot, day_name_snapshot, started_at, finished_at, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session.routine_id, session.routine_day_id,
             session.session_type.value, session.status.value,
             self._bool_to_int(session.completed_fully),
             session.day_label_snapshot, session.day_name_snapshot,
             session.started_at, session.finished_at, session.notes),
        )

    def get_session(self, session_id: int) -> Optional[WorkoutSession]:
        row = self._fetchone("SELECT * FROM workout_sessions WHERE id = ?", (session_id,))
        return self._to_session(row) if row else None

    def get_in_progress_session(self) -> Optional[WorkoutSession]:
        row = self._fetchone(
            "SELECT * FROM workout_sessions WHERE status = 'in_progress' LIMIT 1"
        )
        return self._to_session(row) if row else None

    def finish_session(self, session_id: int, completed_fully: bool, finished_at: str) -> None:
        self._execute(
            """UPDATE workout_sessions
               SET status = 'finished', completed_fully = ?, finished_at = ?
               WHERE id = ?""",
            (int(completed_fully), finished_at, session_id),
        )

    def list_sessions(self, limit: int = 50, offset: int = 0) -> List[WorkoutSession]:
        rows = self._fetchall(
            "SELECT * FROM workout_sessions ORDER BY started_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
        return [self._to_session(r) for r in rows]

    def get_session_count_with_sets(self, since: Optional[str] = None) -> int:
        """Count finished sessions that have at least one logged set."""
        if since:
            row = self._fetchone(
                """SELECT COUNT(*) as cnt FROM workout_sessions ws
                   WHERE ws.status = 'finished' AND ws.started_at >= ?
                   AND EXISTS (
                       SELECT 1 FROM session_exercises se
                       JOIN logged_sets ls ON ls.session_exercise_id = se.id
                       WHERE se.session_id = ws.id
                   )""",
                (since,),
            )
        else:
            row = self._fetchone(
                """SELECT COUNT(*) as cnt FROM workout_sessions ws
                   WHERE ws.status = 'finished'
                   AND EXISTS (
                       SELECT 1 FROM session_exercises se
                       JOIN logged_sets ls ON ls.session_exercise_id = se.id
                       WHERE se.session_id = ws.id
                   )""",
            )
        return row["cnt"] if row else 0

    # --- Session Exercises ---

    def add_session_exercise(self, se: SessionExercise) -> int:
        return self._insert(
            """INSERT INTO session_exercises
               (session_id, exercise_id, routine_day_exercise_id, sort_order,
                exercise_name_snapshot, notes)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (se.session_id, se.exercise_id, se.routine_day_exercise_id,
             se.sort_order, se.exercise_name_snapshot, se.notes),
        )

    def get_session_exercise(self, se_id: int) -> Optional[SessionExercise]:
        row = self._fetchone("SELECT * FROM session_exercises WHERE id = ?", (se_id,))
        return self._to_session_exercise(row) if row else None

    def get_session_exercises(self, session_id: int) -> List[SessionExercise]:
        rows = self._fetchall(
            "SELECT * FROM session_exercises WHERE session_id = ? ORDER BY sort_order",
            (session_id,),
        )
        return [self._to_session_exercise(r) for r in rows]

    def get_session_exercise_count(self, session_id: int) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM session_exercises WHERE session_id = ?",
            (session_id,),
        )
        return row["cnt"] if row else 0

    # --- Logged Sets ---

    def add_logged_set(self, ls: LoggedSet) -> int:
        return self._insert(
            """INSERT INTO logged_sets
               (session_exercise_id, exercise_set_target_id, set_number, set_kind,
                reps, weight, duration_seconds, distance, notes, logged_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ls.session_exercise_id, ls.exercise_set_target_id, ls.set_number,
             ls.set_kind.value, ls.reps, ls.weight, ls.duration_seconds,
             ls.distance, ls.notes, ls.logged_at),
        )

    def get_logged_set(self, set_id: int) -> Optional[LoggedSet]:
        row = self._fetchone("SELECT * FROM logged_sets WHERE id = ?", (set_id,))
        return self._to_logged_set(row) if row else None

    def get_logged_sets(self, session_exercise_id: int) -> List[LoggedSet]:
        rows = self._fetchall(
            "SELECT * FROM logged_sets WHERE session_exercise_id = ? ORDER BY set_number",
            (session_exercise_id,),
        )
        return [self._to_logged_set(r) for r in rows]

    def get_logged_set_count(self, session_exercise_id: int) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM logged_sets WHERE session_exercise_id = ?",
            (session_exercise_id,),
        )
        return row["cnt"] if row else 0

    def get_session_total_set_count(self, session_id: int) -> int:
        """Total logged sets across all exercises in a session."""
        row = self._fetchone(
            """SELECT COUNT(*) as cnt FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               WHERE se.session_id = ?""",
            (session_id,),
        )
        return row["cnt"] if row else 0

    def update_logged_set(self, ls: LoggedSet) -> None:
        self._execute(
            """UPDATE logged_sets
               SET reps = ?, weight = ?, duration_seconds = ?, distance = ?,
                   notes = ?, set_kind = ?
               WHERE id = ?""",
            (ls.reps, ls.weight, ls.duration_seconds, ls.distance,
             ls.notes, ls.set_kind.value, ls.id),
        )

    def delete_logged_set(self, set_id: int) -> None:
        """Delete a logged set and resequence remaining siblings."""
        ls = self.get_logged_set(set_id)
        if not ls:
            return
        self._execute("DELETE FROM logged_sets WHERE id = ?", (set_id,))
        self._execute(
            """UPDATE logged_sets SET set_number = set_number - 1
               WHERE session_exercise_id = ? AND set_number > ?""",
            (ls.session_exercise_id, ls.set_number),
        )

    # --- Queries for stats ---

    def get_last_session_with_sets(self) -> Optional[WorkoutSession]:
        """Most recent finished session that has at least one logged set."""
        row = self._fetchone(
            """SELECT ws.* FROM workout_sessions ws
               WHERE ws.status = 'finished'
               AND EXISTS (
                   SELECT 1 FROM session_exercises se
                   JOIN logged_sets ls ON ls.session_exercise_id = se.id
                   WHERE se.session_id = ws.id
               )
               ORDER BY ws.started_at DESC LIMIT 1""",
        )
        return self._to_session(row) if row else None

    def get_exercise_logged_sets(self, exercise_id: int, limit: int = 100) -> List[dict]:
        """Get logged sets for an exercise across all sessions, for stats/charts.
        Returns dicts with set data + session started_at for time series.
        """
        rows = self._fetchall(
            """SELECT ls.*, se.exercise_id, ws.started_at as session_started_at
               FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               JOIN workout_sessions ws ON se.session_id = ws.id
               WHERE se.exercise_id = ?
               AND ws.status = 'finished'
               ORDER BY ws.started_at DESC, ls.set_number
               LIMIT ?""",
            (exercise_id, limit),
        )
        return [dict(r) for r in rows]

    # --- Row converters ---

    @staticmethod
    def _bool_to_int(val: Optional[bool]) -> Optional[int]:
        if val is None:
            return None
        return 1 if val else 0

    def _to_session(self, row) -> WorkoutSession:
        completed = row["completed_fully"]
        return WorkoutSession(
            id=row["id"],
            routine_id=row["routine_id"],
            routine_day_id=row["routine_day_id"],
            session_type=SessionType(row["session_type"]),
            status=SessionStatus(row["status"]),
            completed_fully=None if completed is None else bool(completed),
            day_label_snapshot=row["day_label_snapshot"],
            day_name_snapshot=row["day_name_snapshot"],
            started_at=row["started_at"],
            finished_at=row["finished_at"],
            notes=row["notes"],
        )

    def _to_session_exercise(self, row) -> SessionExercise:
        return SessionExercise(
            id=row["id"],
            session_id=row["session_id"],
            exercise_id=row["exercise_id"],
            routine_day_exercise_id=row["routine_day_exercise_id"],
            sort_order=row["sort_order"],
            exercise_name_snapshot=row["exercise_name_snapshot"],
            notes=row["notes"],
        )

    def _to_logged_set(self, row) -> LoggedSet:
        return LoggedSet(
            id=row["id"],
            session_exercise_id=row["session_exercise_id"],
            exercise_set_target_id=row["exercise_set_target_id"],
            set_number=row["set_number"],
            set_kind=SetKind(row["set_kind"]),
            reps=row["reps"],
            weight=row["weight"],
            duration_seconds=row["duration_seconds"],
            distance=row["distance"],
            notes=row["notes"],
            logged_at=row["logged_at"],
        )
