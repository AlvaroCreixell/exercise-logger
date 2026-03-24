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
