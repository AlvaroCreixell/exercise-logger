"""Base repository with common database operations."""
import sqlite3
from typing import List, Optional


class BaseRepository:
    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def _execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        return self._conn.execute(sql, params)

    def _fetchone(self, sql: str, params: tuple = ()) -> Optional[sqlite3.Row]:
        return self._conn.execute(sql, params).fetchone()

    def _fetchall(self, sql: str, params: tuple = ()) -> List[sqlite3.Row]:
        return self._conn.execute(sql, params).fetchall()

    def _insert(self, sql: str, params: tuple = ()) -> int:
        """Execute an INSERT and return lastrowid."""
        cursor = self._conn.execute(sql, params)
        return cursor.lastrowid

    def commit(self) -> None:
        self._conn.commit()
