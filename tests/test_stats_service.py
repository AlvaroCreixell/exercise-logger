# tests/test_stats_service.py
"""Tests for StatsService — dashboard queries, PRs, trends."""
import pytest
from datetime import datetime, timezone, timedelta
from src.models.enums import ExerciseType, SetScheme, SessionStatus, ExerciseSource, BenchmarkMethod
from src.models.workout import WorkoutSession, SessionExercise, LoggedSet
from src.models.benchmark import BenchmarkResult


def _seed_finished_session(workout_repo, routine_key="push_pull_legs",
                           routine_name="Push Pull Legs",
                           day_key="push", day_label="A", day_name="Push",
                           started_at=None, finished_at=None,
                           completed_fully=True):
    """Helper: create a finished session directly in the repo."""
    now = datetime.now(timezone.utc)
    if started_at is None:
        started_at = now.isoformat()
    if finished_at is None:
        finished_at = (now + timedelta(minutes=45)).isoformat()

    session = WorkoutSession(
        id=None,
        routine_key_snapshot=routine_key,
        routine_name_snapshot=routine_name,
        day_key_snapshot=day_key,
        day_label_snapshot=day_label,
        day_name_snapshot=day_name,
        status=SessionStatus.FINISHED,
        completed_fully=completed_fully,
        started_at=started_at,
        finished_at=finished_at,
    )
    session.id = workout_repo.create_session(session)
    return session


def _seed_session_exercise(workout_repo, session_id, sort_order=0,
                           exercise_key="barbell_bench_press",
                           exercise_name="Barbell Bench Press",
                           exercise_type="reps_weight",
                           source="planned", scheme="progressive",
                           planned_sets=3):
    """Helper: add a session exercise."""
    se = SessionExercise(
        id=None,
        session_id=session_id,
        sort_order=sort_order,
        exercise_key_snapshot=exercise_key,
        exercise_name_snapshot=exercise_name,
        exercise_type_snapshot=ExerciseType(exercise_type),
        source=ExerciseSource(source),
        scheme_snapshot=SetScheme(scheme) if scheme else None,
        planned_sets=planned_sets,
        target_reps_min=None,
        target_reps_max=None,
        target_duration_seconds=None,
        target_distance_km=None,
        plan_notes_snapshot=None,
    )
    se.id = workout_repo.add_session_exercise(se)
    return se


def _seed_logged_set(workout_repo, session_exercise_id, set_number,
                     reps=None, weight=None, duration_seconds=None,
                     distance_km=None, logged_at=None):
    """Helper: add a logged set."""
    if logged_at is None:
        logged_at = datetime.now(timezone.utc).isoformat()
    ls = LoggedSet(
        id=None,
        session_exercise_id=session_exercise_id,
        set_number=set_number,
        reps=reps,
        weight=weight,
        duration_seconds=duration_seconds,
        distance_km=distance_km,
        logged_at=logged_at,
    )
    ls.id = workout_repo.add_logged_set(ls)
    return ls


class TestSessionCount:
    """get_session_count — finished sessions with >=1 set."""

    def test_zero_sessions(self, stats_service):
        assert stats_service.get_session_count() == 0

    def test_counts_finished_sessions_with_sets(self, stats_service,
                                                  workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        assert stats_service.get_session_count() == 1

    def test_excludes_zero_set_sessions(self, stats_service, workout_repo):
        """Finished sessions with no sets should not count."""
        _seed_finished_session(workout_repo)
        workout_repo.commit()
        assert stats_service.get_session_count() == 0

    def test_excludes_in_progress_sessions(self, stats_service, workout_repo):
        session = WorkoutSession(
            id=None,
            routine_key_snapshot="push_pull_legs",
            routine_name_snapshot="Push Pull Legs",
            day_key_snapshot="push",
            day_label_snapshot="A",
            day_name_snapshot="Push",
            status=SessionStatus.IN_PROGRESS,
            completed_fully=None,
            started_at=datetime.now(timezone.utc).isoformat(),
        )
        session.id = workout_repo.create_session(session)
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        assert stats_service.get_session_count() == 0

    def test_since_filter(self, stats_service, workout_repo):
        """Count only sessions after a given date."""
        now = datetime.now(timezone.utc)
        old = (now - timedelta(days=10)).isoformat()
        old_finish = (now - timedelta(days=10) + timedelta(minutes=30)).isoformat()
        recent = (now - timedelta(hours=1)).isoformat()
        recent_finish = now.isoformat()

        s1 = _seed_finished_session(workout_repo, started_at=old,
                                     finished_at=old_finish)
        se1 = _seed_session_exercise(workout_repo, s1.id)
        _seed_logged_set(workout_repo, se1.id, 1, reps=10, weight=60.0)

        s2 = _seed_finished_session(workout_repo, started_at=recent,
                                     finished_at=recent_finish)
        se2 = _seed_session_exercise(workout_repo, s2.id)
        _seed_logged_set(workout_repo, se2.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        since = (now - timedelta(days=7)).isoformat()
        assert stats_service.get_session_count(since=since) == 1
        assert stats_service.get_session_count() == 2


class TestLastWorkoutSummary:
    """get_last_workout_summary — most recent finished session with sets."""

    def test_no_sessions_returns_none(self, stats_service):
        assert stats_service.get_last_workout_summary() is None

    def test_returns_summary(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        started = now.isoformat()
        finished = (now + timedelta(minutes=45)).isoformat()

        session = _seed_finished_session(workout_repo, started_at=started,
                                          finished_at=finished)
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        summary = stats_service.get_last_workout_summary()
        assert summary is not None
        assert summary["session_id"] == session.id
        assert summary["day_label"] == "A"
        assert summary["day_name"] == "Push"
        assert summary["duration_minutes"] == 45

    def test_returns_most_recent(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)

        s1 = _seed_finished_session(
            workout_repo,
            started_at=(now - timedelta(days=2)).isoformat(),
            finished_at=(now - timedelta(days=2) + timedelta(minutes=30)).isoformat(),
        )
        se1 = _seed_session_exercise(workout_repo, s1.id)
        _seed_logged_set(workout_repo, se1.id, 1, reps=10, weight=60.0)

        s2 = _seed_finished_session(
            workout_repo, day_key="pull", day_label="B", day_name="Pull",
            started_at=(now - timedelta(hours=1)).isoformat(),
            finished_at=now.isoformat(),
        )
        se2 = _seed_session_exercise(workout_repo, s2.id)
        _seed_logged_set(workout_repo, se2.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        summary = stats_service.get_last_workout_summary()
        assert summary["day_name"] == "Pull"


class TestExerciseHistory:
    """get_exercise_history — type-aware aggregation by session date."""

    def test_reps_weight_history(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(
            workout_repo,
            started_at=now.isoformat(),
            finished_at=(now + timedelta(minutes=30)).isoformat(),
        )
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        _seed_logged_set(workout_repo, se.id, 2, reps=8, weight=80.0)
        workout_repo.commit()

        history = stats_service.get_exercise_history("barbell_bench_press")
        assert len(history) == 1  # grouped by session date
        assert history[0]["max_weight"] == 80.0
        assert history[0]["total_volume"] == 10*60 + 8*80  # 1240

    def test_time_history(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="plank",
            exercise_name="Plank", exercise_type="time",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=60)
        _seed_logged_set(workout_repo, se.id, 2, duration_seconds=90)
        workout_repo.commit()

        history = stats_service.get_exercise_history("plank")
        assert len(history) == 1
        assert history[0]["max_duration"] == 90

    def test_cardio_history(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="running",
            exercise_name="Running", exercise_type="cardio",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=1800,
                         distance_km=5.0)
        _seed_logged_set(workout_repo, se.id, 2, duration_seconds=1200,
                         distance_km=3.0)
        workout_repo.commit()

        history = stats_service.get_exercise_history("running")
        assert len(history) == 1
        assert history[0]["max_distance"] == 5.0
        assert history[0]["max_duration"] == 1800

    def test_no_history_returns_empty(self, stats_service):
        assert stats_service.get_exercise_history("barbell_bench_press") == []


class TestExerciseBestSet:
    """get_exercise_best_set — type-aware best set."""

    def test_reps_weight_best_by_weight(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        _seed_logged_set(workout_repo, se.id, 2, reps=5, weight=100.0)
        _seed_logged_set(workout_repo, se.id, 3, reps=8, weight=100.0)
        workout_repo.commit()

        best = stats_service.get_exercise_best_set("barbell_bench_press")
        assert best is not None
        assert best["weight"] == 100.0
        assert best["reps"] == 8  # tie-break: higher reps

    def test_time_best_by_duration(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="plank",
            exercise_name="Plank", exercise_type="time",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=60)
        _seed_logged_set(workout_repo, se.id, 2, duration_seconds=120)
        workout_repo.commit()

        best = stats_service.get_exercise_best_set("plank")
        assert best["duration_seconds"] == 120

    def test_cardio_best_by_distance(self, stats_service, workout_repo):
        """Cardio best: highest distance (tie-break by shorter duration)."""
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="running",
            exercise_name="Running", exercise_type="cardio",
        )
        _seed_logged_set(workout_repo, se.id, 1, distance_km=5.0,
                         duration_seconds=1800)
        _seed_logged_set(workout_repo, se.id, 2, distance_km=5.0,
                         duration_seconds=1500)  # same dist, faster
        _seed_logged_set(workout_repo, se.id, 3, distance_km=3.0,
                         duration_seconds=900)
        workout_repo.commit()

        best = stats_service.get_exercise_best_set("running")
        assert best["distance_km"] == 5.0
        assert best["duration_seconds"] == 1500  # tie-break: shorter

    def test_cardio_best_duration_when_no_distance(self, stats_service,
                                                     workout_repo):
        """Cardio with no distance: best by longest duration."""
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="running",
            exercise_name="Running", exercise_type="cardio",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=1800)
        _seed_logged_set(workout_repo, se.id, 2, duration_seconds=2400)
        workout_repo.commit()

        best = stats_service.get_exercise_best_set("running")
        assert best["duration_seconds"] == 2400

    def test_no_sets_returns_none(self, stats_service):
        assert stats_service.get_exercise_best_set("barbell_bench_press") is None


class TestPersonalBests:
    """get_personal_bests — across all types."""

    def test_personal_bests(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se1 = _seed_session_exercise(workout_repo, session.id, sort_order=0)
        _seed_logged_set(workout_repo, se1.id, 1, reps=5, weight=100.0)

        se2 = _seed_session_exercise(
            workout_repo, session.id, sort_order=1,
            exercise_key="plank", exercise_name="Plank",
            exercise_type="time",
        )
        _seed_logged_set(workout_repo, se2.id, 1, duration_seconds=120)
        workout_repo.commit()

        pbs = stats_service.get_personal_bests(limit=5)
        assert len(pbs) == 2
        names = {pb["exercise_name"] for pb in pbs}
        assert "Barbell Bench Press" in names
        assert "Plank" in names

    def test_personal_bests_limit(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se1 = _seed_session_exercise(workout_repo, session.id, sort_order=0)
        _seed_logged_set(workout_repo, se1.id, 1, reps=5, weight=100.0)
        se2 = _seed_session_exercise(
            workout_repo, session.id, sort_order=1,
            exercise_key="plank", exercise_name="Plank",
            exercise_type="time",
        )
        _seed_logged_set(workout_repo, se2.id, 1, duration_seconds=120)
        workout_repo.commit()

        pbs = stats_service.get_personal_bests(limit=1)
        assert len(pbs) == 1

    def test_empty_returns_empty(self, stats_service):
        assert stats_service.get_personal_bests() == []


class TestVolumeTrend:
    """get_total_volume_trend — weekly SUM(weight * reps) for reps_weight."""

    def test_volume_trend(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(
            workout_repo,
            started_at=now.isoformat(),
            finished_at=(now + timedelta(minutes=30)).isoformat(),
        )
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        _seed_logged_set(workout_repo, se.id, 2, reps=8, weight=80.0)
        workout_repo.commit()

        trend = stats_service.get_total_volume_trend(weeks=4)
        assert len(trend) >= 1
        total = sum(t["total_volume"] for t in trend)
        assert total == 10*60 + 8*80

    def test_excludes_time_and_cardio(self, stats_service, workout_repo):
        """Volume only counts reps_weight exercises."""
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="plank",
            exercise_name="Plank", exercise_type="time",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=120)
        workout_repo.commit()

        trend = stats_service.get_total_volume_trend(weeks=4)
        total = sum(t["total_volume"] for t in trend) if trend else 0
        assert total == 0

    def test_empty_returns_empty(self, stats_service):
        assert stats_service.get_total_volume_trend() == []


class TestBenchmarkHistory:
    """get_benchmark_history — results over time. Optional method param accepted."""

    def test_benchmark_history(self, stats_service, benchmark_repo):
        for val in [90.0, 95.0, 100.0]:
            result = BenchmarkResult(
                id=None,
                exercise_key_snapshot="barbell_bench_press",
                exercise_name_snapshot="Barbell Bench Press",
                method=BenchmarkMethod.MAX_WEIGHT,
                result_value=val,
                bodyweight=80.0,
                tested_at=datetime.now(timezone.utc).isoformat(),
            )
            benchmark_repo.add_result(result)
        benchmark_repo.commit()

        history = stats_service.get_benchmark_history("barbell_bench_press")
        assert len(history) == 3
        assert history[0]["result_value"] == 90.0  # oldest first
        assert history[2]["result_value"] == 100.0

    def test_empty_returns_empty(self, stats_service):
        assert stats_service.get_benchmark_history("barbell_bench_press") == []

    def test_method_param_accepted_and_ignored(self, stats_service, benchmark_repo):
        """Optional method param is accepted without error."""
        result = BenchmarkResult(
            id=None,
            exercise_key_snapshot="barbell_bench_press",
            exercise_name_snapshot="Barbell Bench Press",
            method=BenchmarkMethod.MAX_WEIGHT,
            result_value=100.0,
            bodyweight=80.0,
            tested_at=datetime.now(timezone.utc).isoformat(),
        )
        benchmark_repo.add_result(result)
        benchmark_repo.commit()
        history = stats_service.get_benchmark_history(
            "barbell_bench_press", method="max_weight")
        assert len(history) == 1


class TestExercisesWithHistory:
    """get_exercises_with_history — keys with logged sets in finished sessions."""

    def test_empty_when_no_sessions(self, stats_service):
        assert stats_service.get_exercises_with_history() == []

    def test_returns_keys_with_sets(self, stats_service, workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id,
                                    exercise_key="barbell_bench_press")
        workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se.id, set_number=1,
            reps=10, weight=60.0, duration_seconds=None, distance_km=None,
            logged_at=datetime.now(timezone.utc).isoformat(),
        ))
        workout_repo.commit()

        keys = stats_service.get_exercises_with_history()
        assert "barbell_bench_press" in keys

    def test_does_not_include_in_progress_session_exercises(
            self, stats_service, workout_repo):
        """Only finished sessions count."""
        now = datetime.now(timezone.utc).isoformat()
        session = WorkoutSession(
            id=None, routine_key_snapshot="push_pull_legs",
            routine_name_snapshot="Push Pull Legs",
            day_key_snapshot="push", day_label_snapshot="A",
            day_name_snapshot="Push", status=SessionStatus.IN_PROGRESS,
            completed_fully=None, started_at=now, finished_at=None,
        )
        session.id = workout_repo.create_session(session)
        se = _seed_session_exercise(workout_repo, session.id,
                                    exercise_key="barbell_bench_press")
        workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se.id, set_number=1,
            reps=10, weight=60.0, duration_seconds=None, distance_km=None,
            logged_at=now,
        ))
        workout_repo.commit()

        keys = stats_service.get_exercises_with_history()
        assert "barbell_bench_press" not in keys


class TestGetLatestPlanVsActual:
    """get_latest_plan_vs_actual — plan targets vs logged values."""

    def test_returns_none_when_no_history(self, stats_service):
        assert stats_service.get_latest_plan_vs_actual("barbell_bench_press") is None

    def test_returns_plan_and_actual_data(self, stats_service, workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id,
                                    exercise_key="barbell_bench_press",
                                    planned_sets=3)
        workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se.id, set_number=1,
            reps=10, weight=60.0, duration_seconds=None, distance_km=None,
            logged_at=datetime.now(timezone.utc).isoformat(),
        ))
        workout_repo.commit()

        result = stats_service.get_latest_plan_vs_actual("barbell_bench_press")
        assert result is not None
        assert result["exercise_key"] == "barbell_bench_press"
        assert result["session_id"] == session.id
        assert result["planned_sets"] == 3
        assert result["actual_sets"] >= 1


class TestGetLastSetForExercise:
    """get_last_set_for_exercise — most recent set for stepper pre-fill."""

    def test_returns_none_when_no_history(self, stats_service):
        assert stats_service.get_last_set_for_exercise("barbell_bench_press") is None

    def test_returns_most_recent_set(self, stats_service, workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id)
        now = datetime.now(timezone.utc)
        for i, (reps, weight) in enumerate([(8, 55.0), (10, 60.0)], start=1):
            workout_repo.add_logged_set(LoggedSet(
                id=None, session_exercise_id=se.id, set_number=i,
                reps=reps, weight=weight, duration_seconds=None,
                distance_km=None,
                logged_at=(now + timedelta(seconds=i)).isoformat(),
            ))
        workout_repo.commit()

        last = stats_service.get_last_set_for_exercise("barbell_bench_press")
        assert last is not None
        # Should be the most recent set (reps=10, weight=60.0)
        assert last["reps"] == 10
        assert last["weight"] == 60.0

    def test_returns_all_fields(self, stats_service, workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id)
        workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se.id, set_number=1,
            reps=10, weight=60.0, duration_seconds=None, distance_km=None,
            logged_at=datetime.now(timezone.utc).isoformat(),
        ))
        workout_repo.commit()

        last = stats_service.get_last_set_for_exercise("barbell_bench_press")
        assert set(last.keys()) == {"reps", "weight", "duration_seconds", "distance_km"}


class TestBenchmarkDueSummary:
    """get_benchmark_due_summary — counts and items."""

    def test_all_due_initially(self, stats_service):
        summary = stats_service.get_benchmark_due_summary()
        assert summary["total_items"] == 3
        assert summary["due_count"] == 3

    def test_after_recording(self, stats_service, benchmark_repo):
        result = BenchmarkResult(
            id=None,
            exercise_key_snapshot="barbell_bench_press",
            exercise_name_snapshot="Barbell Bench Press",
            method=BenchmarkMethod.MAX_WEIGHT,
            result_value=100.0,
            bodyweight=80.0,
            tested_at=datetime.now(timezone.utc).isoformat(),
        )
        benchmark_repo.add_result(result)
        benchmark_repo.commit()

        summary = stats_service.get_benchmark_due_summary()
        assert summary["due_count"] == 2
