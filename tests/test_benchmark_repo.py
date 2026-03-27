"""Tests for benchmark repository."""
import pytest
from src.models.enums import BenchmarkMethod
from src.models.benchmark import BenchmarkResult


def _make_result(**overrides):
    defaults = dict(
        id=None,
        exercise_key_snapshot="barbell_bench_press",
        exercise_name_snapshot="Barbell Bench Press",
        method=BenchmarkMethod.MAX_WEIGHT,
        result_value=100.0,
        tested_at="2026-03-26",
        bodyweight=80.0,
    )
    defaults.update(overrides)
    return BenchmarkResult(**defaults)


class TestBenchmarkRepo:
    def test_add_and_get_result(self, benchmark_repo):
        result = _make_result()
        rid = benchmark_repo.add_result(result)
        assert rid is not None

        fetched = benchmark_repo.get_result(rid)
        assert fetched is not None
        assert fetched.exercise_key_snapshot == "barbell_bench_press"
        assert fetched.method == BenchmarkMethod.MAX_WEIGHT
        assert fetched.result_value == 100.0
        assert fetched.bodyweight == 80.0

    def test_get_missing_returns_none(self, benchmark_repo):
        assert benchmark_repo.get_result(999) is None

    def test_get_results_for_exercise(self, benchmark_repo):
        benchmark_repo.add_result(_make_result(tested_at="2026-03-20"))
        benchmark_repo.add_result(_make_result(tested_at="2026-03-26"))
        benchmark_repo.add_result(_make_result(
            exercise_key_snapshot="pull_up",
            exercise_name_snapshot="Pull-Up",
            method=BenchmarkMethod.MAX_REPS,
            result_value=15.0,
        ))

        results = benchmark_repo.get_results_for_exercise("barbell_bench_press")
        assert len(results) == 2
        assert results[0].tested_at >= results[1].tested_at  # Most recent first

    def test_get_latest_result(self, benchmark_repo):
        benchmark_repo.add_result(_make_result(result_value=80.0, tested_at="2026-03-20"))
        benchmark_repo.add_result(_make_result(result_value=100.0, tested_at="2026-03-26"))

        latest = benchmark_repo.get_latest_result("barbell_bench_press")
        assert latest is not None
        assert latest.result_value == 100.0
        assert latest.tested_at == "2026-03-26"

    def test_get_latest_result_none(self, benchmark_repo):
        assert benchmark_repo.get_latest_result("nonexistent") is None

    def test_null_bodyweight(self, benchmark_repo):
        rid = benchmark_repo.add_result(_make_result(bodyweight=None))
        fetched = benchmark_repo.get_result(rid)
        assert fetched.bodyweight is None

    def test_get_all_results(self, benchmark_repo):
        benchmark_repo.add_result(_make_result(tested_at="2026-03-20"))
        benchmark_repo.add_result(_make_result(
            exercise_key_snapshot="pull_up",
            exercise_name_snapshot="Pull-Up",
            method=BenchmarkMethod.MAX_REPS,
            result_value=15.0,
            tested_at="2026-03-26",
        ))

        results = benchmark_repo.get_all_results()
        assert len(results) == 2

    def test_timed_hold_result(self, benchmark_repo):
        rid = benchmark_repo.add_result(_make_result(
            exercise_key_snapshot="plank",
            exercise_name_snapshot="Plank",
            method=BenchmarkMethod.TIMED_HOLD,
            result_value=120.0,
        ))
        fetched = benchmark_repo.get_result(rid)
        assert fetched.method == BenchmarkMethod.TIMED_HOLD
        assert fetched.result_value == 120.0
