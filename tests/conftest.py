"""Shared test fixtures."""
import pytest
import sqlite3


@pytest.fixture
def db_conn():
    """In-memory SQLite database with schema initialized."""
    from src.db.schema import init_db
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    init_db(conn)
    yield conn
    conn.close()


@pytest.fixture
def settings_repo(db_conn):
    from src.repositories.settings_repo import SettingsRepo
    return SettingsRepo(db_conn)


@pytest.fixture
def workout_repo(db_conn):
    from src.repositories.workout_repo import WorkoutRepo
    return WorkoutRepo(db_conn)


@pytest.fixture
def benchmark_repo(db_conn):
    from src.repositories.benchmark_repo import BenchmarkRepo
    return BenchmarkRepo(db_conn)
