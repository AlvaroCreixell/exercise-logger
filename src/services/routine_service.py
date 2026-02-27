from __future__ import annotations

import sqlite3
from typing import Optional

from models.routine import Routine
from repositories.routine_repo import RoutineRepo


class RoutineService:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._repo = RoutineRepo(conn)

    def get_active_routine(self) -> Optional[Routine]:
        return self._repo.get_active()
