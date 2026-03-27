"""Integration test — loads real production data files and verifies the full data layer."""
import os
import pytest
from src.config import EXERCISES_CSV_PATH, ROUTINES_DIR, BENCHMARKS_YAML_PATH
from src.loaders.exercise_loader import load_exercises
from src.loaders.routine_loader import load_all_routines
from src.loaders.benchmark_loader import load_benchmark_config
from src.registries.exercise_registry import ExerciseRegistry
from src.registries.routine_registry import RoutineRegistry
from src.registries.benchmark_registry import BenchmarkRegistry
from src.models.enums import ExerciseType, SetScheme, BenchmarkMethod


class TestProductionDataIntegration:
    """Load all real bundled data and verify cross-references."""

    @pytest.fixture
    def exercise_registry(self):
        exercises = load_exercises(EXERCISES_CSV_PATH)
        return ExerciseRegistry(exercises)

    @pytest.fixture
    def routine_registry(self, exercise_registry):
        routines = load_all_routines(ROUTINES_DIR, exercise_registry)
        return RoutineRegistry(routines)

    @pytest.fixture
    def benchmark_registry(self, exercise_registry):
        config = load_benchmark_config(BENCHMARKS_YAML_PATH, exercise_registry)
        return BenchmarkRegistry(config)

    def test_exercises_loaded(self, exercise_registry):
        assert len(exercise_registry) > 50  # We have ~78 exercises

    def test_known_exercise_exists(self, exercise_registry):
        bench = exercise_registry.get("barbell_bench_press")
        assert bench is not None
        assert bench.type == ExerciseType.REPS_WEIGHT
        assert bench.name == "Barbell Bench Press"

    def test_time_exercise_exists(self, exercise_registry):
        plank = exercise_registry.get("plank")
        assert plank is not None
        assert plank.type == ExerciseType.TIME

    def test_cardio_exercise_exists(self, exercise_registry):
        running = exercise_registry.get("running")
        assert running is not None
        assert running.type == ExerciseType.CARDIO

    def test_routines_loaded(self, routine_registry):
        assert len(routine_registry) >= 1

    def test_ppl_routine_structure(self, routine_registry):
        ppl = routine_registry.get("push_pull_legs")
        assert ppl is not None
        assert len(ppl.days) >= 3

    def test_ppl_day_exercises_reference_valid_keys(self, exercise_registry, routine_registry):
        ppl = routine_registry.get("push_pull_legs")
        for day in ppl.days:
            for ex in day.exercises:
                assert exercise_registry.get(ex.exercise_key) is not None, \
                    f"Exercise key '{ex.exercise_key}' not in catalog"

    def test_cycle_advancement(self, routine_registry):
        ppl = routine_registry.get("push_pull_legs")
        first_day = ppl.days[0].key
        second_day = ppl.days[1].key if len(ppl.days) > 1 else first_day
        next_key = routine_registry.get_next_day_key("push_pull_legs", first_day)
        assert next_key == second_day

    def test_cycle_wraps(self, routine_registry):
        ppl = routine_registry.get("push_pull_legs")
        last_day = ppl.days[-1].key
        first_day = ppl.days[0].key
        next_key = routine_registry.get_next_day_key("push_pull_legs", last_day)
        assert next_key == first_day

    def test_benchmarks_loaded(self, benchmark_registry):
        assert len(benchmark_registry) >= 3

    def test_benchmark_exercise_keys_valid(self, exercise_registry, benchmark_registry):
        for item in benchmark_registry.list_items():
            assert exercise_registry.get(item.exercise_key) is not None, \
                f"Benchmark exercise key '{item.exercise_key}' not in catalog"

    def test_benchmark_frequency(self, benchmark_registry):
        assert benchmark_registry.frequency_weeks == 6
