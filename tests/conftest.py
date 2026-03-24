import pytest
import sqlite3
from src.db.schema import init_db


@pytest.fixture
def db_conn():
    """In-memory SQLite database with schema initialized."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    init_db(conn)
    yield conn
    conn.close()


from src.models.exercise import ExerciseType
from src.repositories.exercise_repo import ExerciseRepo
from src.services.exercise_service import ExerciseService


@pytest.fixture
def exercise_repo(db_conn):
    return ExerciseRepo(db_conn)


@pytest.fixture
def exercise_service(exercise_repo):
    return ExerciseService(exercise_repo)


@pytest.fixture
def make_exercise(exercise_service):
    """Helper to quickly create test exercises."""
    def _make(name="Bench Press", type=ExerciseType.REPS_WEIGHT, **kwargs):
        return exercise_service.create_exercise(name=name, type=type, **kwargs)
    return _make
