from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class SetScheme(Enum):
    UNIFORM = "uniform"
    PROGRESSIVE = "progressive"


class SetKind(Enum):
    REPS_WEIGHT = "reps_weight"
    REPS_ONLY = "reps_only"
    DURATION = "duration"
    CARDIO = "cardio"
    AMRAP = "amrap"


@dataclass
class Routine:
    id: Optional[int]
    name: str
    is_active: bool
    created_at: str
    updated_at: str


@dataclass
class RoutineDay:
    id: Optional[int]
    routine_id: int
    label: str
    name: str
    sort_order: int


@dataclass
class RoutineDayExercise:
    id: Optional[int]
    routine_day_id: int
    exercise_id: int
    sort_order: int
    set_scheme: SetScheme
    notes: Optional[str] = None
    is_optional: bool = False


@dataclass
class SetTarget:
    id: Optional[int]
    routine_day_exercise_id: int
    set_number: int
    set_kind: SetKind
    target_reps_min: Optional[int] = None
    target_reps_max: Optional[int] = None
    target_weight: Optional[float] = None
    target_duration_seconds: Optional[int] = None
    target_distance: Optional[float] = None
