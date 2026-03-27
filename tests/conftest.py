"""Shared test fixtures."""
import pytest
import sqlite3
from datetime import datetime, timezone, timedelta

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


def make_routine() -> Routine:
    """Standard test routine: push_pull_legs with 3 days."""
    return Routine(
        key="push_pull_legs",
        name="Push Pull Legs",
        description="3-day split",
        days=(
            RoutineDay(
                key="push", label="A", name="Push",
                exercises=(
                    DayExercise(
                        exercise_key="barbell_bench_press",
                        scheme=SetScheme.PROGRESSIVE,
                        sets=3,
                    ),
                    DayExercise(
                        exercise_key="plank",
                        scheme=SetScheme.UNIFORM,
                        sets=3,
                        duration_seconds=60,
                    ),
                ),
            ),
            RoutineDay(
                key="pull", label="B", name="Pull",
                exercises=(
                    DayExercise(
                        exercise_key="pull_up",
                        scheme=SetScheme.UNIFORM,
                        sets=4,
                        reps_min=6, reps_max=10,
                    ),
                    DayExercise(
                        exercise_key="running",
                        scheme=SetScheme.UNIFORM,
                        sets=1,
                    ),
                ),
            ),
            RoutineDay(
                key="legs", label="C", name="Legs",
                exercises=(
                    DayExercise(
                        exercise_key="barbell_back_squat",
                        scheme=SetScheme.PROGRESSIVE,
                        sets=3,
                    ),
                ),
            ),
        ),
    )


def make_second_routine() -> Routine:
    """A second routine for testing routine switching."""
    return Routine(
        key="upper_lower",
        name="Upper Lower",
        description="2-day split",
        days=(
            RoutineDay(
                key="upper", label="A", name="Upper",
                exercises=(
                    DayExercise(
                        exercise_key="barbell_bench_press",
                        scheme=SetScheme.UNIFORM,
                        sets=4, reps_min=8, reps_max=12,
                    ),
                ),
            ),
            RoutineDay(
                key="lower", label="B", name="Lower",
                exercises=(
                    DayExercise(
                        exercise_key="barbell_back_squat",
                        scheme=SetScheme.UNIFORM,
                        sets=4, reps_min=8, reps_max=12,
                    ),
                ),
            ),
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
        _make_exercise("barbell_bench_press", "Barbell Bench Press", ExerciseType.REPS_WEIGHT, "Barbell", "Chest"),
        _make_exercise("barbell_back_squat", "Barbell Back Squat", ExerciseType.REPS_WEIGHT, "Barbell", "Legs"),
        _make_exercise("pull_up", "Pull-Up", ExerciseType.REPS_WEIGHT, "Bodyweight", "Back"),
        _make_exercise("plank", "Plank", ExerciseType.TIME, "Bodyweight", "Core"),
        _make_exercise("running", "Running", ExerciseType.CARDIO, "None", "Cardio"),
    ]
    return ExerciseRegistry(exercises)


@pytest.fixture
def routine_registry():
    return RoutineRegistry([make_routine(), make_second_routine()])


@pytest.fixture
def benchmark_config():
    return BenchmarkConfig(frequency_weeks=6, items=(
        BenchmarkItem(exercise_key="barbell_bench_press", method=BenchmarkMethod.MAX_WEIGHT),
        BenchmarkItem(exercise_key="pull_up", method=BenchmarkMethod.MAX_REPS),
        BenchmarkItem(exercise_key="plank", method=BenchmarkMethod.TIMED_HOLD),
    ))


@pytest.fixture
def benchmark_registry(benchmark_config):
    return BenchmarkRegistry(benchmark_config)


# ---------------------------------------------------------------------------
# Service fixtures (imported lazily to allow earlier tasks to pass)
# ---------------------------------------------------------------------------

@pytest.fixture
def app_state_service(settings_repo, routine_registry, workout_repo):
    from src.services.app_state_service import AppStateService
    return AppStateService(settings_repo, routine_registry, workout_repo)


@pytest.fixture
def workout_service(workout_repo, settings_repo, exercise_registry,
                    routine_registry, app_state_service):
    from src.services.workout_service import WorkoutService
    return WorkoutService(workout_repo, settings_repo, exercise_registry,
                          routine_registry, app_state_service)


@pytest.fixture
def benchmark_service(benchmark_repo, benchmark_registry, exercise_registry):
    from src.services.benchmark_service import BenchmarkService
    return BenchmarkService(benchmark_repo, benchmark_registry, exercise_registry)


@pytest.fixture
def stats_service(workout_repo, benchmark_repo, exercise_registry,
                  benchmark_registry):
    from src.services.stats_service import StatsService
    return StatsService(workout_repo, benchmark_repo, exercise_registry,
                        benchmark_registry)


@pytest.fixture
def settings_service(settings_repo, db_conn):
    from src.services.settings_service import SettingsService
    return SettingsService(settings_repo, db_conn)


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def days_ago(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()
