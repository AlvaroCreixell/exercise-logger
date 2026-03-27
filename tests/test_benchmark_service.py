"""Tests for BenchmarkService — due calculation and result recording."""
import pytest
from datetime import datetime, timezone, timedelta
from tests.conftest import days_ago


class TestDueCalculation:
    """Benchmark due = no result or result older than frequency * 7 days."""

    def test_all_due_when_no_results(self, benchmark_service):
        """All items are due when no results have been recorded."""
        due = benchmark_service.get_due_items()
        assert len(due) == 3  # bench, pull_up, plank
        keys = {d["exercise_key"] for d in due}
        assert keys == {"barbell_bench_press", "pull_up", "plank"}

    def test_is_any_due_true_initially(self, benchmark_service):
        assert benchmark_service.is_any_due() is True

    def test_fresh_result_not_due(self, benchmark_service):
        """Recent result within frequency window — not due."""
        benchmark_service.record_result(
            exercise_key="barbell_bench_press",
            method="max_weight",
            result_value=100.0,
            bodyweight=80.0,
        )
        due = benchmark_service.get_due_items()
        keys = {d["exercise_key"] for d in due}
        assert "barbell_bench_press" not in keys
        assert len(due) == 2  # pull_up and plank still due

    def test_old_result_becomes_due(self, benchmark_service, benchmark_repo):
        """Result older than frequency_weeks * 7 days becomes due."""
        from src.models.benchmark import BenchmarkResult
        from src.models.enums import BenchmarkMethod
        # Insert an old result directly
        old_date = (datetime.now(timezone.utc)
                    - timedelta(days=43)).isoformat()  # > 6*7=42 days
        result = BenchmarkResult(
            id=None,
            exercise_key_snapshot="barbell_bench_press",
            exercise_name_snapshot="Barbell Bench Press",
            method=BenchmarkMethod.MAX_WEIGHT,
            result_value=100.0,
            bodyweight=80.0,
            tested_at=old_date,
        )
        benchmark_repo.add_result(result)
        benchmark_repo.commit()

        due = benchmark_service.get_due_items()
        keys = {d["exercise_key"] for d in due}
        assert "barbell_bench_press" in keys

    def test_all_recorded_none_due(self, benchmark_service):
        """All items recently tested — none due."""
        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         100.0, bodyweight=80.0)
        benchmark_service.record_result("pull_up", "max_reps",
                                         15.0, bodyweight=80.0)
        benchmark_service.record_result("plank", "timed_hold",
                                         120.0, bodyweight=80.0)
        assert benchmark_service.is_any_due() is False
        assert len(benchmark_service.get_due_items()) == 0

    def test_due_items_include_last_tested_at(self, benchmark_service):
        """Due items show when they were last tested (or None)."""
        due = benchmark_service.get_due_items()
        for item in due:
            assert "last_tested_at" in item
            assert item["last_tested_at"] is None  # never tested

        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         100.0)
        # Bench is now fresh, check remaining
        due = benchmark_service.get_due_items()
        for item in due:
            assert item["last_tested_at"] is None


class TestRecordResult:
    """Recording benchmark results."""

    def test_record_result_basic(self, benchmark_service):
        result = benchmark_service.record_result(
            exercise_key="barbell_bench_press",
            method="max_weight",
            result_value=100.0,
            bodyweight=80.0,
        )
        assert result.id is not None
        assert result.exercise_key_snapshot == "barbell_bench_press"
        assert result.exercise_name_snapshot == "Barbell Bench Press"
        assert result.method.value == "max_weight"
        assert result.result_value == 100.0
        assert result.bodyweight == 80.0

    def test_record_result_without_bodyweight(self, benchmark_service):
        result = benchmark_service.record_result(
            exercise_key="plank",
            method="timed_hold",
            result_value=120.0,
        )
        assert result.bodyweight is None

    def test_record_result_invalid_exercise_raises(self, benchmark_service):
        with pytest.raises(ValueError, match="not found"):
            benchmark_service.record_result(
                exercise_key="nonexistent",
                method="max_weight",
                result_value=100.0,
            )

    def test_record_result_invalid_method_raises(self, benchmark_service):
        """Method must match the config for this exercise."""
        with pytest.raises(ValueError, match="method"):
            benchmark_service.record_result(
                exercise_key="barbell_bench_press",
                method="max_reps",  # config says max_weight
                result_value=100.0,
            )

    def test_record_result_exercise_not_in_config_raises(
            self, benchmark_service):
        """Exercise exists in catalog but not in benchmark config."""
        with pytest.raises(ValueError, match="not in benchmark"):
            benchmark_service.record_result(
                exercise_key="running",  # not in benchmark config
                method="timed_hold",
                result_value=100.0,
            )

    def test_record_result_zero_value_raises(self, benchmark_service):
        with pytest.raises(ValueError, match="positive"):
            benchmark_service.record_result(
                exercise_key="barbell_bench_press",
                method="max_weight",
                result_value=0.0,
            )


class TestBenchmarkHistory:
    """Retrieving benchmark history."""

    def test_history_empty(self, benchmark_service):
        history = benchmark_service.get_history("barbell_bench_press")
        assert history == []

    def test_history_oldest_first(self, benchmark_service):
        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         90.0, bodyweight=80.0)
        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         95.0, bodyweight=80.0)
        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         100.0, bodyweight=80.0)

        history = benchmark_service.get_history("barbell_bench_press")
        assert len(history) == 3
        assert history[0].result_value == 90.0
        assert history[2].result_value == 100.0
