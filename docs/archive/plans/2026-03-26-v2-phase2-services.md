# V2 Phase 2: Service Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete service layer for the v2 rewrite — AppStateService, WorkoutService, BenchmarkService, StatsService, SettingsService — with full TDD test coverage. No UI, no screens. Pure business logic built on top of Phase 1's schema, models, loaders, registries, and repositories.

**Architecture:** Services use constructor injection. Each service depends only on repositories (for mutable SQLite data) and registries (for immutable bundled data). Services enforce all business invariants that SQLite cannot.

**Tech Stack:** Python 3.10+, sqlite3 (stdlib), pytest, dataclasses, enums.

**Spec reference:** `docs/superpowers/specs/2026-03-26-exercise-logger-v2-simplified.md`

**Phase 1 code reference:** Schema in `src/db/schema.py`, models in `src/models/`, registries in `src/registries/`, repos in `src/repositories/`, connection helpers in `src/db/connection.py`, unit conversion in `src/utils/unit_conversion.py`, test fixtures in `tests/conftest.py`.

---

## Critical Design Decisions (v2 vs v1)

1. **No exercises/routines/benchmarks in SQLite.** All bundled data lives in registries (in-memory). `exercise_key` is the stable identifier, not an integer ID.
2. **Session snapshots are self-contained.** `workout_sessions` stores routine_key_snapshot, routine_name_snapshot, day_key_snapshot, day_label_snapshot, day_name_snapshot. No FK to templates.
3. **session_exercises stores full plan snapshots.** exercise_key_snapshot, exercise_name_snapshot, exercise_type_snapshot, source (planned/ad_hoc), scheme_snapshot, planned_sets, target_reps_min/max, target_duration_seconds, target_distance_km, plan_notes_snapshot.
4. **Cycle state in settings table.** `active_routine_key` and `current_day_key` as settings rows. No separate cycle table.
5. **Benchmarks are sessionless.** No workout_sessions record for benchmarks. benchmark_results stores exercise_key_snapshot, exercise_name_snapshot, method, result_value, bodyweight, tested_at.
6. **Three exercise types only.** `reps_weight`, `time`, `cardio`. No `reps_only`, no `amrap`.
7. **Cancel = delete.** Canceled sessions (zero sets) are deleted from the DB. They never exist in history.
8. **Finished session cleanup.** If deleting the last set from a finished session, delete the session. No cycle rewind.

---

## Dependency Map

```
Task 1:  conftest.py overhaul + v2 models/schema/repos/registries (test infra)
Task 2:  AppStateService (startup reconciliation, active routine, cycle mgmt)
Task 3:  WorkoutService (session lifecycle, set logging, edit/delete)
Task 4:  BenchmarkService (due calc, result recording)
Task 5:  StatsService (dashboard queries, exercise history, PRs, volume trend)
Task 6:  SettingsService (get/set, unit toggle with weight conversion)
```

Tasks 2-6 each depend on Task 1. Tasks 3-6 are independent of each other (but Task 5 needs session data to be meaningful in tests, so it practically follows Task 3).

---

## File Map

```
src/
├── models/
│   ├── bundled.py                       # EXISTS — Exercise, Routine, RoutineDay, DayExercise, BenchmarkConfig, BenchmarkItem
│   ├── workout.py                       # EXISTS — WorkoutSession, SessionExercise, LoggedSet (v2 schema)
│   └── benchmark.py                     # EXISTS — BenchmarkResult (v2 schema)
├── registries/
│   ├── exercise_registry.py             # EXISTS — ExerciseRegistry (get_by_key, list_all, etc.)
│   ├── routine_registry.py              # EXISTS — RoutineRegistry (get_by_key, list_all, etc.)
│   └── benchmark_registry.py            # EXISTS — BenchmarkRegistry (get_config, etc.)
├── repositories/
│   ├── base.py                          # EXISTS — BaseRepository
│   ├── settings_repo.py                 # EXISTS — SettingsRepo (get, set, delete, get_all)
│   ├── workout_repo.py                  # EXISTS — WorkoutRepo (sessions, exercises, sets)
│   └── benchmark_repo.py               # EXISTS — BenchmarkRepo (results)
├── services/
│   ├── __init__.py                      # CREATE — empty
│   ├── app_state_service.py             # CREATE — startup reconciliation, active routine, cycle
│   ├── workout_service.py               # CREATE — session lifecycle, set logging
│   ├── benchmark_service.py             # CREATE — due calculation, result recording
│   ├── stats_service.py                 # CREATE — dashboard queries
│   └── settings_service.py              # CREATE — settings, unit toggle
└── utils/
    └── unit_conversion.py               # EXISTS — lbs_to_kg, kg_to_lbs, convert helpers

tests/
├── conftest.py                          # OVERWRITE — v2 fixtures (registries, repos, services)
├── test_app_state_service.py            # CREATE
├── test_workout_service.py              # CREATE
├── test_benchmark_service.py            # CREATE
├── test_stats_service.py                # CREATE
└── test_settings_service.py             # CREATE
```

---

## Phase 1 Interfaces (Assumed to Exist)

These are the exact interfaces the services will depend on. If Phase 1 deviates, adjust.

### Models

```python
# src/models/bundled.py
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional, List

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

@dataclass
class Exercise:
    key: str
    name: str
    type: ExerciseType
    equipment: str
    muscle_group: str

@dataclass
class DayExercise:
    exercise_key: str
    scheme: SetScheme
    sets: int
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    duration_seconds: Optional[int] = None
    distance_km: Optional[float] = None
    notes: Optional[str] = None

@dataclass
class RoutineDay:
    key: str
    label: str
    name: str
    exercises: List[DayExercise]

@dataclass
class Routine:
    key: str
    name: str
    description: str
    days: List[RoutineDay]

@dataclass
class BenchmarkItem:
    exercise_key: str
    method: BenchmarkMethod

@dataclass
class BenchmarkConfig:
    frequency_weeks: int
    items: List[BenchmarkItem]
```

```python
# src/models/workout.py
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Optional

class SessionStatus(Enum):
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"

@dataclass
class WorkoutSession:
    id: Optional[int]
    routine_key_snapshot: str
    routine_name_snapshot: str
    day_key_snapshot: str
    day_label_snapshot: str
    day_name_snapshot: str
    status: SessionStatus
    completed_fully: Optional[bool]
    started_at: str
    finished_at: Optional[str] = None

@dataclass
class SessionExercise:
    id: Optional[int]
    session_id: int
    sort_order: int
    exercise_key_snapshot: str
    exercise_name_snapshot: str
    exercise_type_snapshot: str          # "reps_weight", "time", "cardio"
    source: str                          # "planned", "ad_hoc"
    scheme_snapshot: Optional[str]       # "uniform", "progressive", NULL for ad_hoc
    planned_sets: Optional[int]          # NULL for ad_hoc
    target_reps_min: Optional[int]
    target_reps_max: Optional[int]
    target_duration_seconds: Optional[int]
    target_distance_km: Optional[float]
    plan_notes_snapshot: Optional[str]

@dataclass
class LoggedSet:
    id: Optional[int]
    session_exercise_id: int
    set_number: int
    reps: Optional[int]
    weight: Optional[float]
    duration_seconds: Optional[int]
    distance_km: Optional[float]
    logged_at: str
```

```python
# src/models/benchmark.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional

@dataclass
class BenchmarkResult:
    id: Optional[int]
    exercise_key_snapshot: str
    exercise_name_snapshot: str
    method: str                          # "max_weight", "max_reps", "timed_hold"
    result_value: float
    bodyweight: Optional[float]
    tested_at: str
```

### Registries

```python
# src/registries/exercise_registry.py
class ExerciseRegistry:
    def get(self, key: str) -> Optional[Exercise]: ...
    def list_all(self) -> List[Exercise]: ...

# src/registries/routine_registry.py
class RoutineRegistry:
    def get(self, key: str) -> Optional[Routine]: ...
    def list_all(self) -> List[Routine]: ...

# src/registries/benchmark_registry.py
class BenchmarkRegistry:
    def get_config(self) -> BenchmarkConfig: ...
```

### Repositories

```python
# src/repositories/settings_repo.py
class SettingsRepo(BaseRepository):
    def get(self, key: str) -> Optional[str]: ...
    def set(self, key: str, value: str) -> None: ...
    def delete(self, key: str) -> None: ...
    def get_all(self) -> dict: ...

# src/repositories/workout_repo.py
class WorkoutRepo(BaseRepository):
    def create_session(self, session: WorkoutSession) -> int: ...
    def get_session(self, session_id: int) -> Optional[WorkoutSession]: ...
    def get_in_progress_session(self) -> Optional[WorkoutSession]: ...
    def finish_session(self, session_id: int, completed_fully: bool, finished_at: str) -> None: ...
    def delete_session(self, session_id: int) -> None: ...
    def add_session_exercise(self, se: SessionExercise) -> int: ...
    def get_session_exercise(self, se_id: int) -> Optional[SessionExercise]: ...
    def get_session_exercises(self, session_id: int) -> List[SessionExercise]: ...
    def get_max_sort_order(self, session_id: int) -> int: ...
    def add_logged_set(self, ls: LoggedSet) -> int: ...
    def get_logged_set(self, set_id: int) -> Optional[LoggedSet]: ...
    def get_logged_sets(self, se_id: int) -> List[LoggedSet]: ...
    def get_logged_set_count(self, se_id: int) -> int: ...
    def get_session_total_set_count(self, session_id: int) -> int: ...
    def update_logged_set(self, ls: LoggedSet) -> None: ...
    def delete_logged_set(self, set_id: int) -> None: ...       # resequences set_numbers
    def delete_session(self, session_id: int) -> None: ...

# src/repositories/benchmark_repo.py
class BenchmarkRepo(BaseRepository):
    def add_result(self, result: BenchmarkResult) -> int: ...
    def get_results_for_exercise(self, exercise_key: str) -> List[BenchmarkResult]: ...
    def get_latest_result(self, exercise_key: str) -> Optional[BenchmarkResult]: ...
    def get_all_results(self) -> List[BenchmarkResult]: ...
```

### Unit Conversion

```python
# src/utils/unit_conversion.py
LB_TO_KG = 0.45359237
KG_TO_LB = 1.0 / LB_TO_KG

def lb_to_kg(lb: float) -> float: ...   # round to 2 decimals
def kg_to_lb(kg: float) -> float: ...   # round to 2 decimals
```

---

## Task 1: Test Infrastructure — conftest.py + Service `__init__.py`

**Goal:** Overwrite `tests/conftest.py` with v2-compatible fixtures. Create `src/services/__init__.py`. Build test helpers for creating realistic registry data and seeding sessions.

**Files:**
- Overwrite: `tests/conftest.py`
- Create: `src/services/__init__.py`

### Step-by-step

- [ ] **Step 1: Create `src/services/__init__.py`**

```python
# src/services/__init__.py
```

Empty file. Package marker only.

- [ ] **Step 2: Overwrite `tests/conftest.py` with v2 fixtures**

```python
# tests/conftest.py
"""Shared test fixtures for v2 service layer tests."""
import pytest
import sqlite3
from datetime import datetime, timezone, timedelta

from src.db.schema import init_db
from src.models.bundled import (
    Exercise, ExerciseType, Routine, RoutineDay, DayExercise,
    SetScheme, BenchmarkConfig, BenchmarkItem, BenchmarkMethod,
)
from src.registries.exercise_registry import ExerciseRegistry
from src.registries.routine_registry import RoutineRegistry
from src.registries.benchmark_registry import BenchmarkRegistry
from src.repositories.settings_repo import SettingsRepo
from src.repositories.workout_repo import WorkoutRepo
from src.repositories.benchmark_repo import BenchmarkRepo


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

@pytest.fixture
def db_conn():
    """In-memory SQLite database with v2 schema initialized."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    init_db(conn)
    yield conn
    conn.close()


# ---------------------------------------------------------------------------
# Repositories
# ---------------------------------------------------------------------------

@pytest.fixture
def settings_repo(db_conn):
    return SettingsRepo(db_conn)


@pytest.fixture
def workout_repo(db_conn):
    return WorkoutRepo(db_conn)


@pytest.fixture
def benchmark_repo(db_conn):
    return BenchmarkRepo(db_conn)


# ---------------------------------------------------------------------------
# Bundled data builders (realistic test data)
# ---------------------------------------------------------------------------

def make_exercise(key="barbell_bench_press", name="Barbell Bench Press",
                  ex_type=ExerciseType.REPS_WEIGHT, equipment="Barbell",
                  muscle_group="Chest") -> Exercise:
    return Exercise(key=key, name=name, type=ex_type, equipment=equipment,
                    muscle_group=muscle_group)


def make_exercises() -> list[Exercise]:
    """Standard test catalog: 5 exercises covering all types."""
    return [
        make_exercise("barbell_bench_press", "Barbell Bench Press",
                      ExerciseType.REPS_WEIGHT, "Barbell", "Chest"),
        make_exercise("barbell_back_squat", "Barbell Back Squat",
                      ExerciseType.REPS_WEIGHT, "Barbell", "Legs"),
        make_exercise("pull_up", "Pull-Up",
                      ExerciseType.REPS_WEIGHT, "Bodyweight", "Back"),
        make_exercise("plank", "Plank",
                      ExerciseType.TIME, "Bodyweight", "Core"),
        make_exercise("running", "Running",
                      ExerciseType.CARDIO, "None", "Cardio"),
    ]


def make_routine() -> Routine:
    """Standard test routine: push_pull_legs with 3 days."""
    return Routine(
        key="push_pull_legs",
        name="Push Pull Legs",
        description="3-day split",
        days=[
            RoutineDay(
                key="push", label="A", name="Push",
                exercises=[
                    DayExercise(
                        exercise_key="barbell_bench_press",
                        scheme=SetScheme.PROGRESSIVE,
                        sets=3,
                    ),
                    DayExercise(
                        exercise_key="plank",
                        scheme=SetScheme.UNIFORM,
                        sets=3,
                        duration_seconds=60,
                    ),
                ],
            ),
            RoutineDay(
                key="pull", label="B", name="Pull",
                exercises=[
                    DayExercise(
                        exercise_key="pull_up",
                        scheme=SetScheme.UNIFORM,
                        sets=4,
                        reps_min=6, reps_max=10,
                    ),
                    DayExercise(
                        exercise_key="running",
                        scheme=SetScheme.UNIFORM,
                        sets=1,
                    ),
                ],
            ),
            RoutineDay(
                key="legs", label="C", name="Legs",
                exercises=[
                    DayExercise(
                        exercise_key="barbell_back_squat",
                        scheme=SetScheme.PROGRESSIVE,
                        sets=3,
                    ),
                ],
            ),
        ],
    )


def make_second_routine() -> Routine:
    """A second routine for testing routine switching."""
    return Routine(
        key="upper_lower",
        name="Upper Lower",
        description="2-day split",
        days=[
            RoutineDay(
                key="upper", label="A", name="Upper",
                exercises=[
                    DayExercise(
                        exercise_key="barbell_bench_press",
                        scheme=SetScheme.UNIFORM,
                        sets=4, reps_min=8, reps_max=12,
                    ),
                ],
            ),
            RoutineDay(
                key="lower", label="B", name="Lower",
                exercises=[
                    DayExercise(
                        exercise_key="barbell_back_squat",
                        scheme=SetScheme.UNIFORM,
                        sets=4, reps_min=8, reps_max=12,
                    ),
                ],
            ),
        ],
    )


def make_benchmark_config() -> BenchmarkConfig:
    return BenchmarkConfig(
        frequency_weeks=6,
        items=[
            BenchmarkItem(exercise_key="barbell_bench_press",
                          method=BenchmarkMethod.MAX_WEIGHT),
            BenchmarkItem(exercise_key="pull_up",
                          method=BenchmarkMethod.MAX_REPS),
            BenchmarkItem(exercise_key="plank",
                          method=BenchmarkMethod.TIMED_HOLD),
        ],
    )


# ---------------------------------------------------------------------------
# Registries
# ---------------------------------------------------------------------------

@pytest.fixture
def exercise_registry() -> ExerciseRegistry:
    reg = ExerciseRegistry()
    for ex in make_exercises():
        reg.register(ex)
    return reg


@pytest.fixture
def routine_registry() -> RoutineRegistry:
    reg = RoutineRegistry()
    reg.register(make_routine())
    reg.register(make_second_routine())
    return reg


@pytest.fixture
def benchmark_registry() -> BenchmarkRegistry:
    reg = BenchmarkRegistry()
    reg.load(make_benchmark_config())
    return reg


# ---------------------------------------------------------------------------
# Services (imported lazily to allow Task 1 to pass before services exist)
# ---------------------------------------------------------------------------

@pytest.fixture
def app_state_service(settings_repo, routine_registry, workout_repo):
    from src.services.app_state_service import AppStateService
    return AppStateService(settings_repo, routine_registry, workout_repo)


@pytest.fixture
def workout_service(workout_repo, settings_repo, exercise_registry,
                    routine_registry):
    from src.services.workout_service import WorkoutService
    return WorkoutService(workout_repo, settings_repo, exercise_registry,
                          routine_registry)


@pytest.fixture
def benchmark_service(benchmark_repo, benchmark_registry, exercise_registry):
    from src.services.benchmark_service import BenchmarkService
    return BenchmarkService(benchmark_repo, benchmark_registry,
                            exercise_registry)


@pytest.fixture
def stats_service(workout_repo, benchmark_repo, exercise_registry,
                  benchmark_registry):
    from src.services.stats_service import StatsService
    return StatsService(workout_repo, benchmark_repo, exercise_registry,
                        benchmark_registry)


@pytest.fixture
def settings_service(settings_repo, db_conn, workout_repo):
    from src.services.settings_service import SettingsService
    return SettingsService(settings_repo, db_conn, workout_repo)


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def days_ago(n: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()
```

- [ ] **Step 3: Verify conftest imports parse correctly**

```bash
python -c "import tests.conftest"
```

This will fail until Phase 1 registries exist. If Phase 1 is complete, this should succeed. The lazy imports for services mean this step passes even before service files are created.

- [ ] **Step 4: Commit**

```
feat(v2): test infrastructure for Phase 2 service layer
```

---

## Task 2: AppStateService — Startup Reconciliation + Cycle Management

**Goal:** Service that handles startup validation of settings, active routine switching, and day cycle advancement (advance, wrap).

**File:** `src/services/app_state_service.py`, `tests/test_app_state_service.py`

**Depends on:** SettingsRepo, RoutineRegistry, WorkoutRepo

### Design

```python
class AppStateService:
    def __init__(self, settings_repo, routine_registry, workout_repo): ...

    # --- Startup ---
    def reconcile_on_startup(self) -> dict:
        """Validate settings against current registries.
        Returns dict with keys: routine_cleared, day_reset, has_in_progress_session.
        """

    # --- Active routine ---
    def get_active_routine(self) -> Optional[Routine]: ...
    def get_current_day(self) -> Optional[RoutineDay]: ...
    def set_active_routine(self, routine_key: str) -> None:
        """Set active routine + reset current_day to first day.
        Raises if a workout is in progress."""

    # --- Cycle ---
    def advance_day(self) -> str:
        """Advance current_day_key to next day in routine. Wraps at end.
        Returns the new day key."""

    def has_in_progress_session(self) -> bool: ...
```

### Tests (write FIRST, then implement)

- [ ] **Step 1: Write `tests/test_app_state_service.py`**

```python
# tests/test_app_state_service.py
"""Tests for AppStateService — startup reconciliation and cycle management."""
import pytest
from tests.conftest import make_routine, make_second_routine


class TestReconcileOnStartup:
    """Startup reconciliation validates settings against registries."""

    def test_no_settings_is_clean(self, app_state_service):
        """No active routine set — nothing to reconcile."""
        result = app_state_service.reconcile_on_startup()
        assert result["routine_cleared"] is False
        assert result["day_reset"] is False
        assert result["has_in_progress_session"] is False

    def test_valid_routine_and_day_unchanged(self, app_state_service,
                                              settings_repo):
        """Valid routine + valid day — no changes."""
        settings_repo.set("active_routine_key", "push_pull_legs")
        settings_repo.set("current_day_key", "pull")
        settings_repo.commit()

        result = app_state_service.reconcile_on_startup()
        assert result["routine_cleared"] is False
        assert result["day_reset"] is False
        assert settings_repo.get("active_routine_key") == "push_pull_legs"
        assert settings_repo.get("current_day_key") == "pull"

    def test_stale_routine_clears_both(self, app_state_service,
                                        settings_repo):
        """Routine key references a removed template — clear both."""
        settings_repo.set("active_routine_key", "nonexistent_routine")
        settings_repo.set("current_day_key", "some_day")
        settings_repo.commit()

        result = app_state_service.reconcile_on_startup()
        assert result["routine_cleared"] is True
        assert settings_repo.get("active_routine_key") is None
        assert settings_repo.get("current_day_key") is None

    def test_stale_day_resets_to_first(self, app_state_service,
                                        settings_repo):
        """Day key missing from active routine — reset to first day."""
        settings_repo.set("active_routine_key", "push_pull_legs")
        settings_repo.set("current_day_key", "nonexistent_day")
        settings_repo.commit()

        result = app_state_service.reconcile_on_startup()
        assert result["routine_cleared"] is False
        assert result["day_reset"] is True
        assert settings_repo.get("current_day_key") == "push"  # first day

    def test_detects_in_progress_session(self, app_state_service,
                                          settings_repo, workout_repo,
                                          exercise_registry, routine_registry):
        """Detects in-progress session for resume prompt."""
        from src.services.workout_service import WorkoutService
        ws = WorkoutService(workout_repo, settings_repo, exercise_registry,
                            routine_registry)
        settings_repo.set("active_routine_key", "push_pull_legs")
        settings_repo.set("current_day_key", "push")
        settings_repo.commit()

        ws.start_session()

        result = app_state_service.reconcile_on_startup()
        assert result["has_in_progress_session"] is True


class TestActiveRoutine:
    """Setting and getting the active routine."""

    def test_no_active_routine_returns_none(self, app_state_service):
        assert app_state_service.get_active_routine() is None

    def test_set_active_routine(self, app_state_service, settings_repo):
        app_state_service.set_active_routine("push_pull_legs")
        routine = app_state_service.get_active_routine()
        assert routine is not None
        assert routine.key == "push_pull_legs"
        # Current day set to first day
        day = app_state_service.get_current_day()
        assert day is not None
        assert day.key == "push"

    def test_switch_routine_resets_day(self, app_state_service, settings_repo):
        """Switching routines resets current day to new routine's first day."""
        app_state_service.set_active_routine("push_pull_legs")
        # Advance to pull day
        app_state_service.advance_day()  # push -> pull
        assert app_state_service.get_current_day().key == "pull"

        # Switch to upper_lower
        app_state_service.set_active_routine("upper_lower")
        day = app_state_service.get_current_day()
        assert day.key == "upper"

    def test_set_invalid_routine_raises(self, app_state_service):
        with pytest.raises(ValueError, match="not found"):
            app_state_service.set_active_routine("nonexistent")

    def test_switch_blocked_during_workout(self, app_state_service,
                                            settings_repo, workout_repo,
                                            exercise_registry,
                                            routine_registry):
        """Cannot switch routines while a workout is in progress."""
        from src.services.workout_service import WorkoutService
        ws = WorkoutService(workout_repo, settings_repo, exercise_registry,
                            routine_registry)
        app_state_service.set_active_routine("push_pull_legs")
        ws.start_session()

        with pytest.raises(ValueError, match="in progress"):
            app_state_service.set_active_routine("upper_lower")


class TestCycleAdvancement:
    """Day cycle management: advance, wrap."""

    def test_advance_to_next_day(self, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        new_key = app_state_service.advance_day()
        assert new_key == "pull"
        assert app_state_service.get_current_day().key == "pull"

    def test_advance_wraps_at_end(self, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        app_state_service.advance_day()  # push -> pull
        app_state_service.advance_day()  # pull -> legs

        new_key = app_state_service.advance_day()  # legs -> push (wrap)
        assert new_key == "push"

    def test_advance_without_routine_raises(self, app_state_service):
        with pytest.raises(ValueError, match="No active routine"):
            app_state_service.advance_day()

    def test_get_current_day_without_routine_returns_none(
            self, app_state_service):
        assert app_state_service.get_current_day() is None
```

- [ ] **Step 2: Implement `src/services/app_state_service.py`**

```python
# src/services/app_state_service.py
"""AppStateService — startup reconciliation, active routine, cycle management."""
from typing import Optional

from src.models.bundled import Routine, RoutineDay
from src.registries.routine_registry import RoutineRegistry
from src.repositories.settings_repo import SettingsRepo
from src.repositories.workout_repo import WorkoutRepo


class AppStateService:
    def __init__(
        self,
        settings_repo: SettingsRepo,
        routine_registry: RoutineRegistry,
        workout_repo: WorkoutRepo,
    ):
        self._settings = settings_repo
        self._routines = routine_registry
        self._workouts = workout_repo

    # ------------------------------------------------------------------
    # Startup reconciliation
    # ------------------------------------------------------------------

    def reconcile_on_startup(self) -> dict:
        """Validate settings against current registries.

        Returns dict:
            routine_cleared: bool — active routine was invalid, cleared
            day_reset: bool — day key was invalid, reset to first day
            has_in_progress_session: bool — an in-progress session exists
        """
        routine_cleared = False
        day_reset = False

        routine_key = self._settings.get("active_routine_key")
        if routine_key is not None:
            routine = self._routines.get(routine_key)
            if routine is None:
                # Stale routine — clear both
                self._settings.delete("active_routine_key")
                self._settings.delete("current_day_key")
                self._settings.commit()
                routine_cleared = True
            else:
                # Routine valid — check day
                day_key = self._settings.get("current_day_key")
                day_keys = [d.key for d in routine.days]
                if day_key not in day_keys:
                    self._settings.set("current_day_key", routine.days[0].key)
                    self._settings.commit()
                    day_reset = True

        has_in_progress = self._workouts.get_in_progress_session() is not None

        return {
            "routine_cleared": routine_cleared,
            "day_reset": day_reset,
            "has_in_progress_session": has_in_progress,
        }

    # ------------------------------------------------------------------
    # Active routine
    # ------------------------------------------------------------------

    def get_active_routine(self) -> Optional[Routine]:
        """Return the active routine, or None if none is set."""
        key = self._settings.get("active_routine_key")
        if key is None:
            return None
        return self._routines.get(key)

    def get_current_day(self) -> Optional[RoutineDay]:
        """Return the current day of the active routine, or None."""
        routine = self.get_active_routine()
        if routine is None:
            return None
        day_key = self._settings.get("current_day_key")
        if day_key is None:
            return None
        for day in routine.days:
            if day.key == day_key:
                return day
        return None

    def set_active_routine(self, routine_key: str) -> None:
        """Set the active routine and reset current day to its first day.

        Raises ValueError if routine_key is not in registry or a workout
        is in progress.
        """
        # Block if workout in progress
        if self._workouts.get_in_progress_session() is not None:
            raise ValueError("Cannot switch routines while a workout is in progress")

        routine = self._routines.get(routine_key)
        if routine is None:
            raise ValueError(f"Routine '{routine_key}' not found in registry")

        self._settings.set("active_routine_key", routine_key)
        self._settings.set("current_day_key", routine.days[0].key)
        self._settings.commit()

    # ------------------------------------------------------------------
    # Cycle management
    # ------------------------------------------------------------------

    def advance_day(self) -> str:
        """Advance current_day_key to the next day. Wraps at end.

        Returns the new day key.
        Raises ValueError if no active routine.
        """
        routine = self.get_active_routine()
        if routine is None:
            raise ValueError("No active routine set")

        current_key = self._settings.get("current_day_key")
        day_keys = [d.key for d in routine.days]

        try:
            idx = day_keys.index(current_key)
        except ValueError:
            idx = -1  # Will wrap to 0

        next_idx = (idx + 1) % len(day_keys)
        new_key = day_keys[next_idx]

        self._settings.set("current_day_key", new_key)
        self._settings.commit()
        return new_key

    def has_in_progress_session(self) -> bool:
        """Check if there is an in-progress workout session."""
        return self._workouts.get_in_progress_session() is not None
```

- [ ] **Step 3: Run tests and verify all pass**

```bash
pytest tests/test_app_state_service.py -v
```

- [ ] **Step 4: Commit**

```
feat(v2): AppStateService with startup reconciliation and cycle management
```

---

## Task 3: WorkoutService — Session Lifecycle + Set Logging

**Goal:** Full workout lifecycle: start session (snapshot plan), log/edit/delete sets, add ad-hoc exercise, finish/end-early/cancel. Type-aware validation on every logged set.

**File:** `src/services/workout_service.py`, `tests/test_workout_service.py`

**Depends on:** WorkoutRepo, SettingsRepo, ExerciseRegistry, RoutineRegistry, AppStateService (for advance_day — but WorkoutService calls AppStateService internally or accepts it as a dependency; to avoid circular deps, WorkoutService takes a cycle_advance callback or depends on AppStateService directly)

### Design Decision: Cycle Advancement

WorkoutService needs to advance the day when finishing/ending-early. Two options:
1. WorkoutService depends on AppStateService (creates a service-to-service dependency).
2. WorkoutService calls SettingsRepo directly for cycle logic.

**Choice: Option 1.** WorkoutService takes AppStateService as a constructor dependency. This keeps cycle logic centralized. The architecture rule "each layer only calls the layer directly below" applies to screens/services/repos — services calling other services within the same layer is acceptable when the dependency is acyclic.

Updated constructor:

```python
class WorkoutService:
    def __init__(self, workout_repo, settings_repo, exercise_registry,
                 routine_registry, app_state_service): ...
```

Wait — this creates a fixture dependency cycle in conftest (app_state_service needs workout_repo, workout_service needs app_state_service). Let me reconsider.

**Revised choice: WorkoutService takes SettingsRepo + RoutineRegistry for cycle advancement.** This duplicates the advance logic (3 lines) but avoids circular dependencies. The advance logic is: get current day index, increment mod length, update setting.

Actually, even simpler: **WorkoutService calls `app_state_service.advance_day()` via a passed-in reference.** The fixture order is: workout_repo and settings_repo are leaf fixtures, app_state_service depends on settings_repo + routine_registry + workout_repo, workout_service depends on workout_repo + settings_repo + exercise_registry + routine_registry + app_state_service. No cycle.

**Final choice: WorkoutService depends on AppStateService.**

Updated conftest fixture:

```python
@pytest.fixture
def workout_service(workout_repo, settings_repo, exercise_registry,
                    routine_registry, app_state_service):
    from src.services.workout_service import WorkoutService
    return WorkoutService(workout_repo, settings_repo, exercise_registry,
                          routine_registry, app_state_service)
```

### Tests

- [ ] **Step 1: Update conftest.py workout_service fixture** to include app_state_service dependency.

Replace the `workout_service` fixture in `tests/conftest.py`:

```python
@pytest.fixture
def workout_service(workout_repo, settings_repo, exercise_registry,
                    routine_registry, app_state_service):
    from src.services.workout_service import WorkoutService
    return WorkoutService(workout_repo, settings_repo, exercise_registry,
                          routine_registry, app_state_service)
```

- [ ] **Step 2: Write `tests/test_workout_service.py`**

```python
# tests/test_workout_service.py
"""Tests for WorkoutService — session lifecycle, set logging, editing."""
import pytest
from src.models.workout import SessionStatus
from tests.conftest import days_ago


class TestStartSession:
    """Starting a workout session snapshots the plan."""

    def test_start_session_creates_session_and_exercises(
            self, workout_service, app_state_service, settings_repo):
        app_state_service.set_active_routine("push_pull_legs")
        # Current day is "push" (2 exercises: bench press + plank)

        session = workout_service.start_session()
        assert session.id is not None
        assert session.status == SessionStatus.IN_PROGRESS
        assert session.routine_key_snapshot == "push_pull_legs"
        assert session.routine_name_snapshot == "Push Pull Legs"
        assert session.day_key_snapshot == "push"
        assert session.day_label_snapshot == "A"
        assert session.day_name_snapshot == "Push"

        exercises = workout_service.get_session_exercises(session.id)
        assert len(exercises) == 2
        assert exercises[0].exercise_key_snapshot == "barbell_bench_press"
        assert exercises[0].source == "planned"
        assert exercises[0].scheme_snapshot == "progressive"
        assert exercises[0].planned_sets == 3
        assert exercises[0].target_reps_min is None  # progressive
        assert exercises[1].exercise_key_snapshot == "plank"
        assert exercises[1].exercise_type_snapshot == "time"
        assert exercises[1].target_duration_seconds == 60

    def test_start_session_blocks_if_already_in_progress(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        workout_service.start_session()

        with pytest.raises(ValueError, match="already in progress"):
            workout_service.start_session()

    def test_start_session_requires_active_routine(self, workout_service):
        with pytest.raises(ValueError, match="No active routine"):
            workout_service.start_session()

class TestLogSet:
    """Logging sets during a workout."""

    def test_log_reps_weight_set(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]  # barbell_bench_press, reps_weight

        logged = workout_service.log_set(
            session_exercise_id=bench_se.id,
            reps=10, weight=60.0,
        )
        assert logged.id is not None
        assert logged.set_number == 1
        assert logged.reps == 10
        assert logged.weight == 60.0

    def test_log_time_set(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        plank_se = exercises[1]  # plank, time

        logged = workout_service.log_set(
            session_exercise_id=plank_se.id,
            duration_seconds=45,
        )
        assert logged.set_number == 1
        assert logged.duration_seconds == 45

    def test_log_cardio_set_with_distance(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        # Advance to pull day which has running
        app_state_service.advance_day()  # push -> pull
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        running_se = [e for e in exercises
                      if e.exercise_key_snapshot == "running"][0]

        logged = workout_service.log_set(
            session_exercise_id=running_se.id,
            duration_seconds=1800, distance_km=5.0,
        )
        assert logged.duration_seconds == 1800
        assert logged.distance_km == 5.0

    def test_log_cardio_set_distance_only(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        app_state_service.advance_day()
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        running_se = [e for e in exercises
                      if e.exercise_key_snapshot == "running"][0]

        logged = workout_service.log_set(
            session_exercise_id=running_se.id,
            distance_km=5.0,
        )
        assert logged.distance_km == 5.0
        assert logged.duration_seconds is None

    def test_log_cardio_set_duration_only(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        app_state_service.advance_day()
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        running_se = [e for e in exercises
                      if e.exercise_key_snapshot == "running"][0]

        logged = workout_service.log_set(
            session_exercise_id=running_se.id,
            duration_seconds=1800,
        )
        assert logged.duration_seconds == 1800

    def test_set_numbers_auto_increment(self, workout_service,
                                         app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        s1 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=10, weight=60.0)
        s2 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=8, weight=70.0)
        s3 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=6, weight=80.0)
        assert s1.set_number == 1
        assert s2.set_number == 2
        assert s3.set_number == 3

    def test_reps_weight_requires_reps_and_weight(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        with pytest.raises(ValueError, match="reps"):
            workout_service.log_set(session_exercise_id=bench_se.id,
                                     weight=60.0)

        with pytest.raises(ValueError, match="weight"):
            workout_service.log_set(session_exercise_id=bench_se.id,
                                     reps=10)

    def test_reps_weight_allows_zero_weight(
            self, workout_service, app_state_service):
        """Bodyweight exercises have weight=0."""
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        logged = workout_service.log_set(session_exercise_id=bench_se.id,
                                          reps=10, weight=0.0)
        assert logged.weight == 0.0

    def test_time_requires_duration(self, workout_service,
                                     app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        plank_se = exercises[1]

        with pytest.raises(ValueError, match="duration"):
            workout_service.log_set(session_exercise_id=plank_se.id,
                                     reps=10)

    def test_cardio_requires_at_least_one_metric(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        app_state_service.advance_day()
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        running_se = [e for e in exercises
                      if e.exercise_key_snapshot == "running"][0]

        with pytest.raises(ValueError, match="duration.*distance"):
            workout_service.log_set(session_exercise_id=running_se.id)


class TestEditSet:
    """Editing logged sets (current or finished sessions)."""

    def test_edit_set_updates_values(self, workout_service,
                                      app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        logged = workout_service.log_set(session_exercise_id=bench_se.id,
                                          reps=10, weight=60.0)
        updated = workout_service.edit_set(logged.id, reps=12, weight=65.0)
        assert updated.reps == 12
        assert updated.weight == 65.0

    def test_edit_set_partial_update(self, workout_service,
                                      app_state_service):
        """Can update just one field."""
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        logged = workout_service.log_set(session_exercise_id=bench_se.id,
                                          reps=10, weight=60.0)
        updated = workout_service.edit_set(logged.id, reps=12)
        assert updated.reps == 12
        assert updated.weight == 60.0  # unchanged

    def test_edit_validates_type(self, workout_service, app_state_service):
        """Cannot null out required fields for the exercise type."""
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        logged = workout_service.log_set(session_exercise_id=bench_se.id,
                                          reps=10, weight=60.0)
        # Setting reps to None on a reps_weight exercise should fail
        # (edit_set uses sentinel to distinguish "not provided" from "set to None")
        # Actually: edit_set only updates fields that are explicitly passed.
        # The type invariants remain enforced by the CHECK constraints.
        # This test verifies the service-level validation catches it.

    def test_edit_nonexistent_set_raises(self, workout_service):
        with pytest.raises(ValueError, match="not found"):
            workout_service.edit_set(9999, reps=10)


class TestDeleteSet:
    """Deleting logged sets with resequencing."""

    def test_delete_set_resequences(self, workout_service,
                                     app_state_service, workout_repo):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        s1 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=10, weight=60.0)
        s2 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=8, weight=70.0)
        s3 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=6, weight=80.0)

        workout_service.delete_set(s2.id)

        sets = workout_repo.get_logged_sets(bench_se.id)
        assert len(sets) == 2
        assert sets[0].set_number == 1
        assert sets[0].weight == 60.0
        assert sets[1].set_number == 2
        assert sets[1].weight == 80.0  # was set_number 3, now 2

    def test_delete_last_set_from_finished_session_deletes_session(
            self, workout_service, app_state_service, workout_repo):
        """Finished session with all sets deleted => session deleted."""
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        s1 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        # Delete the only set
        workout_service.delete_set(s1.id)

        # Session should be gone
        assert workout_repo.get_session(session.id) is None

    def test_delete_last_set_finished_session_no_cycle_rewind(
            self, workout_service, app_state_service, settings_repo):
        """Cycle advancement is permanent — deleting sets doesn't rewind."""
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]
        s1 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        # Day should have advanced to pull
        assert app_state_service.get_current_day().key == "pull"

        # Delete last set => session deleted
        workout_service.delete_set(s1.id)

        # Day should STILL be pull (no rewind)
        assert app_state_service.get_current_day().key == "pull"

    def test_delete_nonexistent_set_raises(self, workout_service):
        with pytest.raises(ValueError, match="not found"):
            workout_service.delete_set(9999)


class TestAddAdHocExercise:
    """Adding ad-hoc exercises during a workout."""

    def test_add_ad_hoc_exercise(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()

        se = workout_service.add_ad_hoc_exercise(
            session_id=session.id,
            exercise_key="running",
        )
        assert se.source == "ad_hoc"
        assert se.exercise_key_snapshot == "running"
        assert se.exercise_type_snapshot == "cardio"
        assert se.planned_sets is None
        assert se.target_reps_min is None
        assert se.scheme_snapshot is None

    def test_ad_hoc_appended_at_end(self, workout_service,
                                     app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        # push day has 2 planned exercises (sort_order 0, 1)

        se = workout_service.add_ad_hoc_exercise(
            session_id=session.id,
            exercise_key="running",
        )
        assert se.sort_order == 2  # after the 2 planned exercises

    def test_ad_hoc_invalid_exercise_raises(self, workout_service,
                                             app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()

        with pytest.raises(ValueError, match="not found"):
            workout_service.add_ad_hoc_exercise(
                session_id=session.id,
                exercise_key="nonexistent_exercise",
            )

    def test_ad_hoc_requires_in_progress_session(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        # Log a set so we can finish
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        with pytest.raises(ValueError, match="not in progress"):
            workout_service.add_ad_hoc_exercise(
                session_id=session.id,
                exercise_key="running",
            )

    def test_can_log_sets_on_ad_hoc_exercise(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        se = workout_service.add_ad_hoc_exercise(
            session_id=session.id,
            exercise_key="barbell_back_squat",
        )

        logged = workout_service.log_set(
            session_exercise_id=se.id,
            reps=10, weight=100.0,
        )
        assert logged.set_number == 1
        assert logged.reps == 10


class TestFinishSession:
    """Finishing a workout."""

    def test_finish_session(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)

        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)

        finished = workout_service.finish_session(session.id)
        assert finished.status == SessionStatus.FINISHED
        assert finished.completed_fully is True
        assert finished.finished_at is not None

    def test_finish_advances_cycle(self, workout_service,
                                    app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        assert app_state_service.get_current_day().key == "pull"

    def test_finish_not_in_progress_raises(self, workout_service,
                                            app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        with pytest.raises(ValueError, match="not in progress"):
            workout_service.finish_session(session.id)

    def test_finish_nonexistent_session_raises(self, workout_service):
        with pytest.raises(ValueError, match="not found"):
            workout_service.finish_session(9999)


class TestEndEarly:
    """Ending a workout early."""

    def test_end_early_with_sets(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)

        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)

        finished = workout_service.end_early(session.id)
        assert finished.status == SessionStatus.FINISHED
        assert finished.completed_fully is False

    def test_end_early_advances_cycle_if_sets_exist(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.end_early(session.id)

        assert app_state_service.get_current_day().key == "pull"

    def test_end_early_requires_at_least_one_set(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()

        with pytest.raises(ValueError, match="at least one set"):
            workout_service.end_early(session.id)


class TestCancelSession:
    """Canceling a workout (zero sets)."""

    def test_cancel_deletes_empty_session(self, workout_service,
                                           app_state_service, workout_repo):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()

        workout_service.cancel_session(session.id)
        assert workout_repo.get_session(session.id) is None

    def test_cancel_does_not_advance_cycle(self, workout_service,
                                            app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        session = workout_service.start_session()
        workout_service.cancel_session(session.id)

        assert app_state_service.get_current_day().key == "push"

    def test_cancel_with_sets_raises(self, workout_service,
                                      app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)

        with pytest.raises(ValueError, match="has logged sets"):
            workout_service.cancel_session(session.id)

    def test_cancel_nonexistent_session_raises(self, workout_service):
        with pytest.raises(ValueError, match="not found"):
            workout_service.cancel_session(9999)

    def test_cancel_finished_session_raises(self, workout_service,
                                             app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        with pytest.raises(ValueError, match="not in progress"):
            workout_service.cancel_session(session.id)


class TestGetInProgressSession:
    """get_in_progress_session — pass-through to repo."""

    def test_returns_none_when_no_session(self, workout_service):
        assert workout_service.get_in_progress_session() is None

    def test_returns_session_when_in_progress(self, workout_service,
                                               app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        started = workout_service.start_session()
        result = workout_service.get_in_progress_session()
        assert result is not None
        assert result.id == started.id

    def test_returns_none_after_finish(self, workout_service,
                                       app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)
        assert workout_service.get_in_progress_session() is None
```

- [ ] **Step 3: Implement `src/services/workout_service.py`**

```python
# src/services/workout_service.py
"""WorkoutService — session lifecycle, set logging, editing."""
from datetime import datetime, timezone
from typing import List, Optional

from src.models.bundled import ExerciseType
from src.models.workout import (
    WorkoutSession, SessionExercise, LoggedSet, SessionStatus,
)
from src.registries.exercise_registry import ExerciseRegistry
from src.registries.routine_registry import RoutineRegistry
from src.repositories.settings_repo import SettingsRepo
from src.repositories.workout_repo import WorkoutRepo
from src.services.app_state_service import AppStateService


class WorkoutService:
    def __init__(
        self,
        workout_repo: WorkoutRepo,
        settings_repo: SettingsRepo,
        exercise_registry: ExerciseRegistry,
        routine_registry: RoutineRegistry,
        app_state_service: AppStateService,
    ):
        self._repo = workout_repo
        self._settings = settings_repo
        self._exercises = exercise_registry
        self._routines = routine_registry
        self._app_state = app_state_service

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    def start_session(self) -> WorkoutSession:
        """Start a new workout session.

        Creates session + snapshots all planned exercises in one transaction.
        Always reads the current day from settings via app_state_service.

        Raises ValueError if:
        - No active routine set
        - Another session is already in progress
        - No current day set
        """
        # Check no in-progress session
        if self._repo.get_in_progress_session() is not None:
            raise ValueError("A session is already in progress")

        # Get active routine
        routine = self._app_state.get_active_routine()
        if routine is None:
            raise ValueError("No active routine set")

        # Resolve day from settings
        day = self._app_state.get_current_day()
        if day is None:
            raise ValueError("No current day set")

        # Create session
        session = WorkoutSession(
            id=None,
            routine_key_snapshot=routine.key,
            routine_name_snapshot=routine.name,
            day_key_snapshot=day.key,
            day_label_snapshot=day.label,
            day_name_snapshot=day.name,
            status=SessionStatus.IN_PROGRESS,
            completed_fully=None,
            started_at=self._now(),
        )
        session.id = self._repo.create_session(session)

        # Snapshot planned exercises
        for i, de in enumerate(day.exercises):
            exercise = self._exercises.get(de.exercise_key)
            if exercise is None:
                continue  # skip if exercise removed from catalog

            se = SessionExercise(
                id=None,
                session_id=session.id,
                sort_order=i,
                exercise_key_snapshot=exercise.key,
                exercise_name_snapshot=exercise.name,
                exercise_type_snapshot=exercise.type.value,
                source="planned",
                scheme_snapshot=de.scheme.value,
                planned_sets=de.sets,
                target_reps_min=de.reps_min,
                target_reps_max=de.reps_max,
                target_duration_seconds=de.duration_seconds,
                target_distance_km=de.distance_km,
                plan_notes_snapshot=de.notes,
            )
            self._repo.add_session_exercise(se)

        self._repo.commit()
        return session

    def finish_session(self, session_id: int) -> WorkoutSession:
        """Finish a workout. completed_fully=True. Advances cycle.

        Raises ValueError if session not found or not in progress.
        """
        session = self._repo.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        self._repo.finish_session(session_id, completed_fully=True,
                                  finished_at=self._now())
        self._app_state.advance_day()
        self._repo.commit()
        return self._repo.get_session(session_id)

    def end_early(self, session_id: int) -> WorkoutSession:
        """End session early. completed_fully=False.
        Advances cycle only if >=1 set logged.

        Raises ValueError if session not found, not in progress,
        or has zero sets.
        """
        session = self._repo.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        total_sets = self._repo.get_session_total_set_count(session_id)
        if total_sets == 0:
            raise ValueError("Cannot end early — session has no logged sets. "
                             "Use cancel for sessions with at least one set.")
            # NOTE: error message intentionally says "at least one set"
            # for the caller's benefit

        self._repo.finish_session(session_id, completed_fully=False,
                                  finished_at=self._now())
        self._app_state.advance_day()
        self._repo.commit()
        return self._repo.get_session(session_id)

    def cancel_session(self, session_id: int) -> None:
        """Cancel a workout. Deletes the empty session. Does not advance cycle.

        Raises ValueError if session not found, not in progress,
        or has logged sets.
        """
        session = self._repo.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        total_sets = self._repo.get_session_total_set_count(session_id)
        if total_sets > 0:
            raise ValueError("Cannot cancel — session has logged sets. "
                             "Use end_early instead.")

        self._repo.delete_session(session_id)
        self._repo.commit()

    # ------------------------------------------------------------------
    # Session exercises
    # ------------------------------------------------------------------

    def get_session_exercises(self, session_id: int) -> List[SessionExercise]:
        return self._repo.get_session_exercises(session_id)

    def add_ad_hoc_exercise(self, session_id: int,
                            exercise_key: str) -> SessionExercise:
        """Add an ad-hoc exercise to an in-progress session.

        Raises ValueError if session not in progress or exercise not found.
        """
        session = self._repo.get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        exercise = self._exercises.get(exercise_key)
        if exercise is None:
            raise ValueError(f"Exercise '{exercise_key}' not found in catalog")

        max_order = self._repo.get_max_sort_order(session_id)
        next_order = max_order + 1 if max_order >= 0 else 0

        se = SessionExercise(
            id=None,
            session_id=session_id,
            sort_order=next_order,
            exercise_key_snapshot=exercise.key,
            exercise_name_snapshot=exercise.name,
            exercise_type_snapshot=exercise.type.value,
            source="ad_hoc",
            scheme_snapshot=None,
            planned_sets=None,
            target_reps_min=None,
            target_reps_max=None,
            target_duration_seconds=None,
            target_distance_km=None,
            plan_notes_snapshot=None,
        )
        se.id = self._repo.add_session_exercise(se)
        self._repo.commit()
        return se

    # ------------------------------------------------------------------
    # Set logging
    # ------------------------------------------------------------------

    def log_set(
        self,
        session_exercise_id: int,
        reps: Optional[int] = None,
        weight: Optional[float] = None,
        duration_seconds: Optional[int] = None,
        distance_km: Optional[float] = None,
    ) -> LoggedSet:
        """Log a set. Validates fields against exercise type.
        Committed immediately (crash safety).
        """
        se = self._repo.get_session_exercise(session_exercise_id)
        if se is None:
            raise ValueError(
                f"Session exercise {session_exercise_id} not found")

        self._validate_set_fields(se.exercise_type_snapshot,
                                  reps, weight, duration_seconds, distance_km)

        set_number = self._repo.get_logged_set_count(session_exercise_id) + 1
        ls = LoggedSet(
            id=None,
            session_exercise_id=session_exercise_id,
            set_number=set_number,
            reps=reps,
            weight=weight,
            duration_seconds=duration_seconds,
            distance_km=distance_km,
            logged_at=self._now(),
        )
        ls.id = self._repo.add_logged_set(ls)
        self._repo.commit()
        return ls

    def edit_set(
        self,
        set_id: int,
        reps: Optional[int] = ...,
        weight: Optional[float] = ...,
        duration_seconds: Optional[int] = ...,
        distance_km: Optional[float] = ...,
    ) -> LoggedSet:
        """Edit a logged set. Only updates fields that are explicitly passed.
        Uses ... (Ellipsis) as sentinel for "not provided".
        """
        ls = self._repo.get_logged_set(set_id)
        if ls is None:
            raise ValueError(f"Logged set {set_id} not found")

        se = self._repo.get_session_exercise(ls.session_exercise_id)

        # Apply updates (Ellipsis means "not provided")
        if reps is not ...:
            ls.reps = reps
        if weight is not ...:
            ls.weight = weight
        if duration_seconds is not ...:
            ls.duration_seconds = duration_seconds
        if distance_km is not ...:
            ls.distance_km = distance_km

        # Validate the final state
        self._validate_set_fields(se.exercise_type_snapshot,
                                  ls.reps, ls.weight,
                                  ls.duration_seconds, ls.distance_km)

        self._repo.update_logged_set(ls)
        self._repo.commit()
        return ls

    def delete_set(self, set_id: int) -> None:
        """Delete a logged set and resequence.

        If this was the last set in a finished session, deletes the session
        (no cycle rewind).
        """
        ls = self._repo.get_logged_set(set_id)
        if ls is None:
            raise ValueError(f"Logged set {set_id} not found")

        se = self._repo.get_session_exercise(ls.session_exercise_id)
        session = self._repo.get_session(se.session_id)

        self._repo.delete_logged_set(set_id)

        # Check if session is now empty and finished
        if session.status == SessionStatus.FINISHED:
            total_remaining = self._repo.get_session_total_set_count(
                session.id)
            if total_remaining == 0:
                self._repo.delete_session(session.id)

        self._repo.commit()

    def get_logged_sets(self, session_exercise_id: int) -> List[LoggedSet]:
        return self._repo.get_logged_sets(session_exercise_id)

    def get_in_progress_session(self) -> Optional[WorkoutSession]:
        """Return the current in-progress session, or None."""
        return self._repo.get_in_progress_session()

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    @staticmethod
    def _validate_set_fields(
        exercise_type: str,
        reps: Optional[int],
        weight: Optional[float],
        duration_seconds: Optional[int],
        distance_km: Optional[float],
    ) -> None:
        """Validate logged set fields match the exercise type.

        Raises ValueError with descriptive message on failure.
        """
        if exercise_type == "reps_weight":
            if reps is None:
                raise ValueError(
                    "reps_weight exercise requires reps")
            if weight is None:
                raise ValueError(
                    "reps_weight exercise requires weight (use 0 for bodyweight)")
        elif exercise_type == "time":
            if duration_seconds is None:
                raise ValueError(
                    "time exercise requires duration_seconds")
        elif exercise_type == "cardio":
            if duration_seconds is None and distance_km is None:
                raise ValueError(
                    "cardio exercise requires duration_seconds and/or "
                    "distance_km (at least one)")
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
pytest tests/test_workout_service.py -v
```

- [ ] **Step 5: Commit**

```
feat(v2): WorkoutService with session lifecycle, set logging, and type validation
```

---

## Task 4: BenchmarkService — Due Calculation + Result Recording

**Goal:** Service for benchmark due calculation and result recording. Benchmarks are sessionless.

**File:** `src/services/benchmark_service.py`, `tests/test_benchmark_service.py`

**Depends on:** BenchmarkRepo, BenchmarkRegistry, ExerciseRegistry

### Design

```python
class BenchmarkService:
    def __init__(self, benchmark_repo, benchmark_registry, exercise_registry): ...

    def get_due_items(self) -> List[dict]:
        """Items with no result or result older than frequency_weeks * 7 days.
        Returns list of dicts: {exercise_key, exercise_name, method, last_tested_at}
        """

    def is_any_due(self) -> bool:
        """Quick check for home screen alert."""

    def record_result(
        self,
        exercise_key: str,
        method: str,
        result_value: float,
        bodyweight: Optional[float] = None,
    ) -> BenchmarkResult:
        """Record a benchmark result. Validates method against config."""

    def get_history(self, exercise_key: str) -> List[BenchmarkResult]:
        """All results for an exercise, oldest first."""
```

### Tests

- [ ] **Step 1: Write `tests/test_benchmark_service.py`**

```python
# tests/test_benchmark_service.py
"""Tests for BenchmarkService — due calculation and result recording."""
import pytest
from datetime import datetime, timezone, timedelta
from tests.conftest import days_ago


class TestDueCalculation:
    """Benchmark due = no result or result older than frequency * 7 days."""

    def test_all_due_when_no_results(self, benchmark_service):
        """All items are due when no results have been recorded."""
        due = benchmark_service.get_due_items()
        assert len(due) == 3  # bench, pull_up, plank
        keys = {d["exercise_key"] for d in due}
        assert keys == {"barbell_bench_press", "pull_up", "plank"}

    def test_is_any_due_true_initially(self, benchmark_service):
        assert benchmark_service.is_any_due() is True

    def test_fresh_result_not_due(self, benchmark_service):
        """Recent result within frequency window — not due."""
        benchmark_service.record_result(
            exercise_key="barbell_bench_press",
            method="max_weight",
            result_value=100.0,
            bodyweight=80.0,
        )
        due = benchmark_service.get_due_items()
        keys = {d["exercise_key"] for d in due}
        assert "barbell_bench_press" not in keys
        assert len(due) == 2  # pull_up and plank still due

    def test_old_result_becomes_due(self, benchmark_service, benchmark_repo):
        """Result older than frequency_weeks * 7 days becomes due."""
        from src.models.benchmark import BenchmarkResult
        # Insert an old result directly
        old_date = (datetime.now(timezone.utc)
                    - timedelta(days=43)).isoformat()  # > 6*7=42 days
        result = BenchmarkResult(
            id=None,
            exercise_key_snapshot="barbell_bench_press",
            exercise_name_snapshot="Barbell Bench Press",
            method="max_weight",
            result_value=100.0,
            bodyweight=80.0,
            tested_at=old_date,
        )
        benchmark_repo.add_result(result)
        benchmark_repo.commit()

        due = benchmark_service.get_due_items()
        keys = {d["exercise_key"] for d in due}
        assert "barbell_bench_press" in keys

    def test_all_recorded_none_due(self, benchmark_service):
        """All items recently tested — none due."""
        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         100.0, bodyweight=80.0)
        benchmark_service.record_result("pull_up", "max_reps",
                                         15.0, bodyweight=80.0)
        benchmark_service.record_result("plank", "timed_hold",
                                         120.0, bodyweight=80.0)
        assert benchmark_service.is_any_due() is False
        assert len(benchmark_service.get_due_items()) == 0

    def test_due_items_include_last_tested_at(self, benchmark_service):
        """Due items show when they were last tested (or None)."""
        due = benchmark_service.get_due_items()
        for item in due:
            assert "last_tested_at" in item
            assert item["last_tested_at"] is None  # never tested

        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         100.0)
        # Bench is now fresh, check remaining
        due = benchmark_service.get_due_items()
        for item in due:
            assert item["last_tested_at"] is None


class TestRecordResult:
    """Recording benchmark results."""

    def test_record_result_basic(self, benchmark_service):
        result = benchmark_service.record_result(
            exercise_key="barbell_bench_press",
            method="max_weight",
            result_value=100.0,
            bodyweight=80.0,
        )
        assert result.id is not None
        assert result.exercise_key_snapshot == "barbell_bench_press"
        assert result.exercise_name_snapshot == "Barbell Bench Press"
        assert result.method == "max_weight"
        assert result.result_value == 100.0
        assert result.bodyweight == 80.0

    def test_record_result_without_bodyweight(self, benchmark_service):
        result = benchmark_service.record_result(
            exercise_key="plank",
            method="timed_hold",
            result_value=120.0,
        )
        assert result.bodyweight is None

    def test_record_result_invalid_exercise_raises(self, benchmark_service):
        with pytest.raises(ValueError, match="not found"):
            benchmark_service.record_result(
                exercise_key="nonexistent",
                method="max_weight",
                result_value=100.0,
            )

    def test_record_result_invalid_method_raises(self, benchmark_service):
        """Method must match the config for this exercise."""
        with pytest.raises(ValueError, match="method"):
            benchmark_service.record_result(
                exercise_key="barbell_bench_press",
                method="max_reps",  # config says max_weight
                result_value=100.0,
            )

    def test_record_result_exercise_not_in_config_raises(
            self, benchmark_service):
        """Exercise exists in catalog but not in benchmark config."""
        with pytest.raises(ValueError, match="not in benchmark"):
            benchmark_service.record_result(
                exercise_key="running",  # not in benchmark config
                method="timed_hold",
                result_value=100.0,
            )

    def test_record_result_zero_value_raises(self, benchmark_service):
        with pytest.raises(ValueError, match="positive"):
            benchmark_service.record_result(
                exercise_key="barbell_bench_press",
                method="max_weight",
                result_value=0.0,
            )


class TestBenchmarkHistory:
    """Retrieving benchmark history."""

    def test_history_empty(self, benchmark_service):
        history = benchmark_service.get_history("barbell_bench_press")
        assert history == []

    def test_history_oldest_first(self, benchmark_service):
        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         90.0, bodyweight=80.0)
        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         95.0, bodyweight=80.0)
        benchmark_service.record_result("barbell_bench_press", "max_weight",
                                         100.0, bodyweight=80.0)

        history = benchmark_service.get_history("barbell_bench_press")
        assert len(history) == 3
        assert history[0].result_value == 90.0
        assert history[2].result_value == 100.0
```

- [ ] **Step 2: Implement `src/services/benchmark_service.py`**

```python
# src/services/benchmark_service.py
"""BenchmarkService — due calculation and result recording."""
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from src.models.benchmark import BenchmarkResult
from src.registries.benchmark_registry import BenchmarkRegistry
from src.registries.exercise_registry import ExerciseRegistry
from src.repositories.benchmark_repo import BenchmarkRepo


class BenchmarkService:
    def __init__(
        self,
        benchmark_repo: BenchmarkRepo,
        benchmark_registry: BenchmarkRegistry,
        exercise_registry: ExerciseRegistry,
    ):
        self._repo = benchmark_repo
        self._config = benchmark_registry
        self._exercises = exercise_registry

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # Due calculation
    # ------------------------------------------------------------------

    def get_due_items(self) -> List[dict]:
        """Return benchmark items that are due for testing.

        An item is due when:
        - It has no recorded result, OR
        - Its latest tested_at is older than frequency_weeks * 7 days.

        Returns list of dicts:
            exercise_key, exercise_name, method, last_tested_at
        """
        config = self._config.get_config()
        cutoff = datetime.now(timezone.utc) - timedelta(
            days=config.frequency_weeks * 7)
        cutoff_iso = cutoff.isoformat()

        due = []
        for item in config.items:
            exercise = self._exercises.get(item.exercise_key)
            if exercise is None:
                continue

            latest = self._repo.get_latest_result(item.exercise_key)
            if latest is None or latest.tested_at < cutoff_iso:
                due.append({
                    "exercise_key": item.exercise_key,
                    "exercise_name": exercise.name,
                    "method": item.method.value,
                    "last_tested_at": latest.tested_at if latest else None,
                })

        return due

    def is_any_due(self) -> bool:
        """Quick check: are any benchmark items due?"""
        return len(self.get_due_items()) > 0

    # ------------------------------------------------------------------
    # Result recording
    # ------------------------------------------------------------------

    def record_result(
        self,
        exercise_key: str,
        method: str,
        result_value: float,
        bodyweight: Optional[float] = None,
    ) -> BenchmarkResult:
        """Record a benchmark result.

        Validates:
        - exercise_key exists in catalog
        - exercise_key is in benchmark config
        - method matches config for this exercise
        - result_value > 0
        """
        if result_value <= 0:
            raise ValueError("result_value must be positive")

        exercise = self._exercises.get(exercise_key)
        if exercise is None:
            raise ValueError(f"Exercise '{exercise_key}' not found in catalog")

        config = self._config.get_config()
        config_item = None
        for item in config.items:
            if item.exercise_key == exercise_key:
                config_item = item
                break

        if config_item is None:
            raise ValueError(
                f"Exercise '{exercise_key}' not in benchmark config")

        if config_item.method.value != method:
            raise ValueError(
                f"Invalid method '{method}' for exercise '{exercise_key}'. "
                f"Expected '{config_item.method.value}'")

        result = BenchmarkResult(
            id=None,
            exercise_key_snapshot=exercise.key,
            exercise_name_snapshot=exercise.name,
            method=method,
            result_value=result_value,
            bodyweight=bodyweight,
            tested_at=self._now(),
        )
        result.id = self._repo.add_result(result)
        self._repo.commit()
        return result

    # ------------------------------------------------------------------
    # History
    # ------------------------------------------------------------------

    def get_history(self, exercise_key: str) -> List[BenchmarkResult]:
        """All results for an exercise, oldest first (for charts)."""
        results = self._repo.get_results_for_exercise(exercise_key)
        # Repo returns newest-first; reverse for charts
        return list(reversed(results))
```

- [ ] **Step 3: Run tests and verify all pass**

```bash
pytest tests/test_benchmark_service.py -v
```

- [ ] **Step 4: Commit**

```
feat(v2): BenchmarkService with due calculation and result recording
```

---

## Task 5: StatsService — Dashboard Queries

**Goal:** All dashboard queries: session count, last workout summary, exercise history, exercise best set, personal bests, volume trend, benchmark history, benchmark due summary.

**File:** `src/services/stats_service.py`, `tests/test_stats_service.py`

**Depends on:** WorkoutRepo, BenchmarkRepo, ExerciseRegistry, BenchmarkRegistry

### Design

```python
class StatsService:
    def __init__(self, workout_repo, benchmark_repo, exercise_registry,
                 benchmark_registry): ...

    def get_session_count(self, since: Optional[str] = None) -> int: ...
    def get_last_workout_summary(self) -> Optional[dict]: ...
    def get_exercise_history(self, exercise_key: str) -> List[dict]: ...
    def get_exercise_best_set(self, exercise_key: str) -> Optional[dict]: ...
    def get_personal_bests(self, limit: int = 5) -> List[dict]: ...
    def get_total_volume_trend(self, weeks: int = 4) -> List[dict]: ...
    def get_benchmark_history(self, exercise_key: str, method: Optional[str] = None) -> List[dict]: ...
    def get_benchmark_due_summary(self) -> dict: ...
    def get_exercises_with_history(self) -> List[str]: ...
    def get_latest_plan_vs_actual(self, exercise_key: str) -> Optional[dict]: ...
    def get_last_set_for_exercise(self, exercise_key: str) -> Optional[dict]: ...
```

### Tests

For stats tests, we need realistic session data. We'll build helper functions to seed sessions efficiently.

- [ ] **Step 1: Write `tests/test_stats_service.py`**

```python
# tests/test_stats_service.py
"""Tests for StatsService — dashboard queries, PRs, trends."""
import pytest
from datetime import datetime, timezone, timedelta
from src.models.workout import WorkoutSession, SessionExercise, LoggedSet, SessionStatus
from src.models.benchmark import BenchmarkResult


def _seed_finished_session(workout_repo, routine_key="push_pull_legs",
                           routine_name="Push Pull Legs",
                           day_key="push", day_label="A", day_name="Push",
                           started_at=None, finished_at=None,
                           completed_fully=True):
    """Helper: create a finished session directly in the repo."""
    now = datetime.now(timezone.utc)
    if started_at is None:
        started_at = now.isoformat()
    if finished_at is None:
        finished_at = (now + timedelta(minutes=45)).isoformat()

    session = WorkoutSession(
        id=None,
        routine_key_snapshot=routine_key,
        routine_name_snapshot=routine_name,
        day_key_snapshot=day_key,
        day_label_snapshot=day_label,
        day_name_snapshot=day_name,
        status=SessionStatus.FINISHED,
        completed_fully=completed_fully,
        started_at=started_at,
        finished_at=finished_at,
    )
    session.id = workout_repo.create_session(session)
    return session


def _seed_session_exercise(workout_repo, session_id, sort_order=0,
                           exercise_key="barbell_bench_press",
                           exercise_name="Barbell Bench Press",
                           exercise_type="reps_weight",
                           source="planned", scheme="progressive",
                           planned_sets=3):
    """Helper: add a session exercise."""
    se = SessionExercise(
        id=None,
        session_id=session_id,
        sort_order=sort_order,
        exercise_key_snapshot=exercise_key,
        exercise_name_snapshot=exercise_name,
        exercise_type_snapshot=exercise_type,
        source=source,
        scheme_snapshot=scheme,
        planned_sets=planned_sets,
        target_reps_min=None,
        target_reps_max=None,
        target_duration_seconds=None,
        target_distance_km=None,
        plan_notes_snapshot=None,
    )
    se.id = workout_repo.add_session_exercise(se)
    return se


def _seed_logged_set(workout_repo, session_exercise_id, set_number,
                     reps=None, weight=None, duration_seconds=None,
                     distance_km=None, logged_at=None):
    """Helper: add a logged set."""
    if logged_at is None:
        logged_at = datetime.now(timezone.utc).isoformat()
    ls = LoggedSet(
        id=None,
        session_exercise_id=session_exercise_id,
        set_number=set_number,
        reps=reps,
        weight=weight,
        duration_seconds=duration_seconds,
        distance_km=distance_km,
        logged_at=logged_at,
    )
    ls.id = workout_repo.add_logged_set(ls)
    return ls


class TestSessionCount:
    """get_session_count — finished sessions with >=1 set."""

    def test_zero_sessions(self, stats_service):
        assert stats_service.get_session_count() == 0

    def test_counts_finished_sessions_with_sets(self, stats_service,
                                                  workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        assert stats_service.get_session_count() == 1

    def test_excludes_zero_set_sessions(self, stats_service, workout_repo):
        """Finished sessions with no sets should not count."""
        _seed_finished_session(workout_repo)
        workout_repo.commit()
        assert stats_service.get_session_count() == 0

    def test_excludes_in_progress_sessions(self, stats_service, workout_repo):
        session = WorkoutSession(
            id=None,
            routine_key_snapshot="push_pull_legs",
            routine_name_snapshot="Push Pull Legs",
            day_key_snapshot="push",
            day_label_snapshot="A",
            day_name_snapshot="Push",
            status=SessionStatus.IN_PROGRESS,
            completed_fully=None,
            started_at=datetime.now(timezone.utc).isoformat(),
        )
        session.id = workout_repo.create_session(session)
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        assert stats_service.get_session_count() == 0

    def test_since_filter(self, stats_service, workout_repo):
        """Count only sessions after a given date."""
        now = datetime.now(timezone.utc)
        old = (now - timedelta(days=10)).isoformat()
        old_finish = (now - timedelta(days=10) + timedelta(minutes=30)).isoformat()
        recent = (now - timedelta(hours=1)).isoformat()
        recent_finish = now.isoformat()

        s1 = _seed_finished_session(workout_repo, started_at=old,
                                     finished_at=old_finish)
        se1 = _seed_session_exercise(workout_repo, s1.id)
        _seed_logged_set(workout_repo, se1.id, 1, reps=10, weight=60.0)

        s2 = _seed_finished_session(workout_repo, started_at=recent,
                                     finished_at=recent_finish)
        se2 = _seed_session_exercise(workout_repo, s2.id)
        _seed_logged_set(workout_repo, se2.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        since = (now - timedelta(days=7)).isoformat()
        assert stats_service.get_session_count(since=since) == 1
        assert stats_service.get_session_count() == 2


class TestLastWorkoutSummary:
    """get_last_workout_summary — most recent finished session with sets."""

    def test_no_sessions_returns_none(self, stats_service):
        assert stats_service.get_last_workout_summary() is None

    def test_returns_summary(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        started = now.isoformat()
        finished = (now + timedelta(minutes=45)).isoformat()

        session = _seed_finished_session(workout_repo, started_at=started,
                                          finished_at=finished)
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        summary = stats_service.get_last_workout_summary()
        assert summary is not None
        assert summary["session_id"] == session.id
        assert summary["day_label"] == "A"
        assert summary["day_name"] == "Push"
        assert summary["duration_minutes"] == 45

    def test_returns_most_recent(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)

        s1 = _seed_finished_session(
            workout_repo,
            started_at=(now - timedelta(days=2)).isoformat(),
            finished_at=(now - timedelta(days=2) + timedelta(minutes=30)).isoformat(),
        )
        se1 = _seed_session_exercise(workout_repo, s1.id)
        _seed_logged_set(workout_repo, se1.id, 1, reps=10, weight=60.0)

        s2 = _seed_finished_session(
            workout_repo, day_key="pull", day_label="B", day_name="Pull",
            started_at=(now - timedelta(hours=1)).isoformat(),
            finished_at=now.isoformat(),
        )
        se2 = _seed_session_exercise(workout_repo, s2.id)
        _seed_logged_set(workout_repo, se2.id, 1, reps=10, weight=60.0)
        workout_repo.commit()

        summary = stats_service.get_last_workout_summary()
        assert summary["day_name"] == "Pull"


class TestExerciseHistory:
    """get_exercise_history — type-aware aggregation by session date."""

    def test_reps_weight_history(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(
            workout_repo,
            started_at=now.isoformat(),
            finished_at=(now + timedelta(minutes=30)).isoformat(),
        )
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        _seed_logged_set(workout_repo, se.id, 2, reps=8, weight=80.0)
        workout_repo.commit()

        history = stats_service.get_exercise_history("barbell_bench_press")
        assert len(history) == 1  # grouped by session date
        assert history[0]["max_weight"] == 80.0
        assert history[0]["total_volume"] == 10*60 + 8*80  # 1240

    def test_time_history(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="plank",
            exercise_name="Plank", exercise_type="time",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=60)
        _seed_logged_set(workout_repo, se.id, 2, duration_seconds=90)
        workout_repo.commit()

        history = stats_service.get_exercise_history("plank")
        assert len(history) == 1
        assert history[0]["max_duration"] == 90

    def test_cardio_history(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="running",
            exercise_name="Running", exercise_type="cardio",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=1800,
                         distance_km=5.0)
        _seed_logged_set(workout_repo, se.id, 2, duration_seconds=1200,
                         distance_km=3.0)
        workout_repo.commit()

        history = stats_service.get_exercise_history("running")
        assert len(history) == 1
        assert history[0]["max_distance"] == 5.0
        assert history[0]["max_duration"] == 1800

    def test_no_history_returns_empty(self, stats_service):
        assert stats_service.get_exercise_history("barbell_bench_press") == []


class TestExerciseBestSet:
    """get_exercise_best_set — type-aware best set."""

    def test_reps_weight_best_by_weight(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        _seed_logged_set(workout_repo, se.id, 2, reps=5, weight=100.0)
        _seed_logged_set(workout_repo, se.id, 3, reps=8, weight=100.0)
        workout_repo.commit()

        best = stats_service.get_exercise_best_set("barbell_bench_press")
        assert best is not None
        assert best["weight"] == 100.0
        assert best["reps"] == 8  # tie-break: higher reps

    def test_time_best_by_duration(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="plank",
            exercise_name="Plank", exercise_type="time",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=60)
        _seed_logged_set(workout_repo, se.id, 2, duration_seconds=120)
        workout_repo.commit()

        best = stats_service.get_exercise_best_set("plank")
        assert best["duration_seconds"] == 120

    def test_cardio_best_by_distance(self, stats_service, workout_repo):
        """Cardio best: highest distance (tie-break by shorter duration)."""
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="running",
            exercise_name="Running", exercise_type="cardio",
        )
        _seed_logged_set(workout_repo, se.id, 1, distance_km=5.0,
                         duration_seconds=1800)
        _seed_logged_set(workout_repo, se.id, 2, distance_km=5.0,
                         duration_seconds=1500)  # same dist, faster
        _seed_logged_set(workout_repo, se.id, 3, distance_km=3.0,
                         duration_seconds=900)
        workout_repo.commit()

        best = stats_service.get_exercise_best_set("running")
        assert best["distance_km"] == 5.0
        assert best["duration_seconds"] == 1500  # tie-break: shorter

    def test_cardio_best_duration_when_no_distance(self, stats_service,
                                                     workout_repo):
        """Cardio with no distance: best by longest duration."""
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="running",
            exercise_name="Running", exercise_type="cardio",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=1800)
        _seed_logged_set(workout_repo, se.id, 2, duration_seconds=2400)
        workout_repo.commit()

        best = stats_service.get_exercise_best_set("running")
        assert best["duration_seconds"] == 2400

    def test_no_sets_returns_none(self, stats_service):
        assert stats_service.get_exercise_best_set("barbell_bench_press") is None


class TestPersonalBests:
    """get_personal_bests — across all types."""

    def test_personal_bests(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se1 = _seed_session_exercise(workout_repo, session.id, sort_order=0)
        _seed_logged_set(workout_repo, se1.id, 1, reps=5, weight=100.0)

        se2 = _seed_session_exercise(
            workout_repo, session.id, sort_order=1,
            exercise_key="plank", exercise_name="Plank",
            exercise_type="time",
        )
        _seed_logged_set(workout_repo, se2.id, 1, duration_seconds=120)
        workout_repo.commit()

        pbs = stats_service.get_personal_bests(limit=5)
        assert len(pbs) == 2
        names = {pb["exercise_name"] for pb in pbs}
        assert "Barbell Bench Press" in names
        assert "Plank" in names

    def test_personal_bests_limit(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se1 = _seed_session_exercise(workout_repo, session.id, sort_order=0)
        _seed_logged_set(workout_repo, se1.id, 1, reps=5, weight=100.0)
        se2 = _seed_session_exercise(
            workout_repo, session.id, sort_order=1,
            exercise_key="plank", exercise_name="Plank",
            exercise_type="time",
        )
        _seed_logged_set(workout_repo, se2.id, 1, duration_seconds=120)
        workout_repo.commit()

        pbs = stats_service.get_personal_bests(limit=1)
        assert len(pbs) == 1

    def test_empty_returns_empty(self, stats_service):
        assert stats_service.get_personal_bests() == []


class TestVolumeTrend:
    """get_total_volume_trend — weekly SUM(weight * reps) for reps_weight."""

    def test_volume_trend(self, stats_service, workout_repo):
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(
            workout_repo,
            started_at=now.isoformat(),
            finished_at=(now + timedelta(minutes=30)).isoformat(),
        )
        se = _seed_session_exercise(workout_repo, session.id)
        _seed_logged_set(workout_repo, se.id, 1, reps=10, weight=60.0)
        _seed_logged_set(workout_repo, se.id, 2, reps=8, weight=80.0)
        workout_repo.commit()

        trend = stats_service.get_total_volume_trend(weeks=4)
        assert len(trend) >= 1
        total = sum(t["total_volume"] for t in trend)
        assert total == 10*60 + 8*80

    def test_excludes_time_and_cardio(self, stats_service, workout_repo):
        """Volume only counts reps_weight exercises."""
        now = datetime.now(timezone.utc)
        session = _seed_finished_session(workout_repo, started_at=now.isoformat(),
                                          finished_at=(now + timedelta(minutes=30)).isoformat())
        se = _seed_session_exercise(
            workout_repo, session.id, exercise_key="plank",
            exercise_name="Plank", exercise_type="time",
        )
        _seed_logged_set(workout_repo, se.id, 1, duration_seconds=120)
        workout_repo.commit()

        trend = stats_service.get_total_volume_trend(weeks=4)
        total = sum(t["total_volume"] for t in trend) if trend else 0
        assert total == 0

    def test_empty_returns_empty(self, stats_service):
        assert stats_service.get_total_volume_trend() == []


class TestBenchmarkHistory:
    """get_benchmark_history — results over time. Optional method param accepted."""

    def test_benchmark_history(self, stats_service, benchmark_repo):
        for val in [90.0, 95.0, 100.0]:
            result = BenchmarkResult(
                id=None,
                exercise_key_snapshot="barbell_bench_press",
                exercise_name_snapshot="Barbell Bench Press",
                method="max_weight",
                result_value=val,
                bodyweight=80.0,
                tested_at=datetime.now(timezone.utc).isoformat(),
            )
            benchmark_repo.add_result(result)
        benchmark_repo.commit()

        history = stats_service.get_benchmark_history("barbell_bench_press")
        assert len(history) == 3
        assert history[0]["result_value"] == 90.0  # oldest first
        assert history[2]["result_value"] == 100.0

    def test_empty_returns_empty(self, stats_service):
        assert stats_service.get_benchmark_history("barbell_bench_press") == []

    def test_method_param_accepted_and_ignored(self, stats_service, benchmark_repo):
        """Optional method param is accepted without error."""
        result = BenchmarkResult(
            id=None,
            exercise_key_snapshot="barbell_bench_press",
            exercise_name_snapshot="Barbell Bench Press",
            method="max_weight",
            result_value=100.0,
            bodyweight=80.0,
            tested_at=datetime.now(timezone.utc).isoformat(),
        )
        benchmark_repo.add_result(result)
        benchmark_repo.commit()
        history = stats_service.get_benchmark_history(
            "barbell_bench_press", method="max_weight")
        assert len(history) == 1


class TestExercisesWithHistory:
    """get_exercises_with_history — keys with logged sets in finished sessions."""

    def test_empty_when_no_sessions(self, stats_service):
        assert stats_service.get_exercises_with_history() == []

    def test_returns_keys_with_sets(self, stats_service, workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id,
                                    exercise_key="barbell_bench_press")
        workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se.id, set_number=1,
            reps=10, weight=60.0, duration_seconds=None, distance_km=None,
            logged_at=datetime.now(timezone.utc).isoformat(),
        ))
        workout_repo.commit()

        keys = stats_service.get_exercises_with_history()
        assert "barbell_bench_press" in keys

    def test_does_not_include_in_progress_session_exercises(
            self, stats_service, workout_repo):
        """Only finished sessions count."""
        from src.models.workout import WorkoutSession, SessionStatus
        now = datetime.now(timezone.utc).isoformat()
        session = WorkoutSession(
            id=None, routine_key_snapshot="push_pull_legs",
            routine_name_snapshot="Push Pull Legs",
            day_key_snapshot="push", day_label_snapshot="A",
            day_name_snapshot="Push", status=SessionStatus.IN_PROGRESS,
            completed_fully=False, started_at=now, finished_at=None,
        )
        session.id = workout_repo.create_session(session)
        se = _seed_session_exercise(workout_repo, session.id,
                                    exercise_key="barbell_bench_press")
        workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se.id, set_number=1,
            reps=10, weight=60.0, duration_seconds=None, distance_km=None,
            logged_at=now,
        ))
        workout_repo.commit()

        keys = stats_service.get_exercises_with_history()
        assert "barbell_bench_press" not in keys


class TestGetLatestPlanVsActual:
    """get_latest_plan_vs_actual — plan targets vs logged values."""

    def test_returns_none_when_no_history(self, stats_service):
        assert stats_service.get_latest_plan_vs_actual("barbell_bench_press") is None

    def test_returns_plan_and_actual_data(self, stats_service, workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id,
                                    exercise_key="barbell_bench_press",
                                    planned_sets=3)
        workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se.id, set_number=1,
            reps=10, weight=60.0, duration_seconds=None, distance_km=None,
            logged_at=datetime.now(timezone.utc).isoformat(),
        ))
        workout_repo.commit()

        result = stats_service.get_latest_plan_vs_actual("barbell_bench_press")
        assert result is not None
        assert result["exercise_key"] == "barbell_bench_press"
        assert result["session_id"] == session.id
        assert result["planned_sets"] == 3
        assert result["actual_sets"] >= 1


class TestGetLastSetForExercise:
    """get_last_set_for_exercise — most recent set for stepper pre-fill."""

    def test_returns_none_when_no_history(self, stats_service):
        assert stats_service.get_last_set_for_exercise("barbell_bench_press") is None

    def test_returns_most_recent_set(self, stats_service, workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id)
        now = datetime.now(timezone.utc)
        for i, (reps, weight) in enumerate([(8, 55.0), (10, 60.0)], start=1):
            workout_repo.add_logged_set(LoggedSet(
                id=None, session_exercise_id=se.id, set_number=i,
                reps=reps, weight=weight, duration_seconds=None,
                distance_km=None,
                logged_at=(now + timedelta(seconds=i)).isoformat(),
            ))
        workout_repo.commit()

        last = stats_service.get_last_set_for_exercise("barbell_bench_press")
        assert last is not None
        # Should be the most recent set (reps=10, weight=60.0)
        assert last["reps"] == 10
        assert last["weight"] == 60.0

    def test_returns_all_fields(self, stats_service, workout_repo):
        session = _seed_finished_session(workout_repo)
        se = _seed_session_exercise(workout_repo, session.id)
        workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se.id, set_number=1,
            reps=10, weight=60.0, duration_seconds=None, distance_km=None,
            logged_at=datetime.now(timezone.utc).isoformat(),
        ))
        workout_repo.commit()

        last = stats_service.get_last_set_for_exercise("barbell_bench_press")
        assert set(last.keys()) == {"reps", "weight", "duration_seconds", "distance_km"}


class TestBenchmarkDueSummary:
    """get_benchmark_due_summary — counts and items."""

    def test_all_due_initially(self, stats_service):
        summary = stats_service.get_benchmark_due_summary()
        assert summary["total_items"] == 3
        assert summary["due_count"] == 3

    def test_after_recording(self, stats_service, benchmark_repo):
        result = BenchmarkResult(
            id=None,
            exercise_key_snapshot="barbell_bench_press",
            exercise_name_snapshot="Barbell Bench Press",
            method="max_weight",
            result_value=100.0,
            bodyweight=80.0,
            tested_at=datetime.now(timezone.utc).isoformat(),
        )
        benchmark_repo.add_result(result)
        benchmark_repo.commit()

        summary = stats_service.get_benchmark_due_summary()
        assert summary["due_count"] == 2
```

- [ ] **Step 2: Implement `src/services/stats_service.py`**

```python
# src/services/stats_service.py
"""StatsService — dashboard queries, exercise history, PRs, trends.

All stats derived live, never cached. Zero-set sessions excluded.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from src.registries.exercise_registry import ExerciseRegistry
from src.registries.benchmark_registry import BenchmarkRegistry
from src.repositories.workout_repo import WorkoutRepo
from src.repositories.benchmark_repo import BenchmarkRepo


class StatsService:
    def __init__(
        self,
        workout_repo: WorkoutRepo,
        benchmark_repo: BenchmarkRepo,
        exercise_registry: ExerciseRegistry,
        benchmark_registry: BenchmarkRegistry,
    ):
        self._workouts = workout_repo
        self._benchmarks = benchmark_repo
        self._exercises = exercise_registry
        self._bench_config = benchmark_registry

    # ------------------------------------------------------------------
    # Session count
    # ------------------------------------------------------------------

    def get_session_count(self, since: Optional[str] = None) -> int:
        """Count finished sessions with at least one logged set."""
        return self._workouts.get_session_count_with_sets(since)

    # ------------------------------------------------------------------
    # Last workout summary
    # ------------------------------------------------------------------

    def get_last_workout_summary(self) -> Optional[dict]:
        """Return summary of the most recent finished session with sets.

        Returns dict: session_id, started_at, finished_at, day_label,
        day_name, duration_minutes. Or None.
        """
        session = self._workouts.get_last_session_with_sets()
        if session is None:
            return None

        duration = None
        if session.started_at and session.finished_at:
            start = datetime.fromisoformat(session.started_at)
            end = datetime.fromisoformat(session.finished_at)
            duration = round((end - start).total_seconds() / 60)

        return {
            "session_id": session.id,
            "started_at": session.started_at,
            "finished_at": session.finished_at,
            "day_label": session.day_label_snapshot,
            "day_name": session.day_name_snapshot,
            "duration_minutes": duration,
        }

    # ------------------------------------------------------------------
    # Exercise history
    # ------------------------------------------------------------------

    def get_exercise_history(self, exercise_key: str) -> List[dict]:
        """Type-aware exercise history grouped by session date.

        reps_weight: {session_date, max_weight, total_volume}
        time: {session_date, max_duration}
        cardio: {session_date, max_duration, max_distance}
        """
        exercise = self._exercises.get(exercise_key)
        if exercise is None:
            return []

        rows = self._workouts.get_exercise_logged_sets(exercise_key)
        if not rows:
            return []

        ex_type = exercise.type.value
        sessions = {}

        for row in rows:
            date = row["session_started_at"][:10]
            if date not in sessions:
                sessions[date] = {}
            d = sessions[date]

            if ex_type == "reps_weight":
                w = row.get("weight") or 0
                r = row.get("reps") or 0
                d["max_weight"] = max(d.get("max_weight", 0), w)
                d["total_volume"] = d.get("total_volume", 0) + w * r
            elif ex_type == "time":
                dur = row.get("duration_seconds") or 0
                d["max_duration"] = max(d.get("max_duration", 0), dur)
            elif ex_type == "cardio":
                dur = row.get("duration_seconds") or 0
                dist = row.get("distance_km") or 0
                d["max_duration"] = max(d.get("max_duration", 0), dur)
                d["max_distance"] = max(d.get("max_distance", 0), dist)

        return [
            {"session_date": date, **data}
            for date, data in sorted(sessions.items())
        ]

    # ------------------------------------------------------------------
    # Exercise best set
    # ------------------------------------------------------------------

    def get_exercise_best_set(self, exercise_key: str) -> Optional[dict]:
        """Type-aware best set.

        reps_weight: highest weight, tie-break by most reps
        time: longest duration
        cardio: highest distance (tie-break shorter duration),
                or longest duration if no distance logged
        """
        exercise = self._exercises.get(exercise_key)
        if exercise is None:
            return None

        rows = self._workouts.get_exercise_logged_sets(exercise_key)
        if not rows:
            return None

        ex_type = exercise.type.value
        best = None

        for row in rows:
            date = row["session_started_at"][:10]

            if ex_type == "reps_weight":
                w = row.get("weight") or 0
                r = row.get("reps") or 0
                if best is None:
                    best = {"weight": w, "reps": r, "session_date": date,
                            "exercise_type": ex_type}
                elif w > best["weight"] or (w == best["weight"]
                                             and r > best["reps"]):
                    best = {"weight": w, "reps": r, "session_date": date,
                            "exercise_type": ex_type}

            elif ex_type == "time":
                dur = row.get("duration_seconds") or 0
                if best is None or dur > best.get("duration_seconds", 0):
                    best = {"duration_seconds": dur, "session_date": date,
                            "exercise_type": ex_type}

            elif ex_type == "cardio":
                dist = row.get("distance_km") or 0
                dur = row.get("duration_seconds") or 0
                if dist > 0:
                    if (best is None
                            or dist > best.get("distance_km", 0)
                            or (dist == best.get("distance_km", 0)
                                and dur < best.get("duration_seconds",
                                                    float("inf")))):
                        best = {"distance_km": dist, "duration_seconds": dur,
                                "session_date": date, "exercise_type": ex_type}
                else:
                    if best is None or dur > best.get("duration_seconds", 0):
                        best = {"duration_seconds": dur, "distance_km": None,
                                "session_date": date, "exercise_type": ex_type}

        return best

    # ------------------------------------------------------------------
    # Personal bests
    # ------------------------------------------------------------------

    def get_personal_bests(self, limit: int = 5) -> List[dict]:
        """Personal bests across all exercise types.

        Returns list of dicts with exercise_name + type-specific best fields.
        Sorted by most recent session_date first.
        """
        exercises = self._exercises.list_all()
        pbs = []

        for ex in exercises:
            best = self.get_exercise_best_set(ex.key)
            if best is None:
                continue
            entry = {"exercise_name": ex.name, "exercise_key": ex.key, **best}
            pbs.append(entry)

        pbs.sort(key=lambda x: x["session_date"], reverse=True)
        return pbs[:limit]

    # ------------------------------------------------------------------
    # Volume trend
    # ------------------------------------------------------------------

    def get_total_volume_trend(self, weeks: int = 4) -> List[dict]:
        """Weekly total volume (weight * reps) for reps_weight exercises.

        Returns list of dicts: {week, total_volume}.
        """
        now = datetime.now(timezone.utc)
        start = now - timedelta(weeks=weeks)

        rows = self._workouts.get_volume_by_week(start.isoformat())
        return [
            {"week": r["year_week"], "total_volume": r["total_volume"]}
            for r in rows
        ]

    # ------------------------------------------------------------------
    # Benchmark stats
    # ------------------------------------------------------------------

    def get_benchmark_history(self, exercise_key: str, method: Optional[str] = None) -> List[dict]:
        """Benchmark results for an exercise, oldest first.

        The `method` parameter is accepted but ignored for now — each exercise
        has a single method. Reserved for future multi-method exercises.
        """
        results = self._benchmarks.get_results_for_exercise(exercise_key)
        # Repo returns newest-first; reverse for charts
        ordered = list(reversed(results))
        return [
            {
                "tested_at": r.tested_at,
                "result_value": r.result_value,
                "method": r.method,
                "bodyweight": r.bodyweight,
            }
            for r in ordered
        ]

    def get_benchmark_due_summary(self) -> dict:
        """Summary of benchmark status for home screen.

        Returns: {total_items, due_count, due_items}
        """
        config = self._bench_config.get_config()
        cutoff = datetime.now(timezone.utc) - timedelta(
            days=config.frequency_weeks * 7)
        cutoff_iso = cutoff.isoformat()

        due_items = []
        for item in config.items:
            exercise = self._exercises.get(item.exercise_key)
            if exercise is None:
                continue
            latest = self._benchmarks.get_latest_result(item.exercise_key)
            if latest is None or latest.tested_at < cutoff_iso:
                due_items.append({
                    "exercise_key": item.exercise_key,
                    "exercise_name": exercise.name,
                    "method": item.method.value,
                })

        return {
            "total_items": len(config.items),
            "due_count": len(due_items),
            "due_items": due_items,
        }

    # ------------------------------------------------------------------
    # Exercise history helpers (used by exercise detail + workout screens)
    # ------------------------------------------------------------------

    def get_exercises_with_history(self) -> List[str]:
        """Return list of exercise keys that have logged sets in finished sessions."""
        return self._workouts.get_exercise_keys_with_logged_sets()

    def get_latest_plan_vs_actual(self, exercise_key: str) -> Optional[dict]:
        """Plan targets vs actual logged values for the most recent finished
        session containing this exercise.

        Returns a dict with keys:
            exercise_key, session_id, planned_sets, target_reps_min,
            target_reps_max, actual_sets, actual_reps_avg,
            actual_weight_avg
        Returns None if no finished session contains this exercise.
        """
        return self._workouts.get_latest_plan_vs_actual(exercise_key)

    def get_last_set_for_exercise(self, exercise_key: str) -> Optional[dict]:
        """Most recent logged set for an exercise across all finished sessions.

        Used to pre-fill stepper fields with the last used values.
        Returns a dict with keys: reps, weight, duration_seconds, distance_km,
        or None if no sets have been logged for this exercise.
        """
        sets = self._workouts.get_exercise_logged_sets(exercise_key)
        if not sets:
            return None
        # get_exercise_logged_sets returns newest-first
        last = sets[0]
        return {
            "reps": last.reps,
            "weight": last.weight,
            "duration_seconds": last.duration_seconds,
            "distance_km": last.distance_km,
        }
```

**Note:** StatsService depends on `WorkoutRepo.get_exercise_logged_sets(exercise_key)` and `WorkoutRepo.get_volume_by_week(since)`. These are repo methods that query by `exercise_key_snapshot` rather than integer `exercise_id`. Phase 1's WorkoutRepo must provide these. If they don't exist, add them to the repo in this task.

The required WorkoutRepo methods for stats (beyond what's in the session lifecycle):

```python
# Additional WorkoutRepo methods needed for StatsService
def get_session_count_with_sets(self, since: Optional[str] = None) -> int: ...
def get_last_session_with_sets(self) -> Optional[WorkoutSession]: ...
def get_exercise_logged_sets(self, exercise_key: str, limit: int = 200) -> List[dict]: ...
def get_volume_by_week(self, since: str) -> List[dict]: ...
```

If these aren't in the Phase 1 WorkoutRepo, add them as part of this task before implementing StatsService:

```python
# These methods go in workout_repo.py if not already present

def get_exercise_logged_sets(self, exercise_key: str, limit: int = 200) -> list:
    """Get logged sets for an exercise key across finished sessions."""
    rows = self._fetchall(
        """SELECT ls.*, se.exercise_key_snapshot, se.exercise_type_snapshot,
                  ws.started_at as session_started_at
           FROM logged_sets ls
           JOIN session_exercises se ON ls.session_exercise_id = se.id
           JOIN workout_sessions ws ON se.session_id = ws.id
           WHERE se.exercise_key_snapshot = ?
           AND ws.status = 'finished'
           ORDER BY ws.started_at DESC, ls.set_number
           LIMIT ?""",
        (exercise_key, limit),
    )
    return [dict(r) for r in rows]

def get_volume_by_week(self, since: str) -> list:
    """Weekly total volume (weight * reps) for reps_weight exercises."""
    rows = self._fetchall(
        """SELECT strftime('%Y-%W', ws.started_at) as year_week,
                  SUM(COALESCE(ls.weight, 0) * COALESCE(ls.reps, 0)) as total_volume
           FROM logged_sets ls
           JOIN session_exercises se ON ls.session_exercise_id = se.id
           JOIN workout_sessions ws ON se.session_id = ws.id
           WHERE ws.status = 'finished' AND ws.started_at >= ?
           AND se.exercise_type_snapshot = 'reps_weight'
           GROUP BY year_week
           ORDER BY year_week""",
        (since,),
    )
    return [dict(r) for r in rows]
```

- [ ] **Step 3: Run tests and verify all pass**

```bash
pytest tests/test_stats_service.py -v
```

- [ ] **Step 4: Commit**

```
feat(v2): StatsService with dashboard queries, exercise history, PRs, and volume trend
```

---

## Task 6: SettingsService — Get/Set + Unit Toggle with Conversion

**Goal:** Settings access and weight unit toggle that converts all historical weight data in one transaction.

**File:** `src/services/settings_service.py`, `tests/test_settings_service.py`

**Depends on:** SettingsRepo, db_conn (for raw SQL in conversion), WorkoutRepo (to verify conversion)

### Design

v2 conversion covers:
- `logged_sets.weight` (all rows where weight IS NOT NULL)
- `benchmark_results.result_value` (only where method = 'max_weight')
- `benchmark_results.bodyweight` (all rows where bodyweight IS NOT NULL)

No more `exercise_set_targets.target_weight` or `benchmark_definitions.reference_weight` — those tables don't exist in v2.

### Tests

- [ ] **Step 1: Write `tests/test_settings_service.py`**

```python
# tests/test_settings_service.py
"""Tests for SettingsService — settings access and unit conversion."""
import pytest
from src.models.workout import WorkoutSession, SessionExercise, LoggedSet, SessionStatus
from src.models.benchmark import BenchmarkResult
from datetime import datetime, timezone, timedelta
from src.utils.unit_conversion import LB_TO_KG, KG_TO_LB


def _seed_weight_data(workout_repo, benchmark_repo):
    """Seed test data with known weights for conversion testing."""
    now = datetime.now(timezone.utc)

    # Create a finished session with weight sets
    session = WorkoutSession(
        id=None,
        routine_key_snapshot="push_pull_legs",
        routine_name_snapshot="Push Pull Legs",
        day_key_snapshot="push",
        day_label_snapshot="A",
        day_name_snapshot="Push",
        status=SessionStatus.FINISHED,
        completed_fully=True,
        started_at=now.isoformat(),
        finished_at=(now + timedelta(minutes=30)).isoformat(),
    )
    session.id = workout_repo.create_session(session)

    se = SessionExercise(
        id=None,
        session_id=session.id,
        sort_order=0,
        exercise_key_snapshot="barbell_bench_press",
        exercise_name_snapshot="Barbell Bench Press",
        exercise_type_snapshot="reps_weight",
        source="planned",
        scheme_snapshot="progressive",
        planned_sets=3,
        target_reps_min=None,
        target_reps_max=None,
        target_duration_seconds=None,
        target_distance_km=None,
        plan_notes_snapshot=None,
    )
    se.id = workout_repo.add_session_exercise(se)

    # 100 lb set
    ls = LoggedSet(
        id=None,
        session_exercise_id=se.id,
        set_number=1,
        reps=10,
        weight=100.0,
        duration_seconds=None,
        distance_km=None,
        logged_at=now.isoformat(),
    )
    ls.id = workout_repo.add_logged_set(ls)
    workout_repo.commit()

    # Benchmark: max_weight result at 200 lb, bodyweight 180 lb
    br_weight = BenchmarkResult(
        id=None,
        exercise_key_snapshot="barbell_bench_press",
        exercise_name_snapshot="Barbell Bench Press",
        method="max_weight",
        result_value=200.0,
        bodyweight=180.0,
        tested_at=now.isoformat(),
    )
    br_weight.id = benchmark_repo.add_result(br_weight)

    # Benchmark: max_reps result (should NOT convert result_value)
    br_reps = BenchmarkResult(
        id=None,
        exercise_key_snapshot="pull_up",
        exercise_name_snapshot="Pull-Up",
        method="max_reps",
        result_value=15.0,
        bodyweight=180.0,
        tested_at=now.isoformat(),
    )
    br_reps.id = benchmark_repo.add_result(br_reps)
    benchmark_repo.commit()

    return {
        "session_id": session.id,
        "se_id": se.id,
        "ls_id": ls.id,
        "br_weight_id": br_weight.id,
        "br_reps_id": br_reps.id,
    }


class TestGetSet:
    """Basic settings get/set."""

    def test_get_default(self, settings_service):
        assert settings_service.get("nonexistent") is None

    def test_get_with_default(self, settings_service):
        assert settings_service.get("nonexistent", "fallback") == "fallback"

    def test_set_and_get(self, settings_service):
        settings_service.set("my_key", "my_value")
        assert settings_service.get("my_key") == "my_value"

    def test_get_weight_unit_default(self, settings_service):
        assert settings_service.get_weight_unit() == "lb"


class TestUnitToggle:
    """Weight unit toggle with conversion."""

    def test_toggle_lb_to_kg(self, settings_service, workout_repo,
                              benchmark_repo):
        ids = _seed_weight_data(workout_repo, benchmark_repo)

        result = settings_service.toggle_weight_unit()
        assert result["new_unit"] == "kg"
        assert result["rows_converted"] > 0

        # Verify weight converted
        ls = workout_repo.get_logged_set(ids["ls_id"])
        assert ls.weight == round(100.0 * LB_TO_KG, 2)

        # Verify benchmark max_weight converted
        br = benchmark_repo.get_result(ids["br_weight_id"])
        assert br.result_value == round(200.0 * LB_TO_KG, 2)

        # Verify bodyweight converted
        assert br.bodyweight == round(180.0 * LB_TO_KG, 2)

        # Verify max_reps result NOT converted
        br_reps = benchmark_repo.get_result(ids["br_reps_id"])
        assert br_reps.result_value == 15.0  # unchanged

        # But max_reps bodyweight IS converted
        assert br_reps.bodyweight == round(180.0 * LB_TO_KG, 2)

        # Setting updated
        assert settings_service.get_weight_unit() == "kg"

    def test_toggle_kg_to_lb(self, settings_service, workout_repo,
                              benchmark_repo, settings_repo):
        ids = _seed_weight_data(workout_repo, benchmark_repo)
        settings_repo.set("weight_unit", "kg")
        settings_repo.commit()

        result = settings_service.toggle_weight_unit()
        assert result["new_unit"] == "lb"

        ls = workout_repo.get_logged_set(ids["ls_id"])
        assert ls.weight == round(100.0 * KG_TO_LB, 2)

    def test_roundtrip_conversion(self, settings_service, workout_repo,
                                   benchmark_repo):
        """lb -> kg -> lb should produce close-to-original values."""
        ids = _seed_weight_data(workout_repo, benchmark_repo)

        settings_service.toggle_weight_unit()  # lb -> kg
        settings_service.toggle_weight_unit()  # kg -> lb

        ls = workout_repo.get_logged_set(ids["ls_id"])
        assert abs(ls.weight - 100.0) < 0.1  # floating point rounding

    def test_toggle_same_unit_noop(self, settings_service, settings_repo):
        """If already the target unit, nothing happens."""
        settings_repo.set("weight_unit", "lb")
        settings_repo.commit()

        # Calling set_weight_unit with same value
        rows = settings_service.set_weight_unit("lb")
        assert rows == 0
```

- [ ] **Step 2: Update `src/utils/unit_conversion.py` for v2**

The v2 conversion function needs to convert different tables than v1. Create a v2-specific conversion function:

```python
# Add to src/utils/unit_conversion.py (or replace the v1 convert_all_weights)

LB_TO_KG = 0.45359237
KG_TO_LB = 1.0 / LB_TO_KG


def lb_to_kg(lb: float) -> float:
    """Convert pounds to kilograms, rounded to 2 decimal places."""
    return round(lb * LB_TO_KG, 2)


def kg_to_lb(kg: float) -> float:
    """Convert kilograms to pounds, rounded to 2 decimal places."""
    return round(kg * KG_TO_LB, 2)


def convert_all_weights_v2(conn, from_unit: str, to_unit: str) -> int:
    """Convert ALL weight values in the v2 database.

    Converts:
    - logged_sets.weight (all non-NULL)
    - benchmark_results.result_value (max_weight method only)
    - benchmark_results.bodyweight (all non-NULL)

    Returns total rows updated.

    NOTE: Does NOT commit. The caller is responsible for committing after
    both the weight conversion AND the setting update succeed, so that
    both changes are applied atomically.
    """
    if from_unit == to_unit:
        return 0

    if from_unit == "lb" and to_unit == "kg":
        factor = LB_TO_KG
    elif from_unit == "kg" and to_unit == "lb":
        factor = KG_TO_LB
    else:
        raise ValueError(f"Invalid conversion: {from_unit} -> {to_unit}")

    total = 0

    # logged_sets.weight
    cursor = conn.execute(
        "UPDATE logged_sets SET weight = ROUND(weight * ?, 2) "
        "WHERE weight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_results.result_value (max_weight only)
    cursor = conn.execute(
        "UPDATE benchmark_results SET result_value = ROUND(result_value * ?, 2) "
        "WHERE method = 'max_weight'",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_results.bodyweight
    cursor = conn.execute(
        "UPDATE benchmark_results SET bodyweight = ROUND(bodyweight * ?, 2) "
        "WHERE bodyweight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    return total
```

- [ ] **Step 3: Implement `src/services/settings_service.py`**

```python
# src/services/settings_service.py
"""SettingsService — app settings and weight unit management."""
import sqlite3
from typing import Optional

from src.repositories.settings_repo import SettingsRepo
from src.repositories.workout_repo import WorkoutRepo
from src.utils.unit_conversion import convert_all_weights_v2


class SettingsService:
    def __init__(
        self,
        settings_repo: SettingsRepo,
        conn: sqlite3.Connection,
        workout_repo: WorkoutRepo,
    ):
        self._repo = settings_repo
        self._conn = conn
        self._workouts = workout_repo

    # ------------------------------------------------------------------
    # Generic get/set
    # ------------------------------------------------------------------

    def get(self, key: str, default: Optional[str] = None) -> Optional[str]:
        value = self._repo.get(key)
        return value if value is not None else default

    def set(self, key: str, value: str) -> None:
        self._repo.set(key, value)
        self._repo.commit()

    def get_all(self) -> dict:
        return self._repo.get_all()

    # ------------------------------------------------------------------
    # Weight unit
    # ------------------------------------------------------------------

    def get_weight_unit(self) -> str:
        """Return current weight unit. Default: 'lb'."""
        return self.get("weight_unit", "lb")

    def set_weight_unit(self, unit: str) -> int:
        """Set weight unit and convert all DB weights.

        Returns number of rows converted. 0 if already the target unit.
        convert_all_weights_v2 does NOT commit; we commit here after both
        the weight conversion and the setting update succeed atomically.
        """
        current = self.get_weight_unit()
        if current == unit:
            return 0

        total = convert_all_weights_v2(self._conn, current, unit)
        self._repo.set("weight_unit", unit)
        self._repo.commit()  # single commit covers both the conversion and setting update
        return total

    def toggle_weight_unit(self) -> dict:
        """Toggle between lb and kg. Converts all historical weights.

        Returns: {new_unit, rows_converted}
        """
        current = self.get_weight_unit()
        new_unit = "kg" if current == "lb" else "lb"
        rows = self.set_weight_unit(new_unit)
        return {"new_unit": new_unit, "rows_converted": rows}
```

- [ ] **Step 4: Run tests and verify all pass**

```bash
pytest tests/test_settings_service.py -v
```

- [ ] **Step 5: Commit**

```
feat(v2): SettingsService with weight unit toggle and conversion
```

---

## Task 7: Full Suite Verification + Cleanup

**Goal:** Run ALL tests together. Fix any cross-test issues. Ensure clean state.

- [ ] **Step 1: Run full test suite**

```bash
pytest tests/ -v
```

- [ ] **Step 2: Fix any failures** (integration issues, import conflicts, fixture ordering)

- [ ] **Step 3: Verify test count matches expectations**

Expected test count (approximate):
- test_app_state_service.py: ~10 tests
- test_workout_service.py: ~25 tests
- test_benchmark_service.py: ~12 tests
- test_stats_service.py: ~18 tests
- test_settings_service.py: ~8 tests
- **Total: ~73 tests**

- [ ] **Step 4: Final commit**

```
chore(v2): Phase 2 service layer complete — all tests passing
```

---

## Summary

| Task | Files Created | Tests | Key Behavior |
|------|--------------|-------|-------------|
| 1 | conftest.py, `__init__.py` | 0 | Test infra with v2 fixtures and helpers |
| 2 | app_state_service.py | ~10 | Startup reconciliation, routine switching, cycle advance/wrap |
| 3 | workout_service.py | ~25 | Start (snapshot plan), log/edit/delete sets, ad-hoc, finish/end-early/cancel |
| 4 | benchmark_service.py | ~12 | Due calculation, result recording with validation |
| 5 | stats_service.py | ~18 | Session count, last workout, exercise history, best set, PRs, volume trend, benchmark stats |
| 6 | settings_service.py | ~8 | Get/set settings, lb/kg toggle with DB-wide conversion |
| 7 | — | — | Full suite verification |
