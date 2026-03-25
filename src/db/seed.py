"""Dev-only seed data — default benchmark exercises and sample data.

NOT run in production builds. Call seed_benchmarks() to populate
the default benchmark definitions from the spec.
"""
from src.models.exercise import Exercise, ExerciseType
from src.models.benchmark import BenchmarkDefinition, BenchmarkMethod
from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.benchmark_repo import BenchmarkRepo


DEFAULT_BENCHMARK_EXERCISES = [
    # Upper
    {"name": "Chest Press", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Upper"},
    {"name": "Shoulder Press", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Upper"},
    {"name": "Bicep Curl Machine", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Upper"},
    {"name": "Cable Tricep Pushdown", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Upper"},
    # Lower
    {"name": "Leg Extension", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    {"name": "Leg Curl", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    {"name": "Adductor", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    {"name": "Leg Press", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    {"name": "Calf Raise", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    # Back
    {"name": "Lat Pulldown", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Back"},
    {"name": "Seated Row", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Back"},
    # Core
    {"name": "Plank", "type": ExerciseType.TIME, "method": BenchmarkMethod.TIMED_HOLD, "group": "Core"},
    {"name": "Cable/Machine Crunch", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Core"},
]


def seed_benchmarks(exercise_repo: ExerciseRepo, benchmark_repo: BenchmarkRepo, frequency_weeks: int = 6) -> None:
    """Create default benchmark exercises and definitions.

    Skips exercises that already exist (by name, case-insensitive).
    """
    for item in DEFAULT_BENCHMARK_EXERCISES:
        existing = exercise_repo.get_by_name_insensitive(item["name"])
        if existing:
            exercise = existing
        else:
            exercise = Exercise(id=None, name=item["name"], type=item["type"])
            exercise.id = exercise_repo.create(exercise)

        defn = BenchmarkDefinition(
            id=None,
            exercise_id=exercise.id,
            method=item["method"],
            reference_weight=None,
            frequency_weeks=frequency_weeks,
            muscle_group_label=item["group"],
        )
        benchmark_repo.create_definition(defn)

    exercise_repo.commit()
