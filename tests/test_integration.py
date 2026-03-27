"""Integration test — loads real production data files and runs a full workout cycle."""
from __future__ import annotations
import os
import sqlite3
import pytest

from src.config import EXERCISES_CSV_PATH, ROUTINES_DIR, BENCHMARKS_YAML_PATH
from src.loaders.exercise_loader import load_exercises
from src.loaders.routine_loader import load_all_routines
from src.loaders.benchmark_loader import load_benchmark_config
from src.registries.exercise_registry import ExerciseRegistry
from src.registries.routine_registry import RoutineRegistry
from src.registries.benchmark_registry import BenchmarkRegistry
from src.models.enums import ExerciseType, SessionStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _data_dir() -> str:
    """Absolute path to src/data/ relative to this test file."""
    tests_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(os.path.dirname(tests_dir), "src", "data")


# ---------------------------------------------------------------------------
# Module-level fixtures: load all real bundled data once
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def exercise_registry():
    exercises = load_exercises(EXERCISES_CSV_PATH)
    return ExerciseRegistry(exercises)


@pytest.fixture(scope="module")
def routine_registry(exercise_registry):
    routines = load_all_routines(ROUTINES_DIR, exercise_registry)
    return RoutineRegistry(routines)


@pytest.fixture(scope="module")
def benchmark_registry(exercise_registry):
    config = load_benchmark_config(BENCHMARKS_YAML_PATH, exercise_registry)
    return BenchmarkRegistry(config)


# ---------------------------------------------------------------------------
# Per-test in-memory DB
# ---------------------------------------------------------------------------

@pytest.fixture
def integration_db():
    """In-memory SQLite with schema, foreign keys on."""
    from src.db.schema import init_db
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    init_db(conn)
    yield conn
    conn.close()


# ---------------------------------------------------------------------------
# Registry validation tests (data-layer only)
# ---------------------------------------------------------------------------

class TestBundledDataRegistries:
    """Verify all real bundled data loads correctly into registries."""

    def test_exercise_registry_has_enough_exercises(self, exercise_registry):
        assert len(exercise_registry) >= 80

    def test_exercise_registry_all_three_types_present(self, exercise_registry):
        types = {ex.type for ex in exercise_registry.list_all()}
        assert ExerciseType.REPS_WEIGHT in types
        assert ExerciseType.TIME in types
        assert ExerciseType.CARDIO in types

    def test_routine_registry_push_pull_legs_has_3_days(self, routine_registry):
        ppl = routine_registry.get("push_pull_legs")
        assert ppl is not None
        assert len(ppl.days) == 3

    def test_routine_registry_upper_lower_has_2_days(self, routine_registry):
        ul = routine_registry.get("upper_lower")
        assert ul is not None
        assert len(ul.days) == 2

    def test_benchmark_registry_has_5_items(self, benchmark_registry):
        assert len(benchmark_registry) == 5

    def test_benchmark_registry_frequency_6_weeks(self, benchmark_registry):
        assert benchmark_registry.frequency_weeks == 6


# ---------------------------------------------------------------------------
# Full end-to-end workout session cycle
# ---------------------------------------------------------------------------

class TestFullWorkoutSessionCycle:
    """End-to-end: load real data, set up services, run a complete workout."""

    @pytest.fixture
    def services(self, integration_db, exercise_registry, routine_registry, benchmark_registry):
        """Build all services wired to the in-memory DB."""
        from src.repositories.settings_repo import SettingsRepo
        from src.repositories.workout_repo import WorkoutRepo
        from src.repositories.benchmark_repo import BenchmarkRepo
        from src.services.app_state_service import AppStateService
        from src.services.workout_service import WorkoutService
        from src.services.benchmark_service import BenchmarkService
        from src.services.stats_service import StatsService
        from src.services.settings_service import SettingsService

        conn = integration_db

        settings_repo = SettingsRepo(conn)
        workout_repo = WorkoutRepo(conn)
        benchmark_repo = BenchmarkRepo(conn)

        app_state = AppStateService(settings_repo, routine_registry, workout_repo)
        workout_service = WorkoutService(
            workout_repo, settings_repo, exercise_registry, routine_registry, app_state
        )
        benchmark_service = BenchmarkService(benchmark_repo, benchmark_registry, exercise_registry)
        stats_service = StatsService(workout_repo, benchmark_repo, exercise_registry, benchmark_registry)
        settings_service = SettingsService(settings_repo, conn)

        return {
            "settings_repo": settings_repo,
            "workout_repo": workout_repo,
            "benchmark_repo": benchmark_repo,
            "app_state": app_state,
            "workout_service": workout_service,
            "benchmark_service": benchmark_service,
            "stats_service": stats_service,
            "settings_service": settings_service,
        }

    def test_full_workout_cycle(self, services):
        """Complete workout cycle: activate routine → start → log sets → finish → stats."""
        app_state = services["app_state"]
        workout_service = services["workout_service"]
        benchmark_service = services["benchmark_service"]
        stats_service = services["stats_service"]
        settings_repo = services["settings_repo"]

        # Step 1: Activate routine
        app_state.set_active_routine("push_pull_legs")
        current_day_key = settings_repo.get("current_day_key")
        assert current_day_key == "push", (
            f"Expected first day key 'push', got '{current_day_key}'"
        )

        # Step 2: Start session
        session = workout_service.start_session()
        assert session is not None
        assert session.id is not None
        assert session.status == SessionStatus.IN_PROGRESS
        assert session.day_key_snapshot == "push"

        # Step 3: Get session exercises
        session_exercises = workout_service.get_session_exercises(session.id)
        assert len(session_exercises) > 0, "Session should have planned exercises"

        # Partition by type
        rw_exercise = None
        time_exercise = None
        cardio_exercise = None
        for se in session_exercises:
            if se.exercise_type_snapshot == ExerciseType.REPS_WEIGHT and rw_exercise is None:
                rw_exercise = se
            elif se.exercise_type_snapshot == ExerciseType.TIME and time_exercise is None:
                time_exercise = se
            elif se.exercise_type_snapshot == ExerciseType.CARDIO and cardio_exercise is None:
                cardio_exercise = se

        assert rw_exercise is not None, (
            "Push day must contain at least one REPS_WEIGHT exercise"
        )
        assert time_exercise is not None, (
            "Push day must contain at least one TIME exercise (e.g. plank)"
        )
        assert cardio_exercise is not None, (
            "Push day must contain at least one CARDIO exercise (e.g. running)"
        )

        # Step 4: Log sets of each type
        logged_rw = workout_service.log_set(rw_exercise.id, reps=8, weight=80.0)
        assert logged_rw.id is not None
        assert logged_rw.reps == 8
        assert logged_rw.weight == 80.0

        logged_time = workout_service.log_set(time_exercise.id, duration_seconds=60)
        assert logged_time.id is not None
        assert logged_time.duration_seconds == 60

        logged_cardio = workout_service.log_set(
            cardio_exercise.id, duration_seconds=1200, distance_km=5.0
        )
        assert logged_cardio.id is not None
        assert logged_cardio.duration_seconds == 1200
        assert logged_cardio.distance_km == 5.0

        # Step 5: Finish session — re-fetch to see updated state
        finished_session = workout_service.finish_session(session.id)
        assert finished_session.status == SessionStatus.FINISHED
        assert finished_session.completed_fully is True

        # Step 6: Verify cycle advanced from "push" to "pull"
        new_day_key = settings_repo.get("current_day_key")
        assert new_day_key == "pull", (
            f"Expected cycle to advance to 'pull', got '{new_day_key}'"
        )

        # Step 7: Check stats
        session_count = stats_service.get_session_count()
        assert session_count >= 1

        summary = stats_service.get_last_workout_summary()
        assert summary is not None
        assert summary["session_id"] == session.id

        # Step 8: Record benchmark result
        result = benchmark_service.record_result(
            "barbell_bench_press", "max_weight", 100.0, bodyweight=75.0
        )
        assert result.id is not None
        assert result.result_value == 100.0

        # Step 9: Verify benchmark history
        history = benchmark_service.get_history("barbell_bench_press")
        assert len(history) >= 1
        matching = [r for r in history if r.result_value == 100.0]
        assert len(matching) >= 1
        assert matching[0].exercise_key_snapshot == "barbell_bench_press"
