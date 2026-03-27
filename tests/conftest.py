"""Shared test fixtures."""
import pytest
import sqlite3

from src.models.enums import ExerciseType, SetScheme, BenchmarkMethod
from src.models.bundled import Exercise, DayExercise, RoutineDay, Routine, BenchmarkConfig, BenchmarkItem
from src.registries.exercise_registry import ExerciseRegistry
from src.registries.routine_registry import RoutineRegistry
from src.registries.benchmark_registry import BenchmarkRegistry


# ---------------------------------------------------------------------------
# Registry builder helpers
# ---------------------------------------------------------------------------

def _make_exercise(key="bench_press", name="Bench Press", type=ExerciseType.REPS_WEIGHT,
                   equipment="Barbell", muscle_group="Chest"):
    return Exercise(key=key, name=name, type=type, equipment=equipment, muscle_group=muscle_group)


def _make_ppl_routine():
    """Build a minimal Push/Pull/Legs routine for testing."""
    return Routine(
        key="ppl", name="Push Pull Legs", description="Test PPL",
        days=(
            RoutineDay(key="push", label="A", name="Push", exercises=(
                DayExercise(exercise_key="bench_press", scheme=SetScheme.UNIFORM, sets=3, reps_min=8, reps_max=12),
                DayExercise(exercise_key="plank", scheme=SetScheme.UNIFORM, sets=3, duration_seconds=60),
            )),
            RoutineDay(key="pull", label="B", name="Pull", exercises=(
                DayExercise(exercise_key="pull_up", scheme=SetScheme.PROGRESSIVE, sets=3),
                DayExercise(exercise_key="running", scheme=SetScheme.UNIFORM, sets=1),
            )),
            RoutineDay(key="legs", label="C", name="Legs", exercises=(
                DayExercise(exercise_key="squat", scheme=SetScheme.UNIFORM, sets=4, reps_min=6, reps_max=10),
            )),
        ),
    )


# ---------------------------------------------------------------------------
# Database fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def db_conn():
    """In-memory SQLite database with schema initialized."""
    from src.db.schema import init_db
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    init_db(conn)
    yield conn
    conn.close()


# ---------------------------------------------------------------------------
# Repository fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def settings_repo(db_conn):
    from src.repositories.settings_repo import SettingsRepo
    return SettingsRepo(db_conn)


@pytest.fixture
def workout_repo(db_conn):
    from src.repositories.workout_repo import WorkoutRepo
    return WorkoutRepo(db_conn)


@pytest.fixture
def benchmark_repo(db_conn):
    from src.repositories.benchmark_repo import BenchmarkRepo
    return BenchmarkRepo(db_conn)


# ---------------------------------------------------------------------------
# Registry fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def exercise_registry():
    exercises = [
        _make_exercise("bench_press", "Bench Press", ExerciseType.REPS_WEIGHT, "Barbell", "Chest"),
        _make_exercise("pull_up", "Pull-Up", ExerciseType.REPS_WEIGHT, "Bodyweight", "Back"),
        _make_exercise("squat", "Barbell Squat", ExerciseType.REPS_WEIGHT, "Barbell", "Legs"),
        _make_exercise("plank", "Plank", ExerciseType.TIME, "Bodyweight", "Core"),
        _make_exercise("running", "Running", ExerciseType.CARDIO, "None", "Cardio"),
    ]
    return ExerciseRegistry(exercises)


@pytest.fixture
def routine_registry():
    return RoutineRegistry([_make_ppl_routine()])


@pytest.fixture
def benchmark_config():
    return BenchmarkConfig(frequency_weeks=6, items=(
        BenchmarkItem(exercise_key="bench_press", method=BenchmarkMethod.MAX_WEIGHT),
        BenchmarkItem(exercise_key="plank", method=BenchmarkMethod.TIMED_HOLD),
    ))


@pytest.fixture
def benchmark_registry(benchmark_config):
    return BenchmarkRegistry(benchmark_config)
