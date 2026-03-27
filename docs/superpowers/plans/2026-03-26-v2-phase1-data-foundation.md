# Phase 1: Data Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete data layer for Exercise Logger v2. Models, database schema, CSV/YAML loaders, in-memory registries, and repositories — all with full test coverage. No services, no screens, no UI.

**Architecture:**

```
Loaders → Registries (immutable, in-memory)
Repositories → SQLite (mutable user data)
```

Bundled data (exercises, routines, benchmarks) stays OUT of SQLite. Loaded from files at startup into read-only registries. SQLite stores only mutable user data: settings, workout sessions, logged sets, benchmark results.

**Tech Stack:** Python 3.10+, sqlite3 (stdlib), pytest, dataclasses, enums, PyYAML, csv (stdlib).

**Spec reference:** `docs/superpowers/specs/2026-03-26-exercise-logger-v2-simplified.md`

**Key design decisions:**
- This is a CLEAN BREAK rewrite. Fresh `src/` directory tree — no v1 code to modify.
- `exercise_key` is the stable identifier (not exercise name, not integer ID).
- Three exercise types only: `reps_weight`, `time`, `cardio`. No `reps_only`.
- Loader validation is FAIL-FAST — invalid data raises exceptions, never warn-and-ignore.
- Tests use in-memory SQLite (`:memory:`).

---

## File Map

All files created in this phase:

```
src/
├── __init__.py                          # Empty (already exists, will be cleared)
├── config.py                            # DB path, defaults
├── data/
│   ├── exercises.csv                    # Exercise catalog (derived from docs/exercises/)
│   ├── benchmarks.yaml                  # Benchmark config
│   └── routines/
│       └── push_pull_legs.yaml          # Sample routine template
├── db/
│   ├── __init__.py
│   ├── connection.py                    # create_connection(), create_memory_connection()
│   └── schema.py                        # 5 tables: settings, workout_sessions, session_exercises, logged_sets, benchmark_results
├── loaders/
│   ├── __init__.py
│   ├── exercise_loader.py              # load_exercises(csv_path) → list[Exercise]
│   ├── routine_loader.py              # load_routine(yaml_path, exercise_registry) → Routine
│   └── benchmark_loader.py            # load_benchmark_config(yaml_path, exercise_registry) → BenchmarkConfig
├── models/
│   ├── __init__.py
│   ├── enums.py                        # ExerciseType, SetScheme, BenchmarkMethod, SessionStatus
│   ├── bundled.py                      # Exercise, Routine, RoutineDay, DayExercise, BenchmarkConfig, BenchmarkItem
│   ├── workout.py                      # WorkoutSession, SessionExercise, LoggedSet
│   └── benchmark.py                    # BenchmarkResult
├── registries/
│   ├── __init__.py
│   ├── exercise_registry.py           # ExerciseRegistry
│   ├── routine_registry.py            # RoutineRegistry
│   └── benchmark_registry.py          # BenchmarkRegistry
├── utils/
│   ├── __init__.py
│   └── unit_conversion.py           # lbs_to_kg(), kg_to_lbs() — used by SettingsService
└── repositories/
    ├── __init__.py
    ├── base.py                         # BaseRepository
    ├── settings_repo.py               # SettingsRepo
    ├── workout_repo.py                # WorkoutRepo
    └── benchmark_repo.py             # BenchmarkRepo

tests/
├── __init__.py
├── conftest.py                         # Shared fixtures
├── data/                               # Test data fixtures
│   ├── valid_exercises.csv
│   ├── duplicate_key_exercises.csv
│   ├── bad_type_exercises.csv
│   ├── valid_routine.yaml
│   ├── bad_routine_missing_sets.yaml
│   ├── bad_routine_unknown_exercise.yaml
│   ├── bad_routine_progressive_time.yaml
│   ├── bad_routine_duplicate_day_key.yaml
│   ├── bad_routine_duplicate_day_label.yaml
│   ├── bad_routine_time_no_duration.yaml
│   ├── valid_benchmarks.yaml
│   ├── bad_benchmarks_duplicate.yaml
│   └── bad_benchmarks_unknown_exercise.yaml
├── test_models.py                      # Dataclass instantiation, enum values
├── test_db_schema.py                   # Schema creation, constraints, FK cascades
├── test_exercise_loader.py             # CSV parsing, validation, fail-fast
├── test_routine_loader.py              # YAML parsing, validation, fail-fast
├── test_benchmark_loader.py            # YAML parsing, validation, fail-fast
├── test_registries.py                  # Registry lookups, immutability
├── test_settings_repo.py              # Settings CRUD
├── test_workout_repo.py               # Session + exercise + set CRUD, constraints
└── test_benchmark_repo.py             # Benchmark result CRUD
```

---

## Task 1: Project Scaffolding + Enums + Models

**Files:** `src/__init__.py`, `src/config.py`, `src/models/__init__.py`, `src/models/enums.py`, `src/models/bundled.py`, `src/models/workout.py`, `src/models/benchmark.py`, `src/utils/__init__.py`, `src/utils/unit_conversion.py`, `tests/__init__.py`, `tests/conftest.py`, `tests/test_models.py`

**Why first:** Every other task depends on models and enums.

- [ ] **Step 1: Create `src/models/enums.py`**

```python
"""Shared enums for the exercise logger."""
from __future__ import annotations
from enum import Enum


class ExerciseType(Enum):
    REPS_WEIGHT = "reps_weight"
    TIME = "time"
    CARDIO = "cardio"


class SetScheme(Enum):
    UNIFORM = "uniform"
    PROGRESSIVE = "progressive"


class BenchmarkMethod(Enum):
    MAX_WEIGHT = "max_weight"
    MAX_REPS = "max_reps"
    TIMED_HOLD = "timed_hold"


class SessionStatus(Enum):
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"


class ExerciseSource(Enum):
    PLANNED = "planned"
    AD_HOC = "ad_hoc"
```

- [ ] **Step 2: Create `src/models/bundled.py`**

```python
"""Immutable bundled data models — loaded from files, never stored in SQLite."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional, List
from src.models.enums import ExerciseType, SetScheme, BenchmarkMethod


@dataclass(frozen=True)
class Exercise:
    key: str
    name: str
    type: ExerciseType
    equipment: str
    muscle_group: str


@dataclass(frozen=True)
class DayExercise:
    exercise_key: str
    scheme: SetScheme
    sets: int
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    duration_seconds: Optional[int] = None
    distance_km: Optional[float] = None
    notes: Optional[str] = None


@dataclass(frozen=True)
class RoutineDay:
    key: str
    label: str
    name: str
    exercises: tuple[DayExercise, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class Routine:
    key: str
    name: str
    description: str
    days: tuple[RoutineDay, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class BenchmarkItem:
    exercise_key: str
    method: BenchmarkMethod


@dataclass(frozen=True)
class BenchmarkConfig:
    frequency_weeks: int
    items: tuple[BenchmarkItem, ...] = field(default_factory=tuple)
```

- [ ] **Step 3: Create `src/models/workout.py`**

```python
"""Mutable workout data models — stored in SQLite."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
from src.models.enums import ExerciseType, SetScheme, SessionStatus, ExerciseSource


@dataclass
class WorkoutSession:
    id: Optional[int]
    routine_key_snapshot: str
    routine_name_snapshot: str
    day_key_snapshot: str
    day_label_snapshot: str
    day_name_snapshot: str
    status: SessionStatus
    started_at: str
    completed_fully: Optional[bool] = None
    finished_at: Optional[str] = None


@dataclass
class SessionExercise:
    id: Optional[int]
    session_id: int
    sort_order: int
    exercise_key_snapshot: str
    exercise_name_snapshot: str
    exercise_type_snapshot: ExerciseType
    source: ExerciseSource
    scheme_snapshot: Optional[SetScheme] = None
    planned_sets: Optional[int] = None
    target_reps_min: Optional[int] = None
    target_reps_max: Optional[int] = None
    target_duration_seconds: Optional[int] = None
    target_distance_km: Optional[float] = None
    plan_notes_snapshot: Optional[str] = None


@dataclass
class LoggedSet:
    id: Optional[int]
    session_exercise_id: int
    set_number: int
    logged_at: str
    reps: Optional[int] = None
    weight: Optional[float] = None
    duration_seconds: Optional[int] = None
    distance_km: Optional[float] = None
```

- [ ] **Step 4: Create `src/models/benchmark.py`**

```python
"""Mutable benchmark result model — stored in SQLite."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
from src.models.enums import BenchmarkMethod


@dataclass
class BenchmarkResult:
    id: Optional[int]
    exercise_key_snapshot: str
    exercise_name_snapshot: str
    method: BenchmarkMethod
    result_value: float
    tested_at: str
    bodyweight: Optional[float] = None
```

- [ ] **Step 5: Create `src/models/__init__.py`** (empty)

- [ ] **Step 6: Create `src/__init__.py`** (empty)

- [ ] **Step 7: Create `src/config.py`**

```python
"""App configuration constants."""
import os

DB_FILENAME = "exercise_logger.db"

# Paths relative to src/
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_SRC_DIR, "data")
EXERCISES_CSV_PATH = os.path.join(DATA_DIR, "exercises.csv")
ROUTINES_DIR = os.path.join(DATA_DIR, "routines")
BENCHMARKS_YAML_PATH = os.path.join(DATA_DIR, "benchmarks.yaml")


def get_db_path() -> str:
    """Get the database file path.

    On Android (Kivy), uses App.get_running_app().user_data_dir.
    On desktop, uses ~/.exercise_logger/ (user's home directory).
    """
    try:
        from kivy.app import App
        app = App.get_running_app()
        if app is not None:
            return os.path.join(app.user_data_dir, DB_FILENAME)
    except ImportError:
        pass
    app_dir = os.path.join(os.path.expanduser("~"), ".exercise_logger")
    os.makedirs(app_dir, exist_ok=True)
    return os.path.join(app_dir, DB_FILENAME)


# Defaults
DEFAULT_WEIGHT_UNIT = "lb"
DEFAULT_BENCHMARK_FREQUENCY_WEEKS = 6
```

- [ ] **Step 8: Create `tests/__init__.py`** (empty)

- [ ] **Step 9: Create `tests/conftest.py`** (minimal — will grow in later tasks)

```python
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
```

- [ ] **Step 10: Create `tests/test_models.py`**

```python
"""Tests for dataclass models and enums."""
from src.models.enums import ExerciseType, SetScheme, BenchmarkMethod, SessionStatus, ExerciseSource
from src.models.bundled import Exercise, Routine, RoutineDay, DayExercise, BenchmarkConfig, BenchmarkItem
from src.models.workout import WorkoutSession, SessionExercise, LoggedSet
from src.models.benchmark import BenchmarkResult


class TestEnums:
    def test_exercise_type_values(self):
        assert ExerciseType.REPS_WEIGHT.value == "reps_weight"
        assert ExerciseType.TIME.value == "time"
        assert ExerciseType.CARDIO.value == "cardio"
        assert len(ExerciseType) == 3  # No reps_only

    def test_set_scheme_values(self):
        assert SetScheme.UNIFORM.value == "uniform"
        assert SetScheme.PROGRESSIVE.value == "progressive"

    def test_benchmark_method_values(self):
        assert BenchmarkMethod.MAX_WEIGHT.value == "max_weight"
        assert BenchmarkMethod.MAX_REPS.value == "max_reps"
        assert BenchmarkMethod.TIMED_HOLD.value == "timed_hold"

    def test_session_status_values(self):
        assert SessionStatus.IN_PROGRESS.value == "in_progress"
        assert SessionStatus.FINISHED.value == "finished"

    def test_exercise_source_values(self):
        assert ExerciseSource.PLANNED.value == "planned"
        assert ExerciseSource.AD_HOC.value == "ad_hoc"


class TestBundledModels:
    def test_exercise_is_frozen(self):
        ex = Exercise(key="bench", name="Bench Press", type=ExerciseType.REPS_WEIGHT,
                      equipment="Barbell", muscle_group="Chest")
        import pytest
        with pytest.raises(AttributeError):
            ex.name = "Changed"

    def test_day_exercise_defaults(self):
        de = DayExercise(exercise_key="bench", scheme=SetScheme.UNIFORM, sets=3)
        assert de.reps_min is None
        assert de.reps_max is None
        assert de.duration_seconds is None
        assert de.distance_km is None
        assert de.notes is None

    def test_routine_day_exercises_is_tuple(self):
        day = RoutineDay(key="push", label="A", name="Push", exercises=())
        assert isinstance(day.exercises, tuple)

    def test_routine_days_is_tuple(self):
        r = Routine(key="ppl", name="PPL", description="desc", days=())
        assert isinstance(r.days, tuple)

    def test_benchmark_config(self):
        item = BenchmarkItem(exercise_key="bench", method=BenchmarkMethod.MAX_WEIGHT)
        config = BenchmarkConfig(frequency_weeks=6, items=(item,))
        assert config.frequency_weeks == 6
        assert len(config.items) == 1

    def test_benchmark_config_is_frozen(self):
        config = BenchmarkConfig(frequency_weeks=6, items=())
        import pytest
        with pytest.raises(AttributeError):
            config.frequency_weeks = 12


class TestMutableModels:
    def test_workout_session_defaults(self):
        ws = WorkoutSession(
            id=None, routine_key_snapshot="ppl", routine_name_snapshot="PPL",
            day_key_snapshot="push", day_label_snapshot="A",
            day_name_snapshot="Push", status=SessionStatus.IN_PROGRESS,
            started_at="2026-03-26T10:00:00",
        )
        assert ws.completed_fully is None
        assert ws.finished_at is None

    def test_session_exercise(self):
        se = SessionExercise(
            id=None, session_id=1, sort_order=0,
            exercise_key_snapshot="bench", exercise_name_snapshot="Bench Press",
            exercise_type_snapshot=ExerciseType.REPS_WEIGHT,
            source=ExerciseSource.PLANNED,
            scheme_snapshot=SetScheme.UNIFORM,
            planned_sets=3, target_reps_min=8, target_reps_max=12,
        )
        assert se.target_duration_seconds is None
        assert se.target_distance_km is None

    def test_logged_set_defaults(self):
        ls = LoggedSet(
            id=None, session_exercise_id=1, set_number=1,
            logged_at="2026-03-26T10:05:00",
        )
        assert ls.reps is None
        assert ls.weight is None
        assert ls.duration_seconds is None
        assert ls.distance_km is None

    def test_benchmark_result(self):
        br = BenchmarkResult(
            id=None, exercise_key_snapshot="bench",
            exercise_name_snapshot="Bench Press",
            method=BenchmarkMethod.MAX_WEIGHT,
            result_value=100.0, tested_at="2026-03-26",
            bodyweight=80.0,
        )
        assert br.bodyweight == 80.0

    def test_benchmark_result_bodyweight_optional(self):
        br = BenchmarkResult(
            id=None, exercise_key_snapshot="bench",
            exercise_name_snapshot="Bench Press",
            method=BenchmarkMethod.MAX_WEIGHT,
            result_value=100.0, tested_at="2026-03-26",
        )
        assert br.bodyweight is None
```

- [ ] **Step 11: Create `src/utils/__init__.py` and `src/utils/unit_conversion.py`**

```python
# src/utils/__init__.py
# (empty)
```

```python
# src/utils/unit_conversion.py
"""Weight and distance unit conversion utilities."""

LBS_TO_KG = 0.45359237
KG_TO_LBS = 1.0 / LBS_TO_KG


def lbs_to_kg(lbs: float) -> float:
    return round(lbs * LBS_TO_KG, 2)


def kg_to_lbs(kg: float) -> float:
    return round(kg * KG_TO_LBS, 2)
```

- [ ] **Step 12: Run tests, verify all pass**

```bash
pytest tests/test_models.py -v
```

- [ ] **Step 13: Commit**

```
feat(v2): models and enums for exercise logger v2 rewrite
```

---

## Task 2: Database Schema + Connection Helpers

**Files:** `src/db/__init__.py`, `src/db/connection.py`, `src/db/schema.py`, `tests/test_db_schema.py`

**Why:** Repos depend on schema. Tests validate SQL constraints are correct.

- [ ] **Step 1: Create `src/db/__init__.py`** (empty)

- [ ] **Step 2: Create `src/db/connection.py`**

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

- [ ] **Step 3: Create `src/db/schema.py`**

5 tables, exactly matching the spec. No `IF NOT EXISTS` — v2 is a clean slate.

```python
"""Database schema definitions for Exercise Logger v2.

Only 5 tables — mutable user data only.
Bundled data (exercises, routines, benchmarks) lives in registries, not SQLite.
"""
import sqlite3

_SCHEMA_SQL = [
    """CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )""",

    """CREATE TABLE IF NOT EXISTS workout_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_key_snapshot TEXT NOT NULL,
        routine_name_snapshot TEXT NOT NULL,
        day_key_snapshot TEXT NOT NULL,
        day_label_snapshot TEXT NOT NULL,
        day_name_snapshot TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('in_progress', 'finished')),
        completed_fully INTEGER CHECK(completed_fully IS NULL OR completed_fully IN (0, 1)),
        started_at TEXT NOT NULL,
        finished_at TEXT,
        CHECK(
            (status = 'in_progress' AND completed_fully IS NULL AND finished_at IS NULL)
            OR
            (status = 'finished' AND completed_fully IN (0, 1) AND finished_at IS NOT NULL)
        )
    )""",

    """CREATE TABLE IF NOT EXISTS session_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL CHECK(sort_order >= 0),
        exercise_key_snapshot TEXT NOT NULL,
        exercise_name_snapshot TEXT NOT NULL,
        exercise_type_snapshot TEXT NOT NULL CHECK(exercise_type_snapshot IN ('reps_weight', 'time', 'cardio')),
        source TEXT NOT NULL CHECK(source IN ('planned', 'ad_hoc')),
        scheme_snapshot TEXT CHECK(scheme_snapshot IN ('uniform', 'progressive')),
        planned_sets INTEGER CHECK(planned_sets IS NULL OR planned_sets >= 1),
        target_reps_min INTEGER CHECK(target_reps_min IS NULL OR target_reps_min >= 1),
        target_reps_max INTEGER CHECK(target_reps_max IS NULL OR target_reps_max >= 1),
        target_duration_seconds INTEGER CHECK(target_duration_seconds IS NULL OR target_duration_seconds >= 1),
        target_distance_km REAL CHECK(target_distance_km IS NULL OR target_distance_km > 0),
        plan_notes_snapshot TEXT,
        UNIQUE(session_id, sort_order),
        CHECK(source = 'ad_hoc' OR planned_sets IS NOT NULL),
        CHECK(target_reps_min IS NULL OR target_reps_max IS NULL OR target_reps_min <= target_reps_max),
        CHECK(
            source = 'planned'
            OR (
                source = 'ad_hoc'
                AND planned_sets IS NULL
                AND target_reps_min IS NULL
                AND target_reps_max IS NULL
                AND target_duration_seconds IS NULL
                AND target_distance_km IS NULL
            )
        )
    )""",

    """CREATE TABLE IF NOT EXISTS logged_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
        set_number INTEGER NOT NULL CHECK(set_number >= 1),
        reps INTEGER CHECK(reps IS NULL OR reps >= 1),
        weight REAL CHECK(weight IS NULL OR weight >= 0),
        duration_seconds INTEGER CHECK(duration_seconds IS NULL OR duration_seconds >= 1),
        distance_km REAL CHECK(distance_km IS NULL OR distance_km > 0),
        logged_at TEXT NOT NULL,
        UNIQUE(session_exercise_id, set_number),
        CHECK(reps IS NOT NULL OR duration_seconds IS NOT NULL OR distance_km IS NOT NULL)
    )""",

    """CREATE TABLE IF NOT EXISTS benchmark_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_key_snapshot TEXT NOT NULL,
        exercise_name_snapshot TEXT NOT NULL,
        method TEXT NOT NULL CHECK(method IN ('max_weight', 'max_reps', 'timed_hold')),
        result_value REAL NOT NULL CHECK(result_value > 0),
        bodyweight REAL CHECK(bodyweight IS NULL OR bodyweight > 0),
        tested_at TEXT NOT NULL
    )""",
]


def init_db(conn: sqlite3.Connection) -> None:
    """Create all tables. Safe to call multiple times (IF NOT EXISTS)."""
    for sql in _SCHEMA_SQL:
        conn.execute(sql)
    conn.commit()
```

- [ ] **Step 4: Create `tests/test_db_schema.py`**

```python
"""Tests for database schema — constraints, cascades, valid/invalid data."""
import pytest
import sqlite3


class TestSchemaCreation:
    def test_tables_exist(self, db_conn):
        """All 5 tables are created."""
        cursor = db_conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = {row["name"] for row in cursor.fetchall()}
        assert "settings" in tables
        assert "workout_sessions" in tables
        assert "session_exercises" in tables
        assert "logged_sets" in tables
        assert "benchmark_results" in tables

    def test_no_exercise_table(self, db_conn):
        """Exercises live in registries, not SQLite."""
        cursor = db_conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='exercises'"
        )
        assert cursor.fetchone() is None

    def test_no_routine_tables(self, db_conn):
        """Routines live in registries, not SQLite."""
        cursor = db_conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'routine%'"
        )
        assert cursor.fetchone() is None

    def test_idempotent_init(self, db_conn):
        """Calling init_db twice doesn't fail."""
        from src.db.schema import init_db
        init_db(db_conn)  # Second call


class TestSettingsConstraints:
    def test_insert_and_read(self, db_conn):
        db_conn.execute("INSERT INTO settings (key, value) VALUES ('unit', 'lb')")
        row = db_conn.execute("SELECT value FROM settings WHERE key = 'unit'").fetchone()
        assert row["value"] == "lb"

    def test_duplicate_key_replaces(self, db_conn):
        db_conn.execute("INSERT INTO settings (key, value) VALUES ('unit', 'lb')")
        db_conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('unit', 'kg')"
        )
        row = db_conn.execute("SELECT value FROM settings WHERE key = 'unit'").fetchone()
        assert row["value"] == "kg"

    def test_null_value_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute("INSERT INTO settings (key, value) VALUES ('unit', NULL)")


class TestWorkoutSessionConstraints:
    def _insert_in_progress(self, db_conn):
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status, started_at)
               VALUES ('ppl', 'Push Pull Legs', 'push', 'A', 'Push',
                       'in_progress', '2026-03-26T10:00:00')"""
        )
        return db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    def test_in_progress_session(self, db_conn):
        sid = self._insert_in_progress(db_conn)
        row = db_conn.execute("SELECT * FROM workout_sessions WHERE id = ?", (sid,)).fetchone()
        assert row["status"] == "in_progress"
        assert row["completed_fully"] is None
        assert row["finished_at"] is None

    def test_finished_session(self, db_conn):
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status, completed_fully,
                started_at, finished_at)
               VALUES ('ppl', 'Push Pull Legs', 'push', 'A', 'Push',
                       'finished', 1, '2026-03-26T10:00:00', '2026-03-26T11:00:00')"""
        )

    def test_invalid_status_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                    day_label_snapshot, day_name_snapshot, status, started_at)
                   VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                           'canceled', '2026-03-26T10:00:00')"""
            )

    def test_in_progress_with_finished_at_rejected(self, db_conn):
        """in_progress must have NULL finished_at and NULL completed_fully."""
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                    day_label_snapshot, day_name_snapshot, status,
                    started_at, finished_at)
                   VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                           'in_progress', '2026-03-26T10:00:00', '2026-03-26T11:00:00')"""
            )

    def test_finished_without_completed_fully_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                    day_label_snapshot, day_name_snapshot, status,
                    started_at, finished_at)
                   VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                           'finished', '2026-03-26T10:00:00', '2026-03-26T11:00:00')"""
            )

    def test_finished_without_finished_at_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO workout_sessions
                   (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                    day_label_snapshot, day_name_snapshot, status, completed_fully,
                    started_at)
                   VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                           'finished', 1, '2026-03-26T10:00:00')"""
            )


class TestSessionExerciseConstraints:
    def _insert_session(self, db_conn):
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status, started_at)
               VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                       'in_progress', '2026-03-26T10:00:00')"""
        )
        return db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    def test_planned_exercise(self, db_conn):
        sid = self._insert_session(db_conn)
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, scheme_snapshot, planned_sets,
                target_reps_min, target_reps_max)
               VALUES (?, 0, 'bench', 'Bench Press', 'reps_weight', 'planned',
                       'uniform', 3, 8, 12)""",
            (sid,),
        )

    def test_ad_hoc_exercise(self, db_conn):
        sid = self._insert_session(db_conn)
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source)
               VALUES (?, 0, 'curl', 'Dumbbell Curl', 'reps_weight', 'ad_hoc')""",
            (sid,),
        )

    def test_ad_hoc_with_targets_rejected(self, db_conn):
        """Ad-hoc exercises must have NULL for all target fields."""
        sid = self._insert_session(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source, planned_sets)
                   VALUES (?, 0, 'curl', 'Curl', 'reps_weight', 'ad_hoc', 3)""",
                (sid,),
            )

    def test_planned_without_planned_sets_rejected(self, db_conn):
        """Planned exercises must have planned_sets."""
        sid = self._insert_session(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source)
                   VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned')""",
                (sid,),
            )

    def test_duplicate_sort_order_rejected(self, db_conn):
        sid = self._insert_session(db_conn)
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, planned_sets)
               VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned', 3)""",
            (sid,),
        )
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source, planned_sets)
                   VALUES (?, 0, 'squat', 'Squat', 'reps_weight', 'planned', 3)""",
                (sid,),
            )

    def test_invalid_exercise_type_rejected(self, db_conn):
        sid = self._insert_session(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source, planned_sets)
                   VALUES (?, 0, 'bench', 'Bench', 'reps_only', 'planned', 3)""",
                (sid,),
            )

    def test_reps_min_greater_than_max_rejected(self, db_conn):
        sid = self._insert_session(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO session_exercises
                   (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                    exercise_type_snapshot, source, planned_sets,
                    target_reps_min, target_reps_max)
                   VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned', 3, 12, 8)""",
                (sid,),
            )

    def test_cascade_delete_session(self, db_conn):
        """Deleting a session cascades to session_exercises."""
        sid = self._insert_session(db_conn)
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, planned_sets)
               VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned', 3)""",
            (sid,),
        )
        db_conn.execute("DELETE FROM workout_sessions WHERE id = ?", (sid,))
        count = db_conn.execute("SELECT COUNT(*) FROM session_exercises").fetchone()[0]
        assert count == 0


class TestLoggedSetConstraints:
    def _setup_exercise(self, db_conn):
        """Create a session and session_exercise, return session_exercise_id."""
        db_conn.execute(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status, started_at)
               VALUES ('ppl', 'PPL', 'push', 'A', 'Push',
                       'in_progress', '2026-03-26T10:00:00')"""
        )
        sid = db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        db_conn.execute(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, planned_sets)
               VALUES (?, 0, 'bench', 'Bench', 'reps_weight', 'planned', 3)""",
            (sid,),
        )
        return db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    def test_valid_reps_weight_set(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 60.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_valid_time_set(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, duration_seconds, logged_at)
               VALUES (?, 1, 60, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_valid_cardio_set_distance_only(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, distance_km, logged_at)
               VALUES (?, 1, 5.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_valid_cardio_set_both(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, duration_seconds, distance_km, logged_at)
               VALUES (?, 1, 600, 2.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_all_null_measurements_rejected(self, db_conn):
        """At least one measurement field must be non-NULL."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, logged_at)
                   VALUES (?, 1, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_zero_reps_rejected(self, db_conn):
        """reps >= 1 enforced."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, reps, weight, logged_at)
                   VALUES (?, 1, 0, 60.0, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_negative_weight_rejected(self, db_conn):
        """weight >= 0 enforced."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, reps, weight, logged_at)
                   VALUES (?, 1, 10, -5.0, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_zero_weight_allowed(self, db_conn):
        """weight=0 valid for bodyweight exercises."""
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 0.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )

    def test_zero_duration_rejected(self, db_conn):
        """duration_seconds >= 1 enforced."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, duration_seconds, logged_at)
                   VALUES (?, 1, 0, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_zero_distance_rejected(self, db_conn):
        """distance_km > 0 enforced."""
        se_id = self._setup_exercise(db_conn)
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, distance_km, logged_at)
                   VALUES (?, 1, 0.0, '2026-03-26T10:05:00')""",
                (se_id,),
            )

    def test_duplicate_set_number_rejected(self, db_conn):
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 60.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO logged_sets
                   (session_exercise_id, set_number, reps, weight, logged_at)
                   VALUES (?, 1, 8, 65.0, '2026-03-26T10:06:00')""",
                (se_id,),
            )

    def test_cascade_delete_session_exercise(self, db_conn):
        """Deleting a session_exercise cascades to logged_sets."""
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 60.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )
        db_conn.execute("DELETE FROM session_exercises WHERE id = ?", (se_id,))
        count = db_conn.execute("SELECT COUNT(*) FROM logged_sets").fetchone()[0]
        assert count == 0

    def test_cascade_delete_session_to_sets(self, db_conn):
        """Deleting a workout_session cascades through to logged_sets."""
        se_id = self._setup_exercise(db_conn)
        db_conn.execute(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight, logged_at)
               VALUES (?, 1, 10, 60.0, '2026-03-26T10:05:00')""",
            (se_id,),
        )
        # Get session_id from session_exercise
        row = db_conn.execute("SELECT session_id FROM session_exercises WHERE id = ?", (se_id,)).fetchone()
        db_conn.execute("DELETE FROM workout_sessions WHERE id = ?", (row["session_id"],))
        count = db_conn.execute("SELECT COUNT(*) FROM logged_sets").fetchone()[0]
        assert count == 0


class TestBenchmarkResultConstraints:
    def test_valid_result(self, db_conn):
        db_conn.execute(
            """INSERT INTO benchmark_results
               (exercise_key_snapshot, exercise_name_snapshot, method,
                result_value, bodyweight, tested_at)
               VALUES ('bench', 'Bench Press', 'max_weight', 100.0, 80.0,
                       '2026-03-26')"""
        )

    def test_null_bodyweight_allowed(self, db_conn):
        db_conn.execute(
            """INSERT INTO benchmark_results
               (exercise_key_snapshot, exercise_name_snapshot, method,
                result_value, tested_at)
               VALUES ('pull_up', 'Pull-Up', 'max_reps', 15.0, '2026-03-26')"""
        )

    def test_zero_result_value_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO benchmark_results
                   (exercise_key_snapshot, exercise_name_snapshot, method,
                    result_value, tested_at)
                   VALUES ('bench', 'Bench', 'max_weight', 0.0, '2026-03-26')"""
            )

    def test_negative_result_value_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO benchmark_results
                   (exercise_key_snapshot, exercise_name_snapshot, method,
                    result_value, tested_at)
                   VALUES ('bench', 'Bench', 'max_weight', -1.0, '2026-03-26')"""
            )

    def test_invalid_method_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO benchmark_results
                   (exercise_key_snapshot, exercise_name_snapshot, method,
                    result_value, tested_at)
                   VALUES ('bench', 'Bench', 'one_rep_max', 100.0, '2026-03-26')"""
            )

    def test_zero_bodyweight_rejected(self, db_conn):
        with pytest.raises(sqlite3.IntegrityError):
            db_conn.execute(
                """INSERT INTO benchmark_results
                   (exercise_key_snapshot, exercise_name_snapshot, method,
                    result_value, bodyweight, tested_at)
                   VALUES ('bench', 'Bench', 'max_weight', 100.0, 0.0, '2026-03-26')"""
            )
```

- [ ] **Step 5: Run tests, verify all pass**

```bash
pytest tests/test_db_schema.py -v
```

- [ ] **Step 6: Commit**

```
feat(v2): database schema with 5 tables and constraint tests
```

---

## Task 3: Exercise Loader (CSV) + Test Data

**Files:** `src/loaders/__init__.py`, `src/loaders/exercise_loader.py`, `src/data/exercises.csv`, `tests/data/valid_exercises.csv`, `tests/data/duplicate_key_exercises.csv`, `tests/data/bad_type_exercises.csv`, `tests/test_exercise_loader.py`

**Why:** Registries depend on loaders. Exercise loader is standalone (no cross-references).

- [ ] **Step 1: Create `src/loaders/__init__.py`** (empty)

- [ ] **Step 2: Create `src/loaders/exercise_loader.py`**

```python
"""Load exercise catalog from CSV.

Fail-fast: any invalid data raises LoaderError.
"""
from __future__ import annotations
import csv
from typing import List
from src.models.enums import ExerciseType
from src.models.bundled import Exercise


class LoaderError(Exception):
    """Fatal loader validation error."""
    pass


# Valid type strings → ExerciseType mapping
_VALID_TYPES = {t.value: t for t in ExerciseType}

_REQUIRED_COLUMNS = {"key", "name", "type", "equipment", "muscle_group"}


def load_exercises(csv_path: str) -> List[Exercise]:
    """Load and validate the exercise catalog from CSV.

    Args:
        csv_path: Path to exercises.csv

    Returns:
        List of validated Exercise dataclasses.

    Raises:
        LoaderError: On any validation failure (duplicate keys, invalid types, etc.)
        FileNotFoundError: If the CSV file doesn't exist.
    """
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            # Validate header
            if reader.fieldnames is None:
                raise LoaderError(f"{csv_path}: empty CSV file")
            missing = _REQUIRED_COLUMNS - set(reader.fieldnames)
            if missing:
                raise LoaderError(
                    f"{csv_path}: missing required columns: {sorted(missing)}"
                )

            exercises: List[Exercise] = []
            seen_keys: set[str] = set()

            for line_num, row in enumerate(reader, start=2):  # line 1 is header
                key = row["key"].strip()
                name = row["name"].strip()
                type_str = row["type"].strip()
                equipment = row["equipment"].strip()
                muscle_group = row["muscle_group"].strip()

                # Validate key
                if not key:
                    raise LoaderError(f"{csv_path}:{line_num}: empty exercise key")
                if key in seen_keys:
                    raise LoaderError(
                        f"{csv_path}:{line_num}: duplicate exercise key '{key}'"
                    )
                seen_keys.add(key)

                # Validate name
                if not name:
                    raise LoaderError(f"{csv_path}:{line_num}: empty exercise name for key '{key}'")

                # Validate type
                if type_str not in _VALID_TYPES:
                    raise LoaderError(
                        f"{csv_path}:{line_num}: invalid exercise type '{type_str}' "
                        f"for key '{key}'. Valid types: {sorted(_VALID_TYPES.keys())}"
                    )

                # Validate equipment and muscle_group
                if not equipment:
                    raise LoaderError(
                        f"{csv_path}:{line_num}: empty equipment for key '{key}'"
                    )
                if not muscle_group:
                    raise LoaderError(
                        f"{csv_path}:{line_num}: empty muscle_group for key '{key}'"
                    )

                exercises.append(Exercise(
                    key=key,
                    name=name,
                    type=_VALID_TYPES[type_str],
                    equipment=equipment,
                    muscle_group=muscle_group,
                ))

            if not exercises:
                raise LoaderError(f"{csv_path}: no exercises found in CSV")

            return exercises

    except csv.Error as e:
        raise LoaderError(f"{csv_path}: CSV parsing error: {e}") from e
```

- [ ] **Step 3: Create `src/data/exercises.csv`**

Derived from `docs/exercises/gym_exercises_catalog.csv` with type mapping: `Weight` -> `reps_weight`, `Bodyweight` -> `reps_weight`, `Isometric` -> `time`. Cardio exercises added manually. Keys are snake_case of names.

```csv
key,name,type,equipment,muscle_group
barbell_back_squat,Barbell Back Squat,reps_weight,Barbell,Legs
barbell_deadlift,Barbell Deadlift,reps_weight,Barbell,Back / Legs
barbell_romanian_deadlift,Barbell Romanian Deadlift,reps_weight,Barbell,Legs
barbell_hip_thrust,Barbell Hip Thrust,reps_weight,Barbell,Legs
barbell_bench_press,Barbell Bench Press,reps_weight,Barbell,Chest
incline_barbell_press,Incline Barbell Press,reps_weight,Barbell,Chest
barbell_overhead_press,Barbell Overhead Press,reps_weight,Barbell,Shoulders
barbell_row,Barbell Row,reps_weight,Barbell,Back
barbell_curl,Barbell Curl,reps_weight,Barbell,Arms
close_grip_bench_press,Close-Grip Bench Press,reps_weight,Barbell,Arms
skull_crusher,Skull Crusher,reps_weight,Barbell,Arms
barbell_shrug,Barbell Shrug,reps_weight,Barbell,Back
dumbbell_bench_press,Dumbbell Bench Press,reps_weight,Dumbbell,Chest
incline_dumbbell_press,Incline Dumbbell Press,reps_weight,Dumbbell,Chest
dumbbell_flyes,Dumbbell Flyes,reps_weight,Dumbbell,Chest
dumbbell_shoulder_press,Dumbbell Shoulder Press,reps_weight,Dumbbell,Shoulders
dumbbell_lateral_raise,Dumbbell Lateral Raise,reps_weight,Dumbbell,Shoulders
dumbbell_front_raise,Dumbbell Front Raise,reps_weight,Dumbbell,Shoulders
dumbbell_rear_delt_fly,Dumbbell Rear Delt Fly,reps_weight,Dumbbell,Shoulders
arnold_press,Arnold Press,reps_weight,Dumbbell,Shoulders
dumbbell_row,Dumbbell Row,reps_weight,Dumbbell,Back
dumbbell_curl,Dumbbell Curl,reps_weight,Dumbbell,Arms
hammer_curl,Hammer Curl,reps_weight,Dumbbell,Arms
concentration_curl,Concentration Curl,reps_weight,Dumbbell,Arms
dumbbell_overhead_tricep_extension,Dumbbell Overhead Tricep Extension,reps_weight,Dumbbell,Arms
dumbbell_kickback,Dumbbell Kickback,reps_weight,Dumbbell,Arms
dumbbell_lunge,Dumbbell Lunge,reps_weight,Dumbbell,Legs
dumbbell_romanian_deadlift,Dumbbell Romanian Deadlift,reps_weight,Dumbbell,Legs
dumbbell_shrug,Dumbbell Shrug,reps_weight,Dumbbell,Back
lat_pulldown,Lat Pulldown,reps_weight,Cable Machine,Back
seated_cable_row,Seated Cable Row,reps_weight,Cable Machine,Back
cable_crossover,Cable Crossover,reps_weight,Cable Machine,Chest
face_pull,Face Pull,reps_weight,Cable Machine,Shoulders
cable_tricep_pushdown,Cable Tricep Pushdown,reps_weight,Cable Machine,Arms
cable_curl,Cable Curl,reps_weight,Cable Machine,Arms
cable_lateral_raise,Cable Lateral Raise,reps_weight,Cable Machine,Shoulders
cable_woodchop,Cable Woodchop,reps_weight,Cable Machine,Core
leg_press,Leg Press,reps_weight,Machine,Legs
leg_extension,Leg Extension,reps_weight,Machine,Legs
leg_curl,Leg Curl,reps_weight,Machine,Legs
hack_squat,Hack Squat,reps_weight,Machine,Legs
calf_raise_machine,Calf Raise Machine,reps_weight,Machine,Legs
hip_abductor_machine,Hip Abductor Machine,reps_weight,Machine,Legs
chest_press_machine,Chest Press Machine,reps_weight,Machine,Chest
pec_deck,Pec Deck,reps_weight,Machine,Chest
shoulder_press_machine,Shoulder Press Machine,reps_weight,Machine,Shoulders
assisted_pull_up_machine,Assisted Pull-Up Machine,reps_weight,Machine,Back
smith_machine_squat,Smith Machine Squat,reps_weight,Smith Machine,Legs
smith_machine_bench_press,Smith Machine Bench Press,reps_weight,Smith Machine,Chest
pull_up,Pull-Up,reps_weight,Bodyweight,Back
chin_up,Chin-Up,reps_weight,Bodyweight,Back
push_up,Push-Up,reps_weight,Bodyweight,Chest
inverted_row,Inverted Row,reps_weight,Bodyweight,Back
dip,Dip,reps_weight,Bodyweight,Chest / Arms
squat,Squat,reps_weight,Bodyweight,Legs
lunge,Lunge,reps_weight,Bodyweight,Legs
calf_raise,Calf Raise,reps_weight,Bodyweight,Legs
crunch,Crunch,reps_weight,Bodyweight,Core
bicycle_crunch,Bicycle Crunch,reps_weight,Bodyweight,Core
leg_raise,Leg Raise,reps_weight,Bodyweight,Core
hanging_leg_raise,Hanging Leg Raise,reps_weight,Bodyweight,Core
mountain_climber,Mountain Climber,reps_weight,Bodyweight,Core
superman,Superman,reps_weight,Bodyweight,Back
burpee,Burpee,reps_weight,Bodyweight,Full Body
ab_wheel_rollout,Ab Wheel Rollout,reps_weight,Bodyweight,Core
plank,Plank,time,Bodyweight,Core
side_plank,Side Plank,time,Bodyweight,Core
wall_sit,Wall Sit,time,Bodyweight,Legs
glute_bridge_hold,Glute Bridge Hold,time,Bodyweight,Legs
dead_hang,Dead Hang,time,Bodyweight,Back
hollow_body_hold,Hollow Body Hold,time,Bodyweight,Core
l_sit,L-Sit,time,Bodyweight,Core
flexed_arm_hang,Flexed-Arm Hang,time,Bodyweight,Arms
running,Running,cardio,None,Cardio
rowing_machine,Rowing Machine,cardio,Rowing Machine,Cardio
2km_rowing,2km Rowing,cardio,Rowing Machine,Cardio
stationary_bike,Stationary Bike,cardio,Stationary Bike,Cardio
elliptical,Elliptical,cardio,Elliptical,Cardio
jump_rope,Jump Rope,cardio,Jump Rope,Cardio
```

- [ ] **Step 4: Create test data files**

`tests/data/valid_exercises.csv`:
```csv
key,name,type,equipment,muscle_group
bench_press,Bench Press,reps_weight,Barbell,Chest
plank,Plank,time,Bodyweight,Core
running,Running,cardio,None,Cardio
```

`tests/data/duplicate_key_exercises.csv`:
```csv
key,name,type,equipment,muscle_group
bench_press,Bench Press,reps_weight,Barbell,Chest
bench_press,Flat Bench Press,reps_weight,Barbell,Chest
```

`tests/data/bad_type_exercises.csv`:
```csv
key,name,type,equipment,muscle_group
bench_press,Bench Press,reps_only,Barbell,Chest
```

- [ ] **Step 5: Create `tests/test_exercise_loader.py`**

```python
"""Tests for exercise CSV loader — valid parsing and fail-fast validation."""
import os
import pytest
from src.loaders.exercise_loader import load_exercises, LoaderError
from src.models.enums import ExerciseType

_TEST_DATA = os.path.join(os.path.dirname(__file__), "data")


class TestValidExerciseLoading:
    def test_loads_all_exercises(self):
        exercises = load_exercises(os.path.join(_TEST_DATA, "valid_exercises.csv"))
        assert len(exercises) == 3

    def test_exercise_fields(self):
        exercises = load_exercises(os.path.join(_TEST_DATA, "valid_exercises.csv"))
        bench = exercises[0]
        assert bench.key == "bench_press"
        assert bench.name == "Bench Press"
        assert bench.type == ExerciseType.REPS_WEIGHT
        assert bench.equipment == "Barbell"
        assert bench.muscle_group == "Chest"

    def test_all_three_types(self):
        exercises = load_exercises(os.path.join(_TEST_DATA, "valid_exercises.csv"))
        types = {e.type for e in exercises}
        assert types == {ExerciseType.REPS_WEIGHT, ExerciseType.TIME, ExerciseType.CARDIO}

    def test_exercises_are_frozen(self):
        exercises = load_exercises(os.path.join(_TEST_DATA, "valid_exercises.csv"))
        with pytest.raises(AttributeError):
            exercises[0].name = "Changed"

    def test_production_csv_loads(self):
        """The real exercises.csv loads without errors."""
        from src.config import EXERCISES_CSV_PATH
        exercises = load_exercises(EXERCISES_CSV_PATH)
        assert len(exercises) > 50  # We know there are ~78 exercises
        keys = [e.key for e in exercises]
        assert len(keys) == len(set(keys))  # All keys unique


class TestExerciseLoaderValidation:
    def test_duplicate_key_fails(self):
        with pytest.raises(LoaderError, match="duplicate exercise key 'bench_press'"):
            load_exercises(os.path.join(_TEST_DATA, "duplicate_key_exercises.csv"))

    def test_invalid_type_fails(self):
        with pytest.raises(LoaderError, match="invalid exercise type 'reps_only'"):
            load_exercises(os.path.join(_TEST_DATA, "bad_type_exercises.csv"))

    def test_missing_file_fails(self):
        with pytest.raises(FileNotFoundError):
            load_exercises("/nonexistent/path.csv")

    def test_empty_csv_fails(self, tmp_path):
        csv_file = tmp_path / "empty.csv"
        csv_file.write_text("key,name,type,equipment,muscle_group\n")
        with pytest.raises(LoaderError, match="no exercises found"):
            load_exercises(str(csv_file))

    def test_missing_column_fails(self, tmp_path):
        csv_file = tmp_path / "bad_header.csv"
        csv_file.write_text("key,name,type\nbench,Bench,reps_weight\n")
        with pytest.raises(LoaderError, match="missing required columns"):
            load_exercises(str(csv_file))

    def test_empty_key_fails(self, tmp_path):
        csv_file = tmp_path / "empty_key.csv"
        csv_file.write_text("key,name,type,equipment,muscle_group\n,Bench,reps_weight,Barbell,Chest\n")
        with pytest.raises(LoaderError, match="empty exercise key"):
            load_exercises(str(csv_file))

    def test_empty_name_fails(self, tmp_path):
        csv_file = tmp_path / "empty_name.csv"
        csv_file.write_text("key,name,type,equipment,muscle_group\nbench,,reps_weight,Barbell,Chest\n")
        with pytest.raises(LoaderError, match="empty exercise name"):
            load_exercises(str(csv_file))
```

- [ ] **Step 6: Run tests, verify all pass**

```bash
pytest tests/test_exercise_loader.py -v
```

- [ ] **Step 7: Commit**

```
feat(v2): exercise CSV loader with fail-fast validation
```

---

## Task 4: Exercise Registry

**Files:** `src/registries/__init__.py`, `src/registries/exercise_registry.py`

**Why:** Routine and benchmark loaders need the exercise registry for cross-reference validation.

- [ ] **Step 1: Create `src/registries/__init__.py`** (empty)

- [ ] **Step 2: Create `src/registries/exercise_registry.py`**

```python
"""In-memory exercise registry — loaded once at startup, read-only at runtime."""
from __future__ import annotations
from typing import List, Optional
from src.models.bundled import Exercise
from src.models.enums import ExerciseType


class ExerciseRegistry:
    """Immutable registry of exercises loaded from CSV.

    Provides O(1) lookup by key and filtered listing.
    """

    def __init__(self, exercises: List[Exercise]):
        self._by_key: dict[str, Exercise] = {}
        for ex in exercises:
            if ex.key in self._by_key:
                raise ValueError(f"Duplicate exercise key: {ex.key}")
            self._by_key[ex.key] = ex
        self._all: tuple[Exercise, ...] = tuple(exercises)

    def get(self, key: str) -> Optional[Exercise]:
        """Get exercise by key, or None if not found."""
        return self._by_key.get(key)

    def get_or_raise(self, key: str) -> Exercise:
        """Get exercise by key, or raise KeyError."""
        ex = self._by_key.get(key)
        if ex is None:
            raise KeyError(f"Unknown exercise key: '{key}'")
        return ex

    def contains(self, key: str) -> bool:
        """Check if an exercise key exists."""
        return key in self._by_key

    def list_all(self) -> tuple[Exercise, ...]:
        """Return all exercises in load order."""
        return self._all

    def list_by_type(self, exercise_type: ExerciseType) -> List[Exercise]:
        """Return exercises filtered by type."""
        return [ex for ex in self._all if ex.type == exercise_type]

    def list_by_muscle_group(self, muscle_group: str) -> List[Exercise]:
        """Return exercises filtered by muscle group (case-sensitive)."""
        return [ex for ex in self._all if ex.muscle_group == muscle_group]

    def __len__(self) -> int:
        return len(self._all)

    def __contains__(self, key: str) -> bool:
        return key in self._by_key
```

- [ ] **Step 3: Tests are in Task 7 (`test_registries.py`) — noted here for dependency tracking.**

- [ ] **Step 4: Commit**

```
feat(v2): exercise registry with key lookup and filtered listing
```

---

## Task 5: Routine Loader (YAML) + Test Data

**Files:** `src/loaders/routine_loader.py`, `src/data/routines/push_pull_legs.yaml`, `tests/data/valid_routine.yaml`, `tests/data/bad_routine_*.yaml`, `tests/test_routine_loader.py`

**Why:** Depends on ExerciseRegistry for cross-reference validation.

- [ ] **Step 1: Create `src/loaders/routine_loader.py`**

```python
"""Load routine templates from YAML.

Fail-fast: any invalid data raises LoaderError.
"""
from __future__ import annotations
import os
from typing import List, Optional
import yaml
from src.loaders.exercise_loader import LoaderError
from src.models.enums import ExerciseType, SetScheme
from src.models.bundled import DayExercise, RoutineDay, Routine
from src.registries.exercise_registry import ExerciseRegistry


def _parse_reps(reps_str: str, file_path: str, context: str) -> tuple[int, int]:
    """Parse reps string like '8' or '8-12' into (min, max).

    Raises LoaderError on invalid syntax.
    """
    reps_str = str(reps_str).strip()
    if "-" in reps_str:
        parts = reps_str.split("-")
        if len(parts) != 2:
            raise LoaderError(f"{file_path}: {context}: invalid reps syntax '{reps_str}'")
        try:
            rmin, rmax = int(parts[0]), int(parts[1])
        except ValueError:
            raise LoaderError(f"{file_path}: {context}: invalid reps syntax '{reps_str}'")
        if rmin < 1 or rmax < 1:
            raise LoaderError(f"{file_path}: {context}: reps must be >= 1, got '{reps_str}'")
        if rmin > rmax:
            raise LoaderError(f"{file_path}: {context}: reps min > max in '{reps_str}'")
        return rmin, rmax
    else:
        try:
            val = int(reps_str)
        except ValueError:
            raise LoaderError(f"{file_path}: {context}: invalid reps syntax '{reps_str}'")
        if val < 1:
            raise LoaderError(f"{file_path}: {context}: reps must be >= 1, got {val}")
        return val, val


def load_routine(yaml_path: str, exercise_registry: ExerciseRegistry) -> Routine:
    """Load and validate a single routine template from YAML.

    Args:
        yaml_path: Path to the routine YAML file.
        exercise_registry: For validating exercise_key references.

    Returns:
        Validated Routine dataclass.

    Raises:
        LoaderError: On any validation failure.
        FileNotFoundError: If the YAML file doesn't exist.
    """
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict):
        raise LoaderError(f"{yaml_path}: expected a YAML mapping at top level")

    # Validate top-level fields
    routine_key = data.get("key")
    if not routine_key or not isinstance(routine_key, str):
        raise LoaderError(f"{yaml_path}: missing or empty 'key'")

    routine_name = data.get("name")
    if not routine_name or not isinstance(routine_name, str):
        raise LoaderError(f"{yaml_path}: missing or empty 'name'")

    description = data.get("description", "")

    days_raw = data.get("days")
    if not days_raw or not isinstance(days_raw, list):
        raise LoaderError(f"{yaml_path}: missing or empty 'days' list")

    # Parse days
    seen_day_keys: set[str] = set()
    seen_day_labels: set[str] = set()
    days: List[RoutineDay] = []

    for day_idx, day_data in enumerate(days_raw):
        if not isinstance(day_data, dict):
            raise LoaderError(f"{yaml_path}: day[{day_idx}] is not a mapping")

        day_key = day_data.get("key")
        if not day_key or not isinstance(day_key, str):
            raise LoaderError(f"{yaml_path}: day[{day_idx}] missing or empty 'key'")
        if day_key in seen_day_keys:
            raise LoaderError(
                f"{yaml_path}: duplicate day key '{day_key}' in routine '{routine_key}'"
            )
        seen_day_keys.add(day_key)

        day_label = day_data.get("label")
        if not day_label or not isinstance(day_label, str):
            raise LoaderError(f"{yaml_path}: day '{day_key}' missing or empty 'label'")
        if day_label in seen_day_labels:
            raise LoaderError(
                f"{yaml_path}: duplicate day label '{day_label}' in routine '{routine_key}'"
            )
        seen_day_labels.add(day_label)

        day_name = day_data.get("name")
        if not day_name or not isinstance(day_name, str):
            raise LoaderError(f"{yaml_path}: day '{day_key}' missing or empty 'name'")

        exercises_raw = day_data.get("exercises")
        if not exercises_raw or not isinstance(exercises_raw, list):
            raise LoaderError(f"{yaml_path}: day '{day_key}' missing or empty 'exercises' list")

        # Parse exercises for this day
        day_exercises: List[DayExercise] = []

        for ex_idx, ex_data in enumerate(exercises_raw):
            if not isinstance(ex_data, dict):
                raise LoaderError(
                    f"{yaml_path}: day '{day_key}' exercise[{ex_idx}] is not a mapping"
                )

            exercise_key = ex_data.get("exercise_key")
            if not exercise_key or not isinstance(exercise_key, str):
                raise LoaderError(
                    f"{yaml_path}: day '{day_key}' exercise[{ex_idx}] missing 'exercise_key'"
                )

            ctx = f"day '{day_key}' exercise '{exercise_key}'"

            # Validate exercise_key exists in registry
            exercise = exercise_registry.get(exercise_key)
            if exercise is None:
                raise LoaderError(
                    f"{yaml_path}: {ctx}: unknown exercise_key '{exercise_key}'"
                )

            # Parse sets (required)
            sets_raw = ex_data.get("sets")
            if sets_raw is None:
                raise LoaderError(f"{yaml_path}: {ctx}: missing 'sets'")
            try:
                sets = int(sets_raw)
            except (ValueError, TypeError):
                raise LoaderError(f"{yaml_path}: {ctx}: 'sets' must be an integer")
            if sets < 1:
                raise LoaderError(f"{yaml_path}: {ctx}: 'sets' must be >= 1")

            # Parse scheme (default: uniform)
            scheme_str = ex_data.get("scheme", "uniform")
            try:
                scheme = SetScheme(scheme_str)
            except ValueError:
                raise LoaderError(
                    f"{yaml_path}: {ctx}: invalid scheme '{scheme_str}'. "
                    f"Valid: {[s.value for s in SetScheme]}"
                )

            # Validate scheme vs exercise type
            if scheme == SetScheme.PROGRESSIVE and exercise.type != ExerciseType.REPS_WEIGHT:
                raise LoaderError(
                    f"{yaml_path}: {ctx}: 'progressive' scheme only valid for "
                    f"reps_weight exercises, but '{exercise_key}' is {exercise.type.value}"
                )

            # Parse type-specific target fields
            reps_min: Optional[int] = None
            reps_max: Optional[int] = None
            duration_seconds: Optional[int] = None
            distance_km: Optional[float] = None

            reps_raw = ex_data.get("reps")
            duration_raw = ex_data.get("duration_seconds")
            distance_raw = ex_data.get("distance_km")

            if exercise.type == ExerciseType.REPS_WEIGHT:
                # Progressive: no reps allowed
                if scheme == SetScheme.PROGRESSIVE:
                    if reps_raw is not None:
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: progressive exercises must not specify 'reps'"
                        )
                else:
                    # Uniform: reps optional (but if provided, must be valid)
                    if reps_raw is not None:
                        reps_min, reps_max = _parse_reps(str(reps_raw), yaml_path, ctx)

            elif exercise.type == ExerciseType.TIME:
                # duration_seconds required for time exercises
                if duration_raw is None:
                    raise LoaderError(
                        f"{yaml_path}: {ctx}: 'duration_seconds' required for time exercises"
                    )
                try:
                    duration_seconds = int(duration_raw)
                except (ValueError, TypeError):
                    raise LoaderError(
                        f"{yaml_path}: {ctx}: 'duration_seconds' must be an integer"
                    )
                if duration_seconds < 1:
                    raise LoaderError(
                        f"{yaml_path}: {ctx}: 'duration_seconds' must be >= 1"
                    )

            elif exercise.type == ExerciseType.CARDIO:
                # Both optional in plan
                if duration_raw is not None:
                    try:
                        duration_seconds = int(duration_raw)
                    except (ValueError, TypeError):
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: 'duration_seconds' must be an integer"
                        )
                    if duration_seconds < 1:
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: 'duration_seconds' must be >= 1"
                        )
                if distance_raw is not None:
                    try:
                        distance_km = float(distance_raw)
                    except (ValueError, TypeError):
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: 'distance_km' must be a number"
                        )
                    if distance_km <= 0:
                        raise LoaderError(
                            f"{yaml_path}: {ctx}: 'distance_km' must be > 0"
                        )

            notes = ex_data.get("notes")
            if notes is not None:
                notes = str(notes).strip() or None

            day_exercises.append(DayExercise(
                exercise_key=exercise_key,
                scheme=scheme,
                sets=sets,
                reps_min=reps_min,
                reps_max=reps_max,
                duration_seconds=duration_seconds,
                distance_km=distance_km,
                notes=notes,
            ))

        days.append(RoutineDay(
            key=day_key,
            label=day_label,
            name=day_name,
            exercises=tuple(day_exercises),
        ))

    return Routine(
        key=routine_key,
        name=routine_name,
        description=description,
        days=tuple(days),
    )


def load_all_routines(
    routines_dir: str, exercise_registry: ExerciseRegistry
) -> List[Routine]:
    """Load all routine YAML files from a directory.

    Args:
        routines_dir: Path to directory containing *.yaml files.
        exercise_registry: For validating exercise_key references.

    Returns:
        List of validated Routine dataclasses.

    Raises:
        LoaderError: On any validation failure or duplicate routine keys.
    """
    if not os.path.isdir(routines_dir):
        raise LoaderError(f"{routines_dir}: not a directory")

    yaml_files = sorted(
        f for f in os.listdir(routines_dir) if f.endswith((".yaml", ".yml"))
    )

    if not yaml_files:
        raise LoaderError(f"{routines_dir}: no YAML files found")

    routines: List[Routine] = []
    seen_keys: set[str] = set()

    for filename in yaml_files:
        filepath = os.path.join(routines_dir, filename)
        routine = load_routine(filepath, exercise_registry)
        if routine.key in seen_keys:
            raise LoaderError(
                f"{filepath}: duplicate routine key '{routine.key}'"
            )
        seen_keys.add(routine.key)
        routines.append(routine)

    return routines
```

- [ ] **Step 2: Create `src/data/routines/push_pull_legs.yaml`**

```yaml
key: push_pull_legs
name: Push Pull Legs
description: 3-day split focused on basic compounds and accessories
days:
  - key: push
    label: A
    name: Push
    exercises:
      - exercise_key: barbell_bench_press
        scheme: progressive
        sets: 3
      - exercise_key: dumbbell_shoulder_press
        scheme: uniform
        sets: 4
        reps: 8-12
      - exercise_key: cable_crossover
        sets: 3
        reps: 12-15
        notes: Squeeze at peak contraction
      - exercise_key: plank
        sets: 3
        duration_seconds: 60
      - exercise_key: running
        sets: 1

  - key: pull
    label: B
    name: Pull
    exercises:
      - exercise_key: barbell_deadlift
        scheme: progressive
        sets: 3
      - exercise_key: pull_up
        sets: 4
        reps: 6-10
      - exercise_key: seated_cable_row
        sets: 3
        reps: 8-12
      - exercise_key: 2km_rowing
        sets: 3
        distance_km: 2.0

  - key: legs
    label: C
    name: Legs
    exercises:
      - exercise_key: barbell_back_squat
        scheme: progressive
        sets: 3
      - exercise_key: leg_press
        sets: 4
        reps: 10-15
      - exercise_key: leg_curl
        sets: 3
        reps: 10-12
      - exercise_key: calf_raise_machine
        sets: 4
        reps: 12-15
```

- [ ] **Step 3: Create test data YAML files**

`tests/data/valid_routine.yaml`:
```yaml
key: test_routine
name: Test Routine
description: A test routine for unit tests
days:
  - key: day_a
    label: A
    name: Day A
    exercises:
      - exercise_key: bench_press
        sets: 3
        reps: 8-12
      - exercise_key: plank
        sets: 3
        duration_seconds: 60
      - exercise_key: running
        sets: 1
```

`tests/data/bad_routine_missing_sets.yaml`:
```yaml
key: bad_routine
name: Bad Routine
description: Missing sets field
days:
  - key: day_a
    label: A
    name: Day A
    exercises:
      - exercise_key: bench_press
        reps: 10
```

`tests/data/bad_routine_unknown_exercise.yaml`:
```yaml
key: bad_routine
name: Bad Routine
description: Unknown exercise key
days:
  - key: day_a
    label: A
    name: Day A
    exercises:
      - exercise_key: nonexistent_exercise
        sets: 3
```

`tests/data/bad_routine_progressive_time.yaml`:
```yaml
key: bad_routine
name: Bad Routine
description: Progressive on a time exercise
days:
  - key: day_a
    label: A
    name: Day A
    exercises:
      - exercise_key: plank
        scheme: progressive
        sets: 3
```

`tests/data/bad_routine_duplicate_day_key.yaml`:
```yaml
key: bad_routine
name: Bad Routine
description: Duplicate day keys
days:
  - key: day_a
    label: A
    name: Day A
    exercises:
      - exercise_key: bench_press
        sets: 3
  - key: day_a
    label: B
    name: Day B
    exercises:
      - exercise_key: bench_press
        sets: 3
```

`tests/data/bad_routine_duplicate_day_label.yaml`:
```yaml
key: bad_routine
name: Bad Routine
description: Duplicate day labels
days:
  - key: day_a
    label: A
    name: Day A
    exercises:
      - exercise_key: bench_press
        sets: 3
  - key: day_b
    label: A
    name: Day B
    exercises:
      - exercise_key: bench_press
        sets: 3
```

`tests/data/bad_routine_time_no_duration.yaml`:
```yaml
key: bad_routine
name: Bad Routine
description: Time exercise without duration_seconds
days:
  - key: day_a
    label: A
    name: Day A
    exercises:
      - exercise_key: plank
        sets: 3
```

- [ ] **Step 4: Create `tests/test_routine_loader.py`**

```python
"""Tests for routine YAML loader — valid parsing and fail-fast validation."""
import os
import pytest
from src.loaders.exercise_loader import LoaderError
from src.loaders.routine_loader import load_routine, load_all_routines
from src.models.enums import ExerciseType, SetScheme
from src.models.bundled import Exercise
from src.registries.exercise_registry import ExerciseRegistry

_TEST_DATA = os.path.join(os.path.dirname(__file__), "data")


@pytest.fixture
def exercise_registry():
    """Minimal exercise registry for routine loader tests."""
    exercises = [
        Exercise(key="bench_press", name="Bench Press", type=ExerciseType.REPS_WEIGHT,
                 equipment="Barbell", muscle_group="Chest"),
        Exercise(key="plank", name="Plank", type=ExerciseType.TIME,
                 equipment="Bodyweight", muscle_group="Core"),
        Exercise(key="running", name="Running", type=ExerciseType.CARDIO,
                 equipment="None", muscle_group="Cardio"),
    ]
    return ExerciseRegistry(exercises)


class TestValidRoutineLoading:
    def test_loads_routine(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        assert routine.key == "test_routine"
        assert routine.name == "Test Routine"
        assert len(routine.days) == 1

    def test_day_fields(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        day = routine.days[0]
        assert day.key == "day_a"
        assert day.label == "A"
        assert day.name == "Day A"
        assert len(day.exercises) == 3

    def test_reps_weight_exercise(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        bench = routine.days[0].exercises[0]
        assert bench.exercise_key == "bench_press"
        assert bench.scheme == SetScheme.UNIFORM
        assert bench.sets == 3
        assert bench.reps_min == 8
        assert bench.reps_max == 12

    def test_time_exercise(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        plank = routine.days[0].exercises[1]
        assert plank.exercise_key == "plank"
        assert plank.duration_seconds == 60
        assert plank.reps_min is None

    def test_cardio_exercise_no_targets(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        run = routine.days[0].exercises[2]
        assert run.exercise_key == "running"
        assert run.sets == 1
        assert run.duration_seconds is None
        assert run.distance_km is None

    def test_routine_is_frozen(self, exercise_registry):
        routine = load_routine(
            os.path.join(_TEST_DATA, "valid_routine.yaml"), exercise_registry
        )
        with pytest.raises(AttributeError):
            routine.name = "Changed"

    def test_exact_reps_parses_as_equal_min_max(self, exercise_registry, tmp_path):
        """reps: 10 parses as reps_min=10, reps_max=10."""
        yaml_file = tmp_path / "exact_reps.yaml"
        yaml_file.write_text(
            "key: test\nname: Test\ndescription: test\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: bench_press\n        sets: 3\n        reps: 10\n"
        )
        routine = load_routine(str(yaml_file), exercise_registry)
        ex = routine.days[0].exercises[0]
        assert ex.reps_min == 10
        assert ex.reps_max == 10

    def test_production_routines_load(self):
        """The real routines directory loads without errors."""
        from src.config import EXERCISES_CSV_PATH, ROUTINES_DIR
        from src.loaders.exercise_loader import load_exercises
        exercises = load_exercises(EXERCISES_CSV_PATH)
        reg = ExerciseRegistry(exercises)
        routines = load_all_routines(ROUTINES_DIR, reg)
        assert len(routines) >= 1
        for r in routines:
            assert r.key
            assert len(r.days) >= 1


class TestRoutineLoaderValidation:
    def test_missing_sets_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="missing 'sets'"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_missing_sets.yaml"),
                exercise_registry,
            )

    def test_unknown_exercise_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="unknown exercise_key"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_unknown_exercise.yaml"),
                exercise_registry,
            )

    def test_progressive_on_time_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="progressive.*only valid for reps_weight"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_progressive_time.yaml"),
                exercise_registry,
            )

    def test_duplicate_day_key_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="duplicate day key"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_duplicate_day_key.yaml"),
                exercise_registry,
            )

    def test_duplicate_day_label_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="duplicate day label"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_duplicate_day_label.yaml"),
                exercise_registry,
            )

    def test_time_without_duration_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="duration_seconds.*required"):
            load_routine(
                os.path.join(_TEST_DATA, "bad_routine_time_no_duration.yaml"),
                exercise_registry,
            )

    def test_missing_file_fails(self, exercise_registry):
        with pytest.raises(FileNotFoundError):
            load_routine("/nonexistent/path.yaml", exercise_registry)

    def test_progressive_with_reps_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "prog_reps.yaml"
        yaml_file.write_text(
            "key: test\nname: Test\ndescription: test\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: bench_press\n        scheme: progressive\n"
            "        sets: 3\n        reps: 8-12\n"
        )
        with pytest.raises(LoaderError, match="progressive.*must not specify.*reps"):
            load_routine(str(yaml_file), exercise_registry)

    def test_invalid_reps_syntax_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "bad_reps.yaml"
        yaml_file.write_text(
            "key: test\nname: Test\ndescription: test\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: bench_press\n        sets: 3\n        reps: abc\n"
        )
        with pytest.raises(LoaderError, match="invalid reps syntax"):
            load_routine(str(yaml_file), exercise_registry)

    def test_duplicate_routine_key_across_files_fails(self, exercise_registry, tmp_path):
        """load_all_routines detects duplicate keys across files."""
        dir_path = tmp_path / "routines"
        dir_path.mkdir()
        routine_yaml = (
            "key: same_key\nname: Routine\ndescription: d\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: bench_press\n        sets: 3\n"
        )
        (dir_path / "a.yaml").write_text(routine_yaml)
        (dir_path / "b.yaml").write_text(routine_yaml)
        with pytest.raises(LoaderError, match="duplicate routine key"):
            load_all_routines(str(dir_path), exercise_registry)

    def test_cardio_with_targets_accepted(self, exercise_registry, tmp_path):
        """Cardio exercises with both duration and distance are valid."""
        yaml_file = tmp_path / "cardio_targets.yaml"
        yaml_file.write_text(
            "key: test\nname: Test\ndescription: test\ndays:\n"
            "  - key: d\n    label: A\n    name: D\n    exercises:\n"
            "      - exercise_key: running\n        sets: 1\n"
            "        duration_seconds: 1800\n        distance_km: 5.0\n"
        )
        routine = load_routine(str(yaml_file), exercise_registry)
        ex = routine.days[0].exercises[0]
        assert ex.duration_seconds == 1800
        assert ex.distance_km == 5.0
```

- [ ] **Step 5: Run tests, verify all pass**

```bash
pytest tests/test_routine_loader.py -v
```

- [ ] **Step 6: Commit**

```
feat(v2): routine YAML loader with cross-reference validation
```

---

## Task 6: Benchmark Loader (YAML) + Test Data

**Files:** `src/loaders/benchmark_loader.py`, `src/data/benchmarks.yaml`, `tests/data/valid_benchmarks.yaml`, `tests/data/bad_benchmarks_*.yaml`, `tests/test_benchmark_loader.py`

**Why:** Depends on ExerciseRegistry for cross-reference validation.

- [ ] **Step 1: Create `src/loaders/benchmark_loader.py`**

```python
"""Load benchmark config from YAML.

Fail-fast: any invalid data raises LoaderError.
"""
from __future__ import annotations
import yaml
from src.loaders.exercise_loader import LoaderError
from src.models.enums import BenchmarkMethod
from src.models.bundled import BenchmarkItem, BenchmarkConfig
from src.registries.exercise_registry import ExerciseRegistry


_VALID_METHODS = {m.value: m for m in BenchmarkMethod}


def load_benchmark_config(
    yaml_path: str, exercise_registry: ExerciseRegistry
) -> BenchmarkConfig:
    """Load and validate benchmark configuration from YAML.

    Args:
        yaml_path: Path to benchmarks.yaml.
        exercise_registry: For validating exercise_key references.

    Returns:
        Validated BenchmarkConfig dataclass.

    Raises:
        LoaderError: On any validation failure.
        FileNotFoundError: If the YAML file doesn't exist.
    """
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict):
        raise LoaderError(f"{yaml_path}: expected a YAML mapping at top level")

    # Validate frequency_weeks
    freq = data.get("frequency_weeks")
    if freq is None:
        raise LoaderError(f"{yaml_path}: missing 'frequency_weeks'")
    try:
        frequency_weeks = int(freq)
    except (ValueError, TypeError):
        raise LoaderError(f"{yaml_path}: 'frequency_weeks' must be an integer")
    if frequency_weeks < 1:
        raise LoaderError(f"{yaml_path}: 'frequency_weeks' must be >= 1")

    # Validate items
    items_raw = data.get("items")
    if not items_raw or not isinstance(items_raw, list):
        raise LoaderError(f"{yaml_path}: missing or empty 'items' list")

    seen_keys: set[str] = set()
    items = []

    for idx, item_data in enumerate(items_raw):
        if not isinstance(item_data, dict):
            raise LoaderError(f"{yaml_path}: items[{idx}] is not a mapping")

        exercise_key = item_data.get("exercise_key")
        if not exercise_key or not isinstance(exercise_key, str):
            raise LoaderError(f"{yaml_path}: items[{idx}] missing 'exercise_key'")

        # Check for duplicate exercise_key
        if exercise_key in seen_keys:
            raise LoaderError(
                f"{yaml_path}: duplicate exercise_key '{exercise_key}' in benchmark items"
            )
        seen_keys.add(exercise_key)

        # Validate exercise_key exists in registry
        if not exercise_registry.contains(exercise_key):
            raise LoaderError(
                f"{yaml_path}: items[{idx}]: unknown exercise_key '{exercise_key}'"
            )

        method_str = item_data.get("method")
        if not method_str or not isinstance(method_str, str):
            raise LoaderError(f"{yaml_path}: items[{idx}] missing 'method'")
        if method_str not in _VALID_METHODS:
            raise LoaderError(
                f"{yaml_path}: items[{idx}]: invalid method '{method_str}'. "
                f"Valid: {sorted(_VALID_METHODS.keys())}"
            )

        items.append(BenchmarkItem(
            exercise_key=exercise_key,
            method=_VALID_METHODS[method_str],
        ))

    return BenchmarkConfig(
        frequency_weeks=frequency_weeks,
        items=tuple(items),
    )
```

- [ ] **Step 2: Create `src/data/benchmarks.yaml`**

```yaml
frequency_weeks: 6
items:
  - exercise_key: barbell_bench_press
    method: max_weight
  - exercise_key: barbell_back_squat
    method: max_weight
  - exercise_key: barbell_deadlift
    method: max_weight
  - exercise_key: pull_up
    method: max_reps
  - exercise_key: plank
    method: timed_hold
```

- [ ] **Step 3: Create test data YAML files**

`tests/data/valid_benchmarks.yaml`:
```yaml
frequency_weeks: 6
items:
  - exercise_key: bench_press
    method: max_weight
  - exercise_key: plank
    method: timed_hold
```

`tests/data/bad_benchmarks_duplicate.yaml`:
```yaml
frequency_weeks: 6
items:
  - exercise_key: bench_press
    method: max_weight
  - exercise_key: bench_press
    method: max_reps
```

`tests/data/bad_benchmarks_unknown_exercise.yaml`:
```yaml
frequency_weeks: 6
items:
  - exercise_key: nonexistent_exercise
    method: max_weight
```

- [ ] **Step 4: Create `tests/test_benchmark_loader.py`**

```python
"""Tests for benchmark YAML loader — valid parsing and fail-fast validation."""
import os
import pytest
from src.loaders.exercise_loader import LoaderError
from src.loaders.benchmark_loader import load_benchmark_config
from src.models.enums import ExerciseType, BenchmarkMethod
from src.models.bundled import Exercise
from src.registries.exercise_registry import ExerciseRegistry

_TEST_DATA = os.path.join(os.path.dirname(__file__), "data")


@pytest.fixture
def exercise_registry():
    """Minimal exercise registry for benchmark loader tests."""
    exercises = [
        Exercise(key="bench_press", name="Bench Press", type=ExerciseType.REPS_WEIGHT,
                 equipment="Barbell", muscle_group="Chest"),
        Exercise(key="plank", name="Plank", type=ExerciseType.TIME,
                 equipment="Bodyweight", muscle_group="Core"),
        Exercise(key="running", name="Running", type=ExerciseType.CARDIO,
                 equipment="None", muscle_group="Cardio"),
    ]
    return ExerciseRegistry(exercises)


class TestValidBenchmarkLoading:
    def test_loads_config(self, exercise_registry):
        config = load_benchmark_config(
            os.path.join(_TEST_DATA, "valid_benchmarks.yaml"), exercise_registry
        )
        assert config.frequency_weeks == 6
        assert len(config.items) == 2

    def test_item_fields(self, exercise_registry):
        config = load_benchmark_config(
            os.path.join(_TEST_DATA, "valid_benchmarks.yaml"), exercise_registry
        )
        bench = config.items[0]
        assert bench.exercise_key == "bench_press"
        assert bench.method == BenchmarkMethod.MAX_WEIGHT

        plank = config.items[1]
        assert plank.exercise_key == "plank"
        assert plank.method == BenchmarkMethod.TIMED_HOLD

    def test_config_is_frozen(self, exercise_registry):
        config = load_benchmark_config(
            os.path.join(_TEST_DATA, "valid_benchmarks.yaml"), exercise_registry
        )
        with pytest.raises(AttributeError):
            config.frequency_weeks = 12

    def test_production_benchmarks_load(self):
        """The real benchmarks.yaml loads without errors."""
        from src.config import EXERCISES_CSV_PATH, BENCHMARKS_YAML_PATH
        from src.loaders.exercise_loader import load_exercises
        exercises = load_exercises(EXERCISES_CSV_PATH)
        reg = ExerciseRegistry(exercises)
        config = load_benchmark_config(BENCHMARKS_YAML_PATH, reg)
        assert config.frequency_weeks >= 1
        assert len(config.items) >= 1


class TestBenchmarkLoaderValidation:
    def test_duplicate_exercise_key_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="duplicate exercise_key 'bench_press'"):
            load_benchmark_config(
                os.path.join(_TEST_DATA, "bad_benchmarks_duplicate.yaml"),
                exercise_registry,
            )

    def test_unknown_exercise_fails(self, exercise_registry):
        with pytest.raises(LoaderError, match="unknown exercise_key"):
            load_benchmark_config(
                os.path.join(_TEST_DATA, "bad_benchmarks_unknown_exercise.yaml"),
                exercise_registry,
            )

    def test_missing_file_fails(self, exercise_registry):
        with pytest.raises(FileNotFoundError):
            load_benchmark_config("/nonexistent/path.yaml", exercise_registry)

    def test_missing_frequency_weeks_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "no_freq.yaml"
        yaml_file.write_text(
            "items:\n  - exercise_key: bench_press\n    method: max_weight\n"
        )
        with pytest.raises(LoaderError, match="missing 'frequency_weeks'"):
            load_benchmark_config(str(yaml_file), exercise_registry)

    def test_invalid_method_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "bad_method.yaml"
        yaml_file.write_text(
            "frequency_weeks: 6\nitems:\n"
            "  - exercise_key: bench_press\n    method: one_rep_max\n"
        )
        with pytest.raises(LoaderError, match="invalid method"):
            load_benchmark_config(str(yaml_file), exercise_registry)

    def test_empty_items_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "empty_items.yaml"
        yaml_file.write_text("frequency_weeks: 6\nitems: []\n")
        with pytest.raises(LoaderError, match="missing or empty 'items'"):
            load_benchmark_config(str(yaml_file), exercise_registry)

    def test_zero_frequency_fails(self, exercise_registry, tmp_path):
        yaml_file = tmp_path / "zero_freq.yaml"
        yaml_file.write_text(
            "frequency_weeks: 0\nitems:\n"
            "  - exercise_key: bench_press\n    method: max_weight\n"
        )
        with pytest.raises(LoaderError, match="frequency_weeks.*must be >= 1"):
            load_benchmark_config(str(yaml_file), exercise_registry)
```

- [ ] **Step 5: Run tests, verify all pass**

```bash
pytest tests/test_benchmark_loader.py -v
```

- [ ] **Step 6: Commit**

```
feat(v2): benchmark YAML loader with fail-fast validation
```

---

## Task 7: Registries (Routine + Benchmark) + Registry Tests

**Files:** `src/registries/routine_registry.py`, `src/registries/benchmark_registry.py`, `tests/test_registries.py`

**Why:** Complete the registry layer. All three registries tested together.

- [ ] **Step 1: Create `src/registries/routine_registry.py`**

```python
"""In-memory routine registry — loaded once at startup, read-only at runtime."""
from __future__ import annotations
from typing import List, Optional
from src.models.bundled import Routine, RoutineDay


class RoutineRegistry:
    """Immutable registry of routine templates loaded from YAML."""

    def __init__(self, routines: List[Routine]):
        self._by_key: dict[str, Routine] = {}
        for routine in routines:
            if routine.key in self._by_key:
                raise ValueError(f"Duplicate routine key: {routine.key}")
            self._by_key[routine.key] = routine
        self._all: tuple[Routine, ...] = tuple(routines)

    def get(self, key: str) -> Optional[Routine]:
        """Get routine by key, or None if not found."""
        return self._by_key.get(key)

    def get_or_raise(self, key: str) -> Routine:
        """Get routine by key, or raise KeyError."""
        routine = self._by_key.get(key)
        if routine is None:
            raise KeyError(f"Unknown routine key: '{key}'")
        return routine

    def contains(self, key: str) -> bool:
        """Check if a routine key exists."""
        return key in self._by_key

    def list_all(self) -> tuple[Routine, ...]:
        """Return all routines in load order."""
        return self._all

    def get_day(self, routine_key: str, day_key: str) -> Optional[RoutineDay]:
        """Get a specific day within a routine, or None if not found."""
        routine = self._by_key.get(routine_key)
        if routine is None:
            return None
        for day in routine.days:
            if day.key == day_key:
                return day
        return None

    def get_next_day_key(self, routine_key: str, current_day_key: str) -> str:
        """Get the next day key in the routine cycle (wraps to first).

        Args:
            routine_key: The routine key.
            current_day_key: The current day key.

        Returns:
            The next day's key, wrapping to first if at end.

        Raises:
            KeyError: If routine_key or current_day_key not found.
        """
        routine = self.get_or_raise(routine_key)
        for i, day in enumerate(routine.days):
            if day.key == current_day_key:
                next_idx = (i + 1) % len(routine.days)
                return routine.days[next_idx].key
        raise KeyError(
            f"Day key '{current_day_key}' not found in routine '{routine_key}'"
        )

    def __len__(self) -> int:
        return len(self._all)

    def __contains__(self, key: str) -> bool:
        return key in self._by_key
```

- [ ] **Step 2: Create `src/registries/benchmark_registry.py`**

```python
"""In-memory benchmark registry — loaded once at startup, read-only at runtime."""
from __future__ import annotations
from typing import Optional
from src.models.bundled import BenchmarkConfig, BenchmarkItem


class BenchmarkRegistry:
    """Immutable registry of benchmark configuration loaded from YAML."""

    def __init__(self, config: BenchmarkConfig):
        self._config = config
        self._by_key: dict[str, BenchmarkItem] = {
            item.exercise_key: item for item in config.items
        }

    @property
    def frequency_weeks(self) -> int:
        return self._config.frequency_weeks

    def get_item(self, exercise_key: str) -> Optional[BenchmarkItem]:
        """Get benchmark item by exercise key, or None if not found."""
        return self._by_key.get(exercise_key)

    def list_items(self) -> tuple[BenchmarkItem, ...]:
        """Return all benchmark items in config order."""
        return self._config.items

    def __len__(self) -> int:
        return len(self._config.items)

    def __contains__(self, exercise_key: str) -> bool:
        return exercise_key in self._by_key
```

- [ ] **Step 3: Create `tests/test_registries.py`**

```python
"""Tests for in-memory registries — lookups, filtering, immutability."""
import pytest
from src.models.enums import ExerciseType, SetScheme, BenchmarkMethod
from src.models.bundled import (
    Exercise, Routine, RoutineDay, DayExercise,
    BenchmarkConfig, BenchmarkItem,
)
from src.registries.exercise_registry import ExerciseRegistry
from src.registries.routine_registry import RoutineRegistry
from src.registries.benchmark_registry import BenchmarkRegistry


# --- Exercise Registry ---

def _make_exercises():
    return [
        Exercise(key="bench", name="Bench Press", type=ExerciseType.REPS_WEIGHT,
                 equipment="Barbell", muscle_group="Chest"),
        Exercise(key="squat", name="Squat", type=ExerciseType.REPS_WEIGHT,
                 equipment="Barbell", muscle_group="Legs"),
        Exercise(key="plank", name="Plank", type=ExerciseType.TIME,
                 equipment="Bodyweight", muscle_group="Core"),
        Exercise(key="running", name="Running", type=ExerciseType.CARDIO,
                 equipment="None", muscle_group="Cardio"),
    ]


class TestExerciseRegistry:
    def test_get_by_key(self):
        reg = ExerciseRegistry(_make_exercises())
        ex = reg.get("bench")
        assert ex is not None
        assert ex.name == "Bench Press"

    def test_get_missing_returns_none(self):
        reg = ExerciseRegistry(_make_exercises())
        assert reg.get("nonexistent") is None

    def test_get_or_raise_found(self):
        reg = ExerciseRegistry(_make_exercises())
        ex = reg.get_or_raise("bench")
        assert ex.key == "bench"

    def test_get_or_raise_missing(self):
        reg = ExerciseRegistry(_make_exercises())
        with pytest.raises(KeyError, match="Unknown exercise key"):
            reg.get_or_raise("nonexistent")

    def test_contains(self):
        reg = ExerciseRegistry(_make_exercises())
        assert reg.contains("bench")
        assert not reg.contains("nonexistent")
        assert "bench" in reg
        assert "nonexistent" not in reg

    def test_list_all(self):
        reg = ExerciseRegistry(_make_exercises())
        all_ex = reg.list_all()
        assert len(all_ex) == 4
        assert isinstance(all_ex, tuple)

    def test_list_by_type(self):
        reg = ExerciseRegistry(_make_exercises())
        rw = reg.list_by_type(ExerciseType.REPS_WEIGHT)
        assert len(rw) == 2
        assert all(e.type == ExerciseType.REPS_WEIGHT for e in rw)

    def test_list_by_muscle_group(self):
        reg = ExerciseRegistry(_make_exercises())
        chest = reg.list_by_muscle_group("Chest")
        assert len(chest) == 1
        assert chest[0].key == "bench"

    def test_len(self):
        reg = ExerciseRegistry(_make_exercises())
        assert len(reg) == 4

    def test_duplicate_key_raises(self):
        exercises = _make_exercises()
        exercises.append(Exercise(key="bench", name="Dup", type=ExerciseType.REPS_WEIGHT,
                                  equipment="X", muscle_group="X"))
        with pytest.raises(ValueError, match="Duplicate exercise key"):
            ExerciseRegistry(exercises)

    def test_empty_registry(self):
        reg = ExerciseRegistry([])
        assert len(reg) == 0
        assert reg.get("anything") is None


# --- Routine Registry ---

def _make_routines():
    day_a = RoutineDay(
        key="push", label="A", name="Push",
        exercises=(
            DayExercise(exercise_key="bench", scheme=SetScheme.UNIFORM, sets=3, reps_min=8, reps_max=12),
        ),
    )
    day_b = RoutineDay(
        key="pull", label="B", name="Pull",
        exercises=(
            DayExercise(exercise_key="squat", scheme=SetScheme.PROGRESSIVE, sets=3),
        ),
    )
    return [
        Routine(key="ppl", name="Push Pull Legs", description="3-day split", days=(day_a, day_b)),
    ]


class TestRoutineRegistry:
    def test_get_by_key(self):
        reg = RoutineRegistry(_make_routines())
        r = reg.get("ppl")
        assert r is not None
        assert r.name == "Push Pull Legs"

    def test_get_missing_returns_none(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get("nonexistent") is None

    def test_get_or_raise(self):
        reg = RoutineRegistry(_make_routines())
        r = reg.get_or_raise("ppl")
        assert r.key == "ppl"

    def test_get_or_raise_missing(self):
        reg = RoutineRegistry(_make_routines())
        with pytest.raises(KeyError, match="Unknown routine key"):
            reg.get_or_raise("nonexistent")

    def test_contains(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.contains("ppl")
        assert "ppl" in reg
        assert "nonexistent" not in reg

    def test_list_all(self):
        reg = RoutineRegistry(_make_routines())
        all_r = reg.list_all()
        assert len(all_r) == 1
        assert isinstance(all_r, tuple)

    def test_get_day(self):
        reg = RoutineRegistry(_make_routines())
        day = reg.get_day("ppl", "push")
        assert day is not None
        assert day.name == "Push"

    def test_get_day_missing_routine(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get_day("nonexistent", "push") is None

    def test_get_day_missing_day(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get_day("ppl", "nonexistent") is None

    def test_get_next_day_key(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get_next_day_key("ppl", "push") == "pull"

    def test_get_next_day_key_wraps(self):
        reg = RoutineRegistry(_make_routines())
        assert reg.get_next_day_key("ppl", "pull") == "push"

    def test_get_next_day_key_unknown_routine(self):
        reg = RoutineRegistry(_make_routines())
        with pytest.raises(KeyError):
            reg.get_next_day_key("nonexistent", "push")

    def test_get_next_day_key_unknown_day(self):
        reg = RoutineRegistry(_make_routines())
        with pytest.raises(KeyError):
            reg.get_next_day_key("ppl", "nonexistent")

    def test_len(self):
        reg = RoutineRegistry(_make_routines())
        assert len(reg) == 1

    def test_duplicate_key_raises(self):
        routines = _make_routines() + _make_routines()
        with pytest.raises(ValueError, match="Duplicate routine key"):
            RoutineRegistry(routines)


# --- Benchmark Registry ---

def _make_benchmark_config():
    return BenchmarkConfig(
        frequency_weeks=6,
        items=(
            BenchmarkItem(exercise_key="bench", method=BenchmarkMethod.MAX_WEIGHT),
            BenchmarkItem(exercise_key="plank", method=BenchmarkMethod.TIMED_HOLD),
        ),
    )


class TestBenchmarkRegistry:
    def test_frequency_weeks(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        assert reg.frequency_weeks == 6

    def test_get_item(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        item = reg.get_item("bench")
        assert item is not None
        assert item.method == BenchmarkMethod.MAX_WEIGHT

    def test_get_item_missing(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        assert reg.get_item("nonexistent") is None

    def test_list_items(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        items = reg.list_items()
        assert len(items) == 2
        assert isinstance(items, tuple)

    def test_contains(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        assert "bench" in reg
        assert "nonexistent" not in reg

    def test_len(self):
        reg = BenchmarkRegistry(_make_benchmark_config())
        assert len(reg) == 2
```

- [ ] **Step 4: Run tests, verify all pass**

```bash
pytest tests/test_registries.py -v
```

- [ ] **Step 5: Commit**

```
feat(v2): routine and benchmark registries with full test coverage
```

---

## Task 8: Repositories (Base + Settings + Workout + Benchmark)

**Files:** `src/repositories/__init__.py`, `src/repositories/base.py`, `src/repositories/settings_repo.py`, `src/repositories/workout_repo.py`, `src/repositories/benchmark_repo.py`, `tests/test_settings_repo.py`, `tests/test_workout_repo.py`, `tests/test_benchmark_repo.py`

**Why:** Complete the data access layer. Repos return dataclass instances.

- [ ] **Step 1: Create `src/repositories/__init__.py`** (empty)

- [ ] **Step 2: Create `src/repositories/base.py`**

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

- [ ] **Step 3: Create `src/repositories/settings_repo.py`**

```python
"""Settings repository — key-value CRUD."""
from typing import Optional
from src.repositories.base import BaseRepository


class SettingsRepo(BaseRepository):

    def get(self, key: str) -> Optional[str]:
        """Get a setting value by key, or None if not set."""
        row = self._fetchone("SELECT value FROM settings WHERE key = ?", (key,))
        return row["value"] if row else None

    def set(self, key: str, value: str) -> None:
        """Set a setting value (upsert)."""
        self._execute(
            """INSERT INTO settings (key, value) VALUES (?, ?)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value""",
            (key, value),
        )

    def delete(self, key: str) -> None:
        """Delete a setting by key."""
        self._execute("DELETE FROM settings WHERE key = ?", (key,))

    def get_all(self) -> dict[str, str]:
        """Get all settings as a dict."""
        rows = self._fetchall("SELECT key, value FROM settings ORDER BY key")
        return {r["key"]: r["value"] for r in rows}
```

- [ ] **Step 4: Create `src/repositories/workout_repo.py`**

```python
"""Workout repository — sessions, session_exercises, logged_sets."""
from typing import List, Optional
from src.models.enums import ExerciseType, SetScheme, SessionStatus, ExerciseSource
from src.models.workout import WorkoutSession, SessionExercise, LoggedSet
from src.repositories.base import BaseRepository


class WorkoutRepo(BaseRepository):

    # --- Sessions ---

    def create_session(self, session: WorkoutSession) -> int:
        """Insert a new workout session, return its id."""
        return self._insert(
            """INSERT INTO workout_sessions
               (routine_key_snapshot, routine_name_snapshot, day_key_snapshot,
                day_label_snapshot, day_name_snapshot, status,
                completed_fully, started_at, finished_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session.routine_key_snapshot, session.routine_name_snapshot,
             session.day_key_snapshot, session.day_label_snapshot,
             session.day_name_snapshot, session.status.value,
             self._bool_to_int(session.completed_fully),
             session.started_at, session.finished_at),
        )

    def get_session(self, session_id: int) -> Optional[WorkoutSession]:
        """Get a session by id."""
        row = self._fetchone(
            "SELECT * FROM workout_sessions WHERE id = ?", (session_id,)
        )
        return self._to_session(row) if row else None

    def get_in_progress_session(self) -> Optional[WorkoutSession]:
        """Get the current in-progress session, if any."""
        row = self._fetchone(
            "SELECT * FROM workout_sessions WHERE status = 'in_progress' LIMIT 1"
        )
        return self._to_session(row) if row else None

    def finish_session(
        self, session_id: int, completed_fully: bool, finished_at: str
    ) -> None:
        """Mark a session as finished."""
        self._execute(
            """UPDATE workout_sessions
               SET status = 'finished', completed_fully = ?, finished_at = ?
               WHERE id = ?""",
            (int(completed_fully), finished_at, session_id),
        )

    def delete_session(self, session_id: int) -> None:
        """Delete a session (cascades to exercises and sets)."""
        self._execute("DELETE FROM workout_sessions WHERE id = ?", (session_id,))

    def list_finished_sessions(
        self, limit: int = 50, offset: int = 0
    ) -> List[WorkoutSession]:
        """List finished sessions, most recent first."""
        rows = self._fetchall(
            """SELECT * FROM workout_sessions
               WHERE status = 'finished'
               ORDER BY started_at DESC LIMIT ? OFFSET ?""",
            (limit, offset),
        )
        return [self._to_session(r) for r in rows]

    # --- Session Exercises ---

    def add_session_exercise(self, se: SessionExercise) -> int:
        """Insert a session exercise, return its id."""
        return self._insert(
            """INSERT INTO session_exercises
               (session_id, sort_order, exercise_key_snapshot, exercise_name_snapshot,
                exercise_type_snapshot, source, scheme_snapshot, planned_sets,
                target_reps_min, target_reps_max, target_duration_seconds,
                target_distance_km, plan_notes_snapshot)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (se.session_id, se.sort_order,
             se.exercise_key_snapshot, se.exercise_name_snapshot,
             se.exercise_type_snapshot.value, se.source.value,
             se.scheme_snapshot.value if se.scheme_snapshot else None,
             se.planned_sets, se.target_reps_min, se.target_reps_max,
             se.target_duration_seconds, se.target_distance_km,
             se.plan_notes_snapshot),
        )

    def get_session_exercise(self, se_id: int) -> Optional[SessionExercise]:
        """Get a session exercise by id."""
        row = self._fetchone(
            "SELECT * FROM session_exercises WHERE id = ?", (se_id,)
        )
        return self._to_session_exercise(row) if row else None

    def get_session_exercises(self, session_id: int) -> List[SessionExercise]:
        """Get all exercises for a session, ordered by sort_order."""
        rows = self._fetchall(
            """SELECT * FROM session_exercises
               WHERE session_id = ? ORDER BY sort_order""",
            (session_id,),
        )
        return [self._to_session_exercise(r) for r in rows]

    def get_max_sort_order(self, session_id: int) -> Optional[int]:
        """Get the highest sort_order for a session, or None if no exercises."""
        row = self._fetchone(
            "SELECT MAX(sort_order) as max_order FROM session_exercises WHERE session_id = ?",
            (session_id,),
        )
        return row["max_order"] if row and row["max_order"] is not None else None

    # --- Logged Sets ---

    def add_logged_set(self, ls: LoggedSet) -> int:
        """Insert a logged set, return its id."""
        return self._insert(
            """INSERT INTO logged_sets
               (session_exercise_id, set_number, reps, weight,
                duration_seconds, distance_km, logged_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (ls.session_exercise_id, ls.set_number, ls.reps, ls.weight,
             ls.duration_seconds, ls.distance_km, ls.logged_at),
        )

    def get_logged_set(self, set_id: int) -> Optional[LoggedSet]:
        """Get a logged set by id."""
        row = self._fetchone(
            "SELECT * FROM logged_sets WHERE id = ?", (set_id,)
        )
        return self._to_logged_set(row) if row else None

    def get_logged_sets(self, session_exercise_id: int) -> List[LoggedSet]:
        """Get all sets for a session exercise, ordered by set_number."""
        rows = self._fetchall(
            """SELECT * FROM logged_sets
               WHERE session_exercise_id = ? ORDER BY set_number""",
            (session_exercise_id,),
        )
        return [self._to_logged_set(r) for r in rows]

    def get_logged_set_count(self, session_exercise_id: int) -> int:
        """Count logged sets for a session exercise."""
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM logged_sets WHERE session_exercise_id = ?",
            (session_exercise_id,),
        )
        return row["cnt"] if row else 0

    def get_session_total_set_count(self, session_id: int) -> int:
        """Count total logged sets across all exercises in a session."""
        row = self._fetchone(
            """SELECT COUNT(*) as cnt FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               WHERE se.session_id = ?""",
            (session_id,),
        )
        return row["cnt"] if row else 0

    def update_logged_set(self, ls: LoggedSet) -> None:
        """Update an existing logged set."""
        self._execute(
            """UPDATE logged_sets
               SET reps = ?, weight = ?, duration_seconds = ?, distance_km = ?
               WHERE id = ?""",
            (ls.reps, ls.weight, ls.duration_seconds, ls.distance_km, ls.id),
        )

    def delete_logged_set(self, set_id: int) -> None:
        """Delete a logged set and resequence remaining siblings."""
        ls = self.get_logged_set(set_id)
        if not ls:
            return
        self._execute("DELETE FROM logged_sets WHERE id = ?", (set_id,))
        self._execute(
            """UPDATE logged_sets SET set_number = set_number - 1
               WHERE session_exercise_id = ? AND set_number > ?""",
            (ls.session_exercise_id, ls.set_number),
        )

    def get_next_set_number(self, session_exercise_id: int) -> int:
        """Get the next set_number for a session exercise (max + 1, or 1)."""
        row = self._fetchone(
            "SELECT MAX(set_number) as max_num FROM logged_sets WHERE session_exercise_id = ?",
            (session_exercise_id,),
        )
        if row and row["max_num"] is not None:
            return row["max_num"] + 1
        return 1

    # --- Row converters ---

    @staticmethod
    def _bool_to_int(val: Optional[bool]) -> Optional[int]:
        if val is None:
            return None
        return 1 if val else 0

    def _to_session(self, row) -> WorkoutSession:
        completed = row["completed_fully"]
        return WorkoutSession(
            id=row["id"],
            routine_key_snapshot=row["routine_key_snapshot"],
            routine_name_snapshot=row["routine_name_snapshot"],
            day_key_snapshot=row["day_key_snapshot"],
            day_label_snapshot=row["day_label_snapshot"],
            day_name_snapshot=row["day_name_snapshot"],
            status=SessionStatus(row["status"]),
            completed_fully=None if completed is None else bool(completed),
            started_at=row["started_at"],
            finished_at=row["finished_at"],
        )

    def _to_session_exercise(self, row) -> SessionExercise:
        scheme = row["scheme_snapshot"]
        return SessionExercise(
            id=row["id"],
            session_id=row["session_id"],
            sort_order=row["sort_order"],
            exercise_key_snapshot=row["exercise_key_snapshot"],
            exercise_name_snapshot=row["exercise_name_snapshot"],
            exercise_type_snapshot=ExerciseType(row["exercise_type_snapshot"]),
            source=ExerciseSource(row["source"]),
            scheme_snapshot=SetScheme(scheme) if scheme else None,
            planned_sets=row["planned_sets"],
            target_reps_min=row["target_reps_min"],
            target_reps_max=row["target_reps_max"],
            target_duration_seconds=row["target_duration_seconds"],
            target_distance_km=row["target_distance_km"],
            plan_notes_snapshot=row["plan_notes_snapshot"],
        )

    def _to_logged_set(self, row) -> LoggedSet:
        return LoggedSet(
            id=row["id"],
            session_exercise_id=row["session_exercise_id"],
            set_number=row["set_number"],
            reps=row["reps"],
            weight=row["weight"],
            duration_seconds=row["duration_seconds"],
            distance_km=row["distance_km"],
            logged_at=row["logged_at"],
        )
```

- [ ] **Step 5: Create `src/repositories/benchmark_repo.py`**

```python
"""Benchmark repository — results CRUD."""
from typing import List, Optional
from src.models.enums import BenchmarkMethod
from src.models.benchmark import BenchmarkResult
from src.repositories.base import BaseRepository


class BenchmarkRepo(BaseRepository):

    def add_result(self, result: BenchmarkResult) -> int:
        """Insert a benchmark result, return its id."""
        return self._insert(
            """INSERT INTO benchmark_results
               (exercise_key_snapshot, exercise_name_snapshot, method,
                result_value, bodyweight, tested_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (result.exercise_key_snapshot, result.exercise_name_snapshot,
             result.method.value, result.result_value,
             result.bodyweight, result.tested_at),
        )

    def get_result(self, result_id: int) -> Optional[BenchmarkResult]:
        """Get a benchmark result by id."""
        row = self._fetchone(
            "SELECT * FROM benchmark_results WHERE id = ?", (result_id,)
        )
        return self._to_result(row) if row else None

    def get_results_for_exercise(
        self, exercise_key: str
    ) -> List[BenchmarkResult]:
        """Get all results for an exercise key, most recent first."""
        rows = self._fetchall(
            """SELECT * FROM benchmark_results
               WHERE exercise_key_snapshot = ?
               ORDER BY tested_at DESC""",
            (exercise_key,),
        )
        return [self._to_result(r) for r in rows]

    def get_latest_result(self, exercise_key: str) -> Optional[BenchmarkResult]:
        """Get the most recent result for an exercise key."""
        row = self._fetchone(
            """SELECT * FROM benchmark_results
               WHERE exercise_key_snapshot = ?
               ORDER BY tested_at DESC LIMIT 1""",
            (exercise_key,),
        )
        return self._to_result(row) if row else None

    def get_all_results(self) -> List[BenchmarkResult]:
        """Get all benchmark results, most recent first."""
        rows = self._fetchall(
            "SELECT * FROM benchmark_results ORDER BY tested_at DESC"
        )
        return [self._to_result(r) for r in rows]

    # --- Row converter ---

    def _to_result(self, row) -> BenchmarkResult:
        return BenchmarkResult(
            id=row["id"],
            exercise_key_snapshot=row["exercise_key_snapshot"],
            exercise_name_snapshot=row["exercise_name_snapshot"],
            method=BenchmarkMethod(row["method"]),
            result_value=row["result_value"],
            bodyweight=row["bodyweight"],
            tested_at=row["tested_at"],
        )
```

- [ ] **Step 6: Update `tests/conftest.py`** with repo fixtures

```python
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
```

- [ ] **Step 7: Create `tests/test_settings_repo.py`**

```python
"""Tests for settings repository."""
import pytest


class TestSettingsRepo:
    def test_get_missing_returns_none(self, settings_repo):
        assert settings_repo.get("nonexistent") is None

    def test_set_and_get(self, settings_repo):
        settings_repo.set("weight_unit", "lb")
        assert settings_repo.get("weight_unit") == "lb"

    def test_set_overwrites(self, settings_repo):
        settings_repo.set("weight_unit", "lb")
        settings_repo.set("weight_unit", "kg")
        assert settings_repo.get("weight_unit") == "kg"

    def test_delete(self, settings_repo):
        settings_repo.set("weight_unit", "lb")
        settings_repo.delete("weight_unit")
        assert settings_repo.get("weight_unit") is None

    def test_delete_nonexistent_no_error(self, settings_repo):
        settings_repo.delete("nonexistent")  # Should not raise

    def test_get_all_empty(self, settings_repo):
        assert settings_repo.get_all() == {}

    def test_get_all(self, settings_repo):
        settings_repo.set("weight_unit", "lb")
        settings_repo.set("active_routine_key", "ppl")
        result = settings_repo.get_all()
        assert result == {"active_routine_key": "ppl", "weight_unit": "lb"}
```

- [ ] **Step 8: Create `tests/test_workout_repo.py`**

```python
"""Tests for workout repository — sessions, exercises, logged sets."""
import pytest
from src.models.enums import ExerciseType, SetScheme, SessionStatus, ExerciseSource
from src.models.workout import WorkoutSession, SessionExercise, LoggedSet


def _make_session(**overrides):
    defaults = dict(
        id=None,
        routine_key_snapshot="ppl",
        routine_name_snapshot="Push Pull Legs",
        day_key_snapshot="push",
        day_label_snapshot="A",
        day_name_snapshot="Push",
        status=SessionStatus.IN_PROGRESS,
        started_at="2026-03-26T10:00:00",
    )
    defaults.update(overrides)
    return WorkoutSession(**defaults)


def _make_planned_exercise(session_id, sort_order=0, **overrides):
    defaults = dict(
        id=None,
        session_id=session_id,
        sort_order=sort_order,
        exercise_key_snapshot="barbell_bench_press",
        exercise_name_snapshot="Barbell Bench Press",
        exercise_type_snapshot=ExerciseType.REPS_WEIGHT,
        source=ExerciseSource.PLANNED,
        scheme_snapshot=SetScheme.UNIFORM,
        planned_sets=3,
        target_reps_min=8,
        target_reps_max=12,
    )
    defaults.update(overrides)
    return SessionExercise(**defaults)


def _make_ad_hoc_exercise(session_id, sort_order=0, **overrides):
    defaults = dict(
        id=None,
        session_id=session_id,
        sort_order=sort_order,
        exercise_key_snapshot="dumbbell_curl",
        exercise_name_snapshot="Dumbbell Curl",
        exercise_type_snapshot=ExerciseType.REPS_WEIGHT,
        source=ExerciseSource.AD_HOC,
    )
    defaults.update(overrides)
    return SessionExercise(**defaults)


def _make_set(session_exercise_id, set_number=1, **overrides):
    defaults = dict(
        id=None,
        session_exercise_id=session_exercise_id,
        set_number=set_number,
        reps=10,
        weight=60.0,
        logged_at="2026-03-26T10:05:00",
    )
    defaults.update(overrides)
    return LoggedSet(**defaults)


class TestSessionCRUD:
    def test_create_and_get_session(self, workout_repo):
        session = _make_session()
        sid = workout_repo.create_session(session)
        assert sid is not None

        fetched = workout_repo.get_session(sid)
        assert fetched is not None
        assert fetched.id == sid
        assert fetched.routine_key_snapshot == "ppl"
        assert fetched.status == SessionStatus.IN_PROGRESS
        assert fetched.completed_fully is None

    def test_get_in_progress_session(self, workout_repo):
        workout_repo.create_session(_make_session())
        ip = workout_repo.get_in_progress_session()
        assert ip is not None
        assert ip.status == SessionStatus.IN_PROGRESS

    def test_no_in_progress_session(self, workout_repo):
        assert workout_repo.get_in_progress_session() is None

    def test_finish_session(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        workout_repo.finish_session(sid, completed_fully=True, finished_at="2026-03-26T11:00:00")
        workout_repo.commit()

        fetched = workout_repo.get_session(sid)
        assert fetched.status == SessionStatus.FINISHED
        assert fetched.completed_fully is True
        assert fetched.finished_at == "2026-03-26T11:00:00"

    def test_delete_session(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        workout_repo.delete_session(sid)
        assert workout_repo.get_session(sid) is None

    def test_list_finished_sessions(self, workout_repo):
        # Create and finish two sessions
        sid1 = workout_repo.create_session(_make_session(started_at="2026-03-25T10:00:00"))
        workout_repo.finish_session(sid1, True, "2026-03-25T11:00:00")
        sid2 = workout_repo.create_session(_make_session(started_at="2026-03-26T10:00:00"))
        workout_repo.finish_session(sid2, True, "2026-03-26T11:00:00")
        workout_repo.commit()

        sessions = workout_repo.list_finished_sessions()
        assert len(sessions) == 2
        assert sessions[0].started_at > sessions[1].started_at  # Most recent first

    def test_list_finished_excludes_in_progress(self, workout_repo):
        workout_repo.create_session(_make_session())
        sessions = workout_repo.list_finished_sessions()
        assert len(sessions) == 0


class TestSessionExerciseCRUD:
    def test_add_and_get_planned_exercise(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se = _make_planned_exercise(sid)
        se_id = workout_repo.add_session_exercise(se)

        fetched = workout_repo.get_session_exercise(se_id)
        assert fetched is not None
        assert fetched.source == ExerciseSource.PLANNED
        assert fetched.scheme_snapshot == SetScheme.UNIFORM
        assert fetched.planned_sets == 3
        assert fetched.target_reps_min == 8
        assert fetched.target_reps_max == 12

    def test_add_and_get_ad_hoc_exercise(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se = _make_ad_hoc_exercise(sid)
        se_id = workout_repo.add_session_exercise(se)

        fetched = workout_repo.get_session_exercise(se_id)
        assert fetched is not None
        assert fetched.source == ExerciseSource.AD_HOC
        assert fetched.planned_sets is None
        assert fetched.scheme_snapshot is None

    def test_get_session_exercises_ordered(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        workout_repo.add_session_exercise(_make_planned_exercise(sid, sort_order=0))
        workout_repo.add_session_exercise(_make_planned_exercise(
            sid, sort_order=1, exercise_key_snapshot="squat",
            exercise_name_snapshot="Squat",
        ))
        workout_repo.add_session_exercise(_make_ad_hoc_exercise(sid, sort_order=2))

        exercises = workout_repo.get_session_exercises(sid)
        assert len(exercises) == 3
        assert exercises[0].sort_order == 0
        assert exercises[1].sort_order == 1
        assert exercises[2].sort_order == 2

    def test_get_max_sort_order(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        assert workout_repo.get_max_sort_order(sid) is None

        workout_repo.add_session_exercise(_make_planned_exercise(sid, sort_order=0))
        assert workout_repo.get_max_sort_order(sid) == 0

        workout_repo.add_session_exercise(_make_planned_exercise(
            sid, sort_order=1, exercise_key_snapshot="squat",
            exercise_name_snapshot="Squat",
        ))
        assert workout_repo.get_max_sort_order(sid) == 1

    def test_cascade_delete(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        workout_repo.add_session_exercise(_make_planned_exercise(sid))
        workout_repo.delete_session(sid)
        exercises = workout_repo.get_session_exercises(sid)
        assert len(exercises) == 0


class TestLoggedSetCRUD:
    def _setup(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se_id = workout_repo.add_session_exercise(_make_planned_exercise(sid))
        return sid, se_id

    def test_add_and_get_set(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        ls = _make_set(se_id)
        ls_id = workout_repo.add_logged_set(ls)

        fetched = workout_repo.get_logged_set(ls_id)
        assert fetched is not None
        assert fetched.reps == 10
        assert fetched.weight == 60.0
        assert fetched.set_number == 1

    def test_get_logged_sets_ordered(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        workout_repo.add_logged_set(_make_set(se_id, set_number=1))
        workout_repo.add_logged_set(_make_set(se_id, set_number=2, reps=8, weight=65.0))
        workout_repo.add_logged_set(_make_set(se_id, set_number=3, reps=6, weight=70.0))

        sets = workout_repo.get_logged_sets(se_id)
        assert len(sets) == 3
        assert [s.set_number for s in sets] == [1, 2, 3]

    def test_get_logged_set_count(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        assert workout_repo.get_logged_set_count(se_id) == 0
        workout_repo.add_logged_set(_make_set(se_id))
        assert workout_repo.get_logged_set_count(se_id) == 1

    def test_get_session_total_set_count(self, workout_repo):
        sid, se_id1 = self._setup(workout_repo)
        se_id2 = workout_repo.add_session_exercise(_make_planned_exercise(
            sid, sort_order=1, exercise_key_snapshot="squat",
            exercise_name_snapshot="Squat",
        ))
        workout_repo.add_logged_set(_make_set(se_id1, set_number=1))
        workout_repo.add_logged_set(_make_set(se_id2, set_number=1))
        assert workout_repo.get_session_total_set_count(sid) == 2

    def test_update_logged_set(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        ls_id = workout_repo.add_logged_set(_make_set(se_id))

        fetched = workout_repo.get_logged_set(ls_id)
        fetched.reps = 12
        fetched.weight = 65.0
        workout_repo.update_logged_set(fetched)

        updated = workout_repo.get_logged_set(ls_id)
        assert updated.reps == 12
        assert updated.weight == 65.0

    def test_delete_logged_set_resequences(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        workout_repo.add_logged_set(_make_set(se_id, set_number=1))
        ls2_id = workout_repo.add_logged_set(_make_set(se_id, set_number=2, reps=8))
        workout_repo.add_logged_set(_make_set(se_id, set_number=3, reps=6))

        workout_repo.delete_logged_set(ls2_id)

        sets = workout_repo.get_logged_sets(se_id)
        assert len(sets) == 2
        assert sets[0].set_number == 1
        assert sets[1].set_number == 2  # Was 3, now resequenced to 2
        assert sets[1].reps == 6

    def test_get_next_set_number(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        assert workout_repo.get_next_set_number(se_id) == 1
        workout_repo.add_logged_set(_make_set(se_id, set_number=1))
        assert workout_repo.get_next_set_number(se_id) == 2

    def test_cascade_delete_session_to_sets(self, workout_repo):
        sid, se_id = self._setup(workout_repo)
        workout_repo.add_logged_set(_make_set(se_id))
        workout_repo.delete_session(sid)
        assert workout_repo.get_logged_set_count(se_id) == 0

    def test_time_set(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se_id = workout_repo.add_session_exercise(_make_planned_exercise(
            sid, exercise_type_snapshot=ExerciseType.TIME,
            exercise_key_snapshot="plank", exercise_name_snapshot="Plank",
        ))
        ls_id = workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se_id, set_number=1,
            duration_seconds=60, logged_at="2026-03-26T10:05:00",
        ))
        fetched = workout_repo.get_logged_set(ls_id)
        assert fetched.duration_seconds == 60
        assert fetched.reps is None

    def test_cardio_set(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se_id = workout_repo.add_session_exercise(_make_planned_exercise(
            sid, exercise_type_snapshot=ExerciseType.CARDIO,
            exercise_key_snapshot="running", exercise_name_snapshot="Running",
        ))
        ls_id = workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se_id, set_number=1,
            duration_seconds=1800, distance_km=5.0,
            logged_at="2026-03-26T10:05:00",
        ))
        fetched = workout_repo.get_logged_set(ls_id)
        assert fetched.duration_seconds == 1800
        assert fetched.distance_km == 5.0
```

- [ ] **Step 9: Create `tests/test_benchmark_repo.py`**

```python
"""Tests for benchmark repository."""
import pytest
from src.models.enums import BenchmarkMethod
from src.models.benchmark import BenchmarkResult


def _make_result(**overrides):
    defaults = dict(
        id=None,
        exercise_key_snapshot="barbell_bench_press",
        exercise_name_snapshot="Barbell Bench Press",
        method=BenchmarkMethod.MAX_WEIGHT,
        result_value=100.0,
        tested_at="2026-03-26",
        bodyweight=80.0,
    )
    defaults.update(overrides)
    return BenchmarkResult(**defaults)


class TestBenchmarkRepo:
    def test_add_and_get_result(self, benchmark_repo):
        result = _make_result()
        rid = benchmark_repo.add_result(result)
        assert rid is not None

        fetched = benchmark_repo.get_result(rid)
        assert fetched is not None
        assert fetched.exercise_key_snapshot == "barbell_bench_press"
        assert fetched.method == BenchmarkMethod.MAX_WEIGHT
        assert fetched.result_value == 100.0
        assert fetched.bodyweight == 80.0

    def test_get_missing_returns_none(self, benchmark_repo):
        assert benchmark_repo.get_result(999) is None

    def test_get_results_for_exercise(self, benchmark_repo):
        benchmark_repo.add_result(_make_result(tested_at="2026-03-20"))
        benchmark_repo.add_result(_make_result(tested_at="2026-03-26"))
        benchmark_repo.add_result(_make_result(
            exercise_key_snapshot="pull_up",
            exercise_name_snapshot="Pull-Up",
            method=BenchmarkMethod.MAX_REPS,
            result_value=15.0,
        ))

        results = benchmark_repo.get_results_for_exercise("barbell_bench_press")
        assert len(results) == 2
        assert results[0].tested_at >= results[1].tested_at  # Most recent first

    def test_get_latest_result(self, benchmark_repo):
        benchmark_repo.add_result(_make_result(result_value=80.0, tested_at="2026-03-20"))
        benchmark_repo.add_result(_make_result(result_value=100.0, tested_at="2026-03-26"))

        latest = benchmark_repo.get_latest_result("barbell_bench_press")
        assert latest is not None
        assert latest.result_value == 100.0
        assert latest.tested_at == "2026-03-26"

    def test_get_latest_result_none(self, benchmark_repo):
        assert benchmark_repo.get_latest_result("nonexistent") is None

    def test_null_bodyweight(self, benchmark_repo):
        rid = benchmark_repo.add_result(_make_result(bodyweight=None))
        fetched = benchmark_repo.get_result(rid)
        assert fetched.bodyweight is None

    def test_get_all_results(self, benchmark_repo):
        benchmark_repo.add_result(_make_result(tested_at="2026-03-20"))
        benchmark_repo.add_result(_make_result(
            exercise_key_snapshot="pull_up",
            exercise_name_snapshot="Pull-Up",
            method=BenchmarkMethod.MAX_REPS,
            result_value=15.0,
            tested_at="2026-03-26",
        ))

        results = benchmark_repo.get_all_results()
        assert len(results) == 2

    def test_timed_hold_result(self, benchmark_repo):
        rid = benchmark_repo.add_result(_make_result(
            exercise_key_snapshot="plank",
            exercise_name_snapshot="Plank",
            method=BenchmarkMethod.TIMED_HOLD,
            result_value=120.0,
        ))
        fetched = benchmark_repo.get_result(rid)
        assert fetched.method == BenchmarkMethod.TIMED_HOLD
        assert fetched.result_value == 120.0
```

- [ ] **Step 10: Run all tests, verify all pass**

```bash
pytest tests/test_settings_repo.py tests/test_workout_repo.py tests/test_benchmark_repo.py -v
```

- [ ] **Step 11: Commit**

```
feat(v2): repositories for settings, workouts, and benchmarks
```

---

## Task 9: Integration Smoke Test + Full Test Run

**Purpose:** Verify all pieces work together end-to-end. Load real data files, build registries, and run against the real schema.

- [ ] **Step 1: Update `tests/conftest.py`** to add registry fixtures

Add these fixtures to the existing `tests/conftest.py`:

```python
@pytest.fixture
def exercise_registry():
    """Exercise registry loaded from production CSV."""
    from src.config import EXERCISES_CSV_PATH
    from src.loaders.exercise_loader import load_exercises
    from src.registries.exercise_registry import ExerciseRegistry
    exercises = load_exercises(EXERCISES_CSV_PATH)
    return ExerciseRegistry(exercises)


@pytest.fixture
def routine_registry(exercise_registry):
    """Routine registry loaded from production YAML."""
    from src.config import ROUTINES_DIR
    from src.loaders.routine_loader import load_all_routines
    from src.registries.routine_registry import RoutineRegistry
    routines = load_all_routines(ROUTINES_DIR, exercise_registry)
    return RoutineRegistry(routines)


@pytest.fixture
def benchmark_registry(exercise_registry):
    """Benchmark registry loaded from production YAML."""
    from src.config import BENCHMARKS_YAML_PATH
    from src.loaders.benchmark_loader import load_benchmark_config
    from src.registries.benchmark_registry import BenchmarkRegistry
    config = load_benchmark_config(BENCHMARKS_YAML_PATH, exercise_registry)
    return BenchmarkRegistry(config)
```

- [ ] **Step 2: Run the full test suite**

```bash
pytest tests/ -v
```

All tests from all 9 test files must pass:
- `test_models.py`
- `test_db_schema.py`
- `test_exercise_loader.py`
- `test_routine_loader.py`
- `test_benchmark_loader.py`
- `test_registries.py`
- `test_settings_repo.py`
- `test_workout_repo.py`
- `test_benchmark_repo.py`

- [ ] **Step 3: Commit**

```
feat(v2): integration fixtures and full Phase 1 test pass
```

---

## Summary

| Task | Description | Files | Tests |
|------|------------|-------|-------|
| 1 | Models + Enums + Config | 7 source files | `test_models.py` |
| 2 | Database Schema + Connection | 3 source files | `test_db_schema.py` |
| 3 | Exercise CSV Loader | 2 source + 1 data + 3 test data | `test_exercise_loader.py` |
| 4 | Exercise Registry | 1 source file | (tested in Task 7) |
| 5 | Routine YAML Loader | 2 source + 1 data + 6 test data | `test_routine_loader.py` |
| 6 | Benchmark YAML Loader | 2 source + 1 data + 3 test data | `test_benchmark_loader.py` |
| 7 | Routine + Benchmark Registries | 2 source files | `test_registries.py` |
| 8 | Repositories (Base + Settings + Workout + Benchmark) | 5 source files | `test_settings_repo.py`, `test_workout_repo.py`, `test_benchmark_repo.py` |
| 9 | Integration + Full Test Run | conftest updates | All tests green |

**Total commits:** 9 (one per task)

**Test command:** `pytest tests/ -v`

**What Phase 1 delivers:**
- Complete data layer with zero UI dependencies
- Production data files (exercises.csv, routines/*.yaml, benchmarks.yaml) validated at load time
- In-memory registries for all bundled data
- SQLite schema with 5 tables and comprehensive CHECK constraints
- Repositories for all mutable data with full CRUD
- 100+ tests covering models, schema constraints, loader validation, registry lookups, and repo operations

**What Phase 1 does NOT include:**
- Services (workout lifecycle, benchmark due calculation, stats, settings management)
- Screens / UI
- Unit conversion
- `src/main.py` / app shell
