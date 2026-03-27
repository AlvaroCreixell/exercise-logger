"""Tests for SettingsService — settings access and unit conversion."""
import pytest
from datetime import datetime, timezone, timedelta

from src.models.workout import WorkoutSession, SessionExercise, LoggedSet, SessionStatus
from src.models.benchmark import BenchmarkResult
from src.models.enums import ExerciseType, SetScheme, ExerciseSource, BenchmarkMethod
from src.utils.unit_conversion import LB_TO_KG, KG_TO_LB


def _seed_weight_data(workout_repo, benchmark_repo):
    """Seed test data with known weights for conversion testing."""
    now = datetime.now(timezone.utc)

    # Create a finished session with weight sets
    session = WorkoutSession(
        id=None,
        routine_key_snapshot="push_pull_legs",
        routine_name_snapshot="Push Pull Legs",
        day_key_snapshot="push",
        day_label_snapshot="A",
        day_name_snapshot="Push",
        status=SessionStatus.FINISHED,
        completed_fully=True,
        started_at=now.isoformat(),
        finished_at=(now + timedelta(minutes=30)).isoformat(),
    )
    session.id = workout_repo.create_session(session)

    se = SessionExercise(
        id=None,
        session_id=session.id,
        sort_order=0,
        exercise_key_snapshot="barbell_bench_press",
        exercise_name_snapshot="Barbell Bench Press",
        exercise_type_snapshot=ExerciseType.REPS_WEIGHT,
        source=ExerciseSource.PLANNED,
        scheme_snapshot=SetScheme.PROGRESSIVE,
        planned_sets=3,
        target_reps_min=None,
        target_reps_max=None,
        target_duration_seconds=None,
        target_distance_km=None,
        plan_notes_snapshot=None,
    )
    se.id = workout_repo.add_session_exercise(se)

    # 100 lb set
    ls = LoggedSet(
        id=None,
        session_exercise_id=se.id,
        set_number=1,
        reps=10,
        weight=100.0,
        duration_seconds=None,
        distance_km=None,
        logged_at=now.isoformat(),
    )
    ls.id = workout_repo.add_logged_set(ls)
    workout_repo.commit()

    # Benchmark: max_weight result at 200 lb, bodyweight 180 lb
    br_weight = BenchmarkResult(
        id=None,
        exercise_key_snapshot="barbell_bench_press",
        exercise_name_snapshot="Barbell Bench Press",
        method=BenchmarkMethod.MAX_WEIGHT,
        result_value=200.0,
        bodyweight=180.0,
        tested_at=now.isoformat(),
    )
    br_weight.id = benchmark_repo.add_result(br_weight)

    # Benchmark: max_reps result (should NOT convert result_value)
    br_reps = BenchmarkResult(
        id=None,
        exercise_key_snapshot="pull_up",
        exercise_name_snapshot="Pull-Up",
        method=BenchmarkMethod.MAX_REPS,
        result_value=15.0,
        bodyweight=180.0,
        tested_at=now.isoformat(),
    )
    br_reps.id = benchmark_repo.add_result(br_reps)
    benchmark_repo.commit()

    return {
        "session_id": session.id,
        "se_id": se.id,
        "ls_id": ls.id,
        "br_weight_id": br_weight.id,
        "br_reps_id": br_reps.id,
    }


class TestGetSet:
    """Basic settings get/set."""

    def test_get_default(self, settings_service):
        assert settings_service.get("nonexistent") is None

    def test_get_with_default(self, settings_service):
        assert settings_service.get("nonexistent", "fallback") == "fallback"

    def test_set_and_get(self, settings_service):
        settings_service.set("my_key", "my_value")
        assert settings_service.get("my_key") == "my_value"

    def test_get_weight_unit_default(self, settings_service):
        assert settings_service.get_weight_unit() == "lb"


class TestUnitToggle:
    """Weight unit toggle with conversion."""

    def test_toggle_lb_to_kg(self, settings_service, workout_repo, benchmark_repo):
        ids = _seed_weight_data(workout_repo, benchmark_repo)

        result = settings_service.toggle_weight_unit()
        assert result["new_unit"] == "kg"
        assert result["rows_converted"] > 0

        # Verify weight converted
        ls = workout_repo.get_logged_set(ids["ls_id"])
        assert ls.weight == round(100.0 * LB_TO_KG, 2)

        # Verify benchmark max_weight converted
        br = benchmark_repo.get_result(ids["br_weight_id"])
        assert br.result_value == round(200.0 * LB_TO_KG, 2)

        # Verify bodyweight converted
        assert br.bodyweight == round(180.0 * LB_TO_KG, 2)

        # Verify max_reps result NOT converted
        br_reps = benchmark_repo.get_result(ids["br_reps_id"])
        assert br_reps.result_value == 15.0  # unchanged

        # But max_reps bodyweight IS converted
        assert br_reps.bodyweight == round(180.0 * LB_TO_KG, 2)

        # Setting updated
        assert settings_service.get_weight_unit() == "kg"

    def test_toggle_kg_to_lb(self, settings_service, workout_repo,
                              benchmark_repo, settings_repo):
        ids = _seed_weight_data(workout_repo, benchmark_repo)
        settings_repo.set("weight_unit", "kg")
        settings_repo.commit()

        result = settings_service.toggle_weight_unit()
        assert result["new_unit"] == "lb"

        ls = workout_repo.get_logged_set(ids["ls_id"])
        assert ls.weight == round(100.0 * KG_TO_LB, 2)

    def test_roundtrip_conversion(self, settings_service, workout_repo, benchmark_repo):
        """lb -> kg -> lb should produce close-to-original values."""
        ids = _seed_weight_data(workout_repo, benchmark_repo)

        settings_service.toggle_weight_unit()  # lb -> kg
        settings_service.toggle_weight_unit()  # kg -> lb

        ls = workout_repo.get_logged_set(ids["ls_id"])
        assert abs(ls.weight - 100.0) < 0.1  # floating point rounding

    def test_toggle_same_unit_noop(self, settings_service, settings_repo):
        """If already the target unit, nothing happens."""
        settings_repo.set("weight_unit", "lb")
        settings_repo.commit()

        # Calling set_weight_unit with same value
        rows = settings_service.set_weight_unit("lb")
        assert rows == 0

    def test_benchmark_max_weight_result_converted(self, settings_service,
                                                    workout_repo, benchmark_repo):
        """benchmark_results.result_value is converted for max_weight method."""
        ids = _seed_weight_data(workout_repo, benchmark_repo)
        settings_service.toggle_weight_unit()

        br = benchmark_repo.get_result(ids["br_weight_id"])
        assert br.result_value == round(200.0 * LB_TO_KG, 2)

    def test_benchmark_max_reps_result_not_converted(self, settings_service,
                                                      workout_repo, benchmark_repo):
        """benchmark_results.result_value is NOT converted for max_reps method."""
        ids = _seed_weight_data(workout_repo, benchmark_repo)
        settings_service.toggle_weight_unit()

        br_reps = benchmark_repo.get_result(ids["br_reps_id"])
        assert br_reps.result_value == 15.0  # unchanged

    def test_benchmark_bodyweight_converted(self, settings_service,
                                             workout_repo, benchmark_repo):
        """benchmark_results.bodyweight is always converted when not NULL."""
        ids = _seed_weight_data(workout_repo, benchmark_repo)
        settings_service.toggle_weight_unit()

        br_reps = benchmark_repo.get_result(ids["br_reps_id"])
        assert br_reps.bodyweight == round(180.0 * LB_TO_KG, 2)


class TestWeightUnitValidation:
    def test_invalid_unit_rejected(self, settings_service):
        with pytest.raises(ValueError, match="must be 'lb' or 'kg'"):
            settings_service.set_weight_unit("stone")

    def test_empty_string_rejected(self, settings_service):
        with pytest.raises(ValueError, match="must be 'lb' or 'kg'"):
            settings_service.set_weight_unit("")

    def test_lb_accepted(self, settings_service):
        settings_service.set_weight_unit("lb")  # should not raise

    def test_kg_accepted(self, settings_service):
        settings_service.set_weight_unit("kg")  # should not raise
