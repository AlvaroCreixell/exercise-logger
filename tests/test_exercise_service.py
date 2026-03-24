import pytest
from src.models.exercise import ExerciseType


class TestExerciseService:
    def test_create_exercise(self, exercise_service):
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        assert ex.id is not None
        assert ex.name == "Bench Press"
        assert ex.type == ExerciseType.REPS_WEIGHT
        assert ex.is_archived is False

    def test_create_with_details(self, exercise_service):
        ex = exercise_service.create_exercise(
            "Bench Press", ExerciseType.REPS_WEIGHT,
            muscle_group="Chest", equipment="Barbell",
        )
        assert ex.muscle_group == "Chest"
        assert ex.equipment == "Barbell"

    def test_duplicate_name_rejected(self, exercise_service):
        exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        with pytest.raises(ValueError, match="already exists"):
            exercise_service.create_exercise("Bench Press", ExerciseType.REPS_ONLY)

    def test_duplicate_name_case_insensitive(self, exercise_service):
        exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        with pytest.raises(ValueError, match="already exists"):
            exercise_service.create_exercise("bench press", ExerciseType.REPS_WEIGHT)

    def test_get_exercise(self, exercise_service):
        created = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        fetched = exercise_service.get_exercise(created.id)
        assert fetched.name == "Bench Press"
        assert fetched.type == ExerciseType.REPS_WEIGHT

    def test_get_nonexistent_returns_none(self, exercise_service):
        assert exercise_service.get_exercise(999) is None

    def test_list_exercises(self, exercise_service):
        exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        exercise_service.create_exercise("Pull-ups", ExerciseType.REPS_ONLY)
        exercises = exercise_service.list_exercises()
        assert len(exercises) == 2

    def test_archive_hides_from_default_list(self, exercise_service):
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        exercise_service.archive_exercise(ex.id)
        assert len(exercise_service.list_exercises()) == 0
        assert len(exercise_service.list_exercises(include_archived=True)) == 1

    def test_unarchive(self, exercise_service):
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        exercise_service.archive_exercise(ex.id)
        exercise_service.unarchive_exercise(ex.id)
        assert len(exercise_service.list_exercises()) == 1

    def test_update_exercise_name(self, exercise_service):
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        ex.name = "Flat Bench Press"
        ex.muscle_group = "Chest"
        updated = exercise_service.update_exercise(ex)
        assert updated.name == "Flat Bench Press"
        assert updated.muscle_group == "Chest"

    def test_update_to_duplicate_name_rejected(self, exercise_service):
        exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        ex2 = exercise_service.create_exercise("Squat", ExerciseType.REPS_WEIGHT)
        ex2.name = "Bench Press"
        with pytest.raises(ValueError, match="already exists"):
            exercise_service.update_exercise(ex2)

    def test_update_same_name_allowed(self, exercise_service):
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        ex.muscle_group = "Chest"
        updated = exercise_service.update_exercise(ex)
        assert updated.muscle_group == "Chest"
