"""Shared enums for the exercise logger."""
from __future__ import annotations
from enum import Enum


class ExerciseType(Enum):
    REPS_WEIGHT = "reps_weight"
    TIME = "time"
    CARDIO = "cardio"


class SetScheme(Enum):
    UNIFORM = "uniform"
    PROGRESSIVE = "progressive"


class BenchmarkMethod(Enum):
    MAX_WEIGHT = "max_weight"
    MAX_REPS = "max_reps"
    TIMED_HOLD = "timed_hold"


class SessionStatus(Enum):
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"


class ExerciseSource(Enum):
    PLANNED = "planned"
    AD_HOC = "ad_hoc"
