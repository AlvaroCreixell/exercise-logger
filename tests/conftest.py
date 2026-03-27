"""Shared test fixtures for v2."""
import pytest
import sqlite3


@pytest.fixture
def db_conn():
    """In-memory SQLite database with foreign keys enabled.

    Schema init added in Task 2 once src/db/schema.py exists.
    """
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    yield conn
    conn.close()
