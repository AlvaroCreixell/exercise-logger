"""Immutable bundled data models — loaded from files, never stored in SQLite."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from src.models.enums import ExerciseType, SetScheme, BenchmarkMethod


@dataclass(frozen=True)
class Exercise:
    key: str
    name: str
    type: ExerciseType
    equipment: str
    muscle_group: str


@dataclass(frozen=True)
class DayExercise:
    exercise_key: str
    scheme: SetScheme
    sets: int
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    duration_seconds: Optional[int] = None
    distance_km: Optional[float] = None
    notes: Optional[str] = None


@dataclass(frozen=True)
class RoutineDay:
    key: str
    label: str
    name: str
    exercises: tuple[DayExercise, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class Routine:
    key: str
    name: str
    description: str
    days: tuple[RoutineDay, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class BenchmarkItem:
    exercise_key: str
    method: BenchmarkMethod


@dataclass(frozen=True)
class BenchmarkConfig:
    frequency_weeks: int
    items: tuple[BenchmarkItem, ...] = field(default_factory=tuple)
