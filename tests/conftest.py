from __future__ import annotations

import sqlite3
import pytest


@pytest.fixture
def db_conn():
    """In-memory SQLite connection for testing. Foreign keys and WAL enabled."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # WAL not meaningful for in-memory, but set for consistency
    conn.execute("PRAGMA journal_mode = WAL")
    yield conn
    conn.close()
