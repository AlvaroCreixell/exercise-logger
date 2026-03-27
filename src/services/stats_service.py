"""StatsService — dashboard queries, exercise history, PRs, trends.

All stats derived live, never cached. Zero-set sessions excluded.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from src.registries.exercise_registry import ExerciseRegistry
from src.registries.benchmark_registry import BenchmarkRegistry
from src.repositories.workout_repo import WorkoutRepo
from src.repositories.benchmark_repo import BenchmarkRepo


class StatsService:
    def __init__(
        self,
        workout_repo: WorkoutRepo,
        benchmark_repo: BenchmarkRepo,
        exercise_registry: ExerciseRegistry,
        benchmark_registry: BenchmarkRegistry,
    ):
        self._workouts = workout_repo
        self._benchmarks = benchmark_repo
        self._exercises = exercise_registry
        self._bench_config = benchmark_registry

    # ------------------------------------------------------------------
    # Session count
    # ------------------------------------------------------------------

    def get_session_count(self, since: Optional[str] = None) -> int:
        """Count finished sessions with at least one logged set."""
        return self._workouts.get_session_count_with_sets(since)

    # ------------------------------------------------------------------
    # Last workout summary
    # ------------------------------------------------------------------

    def get_last_workout_summary(self) -> Optional[dict]:
        """Return summary of the most recent finished session with sets.

        Returns dict: session_id, started_at, finished_at, day_label,
        day_name, duration_minutes. Or None.
        """
        session = self._workouts.get_last_session_with_sets()
        if session is None:
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

    # ------------------------------------------------------------------
    # Exercise history
    # ------------------------------------------------------------------

    def get_exercise_history(self, exercise_key: str) -> List[dict]:
        """Type-aware exercise history grouped by session date.

        reps_weight: {session_date, max_weight, total_volume}
        time: {session_date, max_duration}
        cardio: {session_date, max_duration, max_distance}
        """
        exercise = self._exercises.get(exercise_key)
        if exercise is None:
            return []

        rows = self._workouts.get_exercise_logged_sets(exercise_key)
        if not rows:
            return []

        ex_type = exercise.type.value
        sessions = {}

        for row in rows:
            date = row["session_started_at"][:10]
            if date not in sessions:
                sessions[date] = {}
            d = sessions[date]

            if ex_type == "reps_weight":
                w = row.get("weight") or 0
                r = row.get("reps") or 0
                d["max_weight"] = max(d.get("max_weight", 0), w)
                d["total_volume"] = d.get("total_volume", 0) + w * r
            elif ex_type == "time":
                dur = row.get("duration_seconds") or 0
                d["max_duration"] = max(d.get("max_duration", 0), dur)
            elif ex_type == "cardio":
                dur = row.get("duration_seconds") or 0
                dist = row.get("distance_km") or 0
                d["max_duration"] = max(d.get("max_duration", 0), dur)
                d["max_distance"] = max(d.get("max_distance", 0), dist)

        return [
            {"session_date": date, **data}
            for date, data in sorted(sessions.items())
        ]

    # ------------------------------------------------------------------
    # Exercise best set
    # ------------------------------------------------------------------

    def get_exercise_best_set(self, exercise_key: str) -> Optional[dict]:
        """Type-aware best set.

        reps_weight: highest weight, tie-break by most reps
        time: longest duration
        cardio: highest distance (tie-break shorter duration),
                or longest duration if no distance logged
        """
        exercise = self._exercises.get(exercise_key)
        if exercise is None:
            return None

        rows = self._workouts.get_exercise_logged_sets(exercise_key)
        if not rows:
            return None

        ex_type = exercise.type.value
        best = None

        for row in rows:
            date = row["session_started_at"][:10]

            if ex_type == "reps_weight":
                w = row.get("weight") or 0
                r = row.get("reps") or 0
                if best is None:
                    best = {"weight": w, "reps": r, "session_date": date,
                            "exercise_type": ex_type}
                elif w > best["weight"] or (w == best["weight"]
                                             and r > best["reps"]):
                    best = {"weight": w, "reps": r, "session_date": date,
                            "exercise_type": ex_type}

            elif ex_type == "time":
                dur = row.get("duration_seconds") or 0
                if best is None or dur > best.get("duration_seconds", 0):
                    best = {"duration_seconds": dur, "session_date": date,
                            "exercise_type": ex_type}

            elif ex_type == "cardio":
                dist = row.get("distance_km") or 0
                dur = row.get("duration_seconds") or 0
                if dist > 0:
                    if (best is None
                            or dist > best.get("distance_km", 0)
                            or (dist == best.get("distance_km", 0)
                                and dur < best.get("duration_seconds",
                                                    float("inf")))):
                        best = {"distance_km": dist, "duration_seconds": dur,
                                "session_date": date, "exercise_type": ex_type}
                else:
                    if best is None or dur > best.get("duration_seconds", 0):
                        best = {"duration_seconds": dur, "distance_km": None,
                                "session_date": date, "exercise_type": ex_type}

        return best

    # ------------------------------------------------------------------
    # Personal bests
    # ------------------------------------------------------------------

    def get_personal_bests(self, limit: int = 5) -> List[dict]:
        """Personal bests across all exercise types.

        Returns list of dicts with exercise_name + type-specific best fields.
        Sorted by most recent session_date first.
        """
        exercises = self._exercises.list_all()
        pbs = []

        for ex in exercises:
            best = self.get_exercise_best_set(ex.key)
            if best is None:
                continue
            entry = {"exercise_name": ex.name, "exercise_key": ex.key, **best}
            pbs.append(entry)

        pbs.sort(key=lambda x: x["session_date"], reverse=True)
        return pbs[:limit]

    # ------------------------------------------------------------------
    # Volume trend
    # ------------------------------------------------------------------

    def get_total_volume_trend(self, weeks: int = 4) -> List[dict]:
        """Weekly total volume (weight * reps) for reps_weight exercises.

        Returns list of dicts: {week, total_volume}.
        """
        now = datetime.now(timezone.utc)
        start = now - timedelta(weeks=weeks)

        rows = self._workouts.get_volume_by_week(start.isoformat())
        return [
            {"week": r["year_week"], "total_volume": r["total_volume"]}
            for r in rows
        ]

    # ------------------------------------------------------------------
    # Benchmark stats
    # ------------------------------------------------------------------

    def get_benchmark_history(self, exercise_key: str, method: Optional[str] = None) -> List[dict]:
        """Benchmark results for an exercise, oldest first.

        The `method` parameter is accepted but ignored for now — each exercise
        has a single method. Reserved for future multi-method exercises.
        """
        results = self._benchmarks.get_results_for_exercise(exercise_key)
        # Repo returns newest-first; reverse for charts
        ordered = list(reversed(results))
        return [
            {
                "tested_at": r.tested_at,
                "result_value": r.result_value,
                "method": r.method,
                "bodyweight": r.bodyweight,
            }
            for r in ordered
        ]

    def get_benchmark_due_summary(self) -> dict:
        """Summary of benchmark status for home screen.

        Returns: {total_items, due_count, due_items}
        """
        items = self._bench_config.list_items()
        cutoff = datetime.now(timezone.utc) - timedelta(
            days=self._bench_config.frequency_weeks * 7)
        cutoff_iso = cutoff.isoformat()

        due_items = []
        for item in items:
            exercise = self._exercises.get(item.exercise_key)
            if exercise is None:
                continue
            latest = self._benchmarks.get_latest_result(item.exercise_key)
            if latest is None or latest.tested_at < cutoff_iso:
                due_items.append({
                    "exercise_key": item.exercise_key,
                    "exercise_name": exercise.name,
                    "method": item.method.value,
                })

        return {
            "total_items": len(items),
            "due_count": len(due_items),
            "due_items": due_items,
        }

    # ------------------------------------------------------------------
    # Exercise history helpers (used by exercise detail + workout screens)
    # ------------------------------------------------------------------

    def get_exercises_with_history(self) -> List[str]:
        """Return list of exercise keys that have logged sets in finished sessions."""
        return self._workouts.get_exercise_keys_with_logged_sets()

    def get_latest_plan_vs_actual(self, exercise_key: str) -> Optional[dict]:
        """Plan targets vs actual logged values for the most recent finished
        session containing this exercise.

        Returns a dict with keys:
            exercise_key, session_id, planned_sets, target_reps_min,
            target_reps_max, actual_sets, actual_reps_avg,
            actual_weight_avg
        Returns None if no finished session contains this exercise.
        """
        return self._workouts.get_latest_plan_vs_actual(exercise_key)

    def get_last_set_for_exercise(self, exercise_key: str) -> Optional[dict]:
        """Most recent logged set for an exercise across all finished sessions.

        Used to pre-fill stepper fields with the last used values.
        Returns a dict with keys: reps, weight, duration_seconds, distance_km,
        or None if no sets have been logged for this exercise.
        """
        sets = self._workouts.get_exercise_logged_sets(exercise_key)
        if not sets:
            return None
        # get_exercise_logged_sets returns newest-first
        last = sets[0]
        return {
            "reps": last["reps"],
            "weight": last["weight"],
            "duration_seconds": last["duration_seconds"],
            "distance_km": last["distance_km"],
        }
