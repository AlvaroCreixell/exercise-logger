from __future__ import annotations

import sqlite3
from typing import Optional

from models.exercise import Exercise, ExerciseCategory
from models.routine import Routine, RoutineDay, RoutineDayExercise
from repositories.base import BaseRepository


def _row_to_routine(row: sqlite3.Row) -> Routine:
    return Routine(
        id=row["id"],
        name=row["name"],
        description=row["description"],
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
    )


def _row_to_day(row: sqlite3.Row) -> RoutineDay:
    return RoutineDay(
        id=row["id"],
        routine_id=row["routine_id"],
        day_index=row["day_index"],
        name=row["name"],
    )


def _row_to_rde(row: sqlite3.Row) -> RoutineDayExercise:
    return RoutineDayExercise(
        id=row["id"],
        routine_day_id=row["routine_day_id"],
        exercise_id=row["exercise_id"],
        sort_order=row["sort_order"],
        target_sets=row["target_sets"],
        target_reps=row["target_reps"],
        target_weight=row["target_weight"],
        target_duration_min=row["target_duration_min"],
        target_distance_km=row["target_distance_km"],
        target_intensity=row["target_intensity"],
        notes=row["notes"],
    )


class RoutineRepo(BaseRepository):
    # --- Routines ---

    def get_active(self) -> Optional[Routine]:
        row = self._fetchone(
            "SELECT * FROM routines WHERE is_active = 1 LIMIT 1"
        )
        return _row_to_routine(row) if row else None

    def get_by_id(self, routine_id: int) -> Optional[Routine]:
        row = self._fetchone(
            "SELECT * FROM routines WHERE id = ?", (routine_id,)
        )
        return _row_to_routine(row) if row else None

    def get_all(self) -> list[Routine]:
        rows = self._fetchall(
            "SELECT * FROM routines ORDER BY created_at DESC"
        )
        return [_row_to_routine(r) for r in rows]

    def insert_routine(self, routine: Routine) -> int:
        return self._insert(
            "INSERT INTO routines (name, description, is_active) VALUES (?, ?, ?)",
            (routine.name, routine.description, int(routine.is_active)),
        )

    def deactivate_all(self) -> None:
        """Deactivate all routines (call before activating a new one)."""
        self._execute("UPDATE routines SET is_active = 0")

    def set_active(self, routine_id: int) -> None:
        self._execute(
            "UPDATE routines SET is_active = 1 WHERE id = ?", (routine_id,)
        )

    # --- Days ---

    def get_days(self, routine_id: int) -> list[RoutineDay]:
        rows = self._fetchall(
            "SELECT * FROM routine_days WHERE routine_id = ? ORDER BY day_index ASC",
            (routine_id,),
        )
        return [_row_to_day(r) for r in rows]

    def get_day(self, day_id: int) -> Optional[RoutineDay]:
        row = self._fetchone(
            "SELECT * FROM routine_days WHERE id = ?", (day_id,)
        )
        return _row_to_day(row) if row else None

    def get_day_by_index(self, routine_id: int, day_index: int) -> Optional[RoutineDay]:
        row = self._fetchone(
            "SELECT * FROM routine_days WHERE routine_id = ? AND day_index = ?",
            (routine_id, day_index),
        )
        return _row_to_day(row) if row else None

    def count_days(self, routine_id: int) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) AS cnt FROM routine_days WHERE routine_id = ?",
            (routine_id,),
        )
        return row["cnt"] if row else 0

    def insert_day(self, day: RoutineDay) -> int:
        return self._insert(
            "INSERT INTO routine_days (routine_id, day_index, name) VALUES (?, ?, ?)",
            (day.routine_id, day.day_index, day.name),
        )

    def delete_day(self, day_id: int) -> None:
        self._execute("DELETE FROM routine_days WHERE id = ?", (day_id,))

    # --- Day exercises ---

    def get_day_exercises(self, day_id: int) -> list[RoutineDayExercise]:
        rows = self._fetchall(
            "SELECT * FROM routine_day_exercises"
            " WHERE routine_day_id = ? ORDER BY sort_order ASC",
            (day_id,),
        )
        return [_row_to_rde(r) for r in rows]

    def get_day_exercises_with_detail(
        self, day_id: int
    ) -> list[tuple[RoutineDayExercise, Exercise]]:
        """Return (RoutineDayExercise, Exercise) pairs ordered by sort_order."""
        rows = self._fetchall(
            """
            SELECT
                rde.id, rde.routine_day_id, rde.exercise_id, rde.sort_order,
                rde.target_sets, rde.target_reps, rde.target_weight,
                rde.target_duration_min, rde.target_distance_km,
                rde.target_intensity, rde.notes,
                e.id AS ex_id, e.name AS ex_name, e.category AS ex_category,
                e.equipment AS ex_equipment, e.muscle_group AS ex_muscle_group,
                e.notes AS ex_notes, e.is_archived AS ex_is_archived,
                e.created_at AS ex_created_at
            FROM routine_day_exercises rde
            JOIN exercises e ON e.id = rde.exercise_id
            WHERE rde.routine_day_id = ?
            ORDER BY rde.sort_order ASC
            """,
            (day_id,),
        )
        result = []
        for row in rows:
            rde = RoutineDayExercise(
                id=row["id"],
                routine_day_id=row["routine_day_id"],
                exercise_id=row["exercise_id"],
                sort_order=row["sort_order"],
                target_sets=row["target_sets"],
                target_reps=row["target_reps"],
                target_weight=row["target_weight"],
                target_duration_min=row["target_duration_min"],
                target_distance_km=row["target_distance_km"],
                target_intensity=row["target_intensity"],
                notes=row["notes"],
            )
            ex = Exercise(
                id=row["ex_id"],
                name=row["ex_name"],
                category=ExerciseCategory(row["ex_category"]),
                equipment=row["ex_equipment"],
                muscle_group=row["ex_muscle_group"],
                notes=row["ex_notes"],
                is_archived=bool(row["ex_is_archived"]),
                created_at=row["ex_created_at"],
            )
            result.append((rde, ex))
        return result

    def insert_day_exercise(self, rde: RoutineDayExercise) -> int:
        return self._insert(
            "INSERT INTO routine_day_exercises"
            " (routine_day_id, exercise_id, sort_order,"
            "  target_sets, target_reps, target_weight,"
            "  target_duration_min, target_distance_km, target_intensity, notes)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                rde.routine_day_id,
                rde.exercise_id,
                rde.sort_order,
                rde.target_sets,
                rde.target_reps,
                rde.target_weight,
                rde.target_duration_min,
                rde.target_distance_km,
                rde.target_intensity,
                rde.notes,
            ),
        )

    def delete_day_exercise(self, rde_id: int) -> None:
        self._execute(
            "DELETE FROM routine_day_exercises WHERE id = ?", (rde_id,)
        )

    def update_rde_sort_order(self, rde_id: int, sort_order: int) -> None:
        self._execute(
            "UPDATE routine_day_exercises SET sort_order = ? WHERE id = ?",
            (sort_order, rde_id),
        )

    # --- Update helpers ---

    def update_routine_name(self, routine_id: int, name: str) -> None:
        self._execute(
            "UPDATE routines SET name = ? WHERE id = ?", (name, routine_id)
        )

    def update_day_name(self, day_id: int, name: str) -> None:
        self._execute(
            "UPDATE routine_days SET name = ? WHERE id = ?", (name, day_id)
        )

    def swap_day_indexes(
        self, day_id_a: int, index_a: int, day_id_b: int, index_b: int
    ) -> None:
        """Swap day_index between two days using a temp index of -1 to avoid UNIQUE conflict."""
        self._execute(
            "UPDATE routine_days SET day_index = -1 WHERE id = ?", (day_id_a,)
        )
        self._execute(
            "UPDATE routine_days SET day_index = ? WHERE id = ?", (index_a, day_id_b)
        )
        self._execute(
            "UPDATE routine_days SET day_index = ? WHERE id = ?", (index_b, day_id_a)
        )

    def resequence_days_after_delete(self, routine_id: int, deleted_index: int) -> None:
        """After deleting a day, close the gap by decrementing all higher day_indexes."""
        self._execute(
            "UPDATE routine_days SET day_index = day_index - 1"
            " WHERE routine_id = ? AND day_index > ?",
            (routine_id, deleted_index),
        )
