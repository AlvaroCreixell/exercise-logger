from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class BenchmarkMethod(Enum):
    MAX_WEIGHT = "max_weight"
    MAX_REPS = "max_reps"
    TIMED_HOLD = "timed_hold"


@dataclass
class BenchmarkDefinition:
    id: Optional[int]
    exercise_id: int
    method: BenchmarkMethod
    reference_weight: Optional[float]
    frequency_weeks: int
    muscle_group_label: str


@dataclass
class BenchmarkResult:
    id: Optional[int]
    benchmark_definition_id: int
    session_id: Optional[int]
    method_snapshot: BenchmarkMethod
    reference_weight_snapshot: Optional[float]
    result_value: float
    tested_at: str
