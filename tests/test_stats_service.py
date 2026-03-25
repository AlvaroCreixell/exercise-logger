import pytest
from src.models.exercise import ExerciseType
from src.models.routine import SetScheme, SetKind
from src.models.benchmark import BenchmarkMethod


class TestStatsService:

    def _create_session_with_sets(self, workout_service, routine_service, make_exercise,
                                  exercise_name="Bench Press", reps=10, weight=135.0,
                                  num_sets=1, finish=True):
        """Helper: create a routine, start session, log sets, optionally finish."""
        # Reuse or create routine
        routines = routine_service.list_routines()
        if routines:
            r = routines[0]
            days = routine_service.get_days(r.id)
            day = days[0]
        else:
            r = routine_service.create_routine("Test")
            day = routine_service.add_day(r.id, "A", "Push")
            routine_service.activate_routine(r.id)

        ex = make_exercise(exercise_name)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)

        logged = []
        for _ in range(num_sets):
            ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=reps, weight=weight)
            logged.append(ls)

        if finish:
            workout_service.finish_session(session.id)

        return session, se, logged

    def test_zero_set_session_excluded_from_count(self, stats_service, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(day.id)
        workout_service.end_early(session.id)  # Zero sets

        assert stats_service.get_session_count() == 0

    def test_session_with_sets_counted(self, stats_service, workout_service, routine_service, make_exercise):
        self._create_session_with_sets(workout_service, routine_service, make_exercise)
        assert stats_service.get_session_count() == 1

    def test_last_workout_summary(self, stats_service, workout_service, routine_service, make_exercise):
        self._create_session_with_sets(workout_service, routine_service, make_exercise)
        summary = stats_service.get_last_workout_summary()
        assert summary is not None
        assert summary["day_label"] == "A"
        assert summary["day_name"] == "Push"
        assert summary["duration_minutes"] is not None

    def test_last_workout_excludes_zero_set_sessions(self, stats_service, workout_service, routine_service, make_exercise):
        # Create session with sets
        self._create_session_with_sets(workout_service, routine_service, make_exercise)

        # Create zero-set session after
        days = routine_service.get_days(routine_service.list_routines()[0].id)
        s2 = workout_service.start_routine_session(days[0].id)
        workout_service.end_early(s2.id)

        summary = stats_service.get_last_workout_summary()
        assert summary is not None
        assert summary["session_id"] != s2.id  # Should be the first session

    def test_no_sessions_returns_none(self, stats_service):
        assert stats_service.get_last_workout_summary() is None

    def test_exercise_weight_history(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0, num_sets=3,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        history = stats_service.get_exercise_weight_history(bench.id)
        assert len(history) == 1
        assert history[0]["max_weight"] == 135.0
        assert history[0]["total_volume"] == 135.0 * 10 * 3

    def test_exercise_best_set(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        best = stats_service.get_exercise_best_set(bench.id)
        assert best is not None
        assert best["weight"] == 135.0
        assert best["reps"] == 10

    def test_edit_past_session_updates_stats(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        """Editing a past set immediately affects stats (never cached)."""
        session, se, logged = self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        # Edit the set
        workout_service.update_set(logged[0].id, weight=200.0)

        best = stats_service.get_exercise_best_set(bench.id)
        assert best["weight"] == 200.0

    def test_delete_set_updates_stats(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        """Deleting a set from a session updates stats."""
        session, se, logged = self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0, num_sets=2,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        # Delete one set
        workout_service.delete_set(logged[0].id)

        history = stats_service.get_exercise_weight_history(bench.id)
        assert history[0]["total_volume"] == 135.0 * 10  # Only one set remains

    def test_add_set_to_past_session(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        """Can add a set to a finished session (no append-only restriction)."""
        session, se, logged = self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0, num_sets=1,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        # Add extra set to finished session
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=8, weight=155.0)

        best = stats_service.get_exercise_best_set(bench.id)
        assert best["weight"] == 155.0

    def test_session_count_all_time_includes_old_sessions(self, stats_service, workout_service, make_exercise, routine_service):
        """All-time count includes sessions outside current week/month.

        Regression: dashboard used week+month counts to gate empty state,
        hiding the dashboard when history existed but not in current period.
        """
        ex = make_exercise("Bench Press")
        r = routine_service.create_routine("Test")
        routine_service.activate_routine(r.id)
        day = routine_service.add_day(r.id, "A", "Push")
        routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135)
        workout_service.finish_session(session.id)

        # Backdate the session to 2 months ago so it falls outside this week/month
        from datetime import datetime, timezone, timedelta
        old_date = (datetime.now(timezone.utc) - timedelta(days=70)).isoformat()
        workout_service._repo._execute(
            "UPDATE workout_sessions SET started_at = ?, finished_at = ? WHERE id = ?",
            (old_date, old_date, session.id),
        )
        workout_service._repo.commit()

        # This week and this month should be 0
        assert stats_service.get_sessions_this_week() == 0
        assert stats_service.get_sessions_this_month() == 0

        # But all-time count should still be 1
        assert stats_service.get_session_count() == 1


class TestStatsServiceBenchmarkAndPlanVsActual:

    def test_benchmark_history(self, stats_service, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper",
        )
        benchmark_service.record_result(defn.id, 135.0)
        benchmark_service.record_result(defn.id, 145.0)

        history = stats_service.get_benchmark_history(defn.id)
        assert len(history) == 2
        assert history[0]["result_value"] == 135.0
        assert history[1]["result_value"] == 145.0

    def test_plan_vs_actual_with_target(self, stats_service, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        targets = routine_service.set_uniform_targets(rde.id, 3, SetKind.REPS_WEIGHT, 10, 10, 135.0)
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id, routine_day_exercise_id=rde.id)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, exercise_set_target_id=targets[0].id, reps=10, weight=135.0)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, exercise_set_target_id=targets[1].id, reps=8, weight=140.0)
        workout_service.finish_session(session.id)

        comparison = stats_service.get_plan_vs_actual(se.id)
        assert len(comparison) == 2
        assert comparison[0]["has_target"] == 1
        assert comparison[0]["planned_weight"] == 135.0
        assert comparison[0]["actual_weight"] == 135.0
        assert comparison[1]["actual_reps"] == 8

    def test_plan_vs_actual_ad_hoc_no_target(self, stats_service, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)
        ex = make_exercise("Bench Press")

        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)  # ad-hoc
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        workout_service.finish_session(session.id)

        comparison = stats_service.get_plan_vs_actual(se.id)
        assert len(comparison) == 1
        assert comparison[0]["has_target"] == 0
        assert comparison[0]["planned_weight"] is None

    def test_total_volume_trend(self, stats_service, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=100.0)
        workout_service.finish_session(session.id)

        trend = stats_service.get_total_volume_trend(weeks=1)
        assert len(trend) >= 1
        assert trend[0]["total_volume"] == 1000.0  # 10 * 100


class TestStatsServiceTypeAware:

    def _create_typed_session(self, workout_service, routine_service, make_exercise,
                              name, ex_type, set_kind, finish=True, **set_kwargs):
        routines = routine_service.list_routines()
        if routines:
            r = routines[0]
            days = routine_service.get_days(r.id)
            day = days[0]
        else:
            r = routine_service.create_routine("Test")
            day = routine_service.add_day(r.id, "A", "Push")
            routine_service.activate_routine(r.id)
        ex = make_exercise(name, type=ex_type)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        ls = workout_service.log_set(se.id, set_kind, **set_kwargs)
        if finish:
            workout_service.finish_session(session.id)
        return ex, session, se, ls

    def test_best_set_reps_only(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Pullup", ExerciseType.REPS_ONLY, SetKind.REPS_ONLY, reps=15,
        )
        best = stats_service.get_exercise_best_set(ex.id)
        assert best is not None
        assert best["reps"] == 15
        assert best["exercise_type"] == "reps_only"

    def test_best_set_time(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Plank", ExerciseType.TIME, SetKind.DURATION, duration_seconds=120,
        )
        best = stats_service.get_exercise_best_set(ex.id)
        assert best["duration_seconds"] == 120
        assert best["exercise_type"] == "time"

    def test_best_set_cardio_with_distance(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Treadmill", ExerciseType.CARDIO, SetKind.CARDIO,
            duration_seconds=1800, distance=5.0,
        )
        best = stats_service.get_exercise_best_set(ex.id)
        assert best["distance"] == 5.0
        assert best["duration_seconds"] == 1800

    def test_best_set_cardio_duration_only(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Bike", ExerciseType.CARDIO, SetKind.CARDIO,
            duration_seconds=2400,
        )
        best = stats_service.get_exercise_best_set(ex.id)
        assert best["duration_seconds"] == 2400

    def test_history_reps_only(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Pushup", ExerciseType.REPS_ONLY, SetKind.REPS_ONLY, reps=20,
        )
        history = stats_service.get_exercise_history(ex.id)
        assert len(history) == 1
        assert history[0]["max_reps"] == 20

    def test_history_time(self, stats_service, workout_service, routine_service, make_exercise):
        ex, *_ = self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Wall Sit", ExerciseType.TIME, SetKind.DURATION, duration_seconds=90,
        )
        history = stats_service.get_exercise_history(ex.id)
        assert history[0]["max_duration"] == 90

    def test_recent_prs_includes_non_weight(self, stats_service, workout_service, routine_service, make_exercise):
        self._create_typed_session(
            workout_service, routine_service, make_exercise,
            "Pullup", ExerciseType.REPS_ONLY, SetKind.REPS_ONLY, reps=20,
        )
        prs = stats_service.get_recent_prs(10)
        assert len(prs) >= 1
        pr = next(p for p in prs if p["exercise_name"] == "Pullup")
        assert pr["reps"] == 20
        assert pr["exercise_type"] == "reps_only"
