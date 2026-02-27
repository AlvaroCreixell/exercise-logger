from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ExerciseCategory(str, Enum):
    WEIGHT = "weight"
    CARDIO = "cardio"


@dataclass
class Exercise:
    id: Optional[int]
    name: str
    category: ExerciseCategory
    equipment: Optional[str] = None
    muscle_group: Optional[str] = None
    notes: Optional[str] = None
    is_archived: bool = False
    created_at: Optional[str] = None
