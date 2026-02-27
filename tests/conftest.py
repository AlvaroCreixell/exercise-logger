from __future__ import annotations

import os
import sqlite3
import sys

import pytest

# Ensure src/ is on the path for all test imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from db.schema import init_db  # noqa: E402


@pytest.fixture
def db_conn():
    """In-memory SQLite connection with full schema initialised."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    init_db(conn)
    yield conn
    conn.close()
