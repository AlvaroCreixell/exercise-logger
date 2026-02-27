from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class SessionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"
    ABANDONED = "abandoned"


@dataclass
class WorkoutSession:
    id: Optional[int]
    routine_id: Optional[int]
    routine_day_id: Optional[int]
    status: SessionStatus = SessionStatus.IN_PROGRESS
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class LoggedSet:
    id: Optional[int]
    session_id: int
    exercise_id: int
    routine_day_exercise_id: Optional[int]
    set_index: int
    reps: Optional[int] = None
    weight: Optional[float] = None
    is_warmup: bool = False
    is_failure: bool = False
    notes: Optional[str] = None
    logged_at: Optional[str] = None


@dataclass
class LoggedCardio:
    id: Optional[int]
    session_id: int
    exercise_id: int
    routine_day_exercise_id: Optional[int]
    duration_min: Optional[float] = None
    distance_km: Optional[float] = None
    intensity: Optional[str] = None
    notes: Optional[str] = None
    logged_at: Optional[str] = None
