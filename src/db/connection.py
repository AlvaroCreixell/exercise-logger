from __future__ import annotations

import sqlite3
from typing import Optional

from config import DB_PATH

_connection: Optional[sqlite3.Connection] = None


def get_connection() -> sqlite3.Connection:
    """Return the module-level singleton SQLite connection.

    The connection is created once per process. Flet apps are single-threaded
    so a module-level singleton is safe. Foreign keys and WAL mode are enabled
    on first creation.
    """
    global _connection
    if _connection is None:
        _connection = sqlite3.connect(DB_PATH, check_same_thread=False)
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA foreign_keys = ON")
        _connection.execute("PRAGMA journal_mode = WAL")
    return _connection


def close_connection() -> None:
    """Close and reset the singleton connection. Useful in tests."""
    global _connection
    if _connection is not None:
        _connection.close()
        _connection = None
