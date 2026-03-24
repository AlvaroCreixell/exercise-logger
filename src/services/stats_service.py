"""Stats service — dashboard queries, PRs, chart data.

All stats are derived from current data, never cached.
Zero-set sessions are excluded from all stat queries.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from src.repositories.workout_repo import WorkoutRepo
from src.repositories.exercise_repo import ExerciseRepo


class StatsService:
    def __init__(self, workout_repo: WorkoutRepo, exercise_repo: ExerciseRepo):
        self._workout_repo = workout_repo
        self._exercise_repo = exercise_repo

    def get_session_count(self, since: Optional[str] = None) -> int:
        """Count finished sessions with at least one logged set."""
        return self._workout_repo.get_session_count_with_sets(since)

    def get_sessions_this_week(self) -> int:
        now = datetime.now(timezone.utc)
        start_of_week = now - timedelta(days=now.weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        return self.get_session_count(since=start_of_week.isoformat())

    def get_sessions_this_month(self) -> int:
        now = datetime.now(timezone.utc)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return self.get_session_count(since=start_of_month.isoformat())

    def get_last_workout_summary(self) -> Optional[dict]:
        """Return summary of last finished session with sets.

        Returns dict with: session_id, started_at, finished_at, day_label, day_name, duration_minutes
        """
        session = self._workout_repo.get_last_session_with_sets()
        if not session:
            return None

        duration = None
        if session.started_at and session.finished_at:
            start = datetime.fromisoformat(session.started_at)
            end = datetime.fromisoformat(session.finished_at)
            duration = round((end - start).total_seconds() / 60)

        return {
            "session_id": session.id,
            "started_at": session.started_at,
            "finished_at": session.finished_at,
            "day_label": session.day_label_snapshot,
            "day_name": session.day_name_snapshot,
            "duration_minutes": duration,
        }

    def get_exercise_weight_history(self, exercise_id: int) -> List[dict]:
        """Weight over time for an exercise (for charts).

        Returns list of dicts: {session_date, max_weight, total_volume}
        """
        rows = self._workout_repo.get_exercise_logged_sets(exercise_id)

        # Group by session date
        sessions = {}
        for row in rows:
            session_date = row["session_started_at"][:10]  # YYYY-MM-DD
            if session_date not in sessions:
                sessions[session_date] = {"max_weight": 0, "total_volume": 0}

            weight = row.get("weight") or 0
            reps = row.get("reps") or 0

            if weight > sessions[session_date]["max_weight"]:
                sessions[session_date]["max_weight"] = weight
            sessions[session_date]["total_volume"] += weight * reps

        return [
            {"session_date": date, "max_weight": data["max_weight"], "total_volume": data["total_volume"]}
            for date, data in sorted(sessions.items())
        ]

    def get_exercise_best_set(self, exercise_id: int) -> Optional[dict]:
        """Best set (highest weight) for an exercise across all sessions."""
        rows = self._workout_repo.get_exercise_logged_sets(exercise_id)
        if not rows:
            return None

        best = None
        for row in rows:
            weight = row.get("weight") or 0
            if best is None or weight > best.get("weight", 0):
                best = {
                    "weight": weight,
                    "reps": row.get("reps"),
                    "session_date": row["session_started_at"][:10],
                }
        return best
