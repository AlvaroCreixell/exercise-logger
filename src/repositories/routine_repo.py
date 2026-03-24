"""Routine repository — routines, days, day exercises, set targets."""
from typing import List, Optional
from src.models.routine import (
    Routine, RoutineDay, RoutineDayExercise, SetTarget, SetScheme, SetKind,
)
from src.repositories.base import BaseRepository


class RoutineRepo(BaseRepository):

    # --- Routines ---

    def create_routine(self, routine: Routine) -> int:
        return self._insert(
            """INSERT INTO routines (name, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?)""",
            (routine.name, int(routine.is_active), routine.created_at, routine.updated_at),
        )

    def get_routine(self, routine_id: int) -> Optional[Routine]:
        row = self._fetchone("SELECT * FROM routines WHERE id = ?", (routine_id,))
        return self._to_routine(row) if row else None

    def list_routines(self) -> List[Routine]:
        rows = self._fetchall("SELECT * FROM routines ORDER BY created_at DESC")
        return [self._to_routine(r) for r in rows]

    def get_active_routine(self) -> Optional[Routine]:
        row = self._fetchone("SELECT * FROM routines WHERE is_active = 1")
        return self._to_routine(row) if row else None

    def update_routine(self, routine: Routine) -> None:
        self._execute(
            "UPDATE routines SET name = ?, is_active = ?, updated_at = ? WHERE id = ?",
            (routine.name, int(routine.is_active), routine.updated_at, routine.id),
        )

    def delete_routine(self, routine_id: int) -> None:
        self._execute("DELETE FROM routines WHERE id = ?", (routine_id,))

    # --- Days ---

    def add_day(self, day: RoutineDay) -> int:
        return self._insert(
            """INSERT INTO routine_days (routine_id, label, name, sort_order)
               VALUES (?, ?, ?, ?)""",
            (day.routine_id, day.label, day.name, day.sort_order),
        )

    def get_day(self, day_id: int) -> Optional[RoutineDay]:
        row = self._fetchone("SELECT * FROM routine_days WHERE id = ?", (day_id,))
        return self._to_day(row) if row else None

    def get_days(self, routine_id: int) -> List[RoutineDay]:
        rows = self._fetchall(
            "SELECT * FROM routine_days WHERE routine_id = ? ORDER BY sort_order",
            (routine_id,),
        )
        return [self._to_day(r) for r in rows]

    def get_day_count(self, routine_id: int) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM routine_days WHERE routine_id = ?",
            (routine_id,),
        )
        return row["cnt"] if row else 0

    def update_day(self, day: RoutineDay) -> None:
        self._execute(
            "UPDATE routine_days SET label = ?, name = ?, sort_order = ? WHERE id = ?",
            (day.label, day.name, day.sort_order, day.id),
        )

    def delete_day(self, day_id: int) -> None:
        """Delete day and resequence remaining siblings."""
        day = self.get_day(day_id)
        if not day:
            return
        self._execute("DELETE FROM routine_days WHERE id = ?", (day_id,))
        self._execute(
            "UPDATE routine_days SET sort_order = sort_order - 1 WHERE routine_id = ? AND sort_order > ?",
            (day.routine_id, day.sort_order),
        )

    def reorder_days(self, routine_id: int, day_ids: List[int]) -> None:
        """Reorder days. day_ids must contain all day IDs for this routine."""
        # Move all to negative space to avoid UNIQUE conflicts mid-update
        self._execute(
            "UPDATE routine_days SET sort_order = -(sort_order + 1000) WHERE routine_id = ?",
            (routine_id,),
        )
        for new_order, day_id in enumerate(day_ids):
            self._execute(
                "UPDATE routine_days SET sort_order = ? WHERE id = ?",
                (new_order, day_id),
            )

    # --- Day Exercises ---

    def add_day_exercise(self, rde: RoutineDayExercise) -> int:
        return self._insert(
            """INSERT INTO routine_day_exercises
               (routine_day_id, exercise_id, sort_order, set_scheme, notes, is_optional)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (rde.routine_day_id, rde.exercise_id, rde.sort_order,
             rde.set_scheme.value, rde.notes, int(rde.is_optional)),
        )

    def get_day_exercise(self, rde_id: int) -> Optional[RoutineDayExercise]:
        row = self._fetchone(
            "SELECT * FROM routine_day_exercises WHERE id = ?", (rde_id,)
        )
        return self._to_day_exercise(row) if row else None

    def get_day_exercises(self, day_id: int) -> List[RoutineDayExercise]:
        rows = self._fetchall(
            "SELECT * FROM routine_day_exercises WHERE routine_day_id = ? ORDER BY sort_order",
            (day_id,),
        )
        return [self._to_day_exercise(r) for r in rows]

    def get_day_exercise_count(self, day_id: int) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM routine_day_exercises WHERE routine_day_id = ?",
            (day_id,),
        )
        return row["cnt"] if row else 0

    def delete_day_exercise(self, rde_id: int) -> None:
        """Delete day exercise and resequence remaining siblings."""
        rde = self.get_day_exercise(rde_id)
        if not rde:
            return
        self._execute("DELETE FROM routine_day_exercises WHERE id = ?", (rde_id,))
        self._execute(
            "UPDATE routine_day_exercises SET sort_order = sort_order - 1 WHERE routine_day_id = ? AND sort_order > ?",
            (rde.routine_day_id, rde.sort_order),
        )

    def reorder_day_exercises(self, day_id: int, rde_ids: List[int]) -> None:
        self._execute(
            "UPDATE routine_day_exercises SET sort_order = -(sort_order + 1000) WHERE routine_day_id = ?",
            (day_id,),
        )
        for new_order, rde_id in enumerate(rde_ids):
            self._execute(
                "UPDATE routine_day_exercises SET sort_order = ? WHERE id = ?",
                (new_order, rde_id),
            )

    # --- Set Targets ---

    def set_targets(self, rde_id: int, targets: List[SetTarget]) -> List[int]:
        """Replace all targets for a day exercise. Returns new IDs."""
        self._execute(
            "DELETE FROM exercise_set_targets WHERE routine_day_exercise_id = ?",
            (rde_id,),
        )
        ids = []
        for target in targets:
            tid = self._insert(
                """INSERT INTO exercise_set_targets
                   (routine_day_exercise_id, set_number, set_kind,
                    target_reps_min, target_reps_max, target_weight,
                    target_duration_seconds, target_distance)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (rde_id, target.set_number, target.set_kind.value,
                 target.target_reps_min, target.target_reps_max, target.target_weight,
                 target.target_duration_seconds, target.target_distance),
            )
            ids.append(tid)
        return ids

    def get_targets(self, rde_id: int) -> List[SetTarget]:
        rows = self._fetchall(
            "SELECT * FROM exercise_set_targets WHERE routine_day_exercise_id = ? ORDER BY set_number",
            (rde_id,),
        )
        return [self._to_set_target(r) for r in rows]

    # --- Row converters ---

    def _to_routine(self, row) -> Routine:
        return Routine(
            id=row["id"], name=row["name"],
            is_active=bool(row["is_active"]),
            created_at=row["created_at"], updated_at=row["updated_at"],
        )

    def _to_day(self, row) -> RoutineDay:
        return RoutineDay(
            id=row["id"], routine_id=row["routine_id"],
            label=row["label"], name=row["name"], sort_order=row["sort_order"],
        )

    def _to_day_exercise(self, row) -> RoutineDayExercise:
        return RoutineDayExercise(
            id=row["id"], routine_day_id=row["routine_day_id"],
            exercise_id=row["exercise_id"], sort_order=row["sort_order"],
            set_scheme=SetScheme(row["set_scheme"]),
            notes=row["notes"], is_optional=bool(row["is_optional"]),
        )

    def _to_set_target(self, row) -> SetTarget:
        return SetTarget(
            id=row["id"],
            routine_day_exercise_id=row["routine_day_exercise_id"],
            set_number=row["set_number"],
            set_kind=SetKind(row["set_kind"]),
            target_reps_min=row["target_reps_min"],
            target_reps_max=row["target_reps_max"],
            target_weight=row["target_weight"],
            target_duration_seconds=row["target_duration_seconds"],
            target_distance=row["target_distance"],
        )
