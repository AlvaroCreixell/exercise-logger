"""Mutable workout data models — stored in SQLite."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
from src.models.enums import ExerciseType, SetScheme, SessionStatus, ExerciseSource


@dataclass
class WorkoutSession:
    id: Optional[int]
    routine_key_snapshot: str
    routine_name_snapshot: str
    day_key_snapshot: str
    day_label_snapshot: str
    day_name_snapshot: str
    status: SessionStatus
    started_at: str
    completed_fully: Optional[bool] = None
    finished_at: Optional[str] = None


@dataclass
class SessionExercise:
    id: Optional[int]
    session_id: int
    sort_order: int
    exercise_key_snapshot: str
    exercise_name_snapshot: str
    exercise_type_snapshot: ExerciseType
    source: ExerciseSource
    scheme_snapshot: Optional[SetScheme] = None
    planned_sets: Optional[int] = None
    target_reps_min: Optional[int] = None
    target_reps_max: Optional[int] = None
    target_duration_seconds: Optional[int] = None
    target_distance_km: Optional[float] = None
    plan_notes_snapshot: Optional[str] = None


@dataclass
class LoggedSet:
    id: Optional[int]
    session_exercise_id: int
    set_number: int
    logged_at: str
    reps: Optional[int] = None
    weight: Optional[float] = None
    duration_seconds: Optional[int] = None
    distance_km: Optional[float] = None
