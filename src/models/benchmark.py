"""Mutable benchmark result model — stored in SQLite."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
from src.models.enums import BenchmarkMethod


@dataclass
class BenchmarkResult:
    id: Optional[int]
    exercise_key_snapshot: str
    exercise_name_snapshot: str
    method: BenchmarkMethod
    result_value: float
    tested_at: str
    bodyweight: Optional[float] = None
