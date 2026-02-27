from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class Routine:
    id: Optional[int]
    name: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None


@dataclass
class RoutineDay:
    id: Optional[int]
    routine_id: int
    day_index: int
    name: str


@dataclass
class RoutineDayExercise:
    id: Optional[int]
    routine_day_id: int
    exercise_id: int
    sort_order: int = 0
    target_sets: Optional[int] = None
    target_reps: Optional[int] = None
    target_weight: Optional[float] = None
    target_duration_min: Optional[float] = None
    target_distance_km: Optional[float] = None
    target_intensity: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class RoutineCycleState:
    id: Optional[int]
    routine_id: int
    current_day_index: int = 0
    last_session_id: Optional[int] = None
    updated_at: Optional[str] = None
