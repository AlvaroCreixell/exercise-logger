# Phase 1: Foundation + Core Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all models, database schema, repositories, and services for exercise, routine, and cycle management with full test coverage. No UI — pure backend.

**Architecture:** Three-layer: Services → Repositories → SQLite. Models are pure dataclasses. Repos handle SQL and return models. Services enforce business logic and manage transactions. All tested with in-memory SQLite.

**Tech Stack:** Python 3.10+, sqlite3 (stdlib), pytest, dataclasses, enums.

**Spec reference:** `docs/superpowers/specs/2026-03-23-exercise-logger-greenfield-design.md`

---

## Plan Decomposition

The full spec breaks into three phases:

| Phase | Scope | Depends on |
|-------|-------|------------|
| **Phase 1** (this plan) | Models, DB schema, base repo, exercise/routine/cycle repos+services+tests | Nothing |
| **Phase 2** (separate plan) | Workout, benchmark, stats, import/export, settings services+tests | Phase 1 |
| **Phase 3** (separate plan) | Kivy+KivyMD screens, components, navigation, app shell | Phase 1+2 |

Phase 1 produces a fully tested data layer. Phase 2 adds session/workout logic. Phase 3 adds the UI. Each phase is independently shippable and testable.

---

## File Structure

```
src/
├── __init__.py                          # Empty package init
├── config.py                            # Constants, DB path, defaults
├── models/
│   ├── __init__.py
│   ├── exercise.py                      # Exercise dataclass, ExerciseType enum
│   ├── routine.py                       # Routine, RoutineDay, RoutineDayExercise, SetTarget, SetScheme, SetKind
│   ├── workout.py                       # WorkoutSession, SessionExercise, LoggedSet, SessionStatus, SessionType
│   ├── benchmark.py                     # BenchmarkDefinition, BenchmarkResult, BenchmarkMethod
│   └── settings.py                      # Setting dataclass
├── db/
│   ├── __init__.py
│   ├── connection.py                    # create_connection(), create_memory_connection()
│   └── schema.py                        # CREATE TABLE SQL, init_db()
├── repositories/
│   ├── __init__.py
│   ├── base.py                          # BaseRepository with _execute, _fetchone, _fetchall, _insert, commit
│   ├── exercise_repo.py                 # Exercise CRUD, archive, list
│   ├── routine_repo.py                  # Routines + days + day_exercises + set_targets
│   └── cycle_repo.py                    # Cycle state read/write
├── services/
│   ├── __init__.py
│   ├── exercise_service.py              # Exercise CRUD, name validation
│   ├── routine_service.py               # Routine management, set schemes, validation
│   └── cycle_service.py                 # Advance, wrap, delete-current-day, cross-routine validation
├── utils/
│   └── __init__.py
└── assets/
    └── .gitkeep                         # Already exists

tests/
├── __init__.py
├── conftest.py                          # Shared fixtures (db_conn, repos, services, helpers)
├── test_db_schema.py                    # Schema creation, constraints, FK cascades
├── test_exercise_service.py             # Exercise CRUD, duplicate names, archive
├── test_routine_service.py              # Routines, days, exercises, set targets, reorder
└── test_cycle_service.py                # Advance, wrap, delete-current, cross-routine
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `pyproject.toml`, `CLAUDE.md`, `src/__init__.py`, `src/config.py`
- Create: `src/models/__init__.py`, `src/db/__init__.py`, `src/repositories/__init__.py`, `src/services/__init__.py`, `src/utils/__init__.py`
- Create: `tests/__init__.py`, `tests/conftest.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[project]
name = "exercise-logger"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = []

[project.optional-dependencies]
dev = ["pytest>=7.0"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 2: Create `CLAUDE.md`**

```markdown
# Exercise Logger — Project Conventions

## Overview
Mobile workout logger for Android. Kivy + KivyMD frontend, SQLite backend, fully offline.

## Spec
The authoritative design document is `docs/superpowers/specs/2026-03-23-exercise-logger-greenfield-design.md`. This spec supersedes any conflicting information in this file.

## Tech Stack
- Python 3.10+, Kivy + KivyMD, SQLite3 (stdlib), pytest, Buildozer → APK

## Architecture
```
Screens → Services → Repositories → SQLite
```
Each layer only calls the layer directly below it.

## Coding Conventions
- `dataclasses` for all models. No Pydantic, no ORM.
- `Optional[type]` for nullable fields (Python 3.10 compat).
- `Enum` classes for type/method/status values.
- `from __future__ import annotations` in all model files.
- Raw SQL via `sqlite3`, parameterized queries (`?` placeholders) always.
- Repos extend `BaseRepository`, return dataclass instances.
- Services use constructor injection for dependencies.

## Commands
```bash
pytest tests/           # Run all tests
pytest tests/ -v        # Verbose
pytest tests/test_X.py  # Single file
```

## Testing
- In-memory SQLite (`:memory:`) for all tests.
- Shared fixtures in `tests/conftest.py`.
- Test services and repos, not screens.
```

- [ ] **Step 3: Create `src/config.py`**

```python
"""App configuration constants."""
import os

# Database
DB_FILENAME = "exercise_logger.db"
DB_PATH = os.path.join(os.path.dirname(__file__), DB_FILENAME)

# Defaults
DEFAULT_WEIGHT_UNIT = "lbs"
DEFAULT_BENCHMARK_FREQUENCY_WEEKS = 6
```

- [ ] **Step 4: Create all `__init__.py` files**

Create empty `__init__.py` in: `src/`, `src/models/`, `src/db/`, `src/repositories/`, `src/services/`, `src/utils/`, `tests/`

- [ ] **Step 5: Create minimal `tests/conftest.py`**

```python
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
```

Note: More fixtures will be added in later tasks as repos/services are created.

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml CLAUDE.md src/__init__.py src/config.py src/models/__init__.py src/db/__init__.py src/repositories/__init__.py src/services/__init__.py src/utils/__init__.py tests/__init__.py tests/conftest.py
git commit -m "feat: project scaffolding for greenfield rewrite"
```

---

## Task 2: Models

**Files:**
- Create: `src/models/exercise.py`, `src/models/routine.py`, `src/models/workout.py`, `src/models/benchmark.py`, `src/models/settings.py`

No tests — models are pure data containers with no logic.

- [ ] **Step 1: Create `src/models/exercise.py`**

```python
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class ExerciseType(Enum):
    REPS_WEIGHT = "reps_weight"
    REPS_ONLY = "reps_only"
    TIME = "time"
    CARDIO = "cardio"


@dataclass
class Exercise:
    id: Optional[int]
    name: str
    type: ExerciseType
    muscle_group: Optional[str] = None
    equipment: Optional[str] = None
    is_archived: bool = False
```

- [ ] **Step 2: Create `src/models/routine.py`**

```python
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class SetScheme(Enum):
    UNIFORM = "uniform"
    PROGRESSIVE = "progressive"


class SetKind(Enum):
    REPS_WEIGHT = "reps_weight"
    REPS_ONLY = "reps_only"
    DURATION = "duration"
    CARDIO = "cardio"
    AMRAP = "amrap"


@dataclass
class Routine:
    id: Optional[int]
    name: str
    is_active: bool
    created_at: str
    updated_at: str


@dataclass
class RoutineDay:
    id: Optional[int]
    routine_id: int
    label: str
    name: str
    sort_order: int


@dataclass
class RoutineDayExercise:
    id: Optional[int]
    routine_day_id: int
    exercise_id: int
    sort_order: int
    set_scheme: SetScheme
    notes: Optional[str] = None
    is_optional: bool = False


@dataclass
class SetTarget:
    id: Optional[int]
    routine_day_exercise_id: int
    set_number: int
    set_kind: SetKind
    target_reps_min: Optional[int] = None
    target_reps_max: Optional[int] = None
    target_weight: Optional[float] = None
    target_duration_seconds: Optional[int] = None
    target_distance: Optional[float] = None
```

- [ ] **Step 3: Create `src/models/workout.py`**

```python
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional
from src.models.routine import SetKind


class SessionStatus(Enum):
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"


class SessionType(Enum):
    ROUTINE = "routine"
    BENCHMARK = "benchmark"


@dataclass
class WorkoutSession:
    id: Optional[int]
    routine_id: Optional[int]
    routine_day_id: Optional[int]
    session_type: SessionType
    status: SessionStatus
    completed_fully: Optional[bool]
    day_label_snapshot: Optional[str]
    day_name_snapshot: Optional[str]
    started_at: str
    finished_at: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class SessionExercise:
    id: Optional[int]
    session_id: int
    exercise_id: int
    routine_day_exercise_id: Optional[int]
    sort_order: int
    exercise_name_snapshot: str
    notes: Optional[str] = None


@dataclass
class LoggedSet:
    id: Optional[int]
    session_exercise_id: int
    exercise_set_target_id: Optional[int]
    set_number: int
    set_kind: SetKind
    reps: Optional[int] = None
    weight: Optional[float] = None
    duration_seconds: Optional[int] = None
    distance: Optional[float] = None
    notes: Optional[str] = None
    logged_at: Optional[str] = None
```

- [ ] **Step 4: Create `src/models/benchmark.py`**

```python
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class BenchmarkMethod(Enum):
    MAX_WEIGHT = "max_weight"
    MAX_REPS = "max_reps"
    TIMED_HOLD = "timed_hold"


@dataclass
class BenchmarkDefinition:
    id: Optional[int]
    exercise_id: int
    method: BenchmarkMethod
    reference_weight: Optional[float]
    frequency_weeks: int
    muscle_group_label: str


@dataclass
class BenchmarkResult:
    id: Optional[int]
    benchmark_definition_id: int
    session_id: Optional[int]
    method_snapshot: BenchmarkMethod
    reference_weight_snapshot: Optional[float]
    result_value: float
    tested_at: str
```

- [ ] **Step 5: Create `src/models/settings.py`**

```python
from __future__ import annotations
from dataclasses import dataclass


@dataclass
class Setting:
    key: str
    value: str
```

- [ ] **Step 6: Commit**

```bash
git add src/models/
git commit -m "feat: add all model dataclasses and enums"
```

---

## Task 3: DB Schema + Connection

**Files:**
- Create: `src/db/connection.py`, `src/db/schema.py`
- Create: `tests/test_db_schema.py`

- [ ] **Step 1: Create `src/db/connection.py`**

```python
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
```

- [ ] **Step 2: Create `src/db/schema.py`**

```python
"""Database schema definitions."""
import sqlite3


_SCHEMA_SQL = [
    """CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('reps_weight', 'reps_only', 'time', 'cardio')),
        muscle_group TEXT,
        equipment TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1))
    )""",

    """CREATE TABLE IF NOT EXISTS routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS routine_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        UNIQUE(routine_id, sort_order),
        UNIQUE(routine_id, label)
    )""",

    """CREATE TABLE IF NOT EXISTS routine_day_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_day_id INTEGER NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        sort_order INTEGER NOT NULL,
        set_scheme TEXT NOT NULL CHECK(set_scheme IN ('uniform', 'progressive')),
        notes TEXT,
        is_optional INTEGER NOT NULL DEFAULT 0 CHECK(is_optional IN (0, 1)),
        UNIQUE(routine_day_id, sort_order)
    )""",

    """CREATE TABLE IF NOT EXISTS exercise_set_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_day_exercise_id INTEGER NOT NULL REFERENCES routine_day_exercises(id) ON DELETE CASCADE,
        set_number INTEGER NOT NULL CHECK(set_number >= 1),
        set_kind TEXT NOT NULL CHECK(set_kind IN ('reps_weight', 'reps_only', 'duration', 'cardio', 'amrap')),
        target_reps_min INTEGER CHECK(target_reps_min IS NULL OR target_reps_min >= 1),
        target_reps_max INTEGER CHECK(target_reps_max IS NULL OR target_reps_max >= 1),
        target_weight REAL CHECK(target_weight IS NULL OR target_weight >= 0),
        target_duration_seconds INTEGER CHECK(target_duration_seconds IS NULL OR target_duration_seconds >= 1),
        target_distance REAL CHECK(target_distance IS NULL OR target_distance > 0),
        CHECK(target_reps_min IS NULL OR target_reps_max IS NULL OR target_reps_min <= target_reps_max),
        UNIQUE(routine_day_exercise_id, set_number)
    )""",

    """CREATE TABLE IF NOT EXISTS workout_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
        routine_day_id INTEGER REFERENCES routine_days(id) ON DELETE SET NULL,
        session_type TEXT NOT NULL CHECK(session_type IN ('routine', 'benchmark')),
        status TEXT NOT NULL,
        completed_fully INTEGER,
        day_label_snapshot TEXT,
        day_name_snapshot TEXT,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        notes TEXT,
        CHECK(
            (status = 'in_progress' AND completed_fully IS NULL AND finished_at IS NULL)
            OR
            (status = 'finished' AND completed_fully IN (0, 1) AND finished_at IS NOT NULL)
        )
    )""",

    """CREATE TABLE IF NOT EXISTS session_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES workout_sessions(id),
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        routine_day_exercise_id INTEGER REFERENCES routine_day_exercises(id) ON DELETE SET NULL,
        sort_order INTEGER NOT NULL,
        exercise_name_snapshot TEXT NOT NULL,
        notes TEXT,
        UNIQUE(session_id, sort_order)
    )""",

    """CREATE TABLE IF NOT EXISTS logged_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id),
        exercise_set_target_id INTEGER REFERENCES exercise_set_targets(id) ON DELETE SET NULL,
        set_number INTEGER NOT NULL CHECK(set_number >= 1),
        set_kind TEXT NOT NULL CHECK(set_kind IN ('reps_weight', 'reps_only', 'duration', 'cardio', 'amrap')),
        reps INTEGER CHECK(reps IS NULL OR reps >= 1),
        weight REAL CHECK(weight IS NULL OR weight >= 0),
        duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds >= 1),
        distance REAL CHECK(distance IS NULL OR distance > 0),
        notes TEXT,
        logged_at TEXT NOT NULL,
        UNIQUE(session_exercise_id, set_number)
    )""",

    """CREATE TABLE IF NOT EXISTS routine_cycle_state (
        routine_id INTEGER PRIMARY KEY REFERENCES routines(id) ON DELETE CASCADE,
        current_routine_day_id INTEGER NOT NULL REFERENCES routine_days(id) ON DELETE CASCADE
    )""",

    """CREATE TABLE IF NOT EXISTS benchmark_definitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id),
        method TEXT NOT NULL CHECK(method IN ('max_weight', 'max_reps', 'timed_hold')),
        reference_weight REAL,
        frequency_weeks INTEGER NOT NULL DEFAULT 6 CHECK(frequency_weeks >= 1),
        muscle_group_label TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS benchmark_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        benchmark_definition_id INTEGER NOT NULL REFERENCES benchmark_definitions(id),
        session_id INTEGER REFERENCES workout_sessions(id),
        method_snapshot TEXT NOT NULL CHECK(method_snapshot IN ('max_weight', 'max_reps', 'timed_hold')),
        reference_weight_snapshot REAL,
        result_value REAL NOT NULL,
        tested_at TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )""",
]


def init_db(conn: sqlite3.Connection) -> None:
    """Create all tables. Safe to call multiple times (IF NOT EXISTS)."""
    for sql in _SCHEMA_SQL:
        conn.execute(sql)
    conn.commit()
```

- [ ] **Step 3: Write `tests/test_db_schema.py`**

```python
import sqlite3
import pytest


class TestSchema:
    def test_all_tables_created(self, db_conn):
        rows = db_conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        table_names = {r["name"] for r in rows}
        expected = {
            "exercises", "routines", "routine_days", "routine_day_exercises",
            "exercise_set_targets", "workout_sessions", "session_exercises",
            "logged_sets", "routine_cycle_state", "benchmark_definitions",
            "benchmark_results", "settings",
        }
        assert expected.issubset(table_names)

    def test_foreign_keys_enabled(self, db_conn):
        row = db_conn.execute("PRAGMA foreign_keys").fetchone()
        assert row[0] == 1

    def test_exercise_type_check_rejects_invalid(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                "INSERT INTO exercises (name, type, is_archived) VALUES (?, ?, ?)",
                ("Test", "invalid_type", 0),
            )

    def test_exercise_name_unique(self, db_conn):
        db_conn.execute(
            "INSERT INTO exercises (name, type, is_archived) VALUES (?, ?, ?)",
            ("Bench Press", "reps_weight", 0),
        )
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                "INSERT INTO exercises (name, type, is_archived) VALUES (?, ?, ?)",
                ("Bench Press", "reps_weight", 0),
            )

    def test_session_lifecycle_valid_in_progress(self, db_conn):
        """in_progress + NULL completed_fully + NULL finished_at = valid."""
        db_conn.execute(
            """INSERT INTO workout_sessions
               (session_type, status, completed_fully, started_at, finished_at)
               VALUES (?, ?, ?, ?, ?)""",
            ("routine", "in_progress", None, "2026-01-01T00:00:00", None),
        )

    def test_session_lifecycle_valid_finished(self, db_conn):
        """finished + completed_fully=1 + finished_at set = valid."""
        db_conn.execute(
            """INSERT INTO workout_sessions
               (session_type, status, completed_fully, started_at, finished_at)
               VALUES (?, ?, ?, ?, ?)""",
            ("routine", "finished", 1, "2026-01-01T00:00:00", "2026-01-01T01:00:00"),
        )

    def test_session_lifecycle_invalid_finished_null_completed(self, db_conn):
        """finished + NULL completed_fully = INVALID."""
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (session_type, status, completed_fully, started_at, finished_at)
                   VALUES (?, ?, ?, ?, ?)""",
                ("routine", "finished", None, "2026-01-01T00:00:00", "2026-01-01T01:00:00"),
            )

    def test_session_lifecycle_invalid_in_progress_with_completed(self, db_conn):
        """in_progress + completed_fully=1 = INVALID."""
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (session_type, status, completed_fully, started_at, finished_at)
                   VALUES (?, ?, ?, ?, ?)""",
                ("routine", "in_progress", 1, "2026-01-01T00:00:00", None),
            )

    def test_set_target_reps_min_lte_max(self, db_conn):
        """target_reps_min must be <= target_reps_max."""
        # Create prerequisite chain: exercise -> routine -> day -> day_exercise
        db_conn.execute(
            "INSERT INTO exercises (name, type, is_archived) VALUES (?, ?, ?)",
            ("Bench", "reps_weight", 0),
        )
        db_conn.execute(
            "INSERT INTO routines (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("R", 0, "2026-01-01", "2026-01-01"),
        )
        db_conn.execute(
            "INSERT INTO routine_days (routine_id, label, name, sort_order) VALUES (?, ?, ?, ?)",
            (1, "A", "Push", 0),
        )
        db_conn.execute(
            """INSERT INTO routine_day_exercises
               (routine_day_id, exercise_id, sort_order, set_scheme, is_optional)
               VALUES (?, ?, ?, ?, ?)""",
            (1, 1, 0, "uniform", 0),
        )
        # Invalid: reps_min=12 > reps_max=8
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO exercise_set_targets
                   (routine_day_exercise_id, set_number, set_kind, target_reps_min, target_reps_max)
                   VALUES (?, ?, ?, ?, ?)""",
                (1, 1, "reps_weight", 12, 8),
            )

    def test_cascade_delete_routine_removes_days(self, db_conn):
        db_conn.execute(
            "INSERT INTO routines (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("R", 0, "2026-01-01", "2026-01-01"),
        )
        db_conn.execute(
            "INSERT INTO routine_days (routine_id, label, name, sort_order) VALUES (?, ?, ?, ?)",
            (1, "A", "Push", 0),
        )
        db_conn.execute("DELETE FROM routines WHERE id = 1")
        row = db_conn.execute("SELECT COUNT(*) as cnt FROM routine_days").fetchone()
        assert row["cnt"] == 0

    def test_set_null_on_routine_delete_preserves_session(self, db_conn):
        db_conn.execute(
            "INSERT INTO routines (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("R", 0, "2026-01-01", "2026-01-01"),
        )
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_id, session_type, status, completed_fully, started_at, finished_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (1, "routine", "finished", 1, "2026-01-01T00:00:00", "2026-01-01T01:00:00"),
        )
        db_conn.execute("DELETE FROM routines WHERE id = 1")
        session = db_conn.execute("SELECT * FROM workout_sessions WHERE id = 1").fetchone()
        assert session is not None
        assert session["routine_id"] is None
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_db_schema.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/ tests/test_db_schema.py
git commit -m "feat: database schema with all tables and constraints"
```

---

## Task 4: Base Repository

**Files:**
- Create: `src/repositories/base.py`

No dedicated test file — base repo is tested implicitly through all repo tests.

- [ ] **Step 1: Create `src/repositories/base.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add src/repositories/base.py
git commit -m "feat: base repository with common DB operations"
```

---

## Task 5: Exercise Repo + Service

**Files:**
- Create: `src/repositories/exercise_repo.py`, `src/services/exercise_service.py`
- Create: `tests/test_exercise_service.py`
- Modify: `tests/conftest.py` (add exercise fixtures)

- [ ] **Step 1: Write `tests/test_exercise_service.py`**

```python
import pytest
from src.models.exercise import ExerciseType


class TestExerciseService:
    def test_create_exercise(self, exercise_service):
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        assert ex.id is not None
        assert ex.name == "Bench Press"
        assert ex.type == ExerciseType.REPS_WEIGHT
        assert ex.is_archived is False

    def test_create_with_details(self, exercise_service):
        ex = exercise_service.create_exercise(
            "Bench Press", ExerciseType.REPS_WEIGHT,
            muscle_group="Chest", equipment="Barbell",
        )
        assert ex.muscle_group == "Chest"
        assert ex.equipment == "Barbell"

    def test_duplicate_name_rejected(self, exercise_service):
        exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        with pytest.raises(ValueError, match="already exists"):
            exercise_service.create_exercise("Bench Press", ExerciseType.REPS_ONLY)

    def test_duplicate_name_case_insensitive(self, exercise_service):
        exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        with pytest.raises(ValueError, match="already exists"):
            exercise_service.create_exercise("bench press", ExerciseType.REPS_WEIGHT)

    def test_get_exercise(self, exercise_service):
        created = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        fetched = exercise_service.get_exercise(created.id)
        assert fetched.name == "Bench Press"
        assert fetched.type == ExerciseType.REPS_WEIGHT

    def test_get_nonexistent_returns_none(self, exercise_service):
        assert exercise_service.get_exercise(999) is None

    def test_list_exercises(self, exercise_service):
        exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        exercise_service.create_exercise("Pull-ups", ExerciseType.REPS_ONLY)
        exercises = exercise_service.list_exercises()
        assert len(exercises) == 2

    def test_archive_hides_from_default_list(self, exercise_service):
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        exercise_service.archive_exercise(ex.id)
        assert len(exercise_service.list_exercises()) == 0
        assert len(exercise_service.list_exercises(include_archived=True)) == 1

    def test_unarchive(self, exercise_service):
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        exercise_service.archive_exercise(ex.id)
        exercise_service.unarchive_exercise(ex.id)
        assert len(exercise_service.list_exercises()) == 1

    def test_update_exercise_name(self, exercise_service):
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        ex.name = "Flat Bench Press"
        ex.muscle_group = "Chest"
        updated = exercise_service.update_exercise(ex)
        assert updated.name == "Flat Bench Press"
        assert updated.muscle_group == "Chest"

    def test_update_to_duplicate_name_rejected(self, exercise_service):
        exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        ex2 = exercise_service.create_exercise("Squat", ExerciseType.REPS_WEIGHT)
        ex2.name = "Bench Press"
        with pytest.raises(ValueError, match="already exists"):
            exercise_service.update_exercise(ex2)

    def test_update_same_name_allowed(self, exercise_service):
        """Updating an exercise without changing its name should not raise."""
        ex = exercise_service.create_exercise("Bench Press", ExerciseType.REPS_WEIGHT)
        ex.muscle_group = "Chest"
        updated = exercise_service.update_exercise(ex)
        assert updated.muscle_group == "Chest"
```

- [ ] **Step 2: Add exercise fixtures to `tests/conftest.py`**

Append to the existing conftest:

```python
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
```

- [ ] **Step 3: Create `src/repositories/exercise_repo.py`**

```python
"""Exercise repository — CRUD and archiving."""
from typing import List, Optional
from src.models.exercise import Exercise, ExerciseType
from src.repositories.base import BaseRepository


class ExerciseRepo(BaseRepository):

    def create(self, exercise: Exercise) -> int:
        return self._insert(
            """INSERT INTO exercises (name, type, muscle_group, equipment, is_archived)
               VALUES (?, ?, ?, ?, ?)""",
            (exercise.name, exercise.type.value, exercise.muscle_group,
             exercise.equipment, int(exercise.is_archived)),
        )

    def get_by_id(self, exercise_id: int) -> Optional[Exercise]:
        row = self._fetchone("SELECT * FROM exercises WHERE id = ?", (exercise_id,))
        return self._to_model(row) if row else None

    def get_by_name(self, name: str) -> Optional[Exercise]:
        row = self._fetchone("SELECT * FROM exercises WHERE name = ?", (name,))
        return self._to_model(row) if row else None

    def get_by_name_insensitive(self, name: str) -> Optional[Exercise]:
        row = self._fetchone(
            "SELECT * FROM exercises WHERE LOWER(name) = LOWER(?)", (name,)
        )
        return self._to_model(row) if row else None

    def list_all(self, include_archived: bool = False) -> List[Exercise]:
        if include_archived:
            rows = self._fetchall("SELECT * FROM exercises ORDER BY name")
        else:
            rows = self._fetchall(
                "SELECT * FROM exercises WHERE is_archived = 0 ORDER BY name"
            )
        return [self._to_model(r) for r in rows]

    def update(self, exercise: Exercise) -> None:
        self._execute(
            """UPDATE exercises SET name = ?, type = ?, muscle_group = ?,
               equipment = ?, is_archived = ? WHERE id = ?""",
            (exercise.name, exercise.type.value, exercise.muscle_group,
             exercise.equipment, int(exercise.is_archived), exercise.id),
        )

    def archive(self, exercise_id: int) -> None:
        self._execute(
            "UPDATE exercises SET is_archived = 1 WHERE id = ?", (exercise_id,)
        )

    def unarchive(self, exercise_id: int) -> None:
        self._execute(
            "UPDATE exercises SET is_archived = 0 WHERE id = ?", (exercise_id,)
        )

    def _to_model(self, row) -> Exercise:
        return Exercise(
            id=row["id"],
            name=row["name"],
            type=ExerciseType(row["type"]),
            muscle_group=row["muscle_group"],
            equipment=row["equipment"],
            is_archived=bool(row["is_archived"]),
        )
```

- [ ] **Step 4: Create `src/services/exercise_service.py`**

```python
"""Exercise service — CRUD with validation."""
from typing import List, Optional
from src.models.exercise import Exercise, ExerciseType
from src.repositories.exercise_repo import ExerciseRepo


class ExerciseService:
    def __init__(self, exercise_repo: ExerciseRepo):
        self._repo = exercise_repo

    def create_exercise(
        self,
        name: str,
        type: ExerciseType,
        muscle_group: Optional[str] = None,
        equipment: Optional[str] = None,
    ) -> Exercise:
        existing = self._repo.get_by_name_insensitive(name)
        if existing:
            raise ValueError(f"Exercise '{existing.name}' already exists")

        exercise = Exercise(
            id=None, name=name, type=type,
            muscle_group=muscle_group, equipment=equipment,
        )
        exercise.id = self._repo.create(exercise)
        self._repo.commit()
        return exercise

    def get_exercise(self, exercise_id: int) -> Optional[Exercise]:
        return self._repo.get_by_id(exercise_id)

    def list_exercises(self, include_archived: bool = False) -> List[Exercise]:
        return self._repo.list_all(include_archived)

    def update_exercise(self, exercise: Exercise) -> Exercise:
        if not exercise.id:
            raise ValueError("Exercise must have an id for update")
        existing = self._repo.get_by_id(exercise.id)
        if not existing:
            raise ValueError(f"Exercise {exercise.id} not found")
        if exercise.name != existing.name:
            dup = self._repo.get_by_name_insensitive(exercise.name)
            if dup and dup.id != exercise.id:
                raise ValueError(f"Exercise '{dup.name}' already exists")
        self._repo.update(exercise)
        self._repo.commit()
        return exercise

    def archive_exercise(self, exercise_id: int) -> None:
        self._repo.archive(exercise_id)
        self._repo.commit()

    def unarchive_exercise(self, exercise_id: int) -> None:
        self._repo.unarchive(exercise_id)
        self._repo.commit()
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/test_exercise_service.py -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/exercise_repo.py src/services/exercise_service.py tests/test_exercise_service.py tests/conftest.py
git commit -m "feat: exercise repo and service with CRUD, archiving, duplicate name validation"
```

---

## Task 6: Routine Repo + Cycle Repo + Cycle Service

**Files:**
- Create: `src/repositories/routine_repo.py`, `src/repositories/cycle_repo.py`, `src/services/cycle_service.py`
- Create: `tests/test_cycle_service.py`
- Modify: `tests/conftest.py` (add routine_repo, cycle_repo, cycle_service fixtures)

The routine repo is built here because cycle_service depends on it for `get_days()`. The routine repo is tested more thoroughly through routine_service in Tasks 7-8.

- [ ] **Step 1: Write `tests/test_cycle_service.py`**

```python
import pytest
from src.models.exercise import ExerciseType
from src.models.routine import Routine, RoutineDay


class TestCycleService:
    """Tests for cycle advance, wrap-around, delete-current-day, cross-routine validation."""

    def _make_routine_with_days(self, routine_repo, db_conn, name, labels):
        """Helper: create a routine with days directly via repo."""
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        routine_id = routine_repo.create_routine(
            Routine(id=None, name=name, is_active=False, created_at=now, updated_at=now)
        )
        days = []
        for i, (label, day_name) in enumerate(labels):
            day_id = routine_repo.add_day(
                RoutineDay(id=None, routine_id=routine_id, label=label, name=day_name, sort_order=i)
            )
            days.append(routine_repo.get_day(day_id))
        db_conn.commit()
        return routine_repo.get_routine(routine_id), days

    def test_initialize_sets_first_day(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[0].id

    def test_initialize_empty_routine(self, cycle_service, routine_repo, db_conn):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        routine_id = routine_repo.create_routine(
            Routine(id=None, name="Empty", is_active=False, created_at=now, updated_at=now)
        )
        db_conn.commit()
        cycle_service.initialize(routine_id)
        assert cycle_service.get_current_day(routine_id) is None

    def test_advance_to_next(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        next_day = cycle_service.advance(r.id)
        assert next_day.id == days[1].id

    def test_advance_wraps_around(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull")])
        cycle_service.initialize(r.id)
        cycle_service.advance(r.id)  # A -> B
        next_day = cycle_service.advance(r.id)  # B -> A (wrap)
        assert next_day.id == days[0].id

    def test_advance_single_day_stays(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Only")])
        cycle_service.initialize(r.id)
        next_day = cycle_service.advance(r.id)
        assert next_day.id == days[0].id

    def test_set_day_manual_override(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        cycle_service.set_day(r.id, days[2].id)
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[2].id

    def test_set_day_wrong_routine_raises(self, cycle_service, routine_repo, db_conn):
        r1, days1 = self._make_routine_with_days(routine_repo, db_conn, "R1", [("A", "Push")])
        r2, days2 = self._make_routine_with_days(routine_repo, db_conn, "R2", [("X", "Pull")])
        with pytest.raises(ValueError, match="does not belong"):
            cycle_service.set_day(r1.id, days2[0].id)

    def test_handle_day_deleted_current_picks_next(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        cycle_service.set_day(r.id, days[1].id)  # Current = B
        cycle_service.handle_day_deleted(r.id, days[1].id)  # B about to be deleted
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[2].id  # Picked C (next by sort_order)

    def test_handle_day_deleted_last_wraps_to_first(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        cycle_service.set_day(r.id, days[2].id)  # Current = C
        cycle_service.handle_day_deleted(r.id, days[2].id)  # C about to be deleted
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[0].id  # Wrapped to A

    def test_handle_day_deleted_all_gone_clears_state(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Only")])
        cycle_service.initialize(r.id)
        cycle_service.handle_day_deleted(r.id, days[0].id)
        assert cycle_service.get_current_day(r.id) is None

    def test_handle_day_deleted_not_current_no_change(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)  # Current = A
        cycle_service.handle_day_deleted(r.id, days[2].id)  # Delete C (not current)
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[0].id  # Still A

    def test_advance_after_manual_set(self, cycle_service, routine_repo, db_conn):
        """After manual override to C, advance goes to next after C."""
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        cycle_service.set_day(r.id, days[1].id)  # Manual set to B
        next_day = cycle_service.advance(r.id)  # Should go to C
        assert next_day.id == days[2].id
```

- [ ] **Step 2: Add fixtures to `tests/conftest.py`**

Append:

```python
from src.repositories.routine_repo import RoutineRepo
from src.repositories.cycle_repo import CycleRepo
from src.services.cycle_service import CycleService


@pytest.fixture
def routine_repo(db_conn):
    return RoutineRepo(db_conn)


@pytest.fixture
def cycle_repo(db_conn):
    return CycleRepo(db_conn)


@pytest.fixture
def cycle_service(cycle_repo, routine_repo):
    return CycleService(cycle_repo, routine_repo)
```

- [ ] **Step 3: Create `src/repositories/cycle_repo.py`**

```python
"""Cycle state repository — tracks current day per routine."""
from typing import Optional
from src.repositories.base import BaseRepository


class CycleRepo(BaseRepository):

    def get_current_day_id(self, routine_id: int) -> Optional[int]:
        row = self._fetchone(
            "SELECT current_routine_day_id FROM routine_cycle_state WHERE routine_id = ?",
            (routine_id,),
        )
        return row["current_routine_day_id"] if row else None

    def set_current_day(self, routine_id: int, day_id: int) -> None:
        self._execute(
            """INSERT INTO routine_cycle_state (routine_id, current_routine_day_id)
               VALUES (?, ?)
               ON CONFLICT(routine_id) DO UPDATE SET current_routine_day_id = ?""",
            (routine_id, day_id, day_id),
        )

    def delete_state(self, routine_id: int) -> None:
        self._execute(
            "DELETE FROM routine_cycle_state WHERE routine_id = ?", (routine_id,)
        )
```

- [ ] **Step 4: Create `src/repositories/routine_repo.py`**

```python
"""Routine repository — routines, days, day exercises, set targets."""
from typing import List, Optional
from src.models.routine import (
    Routine, RoutineDay, RoutineDayExercise, SetTarget, SetScheme, SetKind,
)
from src.repositories.base import BaseRepository


class RoutineRepo(BaseRepository):

    # --- Routines ---

    def create_routine(self, routine: Routine) -> int:
        return self._insert(
            """INSERT INTO routines (name, is_active, created_at, updated_at)
               VALUES (?, ?, ?, ?)""",
            (routine.name, int(routine.is_active), routine.created_at, routine.updated_at),
        )

    def get_routine(self, routine_id: int) -> Optional[Routine]:
        row = self._fetchone("SELECT * FROM routines WHERE id = ?", (routine_id,))
        return self._to_routine(row) if row else None

    def list_routines(self) -> List[Routine]:
        rows = self._fetchall("SELECT * FROM routines ORDER BY created_at DESC")
        return [self._to_routine(r) for r in rows]

    def get_active_routine(self) -> Optional[Routine]:
        row = self._fetchone("SELECT * FROM routines WHERE is_active = 1")
        return self._to_routine(row) if row else None

    def update_routine(self, routine: Routine) -> None:
        self._execute(
            "UPDATE routines SET name = ?, is_active = ?, updated_at = ? WHERE id = ?",
            (routine.name, int(routine.is_active), routine.updated_at, routine.id),
        )

    def delete_routine(self, routine_id: int) -> None:
        self._execute("DELETE FROM routines WHERE id = ?", (routine_id,))

    # --- Days ---

    def add_day(self, day: RoutineDay) -> int:
        return self._insert(
            """INSERT INTO routine_days (routine_id, label, name, sort_order)
               VALUES (?, ?, ?, ?)""",
            (day.routine_id, day.label, day.name, day.sort_order),
        )

    def get_day(self, day_id: int) -> Optional[RoutineDay]:
        row = self._fetchone("SELECT * FROM routine_days WHERE id = ?", (day_id,))
        return self._to_day(row) if row else None

    def get_days(self, routine_id: int) -> List[RoutineDay]:
        rows = self._fetchall(
            "SELECT * FROM routine_days WHERE routine_id = ? ORDER BY sort_order",
            (routine_id,),
        )
        return [self._to_day(r) for r in rows]

    def get_day_count(self, routine_id: int) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM routine_days WHERE routine_id = ?",
            (routine_id,),
        )
        return row["cnt"] if row else 0

    def update_day(self, day: RoutineDay) -> None:
        self._execute(
            "UPDATE routine_days SET label = ?, name = ?, sort_order = ? WHERE id = ?",
            (day.label, day.name, day.sort_order, day.id),
        )

    def delete_day(self, day_id: int) -> None:
        """Delete day and resequence remaining siblings."""
        day = self.get_day(day_id)
        if not day:
            return
        self._execute("DELETE FROM routine_days WHERE id = ?", (day_id,))
        self._execute(
            "UPDATE routine_days SET sort_order = sort_order - 1 WHERE routine_id = ? AND sort_order > ?",
            (day.routine_id, day.sort_order),
        )

    def reorder_days(self, routine_id: int, day_ids: List[int]) -> None:
        """Reorder days. day_ids must contain all day IDs for this routine."""
        # Move all to negative space to avoid UNIQUE conflicts mid-update
        self._execute(
            "UPDATE routine_days SET sort_order = -(sort_order + 1000) WHERE routine_id = ?",
            (routine_id,),
        )
        for new_order, day_id in enumerate(day_ids):
            self._execute(
                "UPDATE routine_days SET sort_order = ? WHERE id = ?",
                (new_order, day_id),
            )

    # --- Day Exercises ---

    def add_day_exercise(self, rde: RoutineDayExercise) -> int:
        return self._insert(
            """INSERT INTO routine_day_exercises
               (routine_day_id, exercise_id, sort_order, set_scheme, notes, is_optional)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (rde.routine_day_id, rde.exercise_id, rde.sort_order,
             rde.set_scheme.value, rde.notes, int(rde.is_optional)),
        )

    def get_day_exercise(self, rde_id: int) -> Optional[RoutineDayExercise]:
        row = self._fetchone(
            "SELECT * FROM routine_day_exercises WHERE id = ?", (rde_id,)
        )
        return self._to_day_exercise(row) if row else None

    def get_day_exercises(self, day_id: int) -> List[RoutineDayExercise]:
        rows = self._fetchall(
            "SELECT * FROM routine_day_exercises WHERE routine_day_id = ? ORDER BY sort_order",
            (day_id,),
        )
        return [self._to_day_exercise(r) for r in rows]

    def get_day_exercise_count(self, day_id: int) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM routine_day_exercises WHERE routine_day_id = ?",
            (day_id,),
        )
        return row["cnt"] if row else 0

    def delete_day_exercise(self, rde_id: int) -> None:
        """Delete day exercise and resequence remaining siblings."""
        rde = self.get_day_exercise(rde_id)
        if not rde:
            return
        self._execute("DELETE FROM routine_day_exercises WHERE id = ?", (rde_id,))
        self._execute(
            "UPDATE routine_day_exercises SET sort_order = sort_order - 1 WHERE routine_day_id = ? AND sort_order > ?",
            (rde.routine_day_id, rde.sort_order),
        )

    def reorder_day_exercises(self, day_id: int, rde_ids: List[int]) -> None:
        self._execute(
            "UPDATE routine_day_exercises SET sort_order = -(sort_order + 1000) WHERE routine_day_id = ?",
            (day_id,),
        )
        for new_order, rde_id in enumerate(rde_ids):
            self._execute(
                "UPDATE routine_day_exercises SET sort_order = ? WHERE id = ?",
                (new_order, rde_id),
            )

    # --- Set Targets ---

    def set_targets(self, rde_id: int, targets: List[SetTarget]) -> List[int]:
        """Replace all targets for a day exercise. Returns new IDs."""
        self._execute(
            "DELETE FROM exercise_set_targets WHERE routine_day_exercise_id = ?",
            (rde_id,),
        )
        ids = []
        for target in targets:
            tid = self._insert(
                """INSERT INTO exercise_set_targets
                   (routine_day_exercise_id, set_number, set_kind,
                    target_reps_min, target_reps_max, target_weight,
                    target_duration_seconds, target_distance)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (rde_id, target.set_number, target.set_kind.value,
                 target.target_reps_min, target.target_reps_max, target.target_weight,
                 target.target_duration_seconds, target.target_distance),
            )
            ids.append(tid)
        return ids

    def get_targets(self, rde_id: int) -> List[SetTarget]:
        rows = self._fetchall(
            "SELECT * FROM exercise_set_targets WHERE routine_day_exercise_id = ? ORDER BY set_number",
            (rde_id,),
        )
        return [self._to_set_target(r) for r in rows]

    # --- Row converters ---

    def _to_routine(self, row) -> Routine:
        return Routine(
            id=row["id"], name=row["name"],
            is_active=bool(row["is_active"]),
            created_at=row["created_at"], updated_at=row["updated_at"],
        )

    def _to_day(self, row) -> RoutineDay:
        return RoutineDay(
            id=row["id"], routine_id=row["routine_id"],
            label=row["label"], name=row["name"], sort_order=row["sort_order"],
        )

    def _to_day_exercise(self, row) -> RoutineDayExercise:
        return RoutineDayExercise(
            id=row["id"], routine_day_id=row["routine_day_id"],
            exercise_id=row["exercise_id"], sort_order=row["sort_order"],
            set_scheme=SetScheme(row["set_scheme"]),
            notes=row["notes"], is_optional=bool(row["is_optional"]),
        )

    def _to_set_target(self, row) -> SetTarget:
        return SetTarget(
            id=row["id"],
            routine_day_exercise_id=row["routine_day_exercise_id"],
            set_number=row["set_number"],
            set_kind=SetKind(row["set_kind"]),
            target_reps_min=row["target_reps_min"],
            target_reps_max=row["target_reps_max"],
            target_weight=row["target_weight"],
            target_duration_seconds=row["target_duration_seconds"],
            target_distance=row["target_distance"],
        )
```

- [ ] **Step 5: Create `src/services/cycle_service.py`**

```python
"""Cycle service — manages routine day cycling."""
from typing import Optional
from src.models.routine import RoutineDay
from src.repositories.cycle_repo import CycleRepo
from src.repositories.routine_repo import RoutineRepo


class CycleService:
    """Manages routine day cycling.

    Note: CycleService methods write to the DB but do NOT commit.
    They are designed to be called within a larger transaction managed
    by the calling service (e.g., RoutineService, WorkoutService).
    The caller is responsible for committing.
    """

    def __init__(self, cycle_repo: CycleRepo, routine_repo: RoutineRepo):
        self._cycle_repo = cycle_repo
        self._routine_repo = routine_repo

    def initialize(self, routine_id: int) -> None:
        """Set cycle to first day by sort_order. Clears state if no days."""
        days = self._routine_repo.get_days(routine_id)
        if days:
            self._cycle_repo.set_current_day(routine_id, days[0].id)
        else:
            self._cycle_repo.delete_state(routine_id)

    def get_current_day(self, routine_id: int) -> Optional[RoutineDay]:
        day_id = self._cycle_repo.get_current_day_id(routine_id)
        if day_id is None:
            return None
        return self._routine_repo.get_day(day_id)

    def advance(self, routine_id: int) -> Optional[RoutineDay]:
        """Advance to next day by sort_order, wrap at end. Returns new current day."""
        current_day_id = self._cycle_repo.get_current_day_id(routine_id)
        days = self._routine_repo.get_days(routine_id)

        if not days:
            return None

        if current_day_id is None:
            self._cycle_repo.set_current_day(routine_id, days[0].id)
            return days[0]

        # Find current position
        current_idx = None
        for i, day in enumerate(days):
            if day.id == current_day_id:
                current_idx = i
                break

        if current_idx is None:
            # Current day no longer exists — reset to first
            self._cycle_repo.set_current_day(routine_id, days[0].id)
            return days[0]

        next_idx = (current_idx + 1) % len(days)
        next_day = days[next_idx]
        self._cycle_repo.set_current_day(routine_id, next_day.id)
        return next_day

    def set_day(self, routine_id: int, day_id: int) -> None:
        """Manual override. Validates day belongs to routine."""
        self._validate_day_belongs_to_routine(routine_id, day_id)
        self._cycle_repo.set_current_day(routine_id, day_id)

    def handle_day_deleted(self, routine_id: int, deleted_day_id: int) -> None:
        """Adjust cycle state when a day is about to be deleted.

        Call this BEFORE the actual delete so the day still exists for lookup.
        If deleted day is current: pick next by sort_order, or wrap to first.
        If deleted day is not current: no change.
        """
        current_day_id = self._cycle_repo.get_current_day_id(routine_id)
        if current_day_id != deleted_day_id:
            return

        days = self._routine_repo.get_days(routine_id)
        remaining = [d for d in days if d.id != deleted_day_id]

        if not remaining:
            self._cycle_repo.delete_state(routine_id)
            return

        deleted_day = next(d for d in days if d.id == deleted_day_id)
        after = [d for d in remaining if d.sort_order > deleted_day.sort_order]

        if after:
            self._cycle_repo.set_current_day(routine_id, after[0].id)
        else:
            self._cycle_repo.set_current_day(routine_id, remaining[0].id)

    def _validate_day_belongs_to_routine(self, routine_id: int, day_id: int) -> None:
        day = self._routine_repo.get_day(day_id)
        if not day or day.routine_id != routine_id:
            raise ValueError(f"Day {day_id} does not belong to routine {routine_id}")
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_cycle_service.py -v
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/routine_repo.py src/repositories/cycle_repo.py src/services/cycle_service.py tests/test_cycle_service.py tests/conftest.py
git commit -m "feat: routine repo, cycle repo, and cycle service with advance/wrap/delete logic"
```

---

## Task 7: Routine Service — Routines + Days

**Files:**
- Create: `src/services/routine_service.py`
- Create: `tests/test_routine_service.py`
- Modify: `tests/conftest.py` (add routine_service fixture)

- [ ] **Step 1: Write `tests/test_routine_service.py` (routines + days section)**

```python
import pytest
from src.models.exercise import ExerciseType
from src.models.routine import SetScheme, SetKind


class TestRoutineServiceRoutines:
    """Tests for routine CRUD and activation."""

    def test_create_routine(self, routine_service):
        r = routine_service.create_routine("PPL")
        assert r.id is not None
        assert r.name == "PPL"
        assert r.is_active is False

    def test_list_routines(self, routine_service):
        routine_service.create_routine("PPL")
        routine_service.create_routine("Upper/Lower")
        assert len(routine_service.list_routines()) == 2

    def test_get_routine(self, routine_service):
        r = routine_service.create_routine("PPL")
        fetched = routine_service.get_routine(r.id)
        assert fetched.name == "PPL"

    def test_activate_routine(self, routine_service):
        r = routine_service.create_routine("PPL")
        routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)
        active = routine_service.get_active_routine()
        assert active.id == r.id
        assert active.is_active is True

    def test_activate_deactivates_previous(self, routine_service):
        r1 = routine_service.create_routine("PPL")
        routine_service.add_day(r1.id, "A", "Push")
        routine_service.activate_routine(r1.id)

        r2 = routine_service.create_routine("Upper/Lower")
        routine_service.add_day(r2.id, "A", "Upper")
        routine_service.activate_routine(r2.id)

        r1_updated = routine_service.get_routine(r1.id)
        assert r1_updated.is_active is False
        assert routine_service.get_active_routine().id == r2.id

    def test_activate_initializes_cycle(self, routine_service, cycle_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        routine_service.add_day(r.id, "B", "Pull")
        routine_service.activate_routine(r.id)
        current = cycle_service.get_current_day(r.id)
        assert current.id == d1.id

    def test_deactivate_routine(self, routine_service):
        r = routine_service.create_routine("PPL")
        routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)
        routine_service.deactivate_routine(r.id)
        assert routine_service.get_active_routine() is None

    def test_delete_routine_cascades(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        routine_service.delete_routine(r.id)
        assert routine_service.get_routine(r.id) is None


class TestRoutineServiceDays:
    """Tests for day management and reordering."""

    def test_add_day(self, routine_service):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        assert day.id is not None
        assert day.label == "A"
        assert day.name == "Push"
        assert day.sort_order == 0

    def test_add_days_auto_sort_order(self, routine_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        d3 = routine_service.add_day(r.id, "C", "Legs")
        assert d1.sort_order == 0
        assert d2.sort_order == 1
        assert d3.sort_order == 2

    def test_update_day(self, routine_service):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        updated = routine_service.update_day(day.id, name="Chest & Triceps")
        assert updated.name == "Chest & Triceps"
        assert updated.label == "A"

    def test_delete_day_resequences(self, routine_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        d3 = routine_service.add_day(r.id, "C", "Legs")

        routine_service.delete_day(d2.id)

        days = routine_service.get_days(r.id)
        assert len(days) == 2
        assert days[0].label == "A"
        assert days[0].sort_order == 0
        assert days[1].label == "C"
        assert days[1].sort_order == 1

    def test_delete_first_day_resequences(self, routine_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")

        routine_service.delete_day(d1.id)

        days = routine_service.get_days(r.id)
        assert len(days) == 1
        assert days[0].label == "B"
        assert days[0].sort_order == 0

    def test_delete_current_cycle_day_adjusts_cycle(self, routine_service, cycle_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        d3 = routine_service.add_day(r.id, "C", "Legs")
        routine_service.activate_routine(r.id)

        cycle_service.set_day(r.id, d2.id)  # Current = B
        routine_service.delete_day(d2.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d3.id  # Should pick C

    def test_reorder_days(self, routine_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        d3 = routine_service.add_day(r.id, "C", "Legs")

        routine_service.reorder_days(r.id, [d3.id, d1.id, d2.id])

        days = routine_service.get_days(r.id)
        assert days[0].label == "C"
        assert days[0].sort_order == 0
        assert days[1].label == "A"
        assert days[1].sort_order == 1
        assert days[2].label == "B"
        assert days[2].sort_order == 2

    def test_add_day_updates_routine_timestamp(self, routine_service):
        r = routine_service.create_routine("PPL")
        original_updated = r.updated_at
        routine_service.add_day(r.id, "A", "Push")
        updated_r = routine_service.get_routine(r.id)
        assert updated_r.updated_at >= original_updated
```

- [ ] **Step 2: Add routine_service fixture to `tests/conftest.py`**

Append:

```python
from src.services.routine_service import RoutineService


@pytest.fixture
def routine_service(routine_repo, exercise_repo, cycle_service):
    return RoutineService(routine_repo, exercise_repo, cycle_service)
```

- [ ] **Step 3: Create `src/services/routine_service.py` (routines + days)**

```python
"""Routine service — routine management, set schemes, validation."""
from datetime import datetime, timezone
from typing import List, Optional
from src.models.exercise import ExerciseType
from src.models.routine import (
    Routine, RoutineDay, RoutineDayExercise, SetTarget, SetScheme, SetKind,
)
from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.routine_repo import RoutineRepo
from src.services.cycle_service import CycleService


# Compatibility matrix: exercise_type -> allowed set_kinds
COMPATIBLE_SET_KINDS = {
    ExerciseType.REPS_WEIGHT: {SetKind.REPS_WEIGHT, SetKind.AMRAP},
    ExerciseType.REPS_ONLY: {SetKind.REPS_ONLY, SetKind.AMRAP},
    ExerciseType.TIME: {SetKind.DURATION},
    ExerciseType.CARDIO: {SetKind.CARDIO},
}


class RoutineService:
    def __init__(self, routine_repo: RoutineRepo, exercise_repo: ExerciseRepo, cycle_service: CycleService):
        self._repo = routine_repo
        self._exercise_repo = exercise_repo
        self._cycle_service = cycle_service

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # --- Routines ---

    def create_routine(self, name: str) -> Routine:
        now = self._now()
        routine = Routine(id=None, name=name, is_active=False, created_at=now, updated_at=now)
        routine.id = self._repo.create_routine(routine)
        self._repo.commit()
        return routine

    def get_routine(self, routine_id: int) -> Optional[Routine]:
        return self._repo.get_routine(routine_id)

    def list_routines(self) -> List[Routine]:
        return self._repo.list_routines()

    def get_active_routine(self) -> Optional[Routine]:
        return self._repo.get_active_routine()

    def activate_routine(self, routine_id: int) -> None:
        routine = self._repo.get_routine(routine_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found")

        current = self._repo.get_active_routine()
        if current and current.id != routine_id:
            current.is_active = False
            current.updated_at = self._now()
            self._repo.update_routine(current)

        routine.is_active = True
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._cycle_service.initialize(routine_id)
        self._repo.commit()

    def deactivate_routine(self, routine_id: int) -> None:
        routine = self._repo.get_routine(routine_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found")
        routine.is_active = False
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()

    def delete_routine(self, routine_id: int) -> None:
        self._repo.delete_routine(routine_id)
        self._repo.commit()

    # --- Days ---

    def add_day(self, routine_id: int, label: str, name: str) -> RoutineDay:
        routine = self._repo.get_routine(routine_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found")

        sort_order = self._repo.get_day_count(routine_id)
        day = RoutineDay(id=None, routine_id=routine_id, label=label, name=name, sort_order=sort_order)
        day.id = self._repo.add_day(day)

        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return day

    def update_day(self, day_id: int, label: Optional[str] = None, name: Optional[str] = None) -> RoutineDay:
        day = self._repo.get_day(day_id)
        if not day:
            raise ValueError(f"Day {day_id} not found")
        if label is not None:
            day.label = label
        if name is not None:
            day.name = name
        self._repo.update_day(day)

        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return day

    def delete_day(self, day_id: int) -> None:
        day = self._repo.get_day(day_id)
        if not day:
            raise ValueError(f"Day {day_id} not found")

        # Adjust cycle state BEFORE delete (FK would block otherwise)
        self._cycle_service.handle_day_deleted(day.routine_id, day_id)

        self._repo.delete_day(day_id)

        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()

    def reorder_days(self, routine_id: int, day_ids: List[int]) -> None:
        self._repo.reorder_days(routine_id, day_ids)
        routine = self._repo.get_routine(routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()

    def get_days(self, routine_id: int) -> List[RoutineDay]:
        return self._repo.get_days(routine_id)

    # --- Day Exercises (implemented in Task 8) ---

    def add_exercise_to_day(self, day_id: int, exercise_id: int, set_scheme: SetScheme,
                            notes: Optional[str] = None, is_optional: bool = False) -> RoutineDayExercise:
        day = self._repo.get_day(day_id)
        if not day:
            raise ValueError(f"Day {day_id} not found")
        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            raise ValueError(f"Exercise {exercise_id} not found")

        sort_order = self._repo.get_day_exercise_count(day_id)
        rde = RoutineDayExercise(
            id=None, routine_day_id=day_id, exercise_id=exercise_id,
            sort_order=sort_order, set_scheme=set_scheme,
            notes=notes, is_optional=is_optional,
        )
        rde.id = self._repo.add_day_exercise(rde)

        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return rde

    def remove_exercise_from_day(self, rde_id: int) -> None:
        rde = self._repo.get_day_exercise(rde_id)
        if not rde:
            raise ValueError(f"Day exercise {rde_id} not found")
        day = self._repo.get_day(rde.routine_day_id)
        self._repo.delete_day_exercise(rde_id)

        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()

    def get_day_exercises(self, day_id: int) -> List[RoutineDayExercise]:
        return self._repo.get_day_exercises(day_id)

    # --- Set Targets ---

    def set_uniform_targets(
        self, rde_id: int, num_sets: int, set_kind: SetKind,
        reps_min: Optional[int] = None, reps_max: Optional[int] = None,
        weight: Optional[float] = None,
        duration_seconds: Optional[int] = None, distance: Optional[float] = None,
    ) -> List[SetTarget]:
        rde = self._repo.get_day_exercise(rde_id)
        if not rde:
            raise ValueError(f"Day exercise {rde_id} not found")
        exercise = self._exercise_repo.get_by_id(rde.exercise_id)
        self._validate_set_kind(set_kind, exercise.type)
        self._validate_cardio_fields(set_kind, duration_seconds, distance)
        self._validate_amrap_fields(set_kind, exercise.type, weight)

        targets = [
            SetTarget(
                id=None, routine_day_exercise_id=rde_id,
                set_number=i + 1, set_kind=set_kind,
                target_reps_min=reps_min, target_reps_max=reps_max,
                target_weight=weight,
                target_duration_seconds=duration_seconds, target_distance=distance,
            )
            for i in range(num_sets)
        ]
        self._repo.set_targets(rde_id, targets)

        day = self._repo.get_day(rde.routine_day_id)
        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return self._repo.get_targets(rde_id)

    def set_progressive_targets(self, rde_id: int, targets_data: List[dict]) -> List[SetTarget]:
        """Set progressive targets from a list of dicts.

        Each dict may contain: set_kind, reps_min, reps_max, weight,
        duration_seconds, distance.
        """
        rde = self._repo.get_day_exercise(rde_id)
        if not rde:
            raise ValueError(f"Day exercise {rde_id} not found")
        exercise = self._exercise_repo.get_by_id(rde.exercise_id)

        targets = []
        for i, data in enumerate(targets_data):
            sk = data.get("set_kind")
            if sk is not None and not isinstance(sk, SetKind):
                sk = SetKind(sk)
            elif sk is None:
                raise ValueError(f"set_kind is required for set {i + 1}")
            self._validate_set_kind(sk, exercise.type)
            self._validate_cardio_fields(sk, data.get("duration_seconds"), data.get("distance"))
            self._validate_amrap_fields(sk, exercise.type, data.get("weight"))

            targets.append(SetTarget(
                id=None, routine_day_exercise_id=rde_id,
                set_number=i + 1, set_kind=sk,
                target_reps_min=data.get("reps_min"),
                target_reps_max=data.get("reps_max"),
                target_weight=data.get("weight"),
                target_duration_seconds=data.get("duration_seconds"),
                target_distance=data.get("distance"),
            ))

        self._repo.set_targets(rde_id, targets)

        day = self._repo.get_day(rde.routine_day_id)
        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
        return self._repo.get_targets(rde_id)

    def get_targets(self, rde_id: int) -> List[SetTarget]:
        return self._repo.get_targets(rde_id)

    # --- Validation ---

    @staticmethod
    def _validate_set_kind(set_kind: SetKind, exercise_type: ExerciseType) -> None:
        allowed = COMPATIBLE_SET_KINDS.get(exercise_type, set())
        if set_kind not in allowed:
            raise ValueError(
                f"Set kind '{set_kind.value}' is not compatible with "
                f"exercise type '{exercise_type.value}'"
            )

    @staticmethod
    def _validate_cardio_fields(set_kind: SetKind, duration_seconds: Optional[int], distance: Optional[float]) -> None:
        if set_kind == SetKind.CARDIO and duration_seconds is None and distance is None:
            raise ValueError("Cardio sets require at least one of duration_seconds or distance")

    @staticmethod
    def _validate_amrap_fields(set_kind: SetKind, exercise_type: ExerciseType, weight: Optional[float]) -> None:
        if set_kind != SetKind.AMRAP:
            return
        if exercise_type == ExerciseType.REPS_WEIGHT and weight is None:
            raise ValueError("AMRAP sets for reps_weight exercises require a weight")
        if exercise_type == ExerciseType.REPS_ONLY and weight is not None:
            raise ValueError("AMRAP sets for reps_only exercises must not have a weight (bodyweight)")
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_routine_service.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/routine_service.py tests/test_routine_service.py tests/conftest.py
git commit -m "feat: routine service with CRUD, activation, day management, cycle integration"
```

---

## Task 8: Routine Service — Day Exercises + Set Targets Tests

**Files:**
- Modify: `tests/test_routine_service.py` (add exercise and target tests)

This task adds tests for the day exercise and set target functionality already implemented in Task 7's routine_service.py.

- [ ] **Step 1: Append to `tests/test_routine_service.py`**

```python
class TestRoutineServiceExercises:
    """Tests for adding/removing exercises on days."""

    def test_add_exercise_to_day(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")

        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        assert rde.id is not None
        assert rde.sort_order == 0
        assert rde.set_scheme == SetScheme.UNIFORM

    def test_add_exercises_auto_sort_order(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex1 = make_exercise("Bench Press")
        ex2 = make_exercise("Shoulder Press")

        rde1 = routine_service.add_exercise_to_day(day.id, ex1.id, SetScheme.UNIFORM)
        rde2 = routine_service.add_exercise_to_day(day.id, ex2.id, SetScheme.UNIFORM)
        assert rde1.sort_order == 0
        assert rde2.sort_order == 1

    def test_remove_exercise_resequences(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex1 = make_exercise("Bench Press")
        ex2 = make_exercise("Shoulder Press")
        ex3 = make_exercise("Tricep Pushdown")

        rde1 = routine_service.add_exercise_to_day(day.id, ex1.id, SetScheme.UNIFORM)
        rde2 = routine_service.add_exercise_to_day(day.id, ex2.id, SetScheme.UNIFORM)
        rde3 = routine_service.add_exercise_to_day(day.id, ex3.id, SetScheme.UNIFORM)

        routine_service.remove_exercise_from_day(rde2.id)

        exercises = routine_service.get_day_exercises(day.id)
        assert len(exercises) == 2
        assert exercises[0].exercise_id == ex1.id
        assert exercises[0].sort_order == 0
        assert exercises[1].exercise_id == ex3.id
        assert exercises[1].sort_order == 1

    def test_add_exercise_with_notes_and_optional(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Lateral Raise")

        rde = routine_service.add_exercise_to_day(
            day.id, ex.id, SetScheme.UNIFORM,
            notes="slow eccentric", is_optional=True,
        )
        assert rde.notes == "slow eccentric"
        assert rde.is_optional is True


class TestRoutineServiceSetTargets:
    """Tests for uniform/progressive set targets and validation."""

    def test_uniform_targets(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, num_sets=4, set_kind=SetKind.REPS_WEIGHT,
            reps_min=10, reps_max=10, weight=135.0,
        )
        assert len(targets) == 4
        for i, t in enumerate(targets):
            assert t.set_number == i + 1
            assert t.target_reps_min == 10
            assert t.target_reps_max == 10
            assert t.target_weight == 135.0

    def test_uniform_targets_with_rep_range(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Lat Pulldown")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, num_sets=3, set_kind=SetKind.REPS_WEIGHT,
            reps_min=8, reps_max=12, weight=100.0,
        )
        assert targets[0].target_reps_min == 8
        assert targets[0].target_reps_max == 12

    def test_progressive_targets(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Incline DB Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        targets = routine_service.set_progressive_targets(rde.id, [
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 12, "reps_max": 12, "weight": 50.0},
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 8, "reps_max": 8, "weight": 60.0},
            {"set_kind": SetKind.AMRAP, "weight": 70.0},
        ])
        assert len(targets) == 3
        assert targets[0].target_reps_min == 12
        assert targets[0].target_weight == 50.0
        assert targets[2].set_kind == SetKind.AMRAP
        assert targets[2].target_weight == 70.0

    def test_set_kind_incompatible_rejected(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press", type=ExerciseType.REPS_WEIGHT)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        with pytest.raises(ValueError, match="not compatible"):
            routine_service.set_uniform_targets(rde.id, 3, SetKind.DURATION, duration_seconds=60)

    def test_reps_only_rejects_reps_weight_kind(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Pull")
        ex = make_exercise("Pull-ups", type=ExerciseType.REPS_ONLY)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        with pytest.raises(ValueError, match="not compatible"):
            routine_service.set_uniform_targets(rde.id, 3, SetKind.REPS_WEIGHT, 10, 10, 135.0)

    def test_amrap_with_reps_weight(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press", type=ExerciseType.REPS_WEIGHT)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        targets = routine_service.set_progressive_targets(rde.id, [
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 10, "reps_max": 10, "weight": 135.0},
            {"set_kind": SetKind.AMRAP, "weight": 135.0},
        ])
        assert targets[1].set_kind == SetKind.AMRAP

    def test_amrap_with_reps_only_bodyweight(self, routine_service, make_exercise):
        """Bodyweight AMRAP: reps_only exercise, no weight."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Pull")
        ex = make_exercise("Pull-ups", type=ExerciseType.REPS_ONLY)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        targets = routine_service.set_progressive_targets(rde.id, [
            {"set_kind": SetKind.REPS_ONLY, "reps_min": 10, "reps_max": 10},
            {"set_kind": SetKind.AMRAP},
        ])
        assert targets[1].set_kind == SetKind.AMRAP
        assert targets[1].target_weight is None

    def test_cardio_with_duration_only(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Cardio")
        ex = make_exercise("Treadmill", type=ExerciseType.CARDIO)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, 1, SetKind.CARDIO, duration_seconds=1200,
        )
        assert targets[0].target_duration_seconds == 1200
        assert targets[0].target_distance is None

    def test_cardio_with_both_duration_and_distance(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Cardio")
        ex = make_exercise("Treadmill", type=ExerciseType.CARDIO)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, 1, SetKind.CARDIO, duration_seconds=1200, distance=5.0,
        )
        assert targets[0].target_duration_seconds == 1200
        assert targets[0].target_distance == 5.0

    def test_cardio_requires_duration_or_distance(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Cardio")
        ex = make_exercise("Treadmill", type=ExerciseType.CARDIO)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        with pytest.raises(ValueError, match="at least one"):
            routine_service.set_uniform_targets(rde.id, 1, SetKind.CARDIO)

    def test_replacing_targets_deletes_old(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        routine_service.set_uniform_targets(rde.id, 4, SetKind.REPS_WEIGHT, 10, 10, 135.0)
        assert len(routine_service.get_targets(rde.id)) == 4

        routine_service.set_uniform_targets(rde.id, 3, SetKind.REPS_WEIGHT, 8, 8, 145.0)
        targets = routine_service.get_targets(rde.id)
        assert len(targets) == 3
        assert targets[0].target_weight == 145.0

    def test_duration_targets_for_time_exercise(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Core")
        ex = make_exercise("Plank", type=ExerciseType.TIME)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, 3, SetKind.DURATION, duration_seconds=60,
        )
        assert len(targets) == 3
        assert targets[0].target_duration_seconds == 60

    def test_amrap_reps_weight_requires_weight(self, routine_service, make_exercise):
        """AMRAP on reps_weight exercise must have weight set."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press", type=ExerciseType.REPS_WEIGHT)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        with pytest.raises(ValueError, match="require a weight"):
            routine_service.set_progressive_targets(rde.id, [
                {"set_kind": SetKind.AMRAP},  # Missing weight
            ])

    def test_amrap_reps_only_rejects_weight(self, routine_service, make_exercise):
        """AMRAP on reps_only exercise must NOT have weight."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Pull")
        ex = make_exercise("Pull-ups", type=ExerciseType.REPS_ONLY)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        with pytest.raises(ValueError, match="must not have a weight"):
            routine_service.set_progressive_targets(rde.id, [
                {"set_kind": SetKind.AMRAP, "weight": 50.0},  # Weight on bodyweight exercise
            ])


class TestRoutineServiceCascade:
    """Tests for deletion cascade behavior."""

    def test_delete_routine_with_active_cycle_state(self, routine_service, cycle_service):
        """Deleting a routine with cycle state should cascade cleanly."""
        r = routine_service.create_routine("PPL")
        routine_service.add_day(r.id, "A", "Push")
        routine_service.add_day(r.id, "B", "Pull")
        routine_service.activate_routine(r.id)

        # Verify cycle state exists
        assert cycle_service.get_current_day(r.id) is not None

        # Delete should cascade without FK errors
        routine_service.delete_routine(r.id)
        assert routine_service.get_routine(r.id) is None
```

- [ ] **Step 2: Run all tests**

```bash
pytest tests/ -v
```

Expected: All tests across all files PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/test_routine_service.py
git commit -m "feat: routine service tests for day exercises, set targets, compatibility validation"
```

---

## Verification Checkpoint

After completing all 8 tasks, run the full test suite:

```bash
pytest tests/ -v --tb=short
```

**Expected result:** All tests pass. The following modules are implemented and tested:

| Module | Tests |
|--------|-------|
| DB schema | Table creation, CHECK constraints, FK cascades, lifecycle CHECK |
| Exercise service | CRUD, duplicate name, archive/unarchive |
| Cycle service | Initialize, advance, wrap, manual set, delete-current-day, cross-routine validation |
| Routine service | Routine CRUD, activation, day management, reorder, exercise management, uniform/progressive targets, set_kind compatibility, cardio validation |

---

## Future Plans

| Plan | Contents | Prerequisite |
|------|----------|-------------|
| **Phase 2** | WorkoutRepo+Service (session lifecycle, set logging, editing), BenchmarkRepo+Service (due calc, snapshots), StatsService (session counts, PRs, chart data), ImportExportService (validation, exercise matching, round-trip), SettingsRepo + unit conversion | This plan (Phase 1) |
| **Phase 3** | Kivy app shell, screen manager, bottom navigation, all screens (home, workout, dashboard, settings, routine editor, exercise catalog, benchmark), components (set logger, exercise card, chart widgets) | Phase 1 + Phase 2 |
