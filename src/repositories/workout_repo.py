"""Workout repository — sessions, session_exercises, logged_sets."""
from typing import List, Optional
from src.models.enums import ExerciseType, SetScheme, SessionStatus, ExerciseSource
from src.models.workout import WorkoutSession, SessionExercise, LoggedSet
from src.repositories.base import BaseRepository


class WorkoutRepo(BaseRepository):

    # --- Sessions ---

    def create_session(self, session: WorkoutSession) -> int:
        """Insert a new workout session, return its id."""
        return self._insert(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status,
                completed_fully, started_at, finished_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session.routine_key_snapshot, session.routine_name_snapshot,
             session.day_key_snapshot, session.day_label_snapshot,
             session.day_name_snapshot, session.status.value,
             self._bool_to_int(session.completed_fully),
             session.started_at, session.finished_at),
        )

    def get_session(self, session_id: int) -> Optional[WorkoutSession]:
        """Get a session by id."""
        row = self._fetchone(
            "SELECT * FROM workout_sessions WHERE id = ?", (session_id,)
        )
        return self._to_session(row) if row else None

    def get_in_progress_session(self) -> Optional[WorkoutSession]:
        """Get the current in-progress session, if any."""
        row = self._fetchone(
            "SELECT * FROM workout_sessions WHERE status = 'in_progress' LIMIT 1"
        )
        return self._to_session(row) if row else None

    def finish_session(
        self, session_id: int, completed_fully: bool, finished_at: str
    ) -> None:
        """Mark a session as finished."""
        self._execute(
            """UPDATE workout_sessions
               SET status = 'finished', completed_fully = ?, finished_at = ?
               WHERE id = ?""",
            (int(completed_fully), finished_at, session_id),
        )

    def delete_session(self, session_id: int) -> None:
        """Delete a session (cascades to exercises and sets)."""
        self._execute("DELETE FROM workout_sessions WHERE id = ?", (session_id,))

    def list_finished_sessions(
        self, limit: int = 50, offset: int = 0
    ) -> List[WorkoutSession]:
        """List finished sessions, most recent first."""
        rows = self._fetchall(
            """SELECT * FROM workout_sessions
               WHERE status = 'finished'
               ORDER BY started_at DESC LIMIT ? OFFSET ?""",
            (limit, offset),
        )
        return [self._to_session(r) for r in rows]

    # --- Session Exercises ---

    def add_session_exercise(self, se: SessionExercise) -> int:
        """Insert a session exercise, return its id."""
        return self._insert(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, scheme_snapshot, planned_sets,
                target_reps_min, target_reps_max, target_duration_seconds,
                target_distance_km, plan_notes_snapshot)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (se.session_id, se.sort_order,
             se.exercise_key_snapshot, se.exercise_name_snapshot,
             se.exercise_type_snapshot.value, se.source.value,
             se.scheme_snapshot.value if se.scheme_snapshot else None,
             se.planned_sets, se.target_reps_min, se.target_reps_max,
             se.target_duration_seconds, se.target_distance_km,
             se.plan_notes_snapshot),
        )

    def get_session_exercise(self, se_id: int) -> Optional[SessionExercise]:
        """Get a session exercise by id."""
        row = self._fetchone(
            "SELECT * FROM session_exercises WHERE id = ?", (se_id,)
        )
        return self._to_session_exercise(row) if row else None

    def get_session_exercises(self, session_id: int) -> List[SessionExercise]:
        """Get all exercises for a session, ordered by sort_order."""
        rows = self._fetchall(
            """SELECT * FROM session_exercises
               WHERE session_id = ? ORDER BY sort_order""",
            (session_id,),
        )
        return [self._to_session_exercise(r) for r in rows]

    def get_max_sort_order(self, session_id: int) -> Optional[int]:
        """Get the highest sort_order for a session, or None if no exercises."""
        row = self._fetchone(
            "SELECT MAX(sort_order) as max_order FROM session_exercises WHERE session_id = ?",
            (session_id,),
        )
        return row["max_order"] if row and row["max_order"] is not None else None

    # --- Logged Sets ---

    def add_logged_set(self, ls: LoggedSet) -> int:
        """Insert a logged set, return its id."""
        return self._insert(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight,
                duration_seconds, distance_km, logged_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (ls.session_exercise_id, ls.set_number, ls.reps, ls.weight,
             ls.duration_seconds, ls.distance_km, ls.logged_at),
        )

    def get_logged_set(self, set_id: int) -> Optional[LoggedSet]:
        """Get a logged set by id."""
        row = self._fetchone(
            "SELECT * FROM logged_sets WHERE id = ?", (set_id,)
        )
        return self._to_logged_set(row) if row else None

    def get_logged_sets(self, session_exercise_id: int) -> List[LoggedSet]:
        """Get all sets for a session exercise, ordered by set_number."""
        rows = self._fetchall(
            """SELECT * FROM logged_sets
               WHERE session_exercise_id = ? ORDER BY set_number""",
            (session_exercise_id,),
        )
        return [self._to_logged_set(r) for r in rows]

    def get_logged_set_count(self, session_exercise_id: int) -> int:
        """Count logged sets for a session exercise."""
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM logged_sets WHERE session_exercise_id = ?",
            (session_exercise_id,),
        )
        return row["cnt"] if row else 0

    def get_session_total_set_count(self, session_id: int) -> int:
        """Count total logged sets across all exercises in a session."""
        row = self._fetchone(
            """SELECT COUNT(*) as cnt FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               WHERE se.session_id = ?""",
            (session_id,),
        )
        return row["cnt"] if row else 0

    def get_next_set_number(self, session_exercise_id: int) -> int:
        """Get the next set_number for a session exercise (max + 1, or 1)."""
        row = self._fetchone(
            "SELECT MAX(set_number) as max_num FROM logged_sets WHERE session_exercise_id = ?",
            (session_exercise_id,),
        )
        if row and row["max_num"] is not None:
            return row["max_num"] + 1
        return 1

    def update_logged_set(self, ls: LoggedSet) -> None:
        """Update an existing logged set."""
        self._execute(
            """UPDATE logged_sets
               SET reps = ?, weight = ?, duration_seconds = ?, distance_km = ?
               WHERE id = ?""",
            (ls.reps, ls.weight, ls.duration_seconds, ls.distance_km, ls.id),
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

    # --- Stats query helpers ---

    def get_session_count_with_sets(self, since: Optional[str] = None) -> int:
        """Count finished sessions that have at least one logged set."""
        if since:
            row = self._fetchone(
                """SELECT COUNT(*) as cnt FROM workout_sessions ws
                   WHERE ws.status = 'finished' AND ws.started_at >= ?
                   AND EXISTS (
                       SELECT 1 FROM logged_sets ls
                       JOIN session_exercises se ON ls.session_exercise_id = se.id
                       WHERE se.session_id = ws.id
                   )""",
                (since,),
            )
        else:
            row = self._fetchone(
                """SELECT COUNT(*) as cnt FROM workout_sessions ws
                   WHERE ws.status = 'finished'
                   AND EXISTS (
                       SELECT 1 FROM logged_sets ls
                       JOIN session_exercises se ON ls.session_exercise_id = se.id
                       WHERE se.session_id = ws.id
                   )""",
            )
        return row["cnt"] if row else 0

    def get_last_session_with_sets(self) -> Optional[WorkoutSession]:
        """Get the most recent finished session that has at least one logged set."""
        row = self._fetchone(
            """SELECT ws.* FROM workout_sessions ws
               WHERE ws.status = 'finished'
               AND EXISTS (
                   SELECT 1 FROM logged_sets ls
                   JOIN session_exercises se ON ls.session_exercise_id = se.id
                   WHERE se.session_id = ws.id
               )
               ORDER BY ws.started_at DESC LIMIT 1""",
        )
        return self._to_session(row) if row else None

    def get_exercise_logged_sets(self, exercise_key: str, limit: int = 200) -> list:
        """Get logged sets for an exercise key across finished sessions.

        Returns list of dicts with set fields plus session_started_at.
        Ordered by session started_at DESC, then set_number ASC.
        """
        rows = self._fetchall(
            """SELECT ls.*, se.exercise_key_snapshot, se.exercise_type_snapshot,
                      ws.started_at as session_started_at
               FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               JOIN workout_sessions ws ON se.session_id = ws.id
               WHERE se.exercise_key_snapshot = ?
               AND ws.status = 'finished'
               ORDER BY ws.started_at DESC, ls.set_number DESC
               LIMIT ?""",
            (exercise_key, limit),
        )
        return [dict(r) for r in rows]

    def get_volume_by_week(self, since: str) -> list:
        """Weekly total volume (weight * reps) for reps_weight exercises.

        Returns list of dicts: {year_week, total_volume}.
        """
        rows = self._fetchall(
            """SELECT strftime('%Y-%W', ws.started_at) as year_week,
                      SUM(COALESCE(ls.weight, 0) * COALESCE(ls.reps, 0)) as total_volume
               FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               JOIN workout_sessions ws ON se.session_id = ws.id
               WHERE ws.status = 'finished' AND ws.started_at >= ?
               AND se.exercise_type_snapshot = 'reps_weight'
               GROUP BY year_week
               ORDER BY year_week""",
            (since,),
        )
        return [dict(r) for r in rows]

    def get_exercise_keys_with_logged_sets(self) -> list:
        """Return distinct exercise keys that have logged sets in finished sessions."""
        rows = self._fetchall(
            """SELECT DISTINCT se.exercise_key_snapshot
               FROM session_exercises se
               JOIN workout_sessions ws ON se.session_id = ws.id
               JOIN logged_sets ls ON ls.session_exercise_id = se.id
               WHERE ws.status = 'finished'
               ORDER BY se.exercise_key_snapshot""",
        )
        return [r["exercise_key_snapshot"] for r in rows]

    def get_latest_plan_vs_actual(self, exercise_key: str) -> Optional[dict]:
        """Plan targets vs actual for the most recent finished session
        containing this exercise.

        Returns dict with exercise_key, session_id, planned_sets,
        target_reps_min, target_reps_max, actual_sets, actual_reps_avg,
        actual_weight_avg. Or None.
        """
        row = self._fetchone(
            """SELECT se.session_id, se.planned_sets,
                      se.target_reps_min, se.target_reps_max,
                      se.exercise_key_snapshot,
                      COUNT(ls.id) as actual_sets,
                      AVG(ls.reps) as actual_reps_avg,
                      AVG(ls.weight) as actual_weight_avg
               FROM session_exercises se
               JOIN workout_sessions ws ON se.session_id = ws.id
               JOIN logged_sets ls ON ls.session_exercise_id = se.id
               WHERE se.exercise_key_snapshot = ?
               AND ws.status = 'finished'
               GROUP BY se.id
               ORDER BY ws.started_at DESC
               LIMIT 1""",
            (exercise_key,),
        )
        if not row:
            return None
        return {
            "exercise_key": row["exercise_key_snapshot"],
            "session_id": row["session_id"],
            "planned_sets": row["planned_sets"],
            "target_reps_min": row["target_reps_min"],
            "target_reps_max": row["target_reps_max"],
            "actual_sets": row["actual_sets"],
            "actual_reps_avg": row["actual_reps_avg"],
            "actual_weight_avg": row["actual_weight_avg"],
        }

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
            routine_key_snapshot=row["routine_key_snapshot"],
            routine_name_snapshot=row["routine_name_snapshot"],
            day_key_snapshot=row["day_key_snapshot"],
            day_label_snapshot=row["day_label_snapshot"],
            day_name_snapshot=row["day_name_snapshot"],
            status=SessionStatus(row["status"]),
            completed_fully=None if completed is None else bool(completed),
            started_at=row["started_at"],
            finished_at=row["finished_at"],
        )

    def _to_session_exercise(self, row) -> SessionExercise:
        scheme = row["scheme_snapshot"]
        return SessionExercise(
            id=row["id"],
            session_id=row["session_id"],
            sort_order=row["sort_order"],
            exercise_key_snapshot=row["exercise_key_snapshot"],
            exercise_name_snapshot=row["exercise_name_snapshot"],
            exercise_type_snapshot=ExerciseType(row["exercise_type_snapshot"]),
            source=ExerciseSource(row["source"]),
            scheme_snapshot=SetScheme(scheme) if scheme else None,
            planned_sets=row["planned_sets"],
            target_reps_min=row["target_reps_min"],
            target_reps_max=row["target_reps_max"],
            target_duration_seconds=row["target_duration_seconds"],
            target_distance_km=row["target_distance_km"],
            plan_notes_snapshot=row["plan_notes_snapshot"],
        )

    def _to_logged_set(self, row) -> LoggedSet:
        return LoggedSet(
            id=row["id"],
            session_exercise_id=row["session_exercise_id"],
            set_number=row["set_number"],
            reps=row["reps"],
            weight=row["weight"],
            duration_seconds=row["duration_seconds"],
            distance_km=row["distance_km"],
            logged_at=row["logged_at"],
        )
