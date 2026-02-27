from __future__ import annotations

import sqlite3
from typing import Optional

from models.routine import RoutineCycleState, RoutineDay
from repositories.cycle_repo import CycleRepo
from repositories.routine_repo import RoutineRepo


class CycleService:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._cycle_repo = CycleRepo(conn)
        self._routine_repo = RoutineRepo(conn)
        self._conn = conn

    def get_current_day(self, routine_id: int) -> Optional[RoutineDay]:
        """Return the RoutineDay that should be worked next."""
        state = self._cycle_repo.get_state(routine_id)
        if state is None:
            return None
        return self._routine_repo.get_day_by_index(
            routine_id, state.current_day_index
        )

    def get_current_index(self, routine_id: int) -> int:
        state = self._cycle_repo.get_state(routine_id)
        return state.current_day_index if state else 0

    def advance(self, routine_id: int, session_id: int) -> None:
        """Advance the cycle to the next day (mod total days).

        Call this ONLY after a session has been finished, never on start.
        """
        state = self._cycle_repo.get_state(routine_id)
        total_days = self._routine_repo.count_days(routine_id)
        if total_days == 0:
            return

        current = state.current_day_index if state else 0
        next_index = (current + 1) % total_days

        new_state = RoutineCycleState(
            id=None,
            routine_id=routine_id,
            current_day_index=next_index,
            last_session_id=session_id,
        )
        self._cycle_repo.upsert_state(new_state)
        self._conn.commit()

    def override_day(self, routine_id: int, day_index: int) -> None:
        """Manually set the next day index (for skipping or repeating days).

        After a session finishes, advance will be relative to this index.
        """
        state = self._cycle_repo.get_state(routine_id)
        last_session_id = state.last_session_id if state else None

        new_state = RoutineCycleState(
            id=None,
            routine_id=routine_id,
            current_day_index=day_index,
            last_session_id=last_session_id,
        )
        self._cycle_repo.upsert_state(new_state)
        self._conn.commit()

    def reset(self, routine_id: int) -> None:
        """Reset cycle to day 0 (e.g. after a routine is edited)."""
        state = self._cycle_repo.get_state(routine_id)
        last_session_id = state.last_session_id if state else None

        new_state = RoutineCycleState(
            id=None,
            routine_id=routine_id,
            current_day_index=0,
            last_session_id=last_session_id,
        )
        self._cycle_repo.upsert_state(new_state)
        self._conn.commit()
