"""Tests for benchmark YAML loader — valid parsing and fail-fast validation."""
import os
import pytest
from src.loaders.exercise_loader import LoaderError
from src.loaders.benchmark_loader import load_benchmark_config
from src.models.enums import ExerciseType, BenchmarkMethod
from src.models.bundled import Exercise
from src.registries.exercise_registry import ExerciseRegistry

_TEST_DATA = os.path.join(os.path.dirname(__file__), "data")


@pytest.fixture
def exercise_registry():
    """Minimal exercise registry for benchmark loader tests."""
    exercises = [
        Exercise(key="bench_press", name="Bench Press", type=ExerciseType.REPS_WEIGHT,
                 equipment="Barbell", muscle_group="Chest"),
        Exercise(key="plank", name="Plank", type=ExerciseType.TIME,
                 equipment="Bodyweight", muscle_group="Core"),
        Exercise(key="running", name="Running", type=ExerciseType.CARDIO,
                 equipment="None", muscle_group="Cardio"),
    ]
    return ExerciseRegistry(exercises)


class TestValidBenchmarkLoading:
    def test_loads_config(self, exercise_registry):
        config = load_benchmark_config(
            os.path.join(_TEST_DATA, "valid_benchmarks.yaml"), exercise_registry
        )
        assert config.frequency_weeks == 6
        assert len(config.items) == 2

    def test_item_fields(self, exercise_registry):
        config = load_benchmark_config(
            os.path.join(_TEST_DATA, "valid_benchmarks.yaml"), exercise_registry
        )
        bench = config.items[0]
        assert bench.exercise_key == "bench_press"
        assert bench.method == BenchmarkMethod.MAX_WEIGHT

        plank = config.items[1]
        assert plank.exercise_key == "plank"
        assert plank.method == BenchmarkMethod.TIMED_HOLD

    def test_config_is_frozen(self, exercise_registry):
        config = load_benchmark_config(
            os.path.join(_TEST_DATA, "valid_benchmarks.yaml"), exercise_registry
        )
        with pytest.raises(AttributeError):
            config.frequency_weeks = 12

    def test_production_benchmarks_load(self):
        """The real benchmarks.yaml loads without errors."""
        from src.config import EXERCISES_CSV_PATH, BENCHMARKS_YAML_PATH
        from src.loaders.exercise_loader import load_exercises
        exercises = load_exercises(EXERCISES_CSV_PATH)
        reg = ExerciseRegistry(exercises)
        config = load_benchmark_config(BENCHMARKS_YAML_PATH, reg)
        assert config.frequency_weeks >= 1
        assert len(config.items) >= 1


class TestBenchmarkLoaderValidation:
    def test_duplicate_exercise_key_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="duplicate exercise_key 'bench_press'"):
            load_benchmark_config(
                os.path.join(_TEST_DATA, "bad_benchmarks_duplicate.yaml"),
                exercise_registry,
            )

    def test_unknown_exercise_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="unknown exercise_key"):
            load_benchmark_config(
                os.path.join(_TEST_DATA, "bad_benchmarks_unknown_exercise.yaml"),
                exercise_registry,
            )

    def test_missing_file_fails(self, exercise_registry):
        with pytest.raises(FileNotFoundError):
            load_benchmark_config("/nonexistent/path.yaml", exercise_registry)

    def test_missing_frequency_weeks_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "no_freq.yaml"
        yaml_file.write_text(
            "items:\n  - exercise_key: bench_press\n    method: max_weight\n"
        )
        with pytest.raises(LoaderError, match="missing 'frequency_weeks'"):
            load_benchmark_config(str(yaml_file), exercise_registry)

    def test_invalid_method_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "bad_method.yaml"
        yaml_file.write_text(
            "frequency_weeks: 6\nitems:\n"
            "  - exercise_key: bench_press\n    method: one_rep_max\n"
        )
        with pytest.raises(LoaderError, match="invalid method"):
            load_benchmark_config(str(yaml_file), exercise_registry)

    def test_empty_items_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "empty_items.yaml"
        yaml_file.write_text("frequency_weeks: 6\nitems: []\n")
        with pytest.raises(LoaderError, match="missing or empty 'items'"):
            load_benchmark_config(str(yaml_file), exercise_registry)

    def test_zero_frequency_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "zero_freq.yaml"
        yaml_file.write_text(
            "frequency_weeks: 0\nitems:\n"
            "  - exercise_key: bench_press\n    method: max_weight\n"
        )
        with pytest.raises(LoaderError, match="frequency_weeks.*must be >= 1"):
            load_benchmark_config(str(yaml_file), exercise_registry)
