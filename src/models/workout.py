from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional
from src.models.routine import SetKind


class SessionStatus(Enum):
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"


class SessionType(Enum):
    ROUTINE = "routine"
    BENCHMARK = "benchmark"


@dataclass
class WorkoutSession:
    id: Optional[int]
    routine_id: Optional[int]
    routine_day_id: Optional[int]
    session_type: SessionType
    status: SessionStatus
    completed_fully: Optional[bool]
    day_label_snapshot: Optional[str]
    day_name_snapshot: Optional[str]
    started_at: str
    finished_at: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class SessionExercise:
    id: Optional[int]
    session_id: int
    exercise_id: int
    routine_day_exercise_id: Optional[int]
    sort_order: int
    exercise_name_snapshot: str
    notes: Optional[str] = None


@dataclass
class LoggedSet:
    id: Optional[int]
    session_exercise_id: int
    exercise_set_target_id: Optional[int]
    set_number: int
    set_kind: SetKind
    reps: Optional[int] = None
    weight: Optional[float] = None
    duration_seconds: Optional[int] = None
    distance: Optional[float] = None
    notes: Optional[str] = None
    logged_at: Optional[str] = None
