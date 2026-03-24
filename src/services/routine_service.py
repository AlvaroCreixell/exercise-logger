"""Routine service — routine management, set schemes, validation."""
from datetime import datetime, timezone
from typing import List, Optional
from src.models.routine import (
    Routine, RoutineDay, RoutineDayExercise, SetTarget, SetScheme, SetKind,
)
from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.routine_repo import RoutineRepo
from src.services.cycle_service import CycleService
from src.services.validation import (
    COMPATIBLE_SET_KINDS, validate_set_kind, validate_cardio_fields, validate_amrap_fields,
)


class RoutineService:
    def __init__(self, routine_repo: RoutineRepo, exercise_repo: ExerciseRepo, cycle_service: CycleService):
        self._repo = routine_repo
        self._exercise_repo = exercise_repo
        self._cycle_service = cycle_service

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # --- Routines ---

    def create_routine(self, name: str) -> Routine:
        now = self._now()
        routine = Routine(id=None, name=name, is_active=False, created_at=now, updated_at=now)
        routine.id = self._repo.create_routine(routine)
        self._repo.commit()
        return routine

    def get_routine(self, routine_id: int) -> Optional[Routine]:
        return self._repo.get_routine(routine_id)

    def list_routines(self) -> List[Routine]:
        return self._repo.list_routines()

    def get_active_routine(self) -> Optional[Routine]:
        return self._repo.get_active_routine()

    def activate_routine(self, routine_id: int) -> None:
        routine = self._repo.get_routine(routine_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found")

        current = self._repo.get_active_routine()
        if current and current.id != routine_id:
            current.is_active = False
            current.updated_at = self._now()
            self._repo.update_routine(current)

        routine.is_active = True
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        # Only initialize cycle if no state exists (preserve progress on re-activation)
        if self._cycle_service.get_current_day(routine_id) is None:
            self._cycle_service.initialize(routine_id)
        self._repo.commit()

    def deactivate_routine(self, routine_id: int) -> None:
        routine = self._repo.get_routine(routine_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found")
        routine.is_active = False
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()

    def delete_routine(self, routine_id: int) -> None:
        self._repo.delete_routine(routine_id)
        self._repo.commit()

    # --- Days ---

    def add_day(self, routine_id: int, label: str, name: str) -> RoutineDay:
        routine = self._repo.get_routine(routine_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found")

        sort_order = self._repo.get_day_count(routine_id)
        day = RoutineDay(id=None, routine_id=routine_id, label=label, name=name, sort_order=sort_order)
        day.id = self._repo.add_day(day)

        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return day

    def update_day(self, day_id: int, label: Optional[str] = None, name: Optional[str] = None) -> RoutineDay:
        day = self._repo.get_day(day_id)
        if not day:
            raise ValueError(f"Day {day_id} not found")
        if label is not None:
            day.label = label
        if name is not None:
            day.name = name
        self._repo.update_day(day)

        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return day

    def delete_day(self, day_id: int) -> None:
        day = self._repo.get_day(day_id)
        if not day:
            raise ValueError(f"Day {day_id} not found")

        # Adjust cycle state BEFORE delete (FK would block otherwise)
        self._cycle_service.handle_day_deleted(day.routine_id, day_id)

        self._repo.delete_day(day_id)

        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()

    def reorder_days(self, routine_id: int, day_ids: List[int]) -> None:
        self._repo.reorder_days(routine_id, day_ids)
        routine = self._repo.get_routine(routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()

    def get_days(self, routine_id: int) -> List[RoutineDay]:
        return self._repo.get_days(routine_id)

    # --- Day Exercises (implemented in Task 8) ---

    def add_exercise_to_day(self, day_id: int, exercise_id: int, set_scheme: SetScheme,
                            notes: Optional[str] = None, is_optional: bool = False) -> RoutineDayExercise:
        day = self._repo.get_day(day_id)
        if not day:
            raise ValueError(f"Day {day_id} not found")
        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            raise ValueError(f"Exercise {exercise_id} not found")

        sort_order = self._repo.get_day_exercise_count(day_id)
        rde = RoutineDayExercise(
            id=None, routine_day_id=day_id, exercise_id=exercise_id,
            sort_order=sort_order, set_scheme=set_scheme,
            notes=notes, is_optional=is_optional,
        )
        rde.id = self._repo.add_day_exercise(rde)

        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return rde

    def remove_exercise_from_day(self, rde_id: int) -> None:
        rde = self._repo.get_day_exercise(rde_id)
        if not rde:
            raise ValueError(f"Day exercise {rde_id} not found")
        day = self._repo.get_day(rde.routine_day_id)
        self._repo.delete_day_exercise(rde_id)

        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()

    def get_day_exercises(self, day_id: int) -> List[RoutineDayExercise]:
        return self._repo.get_day_exercises(day_id)

    # --- Set Targets ---

    def set_uniform_targets(
        self, rde_id: int, num_sets: int, set_kind: SetKind,
        reps_min: Optional[int] = None, reps_max: Optional[int] = None,
        weight: Optional[float] = None,
        duration_seconds: Optional[int] = None, distance: Optional[float] = None,
    ) -> List[SetTarget]:
        rde = self._repo.get_day_exercise(rde_id)
        if not rde:
            raise ValueError(f"Day exercise {rde_id} not found")
        exercise = self._exercise_repo.get_by_id(rde.exercise_id)
        validate_set_kind(set_kind, exercise.type)
        validate_cardio_fields(set_kind, duration_seconds, distance)
        validate_amrap_fields(set_kind, exercise.type, weight)

        targets = [
            SetTarget(
                id=None, routine_day_exercise_id=rde_id,
                set_number=i + 1, set_kind=set_kind,
                target_reps_min=reps_min, target_reps_max=reps_max,
                target_weight=weight,
                target_duration_seconds=duration_seconds, target_distance=distance,
            )
            for i in range(num_sets)
        ]
        self._repo.set_targets(rde_id, targets)

        day = self._repo.get_day(rde.routine_day_id)
        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return self._repo.get_targets(rde_id)

    def set_progressive_targets(self, rde_id: int, targets_data: List[dict]) -> List[SetTarget]:
        """Set progressive targets from a list of dicts.

        Each dict may contain: set_kind, reps_min, reps_max, weight,
        duration_seconds, distance.
        """
        rde = self._repo.get_day_exercise(rde_id)
        if not rde:
            raise ValueError(f"Day exercise {rde_id} not found")
        exercise = self._exercise_repo.get_by_id(rde.exercise_id)

        targets = []
        for i, data in enumerate(targets_data):
            sk = data.get("set_kind")
            if sk is not None and not isinstance(sk, SetKind):
                sk = SetKind(sk)
            elif sk is None:
                raise ValueError(f"set_kind is required for set {i + 1}")
            validate_set_kind(sk, exercise.type)
            validate_cardio_fields(sk, data.get("duration_seconds"), data.get("distance"))
            validate_amrap_fields(sk, exercise.type, data.get("weight"))

            targets.append(SetTarget(
                id=None, routine_day_exercise_id=rde_id,
                set_number=i + 1, set_kind=sk,
                target_reps_min=data.get("reps_min"),
                target_reps_max=data.get("reps_max"),
                target_weight=data.get("weight"),
                target_duration_seconds=data.get("duration_seconds"),
                target_distance=data.get("distance"),
            ))

        self._repo.set_targets(rde_id, targets)

        day = self._repo.get_day(rde.routine_day_id)
        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return self._repo.get_targets(rde_id)

    def get_targets(self, rde_id: int) -> List[SetTarget]:
        return self._repo.get_targets(rde_id)

