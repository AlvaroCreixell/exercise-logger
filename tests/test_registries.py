"""Tests for in-memory registries — lookups, filtering, immutability."""
import pytest
from src.models.enums import ExerciseType, SetScheme, BenchmarkMethod
from src.models.bundled import (
    Exercise, Routine, RoutineDay, DayExercise,
    BenchmarkConfig, BenchmarkItem,
)
from src.registries.exercise_registry import ExerciseRegistry
from src.registries.routine_registry import RoutineRegistry
from src.registries.benchmark_registry import BenchmarkRegistry


# --- Exercise Registry ---

def _make_exercises():
    return [
        Exercise(key="bench", name="Bench Press", type=ExerciseType.REPS_WEIGHT,
                 equipment="Barbell", muscle_group="Chest"),
        Exercise(key="squat", name="Squat", type=ExerciseType.REPS_WEIGHT,
                 equipment="Barbell", muscle_group="Legs"),
        Exercise(key="plank", name="Plank", type=ExerciseType.TIME,
                 equipment="Bodyweight", muscle_group="Core"),
        Exercise(key="running", name="Running", type=ExerciseType.CARDIO,
                 equipment="None", muscle_group="Cardio"),
    ]


class TestExerciseRegistry:
    def test_get_by_key(self):
        reg = ExerciseRegistry(_make_exercises())
        ex = reg.get("bench")
        assert ex is not None
        assert ex.name == "Bench Press"

    def test_get_missing_returns_none(self):
        reg = ExerciseRegistry(_make_exercises())
        assert reg.get("nonexistent") is None

    def test_get_or_raise_found(self):
        reg = ExerciseRegistry(_make_exercises())
        ex = reg.get_or_raise("bench")
        assert ex.key == "bench"

    def test_get_or_raise_missing(self):
        reg = ExerciseRegistry(_make_exercises())
        with pytest.raises(KeyError, match="Unknown exercise key"):
            reg.get_or_raise("nonexistent")

    def test_contains(self):
        reg = ExerciseRegistry(_make_exercises())
        assert reg.contains("bench")
        assert not reg.contains("nonexistent")
        assert "bench" in reg
        assert "nonexistent" not in reg

    def test_list_all(self):
        reg = ExerciseRegistry(_make_exercises())
        all_ex = reg.list_all()
        assert len(all_ex) == 4
        assert isinstance(all_ex, tuple)

    def test_list_by_type(self):
        reg = ExerciseRegistry(_make_exercises())
        rw = reg.list_by_type(ExerciseType.REPS_WEIGHT)
        assert len(rw) == 2
        assert all(e.type == ExerciseType.REPS_WEIGHT for e in rw)

    def test_list_by_muscle_group(self):
        reg = ExerciseRegistry(_make_exercises())
        chest = reg.list_by_muscle_group("Chest")
        assert len(chest) == 1
        assert chest[0].key == "bench"

    def test_len(self):
        reg = ExerciseRegistry(_make_exercises())
        assert len(reg) == 4

    def test_duplicate_key_raises(self):
        exercises = _make_exercises()
        exercises.append(Exercise(key="bench", name="Dup", type=ExerciseType.REPS_WEIGHT,
                                  equipment="X", muscle_group="X"))
        with pytest.raises(ValueError, match="Duplicate exercise key"):
            ExerciseRegistry(exercises)

    def test_empty_registry(self):
        reg = ExerciseRegistry([])
        assert len(reg) == 0
        assert reg.get("anything") is None


# --- Routine Registry ---

def _make_routines():
    day_a = RoutineDay(
        key="push", label="A", name="Push",
        exercises=(
            DayExercise(exercise_key="bench", scheme=SetScheme.UNIFORM, sets=3, reps_min=8, reps_max=12),
        ),
    )
    day_b = RoutineDay(
        key="pull", label="B", name="Pull",
        exercises=(
            DayExercise(exercise_key="squat", scheme=SetScheme.PROGRESSIVE, sets=3),
        ),
    )
    return [
        Routine(key="ppl", name="Push Pull Legs", description="3-day split", days=(day_a, day_b)),
    ]


class TestRoutineRegistry:
    def test_get_by_key(self):
        reg = RoutineRegistry(_make_routines())
        r = reg.get("ppl")
        assert r is not None
        assert r.name == "Push Pull Legs"

    def test_get_missing_returns_none(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get("nonexistent") is None

    def test_get_or_raise(self):
        reg = RoutineRegistry(_make_routines())
        r = reg.get_or_raise("ppl")
        assert r.key == "ppl"

    def test_get_or_raise_missing(self):
        reg = RoutineRegistry(_make_routines())
        with pytest.raises(KeyError, match="Unknown routine key"):
            reg.get_or_raise("nonexistent")

    def test_contains(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.contains("ppl")
        assert "ppl" in reg
        assert "nonexistent" not in reg

    def test_list_all(self):
        reg = RoutineRegistry(_make_routines())
        all_r = reg.list_all()
        assert len(all_r) == 1
        assert isinstance(all_r, tuple)

    def test_get_day(self):
        reg = RoutineRegistry(_make_routines())
        day = reg.get_day("ppl", "push")
        assert day is not None
        assert day.name == "Push"

    def test_get_day_missing_routine(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get_day("nonexistent", "push") is None

    def test_get_day_missing_day(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get_day("ppl", "nonexistent") is None

    def test_get_next_day_key(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get_next_day_key("ppl", "push") == "pull"

    def test_get_next_day_key_wraps(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get_next_day_key("ppl", "pull") == "push"

    def test_get_next_day_key_unknown_routine(self):
        reg = RoutineRegistry(_make_routines())
        with pytest.raises(KeyError):
            reg.get_next_day_key("nonexistent", "push")

    def test_get_next_day_key_unknown_day(self):
        reg = RoutineRegistry(_make_routines())
        with pytest.raises(KeyError):
            reg.get_next_day_key("ppl", "nonexistent")

    def test_len(self):
        reg = RoutineRegistry(_make_routines())
        assert len(reg) == 1

    def test_duplicate_key_raises(self):
        routines = _make_routines() + _make_routines()
        with pytest.raises(ValueError, match="Duplicate routine key"):
            RoutineRegistry(routines)


# --- Benchmark Registry ---

def _make_benchmark_config():
    return BenchmarkConfig(
        frequency_weeks=6,
        items=(
            BenchmarkItem(exercise_key="bench", method=BenchmarkMethod.MAX_WEIGHT),
            BenchmarkItem(exercise_key="plank", method=BenchmarkMethod.TIMED_HOLD),
        ),
    )


class TestBenchmarkRegistry:
    def test_frequency_weeks(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        assert reg.frequency_weeks == 6

    def test_get_item(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        item = reg.get_item("bench")
        assert item is not None
        assert item.method == BenchmarkMethod.MAX_WEIGHT

    def test_get_item_missing(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        assert reg.get_item("nonexistent") is None

    def test_list_items(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        items = reg.list_items()
        assert len(items) == 2
        assert isinstance(items, tuple)

    def test_contains(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        assert "bench" in reg
        assert "nonexistent" not in reg

    def test_len(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        assert len(reg) == 2
