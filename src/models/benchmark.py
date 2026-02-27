from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class BenchmarkMethod(str, Enum):
    MAX_WEIGHT = "max_weight"
    REPS_TO_FAILURE = "reps_to_failure"
    TIMED_HOLD = "timed_hold"


@dataclass
class BenchmarkDefinition:
    id: Optional[int]
    exercise_id: int
    name: str
    method: BenchmarkMethod
    target_reps: Optional[int] = None
    target_weight: Optional[float] = None
    frequency_weeks: int = 6
    is_active: bool = True
    created_at: Optional[str] = None


@dataclass
class BenchmarkResult:
    id: Optional[int]
    benchmark_definition_id: int
    session_id: Optional[int]
    result_weight: Optional[float] = None
    result_reps: Optional[int] = None
    result_duration_sec: Optional[float] = None
    notes: Optional[str] = None
    tested_at: Optional[str] = None
