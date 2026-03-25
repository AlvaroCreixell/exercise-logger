from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ExerciseType(Enum):
    REPS_WEIGHT = "reps_weight"
    REPS_ONLY = "reps_only"
    TIME = "time"
    CARDIO = "cardio"


@dataclass
class Exercise:
    id: Optional[int]
    name: str
    type: ExerciseType
    muscle_group: Optional[str] = None
    equipment: Optional[str] = None
    is_archived: bool = False
