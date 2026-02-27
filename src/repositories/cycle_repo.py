from __future__ import annotations

import sqlite3
from typing import Optional

from models.routine import RoutineCycleState
from repositories.base import BaseRepository


def _row_to_state(row: sqlite3.Row) -> RoutineCycleState:
    return RoutineCycleState(
        id=row["id"],
        routine_id=row["routine_id"],
        current_day_index=row["current_day_index"],
        last_session_id=row["last_session_id"],
        updated_at=row["updated_at"],
    )


class CycleRepo(BaseRepository):
    def get_state(self, routine_id: int) -> Optional[RoutineCycleState]:
        row = self._fetchone(
            "SELECT * FROM routine_cycle_state WHERE routine_id = ?",
            (routine_id,),
        )
        return _row_to_state(row) if row else None

    def upsert_state(self, state: RoutineCycleState) -> None:
        self._execute(
            """
            INSERT INTO routine_cycle_state
                (routine_id, current_day_index, last_session_id, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(routine_id) DO UPDATE SET
                current_day_index = excluded.current_day_index,
                last_session_id   = excluded.last_session_id,
                updated_at        = excluded.updated_at
            """,
            (state.routine_id, state.current_day_index, state.last_session_id),
        )

    def create_for_routine(self, routine_id: int) -> None:
        """Insert a fresh cycle state at index 0 for a new routine."""
        self._execute(
            "INSERT OR IGNORE INTO routine_cycle_state (routine_id, current_day_index)"
            " VALUES (?, 0)",
            (routine_id,),
        )
