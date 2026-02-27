from __future__ import annotations

import sqlite3
from typing import Any, Optional, Sequence


class BaseRepository:
    def __init__(self, conn: sqlite3.Connection) -> None:
        self._conn = conn

    def _execute(self, sql: str, params: Sequence[Any] = ()) -> sqlite3.Cursor:
        return self._conn.execute(sql, params)

    def _fetchone(self, sql: str, params: Sequence[Any] = ()) -> Optional[sqlite3.Row]:
        return self._conn.execute(sql, params).fetchone()

    def _fetchall(self, sql: str, params: Sequence[Any] = ()) -> list[sqlite3.Row]:
        return self._conn.execute(sql, params).fetchall()

    def _insert(self, sql: str, params: Sequence[Any] = ()) -> int:
        """Execute an INSERT and return the new row's id. Does NOT commit."""
        cursor = self._conn.execute(sql, params)
        return cursor.lastrowid

    def _commit(self) -> None:
        self._conn.commit()
