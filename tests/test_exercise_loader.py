"""Tests for exercise CSV loader — valid parsing and fail-fast validation."""
import os
import pytest
from src.loaders.exercise_loader import load_exercises, LoaderError
from src.models.enums import ExerciseType

_TEST_DATA = os.path.join(os.path.dirname(__file__), "data")


class TestValidExerciseLoading:
    def test_loads_all_exercises(self):
        exercises = load_exercises(os.path.join(_TEST_DATA, "valid_exercises.csv"))
        assert len(exercises) == 3

    def test_exercise_fields(self):
        exercises = load_exercises(os.path.join(_TEST_DATA, "valid_exercises.csv"))
        bench = exercises[0]
        assert bench.key == "bench_press"
        assert bench.name == "Bench Press"
        assert bench.type == ExerciseType.REPS_WEIGHT
        assert bench.equipment == "Barbell"
        assert bench.muscle_group == "Chest"

    def test_all_three_types(self):
        exercises = load_exercises(os.path.join(_TEST_DATA, "valid_exercises.csv"))
        types = {e.type for e in exercises}
        assert types == {ExerciseType.REPS_WEIGHT, ExerciseType.TIME, ExerciseType.CARDIO}

    def test_exercises_are_frozen(self):
        exercises = load_exercises(os.path.join(_TEST_DATA, "valid_exercises.csv"))
        with pytest.raises(AttributeError):
            exercises[0].name = "Changed"

    def test_production_csv_loads(self):
        """The real exercises.csv loads without errors."""
        from src.config import EXERCISES_CSV_PATH
        exercises = load_exercises(EXERCISES_CSV_PATH)
        assert len(exercises) > 50  # We know there are ~78 exercises
        keys = [e.key for e in exercises]
        assert len(keys) == len(set(keys))  # All keys unique


class TestExerciseLoaderValidation:
    def test_duplicate_key_fails(self):
        with pytest.raises(LoaderError, match="duplicate exercise key 'bench_press'"):
            load_exercises(os.path.join(_TEST_DATA, "duplicate_key_exercises.csv"))

    def test_invalid_type_fails(self):
        with pytest.raises(LoaderError, match="invalid exercise type 'reps_only'"):
            load_exercises(os.path.join(_TEST_DATA, "bad_type_exercises.csv"))

    def test_missing_file_fails(self):
        with pytest.raises(FileNotFoundError):
            load_exercises("/nonexistent/path.csv")

    def test_empty_csv_fails(self, tmp_path):
        csv_file = tmp_path / "empty.csv"
        csv_file.write_text("key,name,type,equipment,muscle_group\n")
        with pytest.raises(LoaderError, match="no exercises found"):
            load_exercises(str(csv_file))

    def test_missing_column_fails(self, tmp_path):
        csv_file = tmp_path / "bad_header.csv"
        csv_file.write_text("key,name,type\nbench,Bench,reps_weight\n")
        with pytest.raises(LoaderError, match="missing required columns"):
            load_exercises(str(csv_file))

    def test_empty_key_fails(self, tmp_path):
        csv_file = tmp_path / "empty_key.csv"
        csv_file.write_text("key,name,type,equipment,muscle_group\n,Bench,reps_weight,Barbell,Chest\n")
        with pytest.raises(LoaderError, match="empty exercise key"):
            load_exercises(str(csv_file))

    def test_empty_name_fails(self, tmp_path):
        csv_file = tmp_path / "empty_name.csv"
        csv_file.write_text("key,name,type,equipment,muscle_group\nbench,,reps_weight,Barbell,Chest\n")
        with pytest.raises(LoaderError, match="empty exercise name"):
            load_exercises(str(csv_file))
