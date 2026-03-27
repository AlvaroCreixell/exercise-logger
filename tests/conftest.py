"""Shared test fixtures for v2."""
import pytest
import sqlite3
from src.db.schema import init_db


@pytest.fixture
def db_conn():
    """In-memory SQLite database with v2 schema initialized."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    init_db(conn)
    yield conn
    conn.close()
