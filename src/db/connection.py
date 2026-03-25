"""Database connection helpers."""
import sqlite3


def create_connection(db_path: str) -> sqlite3.Connection:
    """Create a connection to a SQLite database file."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def create_memory_connection() -> sqlite3.Connection:
    """Create an in-memory SQLite connection (for testing)."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn
