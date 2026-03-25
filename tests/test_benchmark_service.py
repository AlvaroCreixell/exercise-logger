import pytest
from datetime import datetime, timezone, timedelta
from src.models.benchmark import BenchmarkMethod


class TestBenchmarkService:

    def test_create_definition(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper",
        )
        assert defn.id is not None
        assert defn.method == BenchmarkMethod.MAX_WEIGHT
        assert defn.frequency_weeks == 6  # default
        assert defn.muscle_group_label == "Upper"

    def test_create_with_reference_weight(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_REPS, "Upper",
            reference_weight=100.0,
        )
        assert defn.reference_weight == 100.0

    def test_create_with_custom_frequency(self, benchmark_service, make_exercise):
        ex = make_exercise("Plank")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.TIMED_HOLD, "Core",
            frequency_weeks=8,
        )
        assert defn.frequency_weeks == 8

    def test_list_definitions(self, benchmark_service, make_exercise):
        ex1 = make_exercise("Bench Press")
        ex2 = make_exercise("Plank")
        benchmark_service.create_definition(ex1.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        benchmark_service.create_definition(ex2.id, BenchmarkMethod.TIMED_HOLD, "Core")
        defns = benchmark_service.list_definitions()
        assert len(defns) == 2

    def test_is_due_never_tested(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        assert benchmark_service.is_due(defn.id) is True

    def test_is_due_recently_tested(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        benchmark_service.record_result(defn.id, 185.0)
        assert benchmark_service.is_due(defn.id) is False

    def test_get_due_benchmarks(self, benchmark_service, make_exercise):
        ex1 = make_exercise("Bench Press")
        ex2 = make_exercise("Squat")
        defn1 = benchmark_service.create_definition(ex1.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        defn2 = benchmark_service.create_definition(ex2.id, BenchmarkMethod.MAX_WEIGHT, "Lower")
        benchmark_service.record_result(defn1.id, 185.0)
        # defn2 never tested = due
        due = benchmark_service.get_due_benchmarks()
        assert len(due) == 1
        assert due[0].id == defn2.id

    def test_record_result_with_snapshots(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_REPS, "Upper",
            reference_weight=100.0,
        )
        result = benchmark_service.record_result(defn.id, 12.0)

        assert result.method_snapshot == BenchmarkMethod.MAX_REPS
        assert result.reference_weight_snapshot == 100.0
        assert result.result_value == 12.0

    def test_snapshot_preserved_after_definition_edit(self, benchmark_service, make_exercise):
        """Editing definition after recording preserves old result's snapshot."""
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_REPS, "Upper",
            reference_weight=100.0,
        )
        result1 = benchmark_service.record_result(defn.id, 12.0)

        # Edit definition to new weight
        defn.reference_weight = 120.0
        benchmark_service.update_definition(defn)

        result2 = benchmark_service.record_result(defn.id, 8.0)

        # Old result still has old snapshot
        results = benchmark_service.get_results(defn.id)
        assert results[0].reference_weight_snapshot == 120.0  # newest first
        assert results[1].reference_weight_snapshot == 100.0  # original snapshot preserved

    def test_delete_definition(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        benchmark_service.delete_definition(defn.id)
        assert benchmark_service.get_definition(defn.id) is None

    def test_delete_definition_with_results(self, benchmark_service, make_exercise):
        """Deleting a definition also removes its recorded results."""
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        benchmark_service.record_result(defn.id, 185.0)
        benchmark_service.record_result(defn.id, 195.0)

        results = benchmark_service.get_results(defn.id)
        assert len(results) == 2

        benchmark_service.delete_definition(defn.id)
        assert benchmark_service.get_definition(defn.id) is None
        assert len(benchmark_service.get_results(defn.id)) == 0
