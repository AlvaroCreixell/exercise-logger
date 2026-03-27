"""Tests for in-memory registries — lookups, filtering, immutability."""
import pytest
from src.models.enums import ExerciseType
from src.models.bundled import Exercise
from src.registries.exercise_registry import ExerciseRegistry


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
