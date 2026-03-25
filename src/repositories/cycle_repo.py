"""Cycle state repository — tracks current day per routine."""
from typing import Optional
from src.repositories.base import BaseRepository


class CycleRepo(BaseRepository):

    def get_current_day_id(self, routine_id: int) -> Optional[int]:
        row = self._fetchone(
            "SELECT current_routine_day_id FROM routine_cycle_state WHERE routine_id = ?",
            (routine_id,),
        )
        return row["current_routine_day_id"] if row else None

    def set_current_day(self, routine_id: int, day_id: int) -> None:
        self._execute(
            """INSERT INTO routine_cycle_state (routine_id, current_routine_day_id)
               VALUES (?, ?)
               ON CONFLICT(routine_id) DO UPDATE SET current_routine_day_id = ?""",
            (routine_id, day_id, day_id),
        )

    def delete_state(self, routine_id: int) -> None:
        self._execute(
            "DELETE FROM routine_cycle_state WHERE routine_id = ?", (routine_id,)
        )
