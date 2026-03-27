"""Tests for routine YAML loader — valid parsing and fail-fast validation."""
import os
import pytest
from src.loaders.exercise_loader import LoaderError
from src.loaders.routine_loader import load_routine, load_all_routines
from src.models.enums import ExerciseType, SetScheme
from src.models.bundled import Exercise
from src.registries.exercise_registry import ExerciseRegistry

_TEST_DATA = os.path.join(os.path.dirname(__file__), "data")


@pytest.fixture
def exercise_registry():
    """Minimal exercise registry for routine loader tests."""
    exercises = [
        Exercise(key="bench_press", name="Bench Press", type=ExerciseType.REPS_WEIGHT,
                 equipment="Barbell", muscle_group="Chest"),
        Exercise(key="plank", name="Plank", type=ExerciseType.TIME,
                 equipment="Bodyweight", muscle_group="Core"),
        Exercise(key="running", name="Running", type=ExerciseType.CARDIO,
                 equipment="None", muscle_group="Cardio"),
    ]
    return ExerciseRegistry(exercises)


class TestValidRoutineLoading:
    def test_loads_routine(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        assert routine.key == "test_routine"
        assert routine.name == "Test Routine"
        assert len(routine.days) == 1

    def test_day_fields(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        day = routine.days[0]
        assert day.key == "day_a"
        assert day.label == "A"
        assert day.name == "Day A"
        assert len(day.exercises) == 3

    def test_reps_weight_exercise(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        bench = routine.days[0].exercises[0]
        assert bench.exercise_key == "bench_press"
        assert bench.scheme == SetScheme.UNIFORM
        assert bench.sets == 3
        assert bench.reps_min == 8
        assert bench.reps_max == 12

    def test_time_exercise(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        plank = routine.days[0].exercises[1]
        assert plank.exercise_key == "plank"
        assert plank.duration_seconds == 60
        assert plank.reps_min is None

    def test_cardio_exercise_no_targets(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        run = routine.days[0].exercises[2]
        assert run.exercise_key == "running"
        assert run.sets == 1
        assert run.duration_seconds is None
        assert run.distance_km is None

    def test_routine_is_frozen(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        with pytest.raises(AttributeError):
            routine.name = "Changed"

    def test_exact_reps_parses_as_equal_min_max(self, exercise_registry, tmp_path):
        """reps: 10 parses as reps_min=10, reps_max=10."""
        yaml_file = tmp_path / "exact_reps.yaml"
        yaml_file.write_text(
            "key: test\nname: Test\ndescription: test\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: bench_press\n        sets: 3\n        reps: 10\n"
        )
        routine = load_routine(str(yaml_file), exercise_registry)
        ex = routine.days[0].exercises[0]
        assert ex.reps_min == 10
        assert ex.reps_max == 10

    def test_production_routines_load(self):
        """The real routines directory loads without errors."""
        from src.config import EXERCISES_CSV_PATH, ROUTINES_DIR
        from src.loaders.exercise_loader import load_exercises
        exercises = load_exercises(EXERCISES_CSV_PATH)
        reg = ExerciseRegistry(exercises)
        routines = load_all_routines(ROUTINES_DIR, reg)
        assert len(routines) >= 1
        for r in routines:
            assert r.key
            assert len(r.days) >= 1


class TestRoutineLoaderValidation:
    def test_missing_sets_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="missing 'sets'"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_missing_sets.yaml"),
                exercise_registry,
            )

    def test_unknown_exercise_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="unknown exercise_key"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_unknown_exercise.yaml"),
                exercise_registry,
            )

    def test_progressive_on_time_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="progressive.*only valid for reps_weight"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_progressive_time.yaml"),
                exercise_registry,
            )

    def test_duplicate_day_key_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="duplicate day key"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_duplicate_day_key.yaml"),
                exercise_registry,
            )

    def test_duplicate_day_label_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="duplicate day label"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_duplicate_day_label.yaml"),
                exercise_registry,
            )

    def test_time_without_duration_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="duration_seconds.*required"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_time_no_duration.yaml"),
                exercise_registry,
            )

    def test_missing_file_fails(self, exercise_registry):
        with pytest.raises(FileNotFoundError):
            load_routine("/nonexistent/path.yaml", exercise_registry)

    def test_progressive_with_reps_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "prog_reps.yaml"
        yaml_file.write_text(
            "key: test\nname: Test\ndescription: test\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: bench_press\n        scheme: progressive\n"
            "        sets: 3\n        reps: 8-12\n"
        )
        with pytest.raises(LoaderError, match="progressive.*must not specify.*reps"):
            load_routine(str(yaml_file), exercise_registry)

    def test_invalid_reps_syntax_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "bad_reps.yaml"
        yaml_file.write_text(
            "key: test\nname: Test\ndescription: test\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: bench_press\n        sets: 3\n        reps: abc\n"
        )
        with pytest.raises(LoaderError, match="invalid reps syntax"):
            load_routine(str(yaml_file), exercise_registry)

    def test_duplicate_routine_key_across_files_fails(self, exercise_registry, tmp_path):
        """load_all_routines detects duplicate keys across files."""
        dir_path = tmp_path / "routines"
        dir_path.mkdir()
        routine_yaml = (
            "key: same_key\nname: Routine\ndescription: d\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: bench_press\n        sets: 3\n"
        )
        (dir_path / "a.yaml").write_text(routine_yaml)
        (dir_path / "b.yaml").write_text(routine_yaml)
        with pytest.raises(LoaderError, match="duplicate routine key"):
            load_all_routines(str(dir_path), exercise_registry)

    def test_cardio_with_targets_accepted(self, exercise_registry, tmp_path):
        """Cardio exercises with both duration and distance are valid."""
        yaml_file = tmp_path / "cardio_targets.yaml"
        yaml_file.write_text(
            "key: test\nname: Test\ndescription: test\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: running\n        sets: 1\n"
            "        duration_seconds: 1800\n        distance_km: 5.0\n"
        )
        routine = load_routine(str(yaml_file), exercise_registry)
        ex = routine.days[0].exercises[0]
        assert ex.duration_seconds == 1800
        assert ex.distance_km == 5.0
