"""Shared validation helpers for set_kind compatibility."""
from typing import Optional
from src.models.exercise import ExerciseType
from src.models.routine import SetKind


# Compatibility matrix: exercise_type -> allowed set_kinds
COMPATIBLE_SET_KINDS = {
    ExerciseType.REPS_WEIGHT: {SetKind.REPS_WEIGHT, SetKind.AMRAP},
    ExerciseType.REPS_ONLY: {SetKind.REPS_ONLY, SetKind.AMRAP},
    ExerciseType.TIME: {SetKind.DURATION},
    ExerciseType.CARDIO: {SetKind.CARDIO},
}


def validate_set_kind(set_kind: SetKind, exercise_type: ExerciseType) -> None:
    """Raise ValueError if set_kind is incompatible with exercise_type."""
    allowed = COMPATIBLE_SET_KINDS.get(exercise_type, set())
    if set_kind not in allowed:
        raise ValueError(
            f"Set kind '{set_kind.value}' is not compatible with "
            f"exercise type '{exercise_type.value}'"
        )


def validate_cardio_fields(set_kind: SetKind, duration_seconds: Optional[int], distance: Optional[float]) -> None:
    """Raise ValueError if cardio set has neither duration nor distance."""
    if set_kind == SetKind.CARDIO and duration_seconds is None and distance is None:
        raise ValueError("Cardio sets require at least one of duration_seconds or distance")


def validate_amrap_fields(set_kind: SetKind, exercise_type: ExerciseType, weight: Optional[float]) -> None:
    """Raise ValueError if AMRAP weight requirements are violated."""
    if set_kind != SetKind.AMRAP:
        return
    if exercise_type == ExerciseType.REPS_WEIGHT and weight is None:
        raise ValueError("AMRAP sets for reps_weight exercises require a weight")
    if exercise_type == ExerciseType.REPS_ONLY and weight is not None:
        raise ValueError("AMRAP sets for reps_only exercises must not have a weight (bodyweight)")


# Default SetKind per ExerciseType (used by target editor payload builder)
DEFAULT_SET_KIND = {
    ExerciseType.REPS_WEIGHT: SetKind.REPS_WEIGHT,
    ExerciseType.REPS_ONLY: SetKind.REPS_ONLY,
    ExerciseType.TIME: SetKind.DURATION,
    ExerciseType.CARDIO: SetKind.CARDIO,
}


def build_targets_payload(state: dict, ex_type: ExerciseType) -> list:
    """Convert editor state to a list of target dicts for routine_service.

    Pure function — no side effects, no service calls, no Kivy deps.

    Args:
        state: Editor state dict with scheme, num_sets, is_amrap, use_rep_range,
               uniform_* fields, and progressive_rows.
        ex_type: The exercise's ExerciseType.

    Returns:
        List of dicts suitable for set_uniform_targets kwargs or
        set_progressive_targets targets_data.
    """
    default_kind = DEFAULT_SET_KIND.get(ex_type, SetKind.REPS_WEIGHT)

    def _build_entry(is_amrap, reps, reps_max, weight, duration, distance):
        set_kind = SetKind.AMRAP if is_amrap else default_kind
        entry = {"set_kind": set_kind}

        if ex_type == ExerciseType.REPS_WEIGHT:
            if not is_amrap:
                entry["reps_min"] = reps
                entry["reps_max"] = reps_max
            entry["weight"] = weight
        elif ex_type == ExerciseType.REPS_ONLY:
            if not is_amrap:
                entry["reps_min"] = reps
                entry["reps_max"] = reps_max
        elif ex_type == ExerciseType.TIME:
            entry["duration_seconds"] = duration
        elif ex_type == ExerciseType.CARDIO:
            entry["duration_seconds"] = duration or None
            entry["distance"] = distance or None

        return entry

    if state.get("scheme") == "uniform":
        is_amrap = state.get("is_amrap", False)
        reps = state.get("uniform_reps", 8)
        reps_max = state.get("uniform_reps_max", reps) if state.get("use_rep_range") else reps
        weight = state.get("uniform_weight", 0.0)
        duration = state.get("uniform_duration", 60)
        distance = state.get("uniform_distance", 0.0)

        entry = _build_entry(is_amrap, reps, reps_max, weight, duration, distance)
        return [dict(entry) for _ in range(state.get("num_sets", 3))]
    else:
        targets = []
        for row in state.get("progressive_rows", []):
            entry = _build_entry(
                is_amrap=row.get("is_amrap", False),
                reps=row.get("reps", 8),
                reps_max=row.get("reps_max", row.get("reps", 8)),
                weight=row.get("weight", 0.0),
                duration=row.get("duration", 60),
                distance=row.get("distance", 0.0),
            )
            targets.append(entry)
        return targets
