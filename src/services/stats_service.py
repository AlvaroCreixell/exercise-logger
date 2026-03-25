"""Stats service — dashboard queries, PRs, chart data.

All stats are derived from current data, never cached.
Zero-set sessions are excluded from all stat queries.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from src.repositories.workout_repo import WorkoutRepo
from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.benchmark_repo import BenchmarkRepo


class StatsService:
    def __init__(self, workout_repo: WorkoutRepo, exercise_repo: ExerciseRepo, benchmark_repo: BenchmarkRepo):
        self._workout_repo = workout_repo
        self._exercise_repo = exercise_repo
        self._benchmark_repo = benchmark_repo

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

    def get_exercise_history(self, exercise_id: int) -> List[dict]:
        """Type-aware exercise history for charts."""
        from src.models.exercise import ExerciseType
        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            return []
        rows = self._workout_repo.get_exercise_logged_sets(exercise_id)
        ex_type = exercise.type

        sessions = {}
        for row in rows:
            date = row["session_started_at"][:10]
            if date not in sessions:
                sessions[date] = {}
            d = sessions[date]
            if ex_type == ExerciseType.REPS_WEIGHT:
                w = row.get("weight") or 0
                r = row.get("reps") or 0
                d["max_weight"] = max(d.get("max_weight", 0), w)
                d["total_volume"] = d.get("total_volume", 0) + w * r
            elif ex_type == ExerciseType.REPS_ONLY:
                r = row.get("reps") or 0
                d["max_reps"] = max(d.get("max_reps", 0), r)
                d["total_reps"] = d.get("total_reps", 0) + r
            elif ex_type == ExerciseType.TIME:
                dur = row.get("duration_seconds") or 0
                d["max_duration"] = max(d.get("max_duration", 0), dur)
            elif ex_type == ExerciseType.CARDIO:
                dur = row.get("duration_seconds") or 0
                dist = row.get("distance") or 0
                d["max_duration"] = max(d.get("max_duration", 0), dur)
                d["max_distance"] = max(d.get("max_distance", 0), dist)

        return [{"session_date": date, **data} for date, data in sorted(sessions.items())]

    def get_exercise_best_set(self, exercise_id: int) -> Optional[dict]:
        """Type-aware best set. Sorts by: weight (reps_weight), reps (reps_only),
        duration (time), distance>0 else duration (cardio)."""
        from src.models.exercise import ExerciseType
        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            return None
        rows = self._workout_repo.get_exercise_logged_sets(exercise_id)
        if not rows:
            return None

        ex_type = exercise.type
        best = None
        for row in rows:
            date = row["session_started_at"][:10]
            if ex_type == ExerciseType.REPS_WEIGHT:
                val = row.get("weight") or 0
                if best is None or val > best.get("weight", 0):
                    best = {"weight": val, "reps": row.get("reps"), "session_date": date, "exercise_type": ex_type.value}
            elif ex_type == ExerciseType.REPS_ONLY:
                val = row.get("reps") or 0
                if best is None or val > best.get("reps", 0):
                    best = {"reps": val, "session_date": date, "exercise_type": ex_type.value}
            elif ex_type == ExerciseType.TIME:
                val = row.get("duration_seconds") or 0
                if best is None or val > best.get("duration_seconds", 0):
                    best = {"duration_seconds": val, "session_date": date, "exercise_type": ex_type.value}
            elif ex_type == ExerciseType.CARDIO:
                dist = row.get("distance") or 0
                dur = row.get("duration_seconds") or 0
                if dist > 0:
                    if best is None or dist > best.get("distance", 0):
                        best = {"distance": dist, "duration_seconds": dur, "session_date": date, "exercise_type": ex_type.value}
                else:
                    if best is None or dur > best.get("duration_seconds", 0):
                        best = {"duration_seconds": dur, "distance": None, "session_date": date, "exercise_type": ex_type.value}
        return best

    def get_benchmark_history(self, defn_id: int) -> List[dict]:
        """Benchmark results over time for charts."""
        results = self._benchmark_repo.get_results(defn_id)
        # get_results returns newest-first (DESC); charts need oldest-first
        return [
            {
                "tested_at": r.tested_at,
                "result_value": r.result_value,
                "method_snapshot": r.method_snapshot.value,
                "reference_weight_snapshot": r.reference_weight_snapshot,
            }
            for r in reversed(results)
        ]

    def get_plan_vs_actual(self, session_exercise_id: int) -> List[dict]:
        """Compare logged sets against their plan targets for a session exercise.

        Returns list of dicts: {set_number, set_kind, planned_reps_min, planned_reps_max,
        planned_weight, actual_reps, actual_weight, has_target}
        """
        rows = self._workout_repo._fetchall(
            """SELECT ls.set_number, ls.set_kind, ls.reps as actual_reps,
                      ls.weight as actual_weight, ls.duration_seconds as actual_duration,
                      ls.distance as actual_distance,
                      est.target_reps_min as planned_reps_min,
                      est.target_reps_max as planned_reps_max,
                      est.target_weight as planned_weight,
                      est.target_duration_seconds as planned_duration,
                      est.target_distance as planned_distance,
                      CASE WHEN est.id IS NOT NULL THEN 1 ELSE 0 END as has_target
               FROM logged_sets ls
               LEFT JOIN exercise_set_targets est ON ls.exercise_set_target_id = est.id
               WHERE ls.session_exercise_id = ?
               ORDER BY ls.set_number""",
            (session_exercise_id,),
        )
        return [dict(r) for r in rows]

    def get_recent_prs(self, limit: int = 5) -> List[dict]:
        """Personal records across all exercise types, most recent first."""
        from src.models.exercise import ExerciseType
        exercises = self._exercise_repo.list_all()
        prs = []
        for ex in exercises:
            best = self.get_exercise_best_set(ex.id)
            if not best:
                continue
            ex_type = ex.type
            if ex_type == ExerciseType.REPS_WEIGHT and not best.get("weight"):
                continue
            if ex_type == ExerciseType.REPS_ONLY and not best.get("reps"):
                continue
            if ex_type == ExerciseType.TIME and not best.get("duration_seconds"):
                continue
            if ex_type == ExerciseType.CARDIO and not best.get("distance") and not best.get("duration_seconds"):
                continue
            entry = {"exercise_name": ex.name, **best}
            prs.append(entry)
        prs.sort(key=lambda x: x["session_date"], reverse=True)
        return prs[:limit]

    def get_latest_plan_vs_actual_for_exercise(self, exercise_id: int) -> Optional[List[dict]]:
        """Get plan-vs-actual for the most recent session where this exercise had plan targets.

        Returns None if no plan-linked session found, otherwise the get_plan_vs_actual() result.
        """
        # Find recent session_exercises for this exercise that have plan targets
        row = self._workout_repo._fetchone(
            """SELECT se.id FROM session_exercises se
               JOIN workout_sessions ws ON se.session_id = ws.id
               WHERE se.exercise_id = ? AND se.routine_day_exercise_id IS NOT NULL
               AND ws.status = 'finished'
               ORDER BY ws.started_at DESC LIMIT 1""",
            (exercise_id,),
        )
        if not row:
            return None
        return self.get_plan_vs_actual(row["id"])

    def get_total_volume_trend(self, weeks: int = 8) -> List[dict]:
        """Weekly total volume (weight * reps) across all exercises.

        Returns list of dicts: {week, total_volume}
        """
        now = datetime.now(timezone.utc)
        start = now - timedelta(weeks=weeks)
        rows = self._workout_repo._fetchall(
            """SELECT strftime('%Y-%W', ws.started_at) as year_week,
                      SUM(COALESCE(ls.weight, 0) * COALESCE(ls.reps, 0)) as total_volume
               FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               JOIN workout_sessions ws ON se.session_id = ws.id
               WHERE ws.status = 'finished' AND ws.started_at >= ?
               GROUP BY year_week
               ORDER BY year_week""",
            (start.isoformat(),),
        )
        return [{"week": r["year_week"], "total_volume": r["total_volume"]} for r in rows]
