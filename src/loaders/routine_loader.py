"""Load routine templates from YAML.

Fail-fast: any invalid data raises LoaderError.
"""
from __future__ import annotations
import os
from typing import List, Optional
import yaml
from src.loaders.exercise_loader import LoaderError
from src.models.enums import ExerciseType, SetScheme
from src.models.bundled import DayExercise, RoutineDay, Routine
from src.registries.exercise_registry import ExerciseRegistry


def _parse_reps(reps_str: str, file_path: str, context: str) -> tuple[int, int]:
    """Parse reps string like '8' or '8-12' into (min, max).

    Raises LoaderError on invalid syntax.
    """
    reps_str = str(reps_str).strip()
    if "-" in reps_str:
        parts = reps_str.split("-")
        if len(parts) != 2:
            raise LoaderError(f"{file_path}: {context}: invalid reps syntax '{reps_str}'")
        try:
            rmin, rmax = int(parts[0]), int(parts[1])
        except ValueError:
            raise LoaderError(f"{file_path}: {context}: invalid reps syntax '{reps_str}'")
        if rmin < 1 or rmax < 1:
            raise LoaderError(f"{file_path}: {context}: reps must be >= 1, got '{reps_str}'")
        if rmin > rmax:
            raise LoaderError(f"{file_path}: {context}: reps min > max in '{reps_str}'")
        return rmin, rmax
    else:
        try:
            val = int(reps_str)
        except ValueError:
            raise LoaderError(f"{file_path}: {context}: invalid reps syntax '{reps_str}'")
        if val < 1:
            raise LoaderError(f"{file_path}: {context}: reps must be >= 1, got {val}")
        return val, val


def load_routine(yaml_path: str, exercise_registry: ExerciseRegistry) -> Routine:
    """Load and validate a single routine template from YAML.

    Args:
        yaml_path: Path to the routine YAML file.
        exercise_registry: For validating exercise_key references.

    Returns:
        Validated Routine dataclass.

    Raises:
        LoaderError: On any validation failure.
        FileNotFoundError: If the YAML file doesn't exist.
    """
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict):
        raise LoaderError(f"{yaml_path}: expected a YAML mapping at top level")

    # Validate top-level fields
    routine_key = data.get("key")
    if not routine_key or not isinstance(routine_key, str):
        raise LoaderError(f"{yaml_path}: missing or empty 'key'")

    routine_name = data.get("name")
    if not routine_name or not isinstance(routine_name, str):
        raise LoaderError(f"{yaml_path}: missing or empty 'name'")

    description = data.get("description", "")

    days_raw = data.get("days")
    if not days_raw or not isinstance(days_raw, list):
        raise LoaderError(f"{yaml_path}: missing or empty 'days' list")

    # Parse days
    seen_day_keys: set[str] = set()
    seen_day_labels: set[str] = set()
    days: List[RoutineDay] = []

    for day_idx, day_data in enumerate(days_raw):
        if not isinstance(day_data, dict):
            raise LoaderError(f"{yaml_path}: day[{day_idx}] is not a mapping")

        day_key = day_data.get("key")
        if not day_key or not isinstance(day_key, str):
            raise LoaderError(f"{yaml_path}: day[{day_idx}] missing or empty 'key'")
        if day_key in seen_day_keys:
            raise LoaderError(
                f"{yaml_path}: duplicate day key '{day_key}' in routine '{routine_key}'"
            )
        seen_day_keys.add(day_key)

        day_label = day_data.get("label")
        if not day_label or not isinstance(day_label, str):
            raise LoaderError(f"{yaml_path}: day '{day_key}' missing or empty 'label'")
        if day_label in seen_day_labels:
            raise LoaderError(
                f"{yaml_path}: duplicate day label '{day_label}' in routine '{routine_key}'"
            )
        seen_day_labels.add(day_label)

        day_name = day_data.get("name")
        if not day_name or not isinstance(day_name, str):
            raise LoaderError(f"{yaml_path}: day '{day_key}' missing or empty 'name'")

        exercises_raw = day_data.get("exercises")
        if not exercises_raw or not isinstance(exercises_raw, list):
            raise LoaderError(f"{yaml_path}: day '{day_key}' missing or empty 'exercises' list")

        # Parse exercises for this day
        day_exercises: List[DayExercise] = []

        for ex_idx, ex_data in enumerate(exercises_raw):
            if not isinstance(ex_data, dict):
                raise LoaderError(
                    f"{yaml_path}: day '{day_key}' exercise[{ex_idx}] is not a mapping"
                )

            exercise_key = ex_data.get("exercise_key")
            if not exercise_key or not isinstance(exercise_key, str):
                raise LoaderError(
                    f"{yaml_path}: day '{day_key}' exercise[{ex_idx}] missing 'exercise_key'"
                )

            ctx = f"day '{day_key}' exercise '{exercise_key}'"

            # Validate exercise_key exists in registry
            exercise = exercise_registry.get(exercise_key)
            if exercise is None:
                raise LoaderError(
                    f"{yaml_path}: {ctx}: unknown exercise_key '{exercise_key}'"
                )

            # Parse sets (required)
            sets_raw = ex_data.get("sets")
            if sets_raw is None:
                raise LoaderError(f"{yaml_path}: {ctx}: missing 'sets'")
            try:
                sets = int(sets_raw)
            except (ValueError, TypeError):
                raise LoaderError(f"{yaml_path}: {ctx}: 'sets' must be an integer")
            if sets < 1:
                raise LoaderError(f"{yaml_path}: {ctx}: 'sets' must be >= 1")

            # Parse scheme (default: uniform)
            scheme_str = ex_data.get("scheme", "uniform")
            try:
                scheme = SetScheme(scheme_str)
            except ValueError:
                raise LoaderError(
                    f"{yaml_path}: {ctx}: invalid scheme '{scheme_str}'. "
                    f"Valid: {[s.value for s in SetScheme]}"
                )

            # Validate scheme vs exercise type
            if scheme == SetScheme.PROGRESSIVE and exercise.type != ExerciseType.REPS_WEIGHT:
                raise LoaderError(
                    f"{yaml_path}: {ctx}: 'progressive' scheme only valid for "
                    f"reps_weight exercises, but '{exercise_key}' is {exercise.type.value}"
                )

            # Parse type-specific target fields
            reps_min: Optional[int] = None
            reps_max: Optional[int] = None
            duration_seconds: Optional[int] = None
            distance_km: Optional[float] = None

            reps_raw = ex_data.get("reps")
            duration_raw = ex_data.get("duration_seconds")
            distance_raw = ex_data.get("distance_km")

            if exercise.type == ExerciseType.REPS_WEIGHT:
                # Progressive: no reps allowed
                if scheme == SetScheme.PROGRESSIVE:
                    if reps_raw is not None:
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: progressive exercises must not specify 'reps'"
                        )
                else:
                    # Uniform: reps optional (but if provided, must be valid)
                    if reps_raw is not None:
                        reps_min, reps_max = _parse_reps(str(reps_raw), yaml_path, ctx)

            elif exercise.type == ExerciseType.TIME:
                # duration_seconds required for time exercises
                if duration_raw is None:
                    raise LoaderError(
                        f"{yaml_path}: {ctx}: 'duration_seconds' required for time exercises"
                    )
                try:
                    duration_seconds = int(duration_raw)
                except (ValueError, TypeError):
                    raise LoaderError(
                        f"{yaml_path}: {ctx}: 'duration_seconds' must be an integer"
                    )
                if duration_seconds < 1:
                    raise LoaderError(
                        f"{yaml_path}: {ctx}: 'duration_seconds' must be >= 1"
                    )

            elif exercise.type == ExerciseType.CARDIO:
                # Both optional in plan
                if duration_raw is not None:
                    try:
                        duration_seconds = int(duration_raw)
                    except (ValueError, TypeError):
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: 'duration_seconds' must be an integer"
                        )
                    if duration_seconds < 1:
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: 'duration_seconds' must be >= 1"
                        )
                if distance_raw is not None:
                    try:
                        distance_km = float(distance_raw)
                    except (ValueError, TypeError):
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: 'distance_km' must be a number"
                        )
                    if distance_km <= 0:
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: 'distance_km' must be > 0"
                        )

            notes = ex_data.get("notes")
            if notes is not None:
                notes = str(notes).strip() or None

            day_exercises.append(DayExercise(
                exercise_key=exercise_key,
                scheme=scheme,
                sets=sets,
                reps_min=reps_min,
                reps_max=reps_max,
                duration_seconds=duration_seconds,
                distance_km=distance_km,
                notes=notes,
            ))

        days.append(RoutineDay(
            key=day_key,
            label=day_label,
            name=day_name,
            exercises=tuple(day_exercises),
        ))

    return Routine(
        key=routine_key,
        name=routine_name,
        description=description,
        days=tuple(days),
    )


def load_all_routines(
    routines_dir: str, exercise_registry: ExerciseRegistry
) -> List[Routine]:
    """Load all routine YAML files from a directory.

    Args:
        routines_dir: Path to directory containing *.yaml files.
        exercise_registry: For validating exercise_key references.

    Returns:
        List of validated Routine dataclasses.

    Raises:
        LoaderError: On any validation failure or duplicate routine keys.
    """
    if not os.path.isdir(routines_dir):
        raise LoaderError(f"{routines_dir}: not a directory")

    yaml_files = sorted(
        f for f in os.listdir(routines_dir) if f.endswith((".yaml", ".yml"))
    )

    if not yaml_files:
        raise LoaderError(f"{routines_dir}: no YAML files found")

    routines: List[Routine] = []
    seen_keys: set[str] = set()

    for filename in yaml_files:
        filepath = os.path.join(routines_dir, filename)
        routine = load_routine(filepath, exercise_registry)
        if routine.key in seen_keys:
            raise LoaderError(
                f"{filepath}: duplicate routine key '{routine.key}'"
            )
        seen_keys.add(routine.key)
        routines.append(routine)

    return routines
