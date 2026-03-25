# Phase 2: Sessions & Advanced Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement workout session management, benchmark system, stats/dashboard queries, import/export, settings, and unit conversion — with full test coverage.

**Architecture:** Builds on Phase 1's models, schema, and repos. Adds workout_repo, benchmark_repo, settings_repo, and four new services. Validation helpers from RoutineService are extracted to a shared module for reuse.

**Tech Stack:** Python 3.10+, sqlite3 (stdlib), pytest, json (stdlib), dataclasses.

**Spec reference:** `docs/superpowers/specs/2026-03-23-exercise-logger-greenfield-design.md`

**Phase 1 code reference:** Models in `src/models/`, schema in `src/db/schema.py`, repos in `src/repositories/`, services in `src/services/`, tests in `tests/`.

---

## Dependency Map

```
Task 1:  Extract shared validation → used by Tasks 2, 6
Task 2:  Workout repo + service  → used by Tasks 4, 5A, 5B, 6
Task 3:  Settings repo + unit conversion → independent
Task 4:  Benchmark repo + service → needs workout_repo
Task 5A: Stats service (routine/exercise) → needs workout_repo
Task 5B: Stats service (benchmark + plan-vs-actual) → needs 5A + benchmark_repo
Task 6:  Import/export service (two-step API) → needs all of the above
Task 7:  Seed data → needs benchmark_repo
```

---

## File Structure

```
src/
├── services/
│   ├── validation.py              # NEW — shared set_kind/cardio/amrap validation (extracted from routine_service)
│   ├── workout_service.py         # NEW — session lifecycle, set logging, editing
│   ├── benchmark_service.py       # NEW — due calc, result recording with snapshots
│   ├── stats_service.py           # NEW — dashboard queries, PRs, chart data
│   ├── import_export_service.py   # NEW — JSON import/export, validation
│   └── routine_service.py         # MODIFY — import validation from validation.py
├── repositories/
│   ├── workout_repo.py            # NEW — sessions + session_exercises + logged_sets
│   ├── benchmark_repo.py          # NEW — definitions + results
│   └── settings_repo.py           # NEW — key-value CRUD
├── utils/
│   └── unit_conversion.py         # NEW — lbs/kg conversion
└── db/
    └── seed.py                    # NEW — default benchmark exercises (dev only)

tests/
├── conftest.py                    # MODIFY — add new fixtures
├── test_workout_service.py        # NEW
├── test_benchmark_service.py      # NEW
├── test_stats_service.py          # NEW
├── test_import_export.py          # NEW
├── test_settings_and_units.py     # NEW
└── test_routine_service.py        # MODIFY — update validation import
```

---

## Task 1: Extract Shared Validation

**Files:**
- Create: `src/services/validation.py`
- Modify: `src/services/routine_service.py` (import from validation.py instead of inline)

The spec requires set_kind compatibility, cardio, and AMRAP validation in RoutineService, WorkoutService, and ImportExportService. Extract to a shared module.

- [ ] **Step 1: Create `src/services/validation.py`**

```python
"""Shared validation helpers for set_kind compatibility."""
from typing import Optional
from src.models.exercise import ExerciseType
from src.models.routine import SetKind


# Compatibility matrix: exercise_type -> allowed set_kinds
COMPATIBLE_SET_KINDS = {
    ExerciseType.REPS_WEIGHT: {SetKind.REPS_WEIGHT, SetKind.AMRAP},
    ExerciseType.REPS_ONLY: {SetKind.REPS_ONLY, SetKind.AMRAP},
    ExerciseType.TIME: {SetKind.DURATION},
    ExerciseType.CARDIO: {SetKind.CARDIO},
}


def validate_set_kind(set_kind: SetKind, exercise_type: ExerciseType) -> None:
    """Raise ValueError if set_kind is incompatible with exercise_type."""
    allowed = COMPATIBLE_SET_KINDS.get(exercise_type, set())
    if set_kind not in allowed:
        raise ValueError(
            f"Set kind '{set_kind.value}' is not compatible with "
            f"exercise type '{exercise_type.value}'"
        )


def validate_cardio_fields(set_kind: SetKind, duration_seconds: Optional[int], distance: Optional[float]) -> None:
    """Raise ValueError if cardio set has neither duration nor distance."""
    if set_kind == SetKind.CARDIO and duration_seconds is None and distance is None:
        raise ValueError("Cardio sets require at least one of duration_seconds or distance")


def validate_amrap_fields(set_kind: SetKind, exercise_type: ExerciseType, weight: Optional[float]) -> None:
    """Raise ValueError if AMRAP weight requirements are violated."""
    if set_kind != SetKind.AMRAP:
        return
    if exercise_type == ExerciseType.REPS_WEIGHT and weight is None:
        raise ValueError("AMRAP sets for reps_weight exercises require a weight")
    if exercise_type == ExerciseType.REPS_ONLY and weight is not None:
        raise ValueError("AMRAP sets for reps_only exercises must not have a weight (bodyweight)")
```

- [ ] **Step 2: Update `src/services/routine_service.py`**

Replace the inline `COMPATIBLE_SET_KINDS` dict and the three `_validate_*` static methods with imports from the shared module. The import section changes to:

```python
from src.services.validation import (
    COMPATIBLE_SET_KINDS, validate_set_kind, validate_cardio_fields, validate_amrap_fields,
)
```

And all calls change from `self._validate_set_kind(...)` to `validate_set_kind(...)`, etc. Remove the `@staticmethod` methods and the `COMPATIBLE_SET_KINDS` dict from the class.

- [ ] **Step 3: Run existing tests to verify refactor**

```bash
python -m pytest tests/test_routine_service.py -v
```

Expected: All 34 tests still PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/validation.py src/services/routine_service.py
git commit -m "refactor: extract shared validation helpers to validation.py"
```

---

## Task 2: Workout Repo + Service

**Files:**
- Create: `src/repositories/workout_repo.py`, `src/services/workout_service.py`
- Create: `tests/test_workout_service.py`
- Modify: `tests/conftest.py` (add workout fixtures)

- [ ] **Step 1: Create `src/repositories/workout_repo.py`**

```python
"""Workout repository — sessions, session_exercises, logged_sets."""
from typing import List, Optional
from src.models.workout import (
    WorkoutSession, SessionExercise, LoggedSet, SessionStatus, SessionType,
)
from src.models.routine import SetKind
from src.repositories.base import BaseRepository


class WorkoutRepo(BaseRepository):

    # --- Sessions ---

    def create_session(self, session: WorkoutSession) -> int:
        return self._insert(
            """INSERT INTO workout_sessions
               (routine_id, routine_day_id, session_type, status, completed_fully,
                day_label_snapshot, day_name_snapshot, started_at, finished_at, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (session.routine_id, session.routine_day_id,
             session.session_type.value, session.status.value,
             self._bool_to_int(session.completed_fully),
             session.day_label_snapshot, session.day_name_snapshot,
             session.started_at, session.finished_at, session.notes),
        )

    def get_session(self, session_id: int) -> Optional[WorkoutSession]:
        row = self._fetchone("SELECT * FROM workout_sessions WHERE id = ?", (session_id,))
        return self._to_session(row) if row else None

    def get_in_progress_session(self) -> Optional[WorkoutSession]:
        row = self._fetchone(
            "SELECT * FROM workout_sessions WHERE status = 'in_progress' LIMIT 1"
        )
        return self._to_session(row) if row else None

    def finish_session(self, session_id: int, completed_fully: bool, finished_at: str) -> None:
        self._execute(
            """UPDATE workout_sessions
               SET status = 'finished', completed_fully = ?, finished_at = ?
               WHERE id = ?""",
            (int(completed_fully), finished_at, session_id),
        )

    def list_sessions(self, limit: int = 50, offset: int = 0) -> List[WorkoutSession]:
        rows = self._fetchall(
            "SELECT * FROM workout_sessions ORDER BY started_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
        return [self._to_session(r) for r in rows]

    def get_session_count_with_sets(self, since: Optional[str] = None) -> int:
        """Count finished sessions that have at least one logged set."""
        if since:
            row = self._fetchone(
                """SELECT COUNT(*) as cnt FROM workout_sessions ws
                   WHERE ws.status = 'finished' AND ws.started_at >= ?
                   AND EXISTS (
                       SELECT 1 FROM session_exercises se
                       JOIN logged_sets ls ON ls.session_exercise_id = se.id
                       WHERE se.session_id = ws.id
                   )""",
                (since,),
            )
        else:
            row = self._fetchone(
                """SELECT COUNT(*) as cnt FROM workout_sessions ws
                   WHERE ws.status = 'finished'
                   AND EXISTS (
                       SELECT 1 FROM session_exercises se
                       JOIN logged_sets ls ON ls.session_exercise_id = se.id
                       WHERE se.session_id = ws.id
                   )""",
            )
        return row["cnt"] if row else 0

    # --- Session Exercises ---

    def add_session_exercise(self, se: SessionExercise) -> int:
        return self._insert(
            """INSERT INTO session_exercises
               (session_id, exercise_id, routine_day_exercise_id, sort_order,
                exercise_name_snapshot, notes)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (se.session_id, se.exercise_id, se.routine_day_exercise_id,
             se.sort_order, se.exercise_name_snapshot, se.notes),
        )

    def get_session_exercise(self, se_id: int) -> Optional[SessionExercise]:
        row = self._fetchone("SELECT * FROM session_exercises WHERE id = ?", (se_id,))
        return self._to_session_exercise(row) if row else None

    def get_session_exercises(self, session_id: int) -> List[SessionExercise]:
        rows = self._fetchall(
            "SELECT * FROM session_exercises WHERE session_id = ? ORDER BY sort_order",
            (session_id,),
        )
        return [self._to_session_exercise(r) for r in rows]

    def get_session_exercise_count(self, session_id: int) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM session_exercises WHERE session_id = ?",
            (session_id,),
        )
        return row["cnt"] if row else 0

    # --- Logged Sets ---

    def add_logged_set(self, ls: LoggedSet) -> int:
        return self._insert(
            """INSERT INTO logged_sets
               (session_exercise_id, exercise_set_target_id, set_number, set_kind,
                reps, weight, duration_seconds, distance, notes, logged_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (ls.session_exercise_id, ls.exercise_set_target_id, ls.set_number,
             ls.set_kind.value, ls.reps, ls.weight, ls.duration_seconds,
             ls.distance, ls.notes, ls.logged_at),
        )

    def get_logged_set(self, set_id: int) -> Optional[LoggedSet]:
        row = self._fetchone("SELECT * FROM logged_sets WHERE id = ?", (set_id,))
        return self._to_logged_set(row) if row else None

    def get_logged_sets(self, session_exercise_id: int) -> List[LoggedSet]:
        rows = self._fetchall(
            "SELECT * FROM logged_sets WHERE session_exercise_id = ? ORDER BY set_number",
            (session_exercise_id,),
        )
        return [self._to_logged_set(r) for r in rows]

    def get_logged_set_count(self, session_exercise_id: int) -> int:
        row = self._fetchone(
            "SELECT COUNT(*) as cnt FROM logged_sets WHERE session_exercise_id = ?",
            (session_exercise_id,),
        )
        return row["cnt"] if row else 0

    def get_session_total_set_count(self, session_id: int) -> int:
        """Total logged sets across all exercises in a session."""
        row = self._fetchone(
            """SELECT COUNT(*) as cnt FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               WHERE se.session_id = ?""",
            (session_id,),
        )
        return row["cnt"] if row else 0

    def update_logged_set(self, ls: LoggedSet) -> None:
        self._execute(
            """UPDATE logged_sets
               SET reps = ?, weight = ?, duration_seconds = ?, distance = ?,
                   notes = ?, set_kind = ?
               WHERE id = ?""",
            (ls.reps, ls.weight, ls.duration_seconds, ls.distance,
             ls.notes, ls.set_kind.value, ls.id),
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

    # --- Queries for stats ---

    def get_last_session_with_sets(self) -> Optional[WorkoutSession]:
        """Most recent finished session that has at least one logged set."""
        row = self._fetchone(
            """SELECT ws.* FROM workout_sessions ws
               WHERE ws.status = 'finished'
               AND EXISTS (
                   SELECT 1 FROM session_exercises se
                   JOIN logged_sets ls ON ls.session_exercise_id = se.id
                   WHERE se.session_id = ws.id
               )
               ORDER BY ws.started_at DESC LIMIT 1""",
        )
        return self._to_session(row) if row else None

    def get_exercise_logged_sets(self, exercise_id: int, limit: int = 100) -> List[dict]:
        """Get logged sets for an exercise across all sessions, for stats/charts.
        Returns dicts with set data + session started_at for time series.
        """
        rows = self._fetchall(
            """SELECT ls.*, se.exercise_id, ws.started_at as session_started_at
               FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               JOIN workout_sessions ws ON se.session_id = ws.id
               WHERE se.exercise_id = ?
               AND ws.status = 'finished'
               AND EXISTS (
                   SELECT 1 FROM logged_sets ls2
                   WHERE ls2.session_exercise_id = se.id
               )
               ORDER BY ws.started_at DESC, ls.set_number
               LIMIT ?""",
            (exercise_id, limit),
        )
        return [dict(r) for r in rows]

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
            routine_id=row["routine_id"],
            routine_day_id=row["routine_day_id"],
            session_type=SessionType(row["session_type"]),
            status=SessionStatus(row["status"]),
            completed_fully=None if completed is None else bool(completed),
            day_label_snapshot=row["day_label_snapshot"],
            day_name_snapshot=row["day_name_snapshot"],
            started_at=row["started_at"],
            finished_at=row["finished_at"],
            notes=row["notes"],
        )

    def _to_session_exercise(self, row) -> SessionExercise:
        return SessionExercise(
            id=row["id"],
            session_id=row["session_id"],
            exercise_id=row["exercise_id"],
            routine_day_exercise_id=row["routine_day_exercise_id"],
            sort_order=row["sort_order"],
            exercise_name_snapshot=row["exercise_name_snapshot"],
            notes=row["notes"],
        )

    def _to_logged_set(self, row) -> LoggedSet:
        return LoggedSet(
            id=row["id"],
            session_exercise_id=row["session_exercise_id"],
            exercise_set_target_id=row["exercise_set_target_id"],
            set_number=row["set_number"],
            set_kind=SetKind(row["set_kind"]),
            reps=row["reps"],
            weight=row["weight"],
            duration_seconds=row["duration_seconds"],
            distance=row["distance"],
            notes=row["notes"],
            logged_at=row["logged_at"],
        )
```

- [ ] **Step 2: Create `src/services/workout_service.py`**

```python
"""Workout service — session lifecycle, set logging, editing."""
from datetime import datetime, timezone
from typing import List, Optional
from src.models.exercise import Exercise, ExerciseType
from src.models.routine import RoutineDay, RoutineDayExercise, SetKind
from src.models.workout import (
    WorkoutSession, SessionExercise, LoggedSet, SessionStatus, SessionType,
)
from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.routine_repo import RoutineRepo
from src.repositories.workout_repo import WorkoutRepo
from src.services.cycle_service import CycleService
from src.services.validation import validate_set_kind, validate_cardio_fields, validate_amrap_fields


class WorkoutService:
    def __init__(
        self,
        workout_repo: WorkoutRepo,
        routine_repo: RoutineRepo,
        exercise_repo: ExerciseRepo,
        cycle_service: CycleService,
    ):
        self._repo = workout_repo
        self._routine_repo = routine_repo
        self._exercise_repo = exercise_repo
        self._cycle_service = cycle_service

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # --- Session lifecycle ---

    def start_routine_session(self, routine_day_id: int) -> WorkoutSession:
        """Start a new routine workout session for the given day."""
        # Block if another session is in progress
        existing = self._repo.get_in_progress_session()
        if existing:
            raise ValueError("Another session is already in progress")

        day = self._routine_repo.get_day(routine_day_id)
        if not day:
            raise ValueError(f"Routine day {routine_day_id} not found")

        routine = self._routine_repo.get_routine(day.routine_id)
        session = WorkoutSession(
            id=None,
            routine_id=day.routine_id,
            routine_day_id=routine_day_id,
            session_type=SessionType.ROUTINE,
            status=SessionStatus.IN_PROGRESS,
            completed_fully=None,
            day_label_snapshot=day.label,
            day_name_snapshot=day.name,
            started_at=self._now(),
        )
        session.id = self._repo.create_session(session)
        self._repo.commit()
        return session

    def start_benchmark_session(self) -> WorkoutSession:
        """Start a new benchmark session."""
        existing = self._repo.get_in_progress_session()
        if existing:
            raise ValueError("Another session is already in progress")

        session = WorkoutSession(
            id=None,
            routine_id=None,
            routine_day_id=None,
            session_type=SessionType.BENCHMARK,
            status=SessionStatus.IN_PROGRESS,
            completed_fully=None,
            day_label_snapshot=None,
            day_name_snapshot=None,
            started_at=self._now(),
        )
        session.id = self._repo.create_session(session)
        self._repo.commit()
        return session

    def finish_session(self, session_id: int) -> WorkoutSession:
        """Finish a session (completed_fully=True). Advances cycle for routine sessions."""
        session = self._repo.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        self._repo.finish_session(session_id, completed_fully=True, finished_at=self._now())

        # Advance cycle for routine sessions
        if session.session_type == SessionType.ROUTINE and session.routine_id:
            self._cycle_service.advance(session.routine_id)

        self._repo.commit()
        return self._repo.get_session(session_id)

    def end_early(self, session_id: int) -> WorkoutSession:
        """End session early (completed_fully=False). Advances cycle only if ≥1 set logged."""
        session = self._repo.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        if session.status != SessionStatus.IN_PROGRESS:
            raise ValueError("Session is not in progress")

        self._repo.finish_session(session_id, completed_fully=False, finished_at=self._now())

        # Advance cycle only if at least one set was logged
        total_sets = self._repo.get_session_total_set_count(session_id)
        if (total_sets > 0
                and session.session_type == SessionType.ROUTINE
                and session.routine_id):
            self._cycle_service.advance(session.routine_id)

        self._repo.commit()
        return self._repo.get_session(session_id)

    def get_session(self, session_id: int) -> Optional[WorkoutSession]:
        return self._repo.get_session(session_id)

    def get_in_progress_session(self) -> Optional[WorkoutSession]:
        return self._repo.get_in_progress_session()

    # --- Session exercises ---

    def add_exercise_to_session(
        self,
        session_id: int,
        exercise_id: int,
        routine_day_exercise_id: Optional[int] = None,
    ) -> SessionExercise:
        """Add an exercise to a session. routine_day_exercise_id=None means ad-hoc."""
        session = self._repo.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            raise ValueError(f"Exercise {exercise_id} not found")

        sort_order = self._repo.get_session_exercise_count(session_id)
        se = SessionExercise(
            id=None,
            session_id=session_id,
            exercise_id=exercise_id,
            routine_day_exercise_id=routine_day_exercise_id,
            sort_order=sort_order,
            exercise_name_snapshot=exercise.name,
        )
        se.id = self._repo.add_session_exercise(se)
        self._repo.commit()
        return se

    def get_session_exercises(self, session_id: int) -> List[SessionExercise]:
        return self._repo.get_session_exercises(session_id)

    # --- Logged sets ---

    def log_set(
        self,
        session_exercise_id: int,
        set_kind: SetKind,
        exercise_set_target_id: Optional[int] = None,
        reps: Optional[int] = None,
        weight: Optional[float] = None,
        duration_seconds: Optional[int] = None,
        distance: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> LoggedSet:
        """Log a set. Committed to DB immediately (crash safety)."""
        se = self._repo.get_session_exercise(session_exercise_id)
        if not se:
            raise ValueError(f"Session exercise {session_exercise_id} not found")

        # Validate set_kind compatibility
        exercise = self._exercise_repo.get_by_id(se.exercise_id)
        validate_set_kind(set_kind, exercise.type)
        validate_cardio_fields(set_kind, duration_seconds, distance)
        validate_amrap_fields(set_kind, exercise.type, weight)

        set_number = self._repo.get_logged_set_count(session_exercise_id) + 1
        ls = LoggedSet(
            id=None,
            session_exercise_id=session_exercise_id,
            exercise_set_target_id=exercise_set_target_id,
            set_number=set_number,
            set_kind=set_kind,
            reps=reps,
            weight=weight,
            duration_seconds=duration_seconds,
            distance=distance,
            notes=notes,
            logged_at=self._now(),
        )
        ls.id = self._repo.add_logged_set(ls)
        self._repo.commit()
        return ls

    def update_set(
        self,
        set_id: int,
        reps: Optional[int] = None,
        weight: Optional[float] = None,
        duration_seconds: Optional[int] = None,
        distance: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> LoggedSet:
        """Edit a logged set (past or present). Stats derived from current data, never cached."""
        ls = self._repo.get_logged_set(set_id)
        if not ls:
            raise ValueError(f"Logged set {set_id} not found")

        # Validate updated fields against exercise type
        se = self._repo.get_session_exercise(ls.session_exercise_id)
        exercise = self._exercise_repo.get_by_id(se.exercise_id)

        updated_weight = weight if weight is not None else ls.weight
        updated_duration = duration_seconds if duration_seconds is not None else ls.duration_seconds
        updated_distance = distance if distance is not None else ls.distance

        validate_cardio_fields(ls.set_kind, updated_duration, updated_distance)
        validate_amrap_fields(ls.set_kind, exercise.type, updated_weight)

        if reps is not None:
            ls.reps = reps
        if weight is not None:
            ls.weight = weight
        if duration_seconds is not None:
            ls.duration_seconds = duration_seconds
        if distance is not None:
            ls.distance = distance
        if notes is not None:
            ls.notes = notes

        self._repo.update_logged_set(ls)
        self._repo.commit()
        return ls

    def delete_set(self, set_id: int) -> None:
        """Delete a logged set and resequence. Works on past or current sessions."""
        self._repo.delete_logged_set(set_id)
        self._repo.commit()

    def get_logged_sets(self, session_exercise_id: int) -> List[LoggedSet]:
        return self._repo.get_logged_sets(session_exercise_id)
```

- [ ] **Step 3: Write `tests/test_workout_service.py`**

```python
import pytest
from src.models.exercise import ExerciseType
from src.models.routine import SetScheme, SetKind
from src.models.workout import SessionStatus, SessionType


class TestWorkoutSessionLifecycle:
    """Tests for session start, finish, end early, and single-session constraint."""

    def _setup_routine_day(self, routine_service, make_exercise):
        """Helper: create a routine with one day and one exercise."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        routine_service.activate_routine(r.id)
        return r, day, ex, rde

    def test_start_routine_session(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        session = workout_service.start_routine_session(day.id)

        assert session.id is not None
        assert session.session_type == SessionType.ROUTINE
        assert session.status == SessionStatus.IN_PROGRESS
        assert session.completed_fully is None
        assert session.day_label_snapshot == "A"
        assert session.day_name_snapshot == "Push"
        assert session.routine_id == r.id

    def test_start_benchmark_session(self, workout_service):
        session = workout_service.start_benchmark_session()
        assert session.session_type == SessionType.BENCHMARK
        assert session.status == SessionStatus.IN_PROGRESS
        assert session.routine_id is None

    def test_only_one_in_progress_session(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        workout_service.start_routine_session(day.id)
        with pytest.raises(ValueError, match="already in progress"):
            workout_service.start_benchmark_session()

    def test_finish_session(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        session = workout_service.start_routine_session(day.id)
        finished = workout_service.finish_session(session.id)

        assert finished.status == SessionStatus.FINISHED
        assert finished.completed_fully is True
        assert finished.finished_at is not None

    def test_finish_advances_cycle(self, workout_service, routine_service, cycle_service, make_exercise):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(d1.id)
        workout_service.finish_session(session.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d2.id

    def test_end_early(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        session = workout_service.start_routine_session(day.id)
        ended = workout_service.end_early(session.id)

        assert ended.status == SessionStatus.FINISHED
        assert ended.completed_fully is False

    def test_end_early_zero_sets_no_cycle_advance(self, workout_service, routine_service, cycle_service, make_exercise):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(d1.id)
        workout_service.end_early(session.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d1.id  # No advance — zero sets

    def test_end_early_with_sets_advances_cycle(self, workout_service, routine_service, cycle_service, make_exercise):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(d1.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        workout_service.end_early(session.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d2.id  # Advanced — had sets

    def test_benchmark_session_no_cycle_advance(self, workout_service, routine_service, cycle_service, make_exercise):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)

        session = workout_service.start_benchmark_session()
        workout_service.finish_session(session.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d1.id  # No advance — benchmark session

    def test_get_in_progress_session(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        session = workout_service.start_routine_session(day.id)
        found = workout_service.get_in_progress_session()
        assert found.id == session.id

    def test_no_in_progress_session(self, workout_service):
        assert workout_service.get_in_progress_session() is None

    def test_can_start_after_finish(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        s1 = workout_service.start_routine_session(day.id)
        workout_service.finish_session(s1.id)
        s2 = workout_service.start_routine_session(day.id)
        assert s2.id != s1.id


class TestWorkoutSetLogging:
    """Tests for logging, editing, and deleting sets."""

    def _start_session_with_exercise(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        return session, se, ex

    def test_log_set(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)

        assert ls.id is not None
        assert ls.set_number == 1
        assert ls.reps == 10
        assert ls.weight == 135.0
        assert ls.logged_at is not None

    def test_log_set_auto_increments_set_number(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls1 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        ls2 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=8, weight=145.0)
        assert ls1.set_number == 1
        assert ls2.set_number == 2

    def test_log_set_validates_set_kind(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        with pytest.raises(ValueError, match="not compatible"):
            workout_service.log_set(se.id, SetKind.DURATION, duration_seconds=60)

    def test_log_set_validates_cardio(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("C")
        day = routine_service.add_day(r.id, "A", "Cardio")
        ex = make_exercise("Treadmill", type=ExerciseType.CARDIO)
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)

        with pytest.raises(ValueError, match="at least one"):
            workout_service.log_set(se.id, SetKind.CARDIO)

    def test_log_set_with_target_link(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        targets = routine_service.set_uniform_targets(rde.id, 3, SetKind.REPS_WEIGHT, 10, 10, 135.0)
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id, routine_day_exercise_id=rde.id)
        ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT,
                                     exercise_set_target_id=targets[0].id,
                                     reps=10, weight=135.0)
        assert ls.exercise_set_target_id == targets[0].id

    def test_add_ad_hoc_exercise(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)

        ex = make_exercise("Tricep Pushdown")
        se = workout_service.add_exercise_to_session(session.id, ex.id)  # No rde_id = ad-hoc
        assert se.routine_day_exercise_id is None
        assert se.exercise_name_snapshot == "Tricep Pushdown"

    def test_update_set(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)

        updated = workout_service.update_set(ls.id, reps=12, weight=140.0)
        assert updated.reps == 12
        assert updated.weight == 140.0

    def test_delete_set_resequences(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls1 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        ls2 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=8, weight=145.0)
        ls3 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=6, weight=155.0)

        workout_service.delete_set(ls2.id)

        sets = workout_service.get_logged_sets(se.id)
        assert len(sets) == 2
        assert sets[0].set_number == 1
        assert sets[0].reps == 10
        assert sets[1].set_number == 2
        assert sets[1].reps == 6

    def test_edit_past_session_set(self, workout_service, routine_service, make_exercise):
        """Editing a past session's set works (no append-only restriction)."""
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        workout_service.finish_session(session.id)

        updated = workout_service.update_set(ls.id, reps=12)
        assert updated.reps == 12

    def test_session_exercise_snapshot(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        assert se.exercise_name_snapshot == "Bench Press"

    def test_routine_deletion_preserves_session(self, workout_service, routine_service, make_exercise, db_conn):
        """ON DELETE SET NULL: deleting routine preserves session with null routine_id."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        workout_service.finish_session(session.id)

        routine_service.delete_routine(r.id)

        preserved = workout_service.get_session(session.id)
        assert preserved is not None
        assert preserved.routine_id is None
        assert preserved.day_label_snapshot == "A"  # Snapshot preserved
```

- [ ] **Step 4: Add workout fixtures to `tests/conftest.py`**

Append:

```python
from src.repositories.workout_repo import WorkoutRepo
from src.services.workout_service import WorkoutService


@pytest.fixture
def workout_repo(db_conn):
    return WorkoutRepo(db_conn)


@pytest.fixture
def workout_service(workout_repo, routine_repo, exercise_repo, cycle_service):
    return WorkoutService(workout_repo, routine_repo, exercise_repo, cycle_service)
```

- [ ] **Step 5: Run tests**

```bash
python -m pytest tests/test_workout_service.py -v
```

Expected: All tests PASS.

- [ ] **Step 6: Run all tests**

```bash
python -m pytest tests/ -v
```

Expected: ALL tests pass (including existing Phase 1 tests).

- [ ] **Step 7: Commit**

```bash
git add src/repositories/workout_repo.py src/services/workout_service.py tests/test_workout_service.py tests/conftest.py
git commit -m "feat: workout repo and service with session lifecycle, set logging, editing"
```

---

## Task 3: Settings Repo + Unit Conversion

**Files:**
- Create: `src/repositories/settings_repo.py`, `src/utils/unit_conversion.py`
- Create: `tests/test_settings_and_units.py`
- Modify: `tests/conftest.py` (add settings_repo fixture)

- [ ] **Step 1: Create `src/repositories/settings_repo.py`**

```python
"""Settings repository — key-value CRUD."""
from typing import Optional
from src.models.settings import Setting
from src.repositories.base import BaseRepository


class SettingsRepo(BaseRepository):

    def get(self, key: str) -> Optional[str]:
        row = self._fetchone("SELECT value FROM settings WHERE key = ?", (key,))
        return row["value"] if row else None

    def set(self, key: str, value: str) -> None:
        self._execute(
            """INSERT INTO settings (key, value) VALUES (?, ?)
               ON CONFLICT(key) DO UPDATE SET value = ?""",
            (key, value, value),
        )

    def delete(self, key: str) -> None:
        self._execute("DELETE FROM settings WHERE key = ?", (key,))

    def get_all(self) -> dict:
        rows = self._fetchall("SELECT key, value FROM settings ORDER BY key")
        return {r["key"]: r["value"] for r in rows}
```

- [ ] **Step 2: Create `src/utils/unit_conversion.py`**

```python
"""Weight and distance unit conversion utilities."""

LBS_TO_KG = 0.45359237
KG_TO_LBS = 1.0 / LBS_TO_KG
KM_TO_MILES = 0.621371
MILES_TO_KM = 1.0 / KM_TO_MILES


def lbs_to_kg(lbs: float) -> float:
    """Convert pounds to kilograms, rounded to 2 decimal places."""
    return round(lbs * LBS_TO_KG, 2)


def kg_to_lbs(kg: float) -> float:
    """Convert kilograms to pounds, rounded to 2 decimal places."""
    return round(kg * KG_TO_LBS, 2)


def km_to_miles(km: float) -> float:
    """Convert kilometers to miles, rounded to 2 decimal places."""
    return round(km * KM_TO_MILES, 2)


def miles_to_km(miles: float) -> float:
    """Convert miles to kilometers, rounded to 2 decimal places."""
    return round(miles * MILES_TO_KM, 2)


def convert_all_weights(conn, from_unit: str, to_unit: str) -> int:
    """Convert ALL weight values in the database in a single transaction.

    Converts weights in: exercise_set_targets, logged_sets, benchmark_definitions,
    benchmark_results (reference_weight_snapshot).

    Args:
        conn: SQLite connection
        from_unit: 'lbs' or 'kg'
        to_unit: 'lbs' or 'kg'

    Returns:
        Total number of rows updated across all tables.
    """
    if from_unit == to_unit:
        return 0

    if from_unit == "lbs" and to_unit == "kg":
        factor = LBS_TO_KG
    elif from_unit == "kg" and to_unit == "lbs":
        factor = KG_TO_LBS
    else:
        raise ValueError(f"Invalid conversion: {from_unit} -> {to_unit}")

    total = 0

    # exercise_set_targets.target_weight
    cursor = conn.execute(
        "UPDATE exercise_set_targets SET target_weight = ROUND(target_weight * ?, 2) WHERE target_weight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # logged_sets.weight
    cursor = conn.execute(
        "UPDATE logged_sets SET weight = ROUND(weight * ?, 2) WHERE weight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_definitions.reference_weight
    cursor = conn.execute(
        "UPDATE benchmark_definitions SET reference_weight = ROUND(reference_weight * ?, 2) WHERE reference_weight IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_results.reference_weight_snapshot
    cursor = conn.execute(
        "UPDATE benchmark_results SET reference_weight_snapshot = ROUND(reference_weight_snapshot * ?, 2) WHERE reference_weight_snapshot IS NOT NULL",
        (factor,),
    )
    total += cursor.rowcount

    # benchmark_results.result_value for max_weight method (result_value stores weight)
    cursor = conn.execute(
        "UPDATE benchmark_results SET result_value = ROUND(result_value * ?, 2) WHERE method_snapshot = 'max_weight'",
        (factor,),
    )
    total += cursor.rowcount

    conn.commit()
    return total
```

- [ ] **Step 3: Write `tests/test_settings_and_units.py`**

```python
import pytest
from src.utils.unit_conversion import lbs_to_kg, kg_to_lbs, km_to_miles, miles_to_km, convert_all_weights


class TestUnitConversion:
    def test_lbs_to_kg(self):
        assert lbs_to_kg(100) == 45.36
        assert lbs_to_kg(0) == 0.0

    def test_kg_to_lbs(self):
        assert kg_to_lbs(45.36) == 99.96  # Round-trip is approximate
        assert kg_to_lbs(0) == 0.0

    def test_km_to_miles(self):
        assert km_to_miles(1.0) == 0.62

    def test_miles_to_km(self):
        assert miles_to_km(1.0) == 1.61


class TestSettingsRepo:
    def test_get_nonexistent(self, settings_repo):
        assert settings_repo.get("missing_key") is None

    def test_set_and_get(self, settings_repo, db_conn):
        settings_repo.set("weight_unit", "lbs")
        db_conn.commit()
        assert settings_repo.get("weight_unit") == "lbs"

    def test_set_overwrites(self, settings_repo, db_conn):
        settings_repo.set("weight_unit", "lbs")
        settings_repo.set("weight_unit", "kg")
        db_conn.commit()
        assert settings_repo.get("weight_unit") == "kg"

    def test_delete(self, settings_repo, db_conn):
        settings_repo.set("weight_unit", "lbs")
        settings_repo.delete("weight_unit")
        db_conn.commit()
        assert settings_repo.get("weight_unit") is None

    def test_get_all(self, settings_repo, db_conn):
        settings_repo.set("weight_unit", "lbs")
        settings_repo.set("theme", "dark")
        db_conn.commit()
        all_settings = settings_repo.get_all()
        assert all_settings == {"theme": "dark", "weight_unit": "lbs"}


class TestConvertAllWeights:
    def test_lbs_to_kg_conversion(self, db_conn):
        """Convert all weights from lbs to kg in one transaction."""
        # Create prerequisite chain
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
        db_conn.execute(
            """INSERT INTO exercise_set_targets
               (routine_day_exercise_id, set_number, set_kind, target_weight)
               VALUES (?, ?, ?, ?)""",
            (1, 1, "reps_weight", 135.0),
        )
        db_conn.commit()

        total = convert_all_weights(db_conn, "lbs", "kg")
        assert total == 1

        row = db_conn.execute("SELECT target_weight FROM exercise_set_targets WHERE id = 1").fetchone()
        assert row["target_weight"] == 61.24  # 135 * 0.45359237 ≈ 61.24

    def test_same_unit_no_op(self, db_conn):
        total = convert_all_weights(db_conn, "lbs", "lbs")
        assert total == 0

    def test_invalid_units_raises(self, db_conn):
        with pytest.raises(ValueError, match="Invalid conversion"):
            convert_all_weights(db_conn, "lbs", "stone")
```

- [ ] **Step 4: Add settings fixture to `tests/conftest.py`**

Append:

```python
from src.repositories.settings_repo import SettingsRepo


@pytest.fixture
def settings_repo(db_conn):
    return SettingsRepo(db_conn)
```

- [ ] **Step 5: Run tests**

```bash
python -m pytest tests/test_settings_and_units.py -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/settings_repo.py src/utils/unit_conversion.py tests/test_settings_and_units.py tests/conftest.py
git commit -m "feat: settings repo and unit conversion with full-DB weight conversion"
```

---

## Task 4: Benchmark Repo + Service

**Files:**
- Create: `src/repositories/benchmark_repo.py`, `src/services/benchmark_service.py`
- Create: `tests/test_benchmark_service.py`
- Modify: `tests/conftest.py` (add benchmark fixtures)

- [ ] **Step 1: Create `src/repositories/benchmark_repo.py`**

```python
"""Benchmark repository — definitions and results."""
from typing import List, Optional
from src.models.benchmark import BenchmarkDefinition, BenchmarkResult, BenchmarkMethod
from src.repositories.base import BaseRepository


class BenchmarkRepo(BaseRepository):

    # --- Definitions ---

    def create_definition(self, defn: BenchmarkDefinition) -> int:
        return self._insert(
            """INSERT INTO benchmark_definitions
               (exercise_id, method, reference_weight, frequency_weeks, muscle_group_label)
               VALUES (?, ?, ?, ?, ?)""",
            (defn.exercise_id, defn.method.value, defn.reference_weight,
             defn.frequency_weeks, defn.muscle_group_label),
        )

    def get_definition(self, defn_id: int) -> Optional[BenchmarkDefinition]:
        row = self._fetchone("SELECT * FROM benchmark_definitions WHERE id = ?", (defn_id,))
        return self._to_definition(row) if row else None

    def get_definitions_for_exercise(self, exercise_id: int) -> List[BenchmarkDefinition]:
        rows = self._fetchall(
            "SELECT * FROM benchmark_definitions WHERE exercise_id = ?",
            (exercise_id,),
        )
        return [self._to_definition(r) for r in rows]

    def list_definitions(self) -> List[BenchmarkDefinition]:
        rows = self._fetchall(
            "SELECT * FROM benchmark_definitions ORDER BY muscle_group_label, id"
        )
        return [self._to_definition(r) for r in rows]

    def update_definition(self, defn: BenchmarkDefinition) -> None:
        self._execute(
            """UPDATE benchmark_definitions
               SET method = ?, reference_weight = ?, frequency_weeks = ?, muscle_group_label = ?
               WHERE id = ?""",
            (defn.method.value, defn.reference_weight, defn.frequency_weeks,
             defn.muscle_group_label, defn.id),
        )

    def delete_definition(self, defn_id: int) -> None:
        # Delete results first (FK has no CASCADE)
        self._execute("DELETE FROM benchmark_results WHERE benchmark_definition_id = ?", (defn_id,))
        self._execute("DELETE FROM benchmark_definitions WHERE id = ?", (defn_id,))

    # --- Results ---

    def add_result(self, result: BenchmarkResult) -> int:
        return self._insert(
            """INSERT INTO benchmark_results
               (benchmark_definition_id, session_id, method_snapshot,
                reference_weight_snapshot, result_value, tested_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (result.benchmark_definition_id, result.session_id,
             result.method_snapshot.value, result.reference_weight_snapshot,
             result.result_value, result.tested_at),
        )

    def get_results(self, defn_id: int) -> List[BenchmarkResult]:
        rows = self._fetchall(
            "SELECT * FROM benchmark_results WHERE benchmark_definition_id = ? ORDER BY tested_at DESC",
            (defn_id,),
        )
        return [self._to_result(r) for r in rows]

    def get_latest_result(self, defn_id: int) -> Optional[BenchmarkResult]:
        row = self._fetchone(
            "SELECT * FROM benchmark_results WHERE benchmark_definition_id = ? ORDER BY tested_at DESC LIMIT 1",
            (defn_id,),
        )
        return self._to_result(row) if row else None

    # --- Row converters ---

    def _to_definition(self, row) -> BenchmarkDefinition:
        return BenchmarkDefinition(
            id=row["id"],
            exercise_id=row["exercise_id"],
            method=BenchmarkMethod(row["method"]),
            reference_weight=row["reference_weight"],
            frequency_weeks=row["frequency_weeks"],
            muscle_group_label=row["muscle_group_label"],
        )

    def _to_result(self, row) -> BenchmarkResult:
        return BenchmarkResult(
            id=row["id"],
            benchmark_definition_id=row["benchmark_definition_id"],
            session_id=row["session_id"],
            method_snapshot=BenchmarkMethod(row["method_snapshot"]),
            reference_weight_snapshot=row["reference_weight_snapshot"],
            result_value=row["result_value"],
            tested_at=row["tested_at"],
        )
```

- [ ] **Step 2: Create `src/services/benchmark_service.py`**

```python
"""Benchmark service — due calculations, result recording with snapshots."""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from src.models.benchmark import BenchmarkDefinition, BenchmarkResult, BenchmarkMethod
from src.repositories.benchmark_repo import BenchmarkRepo
from src.repositories.exercise_repo import ExerciseRepo


class BenchmarkService:
    def __init__(self, benchmark_repo: BenchmarkRepo, exercise_repo: ExerciseRepo):
        self._repo = benchmark_repo
        self._exercise_repo = exercise_repo

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # --- Definitions ---

    def create_definition(
        self,
        exercise_id: int,
        method: BenchmarkMethod,
        muscle_group_label: str,
        reference_weight: Optional[float] = None,
        frequency_weeks: int = 6,
    ) -> BenchmarkDefinition:
        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            raise ValueError(f"Exercise {exercise_id} not found")

        defn = BenchmarkDefinition(
            id=None,
            exercise_id=exercise_id,
            method=method,
            reference_weight=reference_weight,
            frequency_weeks=frequency_weeks,
            muscle_group_label=muscle_group_label,
        )
        defn.id = self._repo.create_definition(defn)
        self._repo.commit()
        return defn

    def get_definition(self, defn_id: int) -> Optional[BenchmarkDefinition]:
        return self._repo.get_definition(defn_id)

    def list_definitions(self) -> List[BenchmarkDefinition]:
        return self._repo.list_definitions()

    def update_definition(self, defn: BenchmarkDefinition) -> BenchmarkDefinition:
        self._repo.update_definition(defn)
        self._repo.commit()
        return defn

    def delete_definition(self, defn_id: int) -> None:
        self._repo.delete_definition(defn_id)
        self._repo.commit()

    # --- Due calculation ---

    def is_due(self, defn_id: int) -> bool:
        """Due = never tested OR days_since_last >= frequency_weeks * 7."""
        defn = self._repo.get_definition(defn_id)
        if not defn:
            raise ValueError(f"Benchmark definition {defn_id} not found")

        latest = self._repo.get_latest_result(defn_id)
        if not latest:
            return True

        tested_at = datetime.fromisoformat(latest.tested_at)
        now = datetime.now(timezone.utc)
        days_since = (now - tested_at).days
        return days_since >= defn.frequency_weeks * 7

    def get_due_benchmarks(self) -> List[BenchmarkDefinition]:
        """Return all benchmark definitions that are due."""
        all_defns = self._repo.list_definitions()
        return [d for d in all_defns if self.is_due(d.id)]

    # --- Results ---

    def record_result(
        self,
        defn_id: int,
        result_value: float,
        session_id: Optional[int] = None,
    ) -> BenchmarkResult:
        """Record a benchmark result with method/weight snapshots from the definition."""
        defn = self._repo.get_definition(defn_id)
        if not defn:
            raise ValueError(f"Benchmark definition {defn_id} not found")

        result = BenchmarkResult(
            id=None,
            benchmark_definition_id=defn_id,
            session_id=session_id,
            method_snapshot=defn.method,
            reference_weight_snapshot=defn.reference_weight,
            result_value=result_value,
            tested_at=self._now(),
        )
        result.id = self._repo.add_result(result)
        self._repo.commit()
        return result

    def get_results(self, defn_id: int) -> List[BenchmarkResult]:
        return self._repo.get_results(defn_id)
```

- [ ] **Step 3: Write `tests/test_benchmark_service.py`**

```python
import pytest
from datetime import datetime, timezone, timedelta
from src.models.benchmark import BenchmarkMethod


class TestBenchmarkService:

    def test_create_definition(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper",
        )
        assert defn.id is not None
        assert defn.method == BenchmarkMethod.MAX_WEIGHT
        assert defn.frequency_weeks == 6  # default
        assert defn.muscle_group_label == "Upper"

    def test_create_with_reference_weight(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_REPS, "Upper",
            reference_weight=100.0,
        )
        assert defn.reference_weight == 100.0

    def test_create_with_custom_frequency(self, benchmark_service, make_exercise):
        ex = make_exercise("Plank")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.TIMED_HOLD, "Core",
            frequency_weeks=8,
        )
        assert defn.frequency_weeks == 8

    def test_list_definitions(self, benchmark_service, make_exercise):
        ex1 = make_exercise("Bench Press")
        ex2 = make_exercise("Plank")
        benchmark_service.create_definition(ex1.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        benchmark_service.create_definition(ex2.id, BenchmarkMethod.TIMED_HOLD, "Core")
        defns = benchmark_service.list_definitions()
        assert len(defns) == 2

    def test_is_due_never_tested(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        assert benchmark_service.is_due(defn.id) is True

    def test_is_due_recently_tested(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        benchmark_service.record_result(defn.id, 185.0)
        assert benchmark_service.is_due(defn.id) is False

    def test_get_due_benchmarks(self, benchmark_service, make_exercise):
        ex1 = make_exercise("Bench Press")
        ex2 = make_exercise("Squat")
        defn1 = benchmark_service.create_definition(ex1.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        defn2 = benchmark_service.create_definition(ex2.id, BenchmarkMethod.MAX_WEIGHT, "Lower")
        benchmark_service.record_result(defn1.id, 185.0)
        # defn2 never tested = due
        due = benchmark_service.get_due_benchmarks()
        assert len(due) == 1
        assert due[0].id == defn2.id

    def test_record_result_with_snapshots(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_REPS, "Upper",
            reference_weight=100.0,
        )
        result = benchmark_service.record_result(defn.id, 12.0)

        assert result.method_snapshot == BenchmarkMethod.MAX_REPS
        assert result.reference_weight_snapshot == 100.0
        assert result.result_value == 12.0

    def test_snapshot_preserved_after_definition_edit(self, benchmark_service, make_exercise):
        """Editing definition after recording preserves old result's snapshot."""
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_REPS, "Upper",
            reference_weight=100.0,
        )
        result1 = benchmark_service.record_result(defn.id, 12.0)

        # Edit definition to new weight
        defn.reference_weight = 120.0
        benchmark_service.update_definition(defn)

        result2 = benchmark_service.record_result(defn.id, 8.0)

        # Old result still has old snapshot
        results = benchmark_service.get_results(defn.id)
        assert results[0].reference_weight_snapshot == 120.0  # newest first
        assert results[1].reference_weight_snapshot == 100.0  # original snapshot preserved

    def test_delete_definition(self, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
        benchmark_service.delete_definition(defn.id)
        assert benchmark_service.get_definition(defn.id) is None
```

- [ ] **Step 4: Add benchmark fixtures to `tests/conftest.py`**

Append:

```python
from src.repositories.benchmark_repo import BenchmarkRepo
from src.services.benchmark_service import BenchmarkService


@pytest.fixture
def benchmark_repo(db_conn):
    return BenchmarkRepo(db_conn)


@pytest.fixture
def benchmark_service(benchmark_repo, exercise_repo):
    return BenchmarkService(benchmark_repo, exercise_repo)
```

- [ ] **Step 5: Run tests**

```bash
python -m pytest tests/test_benchmark_service.py -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/benchmark_repo.py src/services/benchmark_service.py tests/test_benchmark_service.py tests/conftest.py
git commit -m "feat: benchmark repo and service with due calculation, result snapshots"
```

---

## Task 5A: Stats Service — Routine & Exercise Stats

**Files:**
- Create: `src/services/stats_service.py`
- Create: `tests/test_stats_service.py`
- Modify: `tests/conftest.py` (add stats_service fixture)

- [ ] **Step 1: Create `src/services/stats_service.py`**

```python
"""Stats service — dashboard queries, PRs, chart data.

All stats are derived from current data, never cached.
Zero-set sessions are excluded from all stat queries.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from src.repositories.workout_repo import WorkoutRepo
from src.repositories.exercise_repo import ExerciseRepo


class StatsService:
    def __init__(self, workout_repo: WorkoutRepo, exercise_repo: ExerciseRepo):
        self._workout_repo = workout_repo
        self._exercise_repo = exercise_repo

    def get_session_count(self, since: Optional[str] = None) -> int:
        """Count finished sessions with at least one logged set."""
        return self._workout_repo.get_session_count_with_sets(since)

    def get_sessions_this_week(self) -> int:
        now = datetime.now(timezone.utc)
        start_of_week = now - timedelta(days=now.weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        return self.get_session_count(since=start_of_week.isoformat())

    def get_sessions_this_month(self) -> int:
        now = datetime.now(timezone.utc)
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return self.get_session_count(since=start_of_month.isoformat())

    def get_last_workout_summary(self) -> Optional[dict]:
        """Return summary of last finished session with sets.

        Returns dict with: session_id, started_at, finished_at, day_label, day_name, duration_minutes
        """
        session = self._workout_repo.get_last_session_with_sets()
        if not session:
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

    def get_exercise_weight_history(self, exercise_id: int) -> List[dict]:
        """Weight over time for an exercise (for charts).

        Returns list of dicts: {session_date, max_weight, total_volume}
        """
        rows = self._workout_repo.get_exercise_logged_sets(exercise_id)

        # Group by session date
        sessions = {}
        for row in rows:
            session_date = row["session_started_at"][:10]  # YYYY-MM-DD
            if session_date not in sessions:
                sessions[session_date] = {"max_weight": 0, "total_volume": 0}

            weight = row.get("weight") or 0
            reps = row.get("reps") or 0

            if weight > sessions[session_date]["max_weight"]:
                sessions[session_date]["max_weight"] = weight
            sessions[session_date]["total_volume"] += weight * reps

        return [
            {"session_date": date, "max_weight": data["max_weight"], "total_volume": data["total_volume"]}
            for date, data in sorted(sessions.items())
        ]

    def get_exercise_best_set(self, exercise_id: int) -> Optional[dict]:
        """Best set (highest weight) for an exercise across all sessions."""
        rows = self._workout_repo.get_exercise_logged_sets(exercise_id)
        if not rows:
            return None

        best = None
        for row in rows:
            weight = row.get("weight") or 0
            if best is None or weight > best.get("weight", 0):
                best = {
                    "weight": weight,
                    "reps": row.get("reps"),
                    "session_date": row["session_started_at"][:10],
                }
        return best
```

- [ ] **Step 2: Write `tests/test_stats_service.py`**

```python
import pytest
from src.models.exercise import ExerciseType
from src.models.routine import SetScheme, SetKind


class TestStatsService:

    def _create_session_with_sets(self, workout_service, routine_service, make_exercise,
                                  exercise_name="Bench Press", reps=10, weight=135.0,
                                  num_sets=1, finish=True):
        """Helper: create a routine, start session, log sets, optionally finish."""
        # Reuse or create routine
        routines = routine_service.list_routines()
        if routines:
            r = routines[0]
            days = routine_service.get_days(r.id)
            day = days[0]
        else:
            r = routine_service.create_routine("Test")
            day = routine_service.add_day(r.id, "A", "Push")
            routine_service.activate_routine(r.id)

        ex = make_exercise(exercise_name)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)

        logged = []
        for _ in range(num_sets):
            ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=reps, weight=weight)
            logged.append(ls)

        if finish:
            workout_service.finish_session(session.id)

        return session, se, logged

    def test_zero_set_session_excluded_from_count(self, stats_service, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(day.id)
        workout_service.end_early(session.id)  # Zero sets

        assert stats_service.get_session_count() == 0

    def test_session_with_sets_counted(self, stats_service, workout_service, routine_service, make_exercise):
        self._create_session_with_sets(workout_service, routine_service, make_exercise)
        assert stats_service.get_session_count() == 1

    def test_last_workout_summary(self, stats_service, workout_service, routine_service, make_exercise):
        self._create_session_with_sets(workout_service, routine_service, make_exercise)
        summary = stats_service.get_last_workout_summary()
        assert summary is not None
        assert summary["day_label"] == "A"
        assert summary["day_name"] == "Push"
        assert summary["duration_minutes"] is not None

    def test_last_workout_excludes_zero_set_sessions(self, stats_service, workout_service, routine_service, make_exercise):
        # Create session with sets
        self._create_session_with_sets(workout_service, routine_service, make_exercise)

        # Create zero-set session after
        days = routine_service.get_days(routine_service.list_routines()[0].id)
        s2 = workout_service.start_routine_session(days[0].id)
        workout_service.end_early(s2.id)

        summary = stats_service.get_last_workout_summary()
        assert summary is not None
        assert summary["session_id"] != s2.id  # Should be the first session

    def test_no_sessions_returns_none(self, stats_service):
        assert stats_service.get_last_workout_summary() is None

    def test_exercise_weight_history(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0, num_sets=3,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        history = stats_service.get_exercise_weight_history(bench.id)
        assert len(history) == 1
        assert history[0]["max_weight"] == 135.0
        assert history[0]["total_volume"] == 135.0 * 10 * 3

    def test_exercise_best_set(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        best = stats_service.get_exercise_best_set(bench.id)
        assert best is not None
        assert best["weight"] == 135.0
        assert best["reps"] == 10

    def test_edit_past_session_updates_stats(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        """Editing a past set immediately affects stats (never cached)."""
        session, se, logged = self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        # Edit the set
        workout_service.update_set(logged[0].id, weight=200.0)

        best = stats_service.get_exercise_best_set(bench.id)
        assert best["weight"] == 200.0

    def test_delete_set_updates_stats(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        """Deleting a set from a session updates stats."""
        session, se, logged = self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0, num_sets=2,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        # Delete one set
        workout_service.delete_set(logged[0].id)

        history = stats_service.get_exercise_weight_history(bench.id)
        assert history[0]["total_volume"] == 135.0 * 10  # Only one set remains

    def test_add_set_to_past_session(self, stats_service, workout_service, routine_service, make_exercise, exercise_repo):
        """Can add a set to a finished session (no append-only restriction)."""
        session, se, logged = self._create_session_with_sets(
            workout_service, routine_service, make_exercise,
            reps=10, weight=135.0, num_sets=1,
        )
        bench = exercise_repo.get_by_name("Bench Press")

        # Add extra set to finished session
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=8, weight=155.0)

        best = stats_service.get_exercise_best_set(bench.id)
        assert best["weight"] == 155.0
```

- [ ] **Step 3: Add stats fixture to `tests/conftest.py`**

Append:

```python
from src.services.stats_service import StatsService


@pytest.fixture
def stats_service(workout_repo, exercise_repo):
    return StatsService(workout_repo, exercise_repo)
```

- [ ] **Step 4: Run tests**

```bash
python -m pytest tests/test_stats_service.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/stats_service.py tests/test_stats_service.py tests/conftest.py
git commit -m "feat: stats service with session counts, weight history, PRs, zero-set exclusion"
```

---

## Task 5B: Stats Service — Benchmark History + Plan-vs-Actual

**Files:**
- Modify: `src/services/stats_service.py` (add methods)
- Modify: `tests/test_stats_service.py` (add test classes)

This task adds the remaining dashboard queries that Task 5A deferred: benchmark history trends and plan-vs-actual comparison.

- [ ] **Step 1: Add benchmark and plan-vs-actual methods to `src/services/stats_service.py`**

Append these methods to the `StatsService` class:

```python
    def get_benchmark_history(self, defn_id: int) -> List[dict]:
        """Benchmark results over time for charts.

        Returns list of dicts: {tested_at, result_value, method_snapshot, reference_weight_snapshot}
        """
        from src.repositories.benchmark_repo import BenchmarkRepo
        # Use the workout_repo's connection to query benchmark_results directly
        rows = self._workout_repo._fetchall(
            """SELECT tested_at, result_value, method_snapshot, reference_weight_snapshot
               FROM benchmark_results
               WHERE benchmark_definition_id = ?
               ORDER BY tested_at""",
            (defn_id,),
        )
        return [dict(r) for r in rows]

    def get_plan_vs_actual(self, session_exercise_id: int) -> List[dict]:
        """Compare logged sets against their plan targets for a session exercise.

        Returns list of dicts: {set_number, set_kind, planned_reps_min, planned_reps_max,
        planned_weight, actual_reps, actual_weight, has_target}
        """
        rows = self._workout_repo._fetchall(
            """SELECT ls.set_number, ls.set_kind, ls.reps as actual_reps,
                      ls.weight as actual_weight, ls.duration_seconds as actual_duration,
                      ls.distance as actual_distance,
                      est.target_reps_min as planned_reps_min,
                      est.target_reps_max as planned_reps_max,
                      est.target_weight as planned_weight,
                      est.target_duration_seconds as planned_duration,
                      est.target_distance as planned_distance,
                      CASE WHEN est.id IS NOT NULL THEN 1 ELSE 0 END as has_target
               FROM logged_sets ls
               LEFT JOIN exercise_set_targets est ON ls.exercise_set_target_id = est.id
               WHERE ls.session_exercise_id = ?
               ORDER BY ls.set_number""",
            (session_exercise_id,),
        )
        return [dict(r) for r in rows]

    def get_total_volume_trend(self, weeks: int = 8) -> List[dict]:
        """Weekly total volume (weight * reps) across all exercises.

        Returns list of dicts: {week_start, total_volume}
        """
        now = datetime.now(timezone.utc)
        start = now - timedelta(weeks=weeks)
        rows = self._workout_repo._fetchall(
            """SELECT strftime('%%Y-%%W', ws.started_at) as year_week,
                      SUM(COALESCE(ls.weight, 0) * COALESCE(ls.reps, 0)) as total_volume
               FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               JOIN workout_sessions ws ON se.session_id = ws.id
               WHERE ws.status = 'finished' AND ws.started_at >= ?
               GROUP BY year_week
               ORDER BY year_week""",
            (start.isoformat(),),
        )
        return [{"week": r["year_week"], "total_volume": r["total_volume"]} for r in rows]
```

- [ ] **Step 2: Add test class to `tests/test_stats_service.py`**

Append to the test file:

```python
class TestStatsServiceBenchmarkAndPlanVsActual:

    def test_benchmark_history(self, stats_service, benchmark_service, make_exercise):
        ex = make_exercise("Bench Press")
        defn = benchmark_service.create_definition(
            ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper",
        )
        benchmark_service.record_result(defn.id, 135.0)
        benchmark_service.record_result(defn.id, 145.0)

        history = stats_service.get_benchmark_history(defn.id)
        assert len(history) == 2
        assert history[0]["result_value"] == 135.0
        assert history[1]["result_value"] == 145.0

    def test_plan_vs_actual_with_target(self, stats_service, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        targets = routine_service.set_uniform_targets(rde.id, 3, SetKind.REPS_WEIGHT, 10, 10, 135.0)
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id, routine_day_exercise_id=rde.id)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, exercise_set_target_id=targets[0].id, reps=10, weight=135.0)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, exercise_set_target_id=targets[1].id, reps=8, weight=140.0)
        workout_service.finish_session(session.id)

        comparison = stats_service.get_plan_vs_actual(se.id)
        assert len(comparison) == 2
        assert comparison[0]["has_target"] == 1
        assert comparison[0]["planned_weight"] == 135.0
        assert comparison[0]["actual_weight"] == 135.0
        assert comparison[1]["actual_reps"] == 8

    def test_plan_vs_actual_ad_hoc_no_target(self, stats_service, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)
        ex = make_exercise("Bench Press")

        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)  # ad-hoc
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        workout_service.finish_session(session.id)

        comparison = stats_service.get_plan_vs_actual(se.id)
        assert len(comparison) == 1
        assert comparison[0]["has_target"] == 0
        assert comparison[0]["planned_weight"] is None

    def test_total_volume_trend(self, stats_service, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=100.0)
        workout_service.finish_session(session.id)

        trend = stats_service.get_total_volume_trend(weeks=1)
        assert len(trend) >= 1
        assert trend[0]["total_volume"] == 1000.0  # 10 * 100
```

Add the needed import at the top of the test file:

```python
from src.models.benchmark import BenchmarkMethod
```

- [ ] **Step 3: Run tests**

```bash
python -m pytest tests/test_stats_service.py -v
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/stats_service.py tests/test_stats_service.py
git commit -m "feat: stats service benchmark history, plan-vs-actual, volume trend"
```

---

## Task 6: Import/Export Service

**Files:**
- Create: `src/services/import_export_service.py`
- Create: `tests/test_import_export.py`

This is the most complex service. Two-step API per spec:
1. `preview_import(data)` → validation errors, warnings, unmatched exercises, benchmark summary
2. `import_routine(data, exercise_mapping=None, activate=False)` → creates routine, uses mapping for unmatched exercises

- [ ] **Step 1: Create `src/services/import_export_service.py`**

```python
"""Import/export service — two-step routine import, routine export, validation.

Two-step import API:
1. preview_import(data) -> ImportPreview with errors, warnings, unmatched exercises
2. import_routine(data, exercise_mapping=None, activate=False) -> routine_id

Full backup export/restore (DB file replacement) is handled at the UI layer
in Phase 3, since it's a file-system operation, not a service-layer concern.
"""
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from src.models.exercise import Exercise, ExerciseType
from src.models.routine import SetScheme, SetKind
from src.models.benchmark import BenchmarkMethod
from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.routine_repo import RoutineRepo
from src.repositories.benchmark_repo import BenchmarkRepo
from src.services.validation import validate_set_kind, validate_cardio_fields, validate_amrap_fields

SUPPORTED_SCHEMA_VERSIONS = {1}

# Validation ranges per spec
MAX_REPS = 999
MAX_WEIGHT = 9999
MAX_DURATION = 86400


class ImportValidationError(ValueError):
    """Raised when import data fails validation."""
    pass


@dataclass
class ImportPreview:
    """Result of preview_import(). Contains everything the UI needs to show the import preview."""
    name: str = ""
    day_count: int = 0
    exercises_per_day: List[List[str]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    unmatched_exercises: List[dict] = field(default_factory=list)
    benchmark_summary: Optional[dict] = None
    is_valid: bool = False


class ImportExportService:
    def __init__(
        self,
        exercise_repo: ExerciseRepo,
        routine_repo: RoutineRepo,
        benchmark_repo: BenchmarkRepo,
    ):
        self._exercise_repo = exercise_repo
        self._routine_repo = routine_repo
        self._benchmark_repo = benchmark_repo

    # --- Export ---

    def export_routine(self, routine_id: int) -> dict:
        """Export a routine as a JSON-serializable dict."""
        routine = self._routine_repo.get_routine(routine_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found")

        days = self._routine_repo.get_days(routine_id)
        days_data = []
        for day in days:
            exercises_data = []
            rdes = self._routine_repo.get_day_exercises(day.id)
            for rde in rdes:
                exercise = self._exercise_repo.get_by_id(rde.exercise_id)
                targets = self._routine_repo.get_targets(rde.id)
                sets_data = [
                    {
                        "set_kind": t.set_kind.value,
                        "reps_min": t.target_reps_min,
                        "reps_max": t.target_reps_max,
                        "weight": t.target_weight,
                        "duration_seconds": t.target_duration_seconds,
                        "distance": t.target_distance,
                    }
                    for t in targets
                ]
                exercises_data.append({
                    "name": exercise.name,
                    "type": exercise.type.value,
                    "set_scheme": rde.set_scheme.value,
                    "notes": rde.notes,
                    "is_optional": rde.is_optional,
                    "sets": sets_data,
                })
            days_data.append({
                "label": day.label,
                "name": day.name,
                "exercises": exercises_data,
            })

        return {
            "schema_version": 1,
            "name": routine.name,
            "days": days_data,
        }

    # --- Step 1: Preview ---

    def preview_import(self, data: dict) -> ImportPreview:
        """Validate and preview an import. Returns ImportPreview with all info the UI needs.

        This is step 1 of the two-step import. The UI shows this preview and collects
        user decisions (exercise mapping, activate choice) before calling import_routine().
        """
        preview = ImportPreview()
        preview.name = data.get("name", "")

        # Run validation
        preview.errors = self._validate_routine_json(data)
        if preview.errors:
            return preview

        preview.is_valid = True

        # Build preview info
        days = data.get("days", [])
        preview.day_count = len(days)
        for day in days:
            exercises = day.get("exercises", [])
            preview.exercises_per_day.append([ex.get("name", "") for ex in exercises])

        # Find unmatched exercises
        seen = set()
        for day in days:
            for ex in day.get("exercises", []):
                name = ex.get("name", "")
                if name in seen:
                    continue
                seen.add(name)
                existing = self._exercise_repo.get_by_name_insensitive(name)
                if not existing:
                    preview.unmatched_exercises.append({"name": name, "type": ex.get("type")})

        if preview.unmatched_exercises:
            preview.warnings.append(
                f"{len(preview.unmatched_exercises)} exercise(s) not found in catalog"
            )

        # Benchmark summary
        benchmarking = data.get("benchmarking")
        if benchmarking and benchmarking.get("enabled"):
            items = benchmarking.get("items", [])
            preview.benchmark_summary = {
                "enabled": True,
                "default_frequency_weeks": benchmarking.get("frequency_weeks", 6),
                "item_count": len(items),
                "items": [
                    {"exercise_name": i.get("exercise_name"), "method": i.get("method")}
                    for i in items
                ],
            }

        return preview

    # --- Validation ---

    def _validate_routine_json(self, data: dict) -> List[str]:
        """Validate routine import data. Returns list of error messages (empty = valid)."""
        errors = []

        version = data.get("schema_version")
        if version is None:
            errors.append("Missing schema_version")
            return errors
        if version not in SUPPORTED_SCHEMA_VERSIONS:
            errors.append(f"Unsupported schema_version: {version}")
            return errors

        if not data.get("name"):
            errors.append("Missing routine name")

        days = data.get("days")
        if not days or not isinstance(days, list):
            errors.append("At least one day is required")
            return errors

        labels = [d.get("label", "").strip().upper() for d in days]
        if len(labels) != len(set(labels)):
            errors.append("Day labels must be unique")

        for di, day in enumerate(days):
            day_prefix = f"Day {di + 1}"

            if not day.get("label"):
                errors.append(f"{day_prefix}: missing label")
            if not day.get("name"):
                errors.append(f"{day_prefix}: missing name")

            exercises = day.get("exercises")
            if not exercises or not isinstance(exercises, list):
                errors.append(f"{day_prefix}: at least one exercise required")
                continue

            for ei, ex in enumerate(exercises):
                ex_prefix = f"{day_prefix}, Exercise {ei + 1}"

                if not ex.get("name"):
                    errors.append(f"{ex_prefix}: missing name")
                    continue

                ex_type_str = ex.get("type")
                try:
                    ex_type = ExerciseType(ex_type_str)
                except (ValueError, KeyError):
                    errors.append(f"{ex_prefix}: invalid type '{ex_type_str}'")
                    continue

                sets = ex.get("sets")
                if not sets or not isinstance(sets, list):
                    errors.append(f"{ex_prefix}: at least one set required")
                    continue

                for si, s in enumerate(sets):
                    set_prefix = f"{ex_prefix}, Set {si + 1}"
                    sk_str = s.get("set_kind")
                    try:
                        sk = SetKind(sk_str)
                    except (ValueError, KeyError):
                        errors.append(f"{set_prefix}: invalid set_kind '{sk_str}'")
                        continue

                    try:
                        validate_set_kind(sk, ex_type)
                    except ValueError as e:
                        errors.append(f"{set_prefix}: {e}")

                    self._validate_numeric_ranges(s, sk, set_prefix, errors)

        return errors

    def _validate_numeric_ranges(self, s: dict, sk: SetKind, prefix: str, errors: list) -> None:
        reps_min = s.get("reps_min")
        reps_max = s.get("reps_max")
        weight = s.get("weight")
        duration = s.get("duration_seconds")
        distance = s.get("distance")

        if reps_min is not None and (reps_min < 1 or reps_min > MAX_REPS):
            errors.append(f"{prefix}: reps_min must be 1-{MAX_REPS}")
        if reps_max is not None and (reps_max < 1 or reps_max > MAX_REPS):
            errors.append(f"{prefix}: reps_max must be 1-{MAX_REPS}")
        if reps_min is not None and reps_max is not None and reps_min > reps_max:
            errors.append(f"{prefix}: reps_min must be <= reps_max")
        if weight is not None and (weight < 0 or weight > MAX_WEIGHT):
            errors.append(f"{prefix}: weight must be 0-{MAX_WEIGHT}")
        if duration is not None and (duration < 1 or duration > MAX_DURATION):
            errors.append(f"{prefix}: duration_seconds must be 1-{MAX_DURATION}")
        if distance is not None and distance <= 0:
            errors.append(f"{prefix}: distance must be > 0")
        if sk == SetKind.CARDIO and duration is None and distance is None:
            errors.append(f"{prefix}: cardio sets require at least one of duration_seconds or distance")

    # --- Step 2: Import ---

    def import_routine(
        self,
        data: dict,
        exercise_mapping: Optional[Dict[str, int]] = None,
        activate: bool = False,
    ) -> int:
        """Import a validated routine. Returns new routine_id.

        Args:
            data: Validated import JSON.
            exercise_mapping: Optional dict mapping unmatched exercise names to existing
                exercise IDs. For unmatched names not in this mapping, new exercises are
                created. This is the user's decision from the preview step:
                - Map to existing: {"Bench Press": 42}
                - Create as new: omit from mapping (auto-created with type from file)
            activate: If True, activate the imported routine.
        """
        preview = self.preview_import(data)
        if not preview.is_valid:
            raise ImportValidationError(f"Validation failed: {'; '.join(preview.errors)}")

        if exercise_mapping is None:
            exercise_mapping = {}

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        from src.models.routine import Routine, RoutineDay, RoutineDayExercise, SetTarget

        routine = Routine(id=None, name=data["name"], is_active=False, created_at=now, updated_at=now)
        routine_id = self._routine_repo.create_routine(routine)

        for di, day_data in enumerate(data["days"]):
            day = RoutineDay(
                id=None, routine_id=routine_id,
                label=day_data["label"].strip(), name=day_data["name"].strip(),
                sort_order=di,
            )
            day_id = self._routine_repo.add_day(day)

            for ei, ex_data in enumerate(day_data["exercises"]):
                exercise = self._resolve_exercise(
                    ex_data["name"], ExerciseType(ex_data["type"]), exercise_mapping,
                )

                set_scheme_str = ex_data.get("set_scheme", "uniform")
                rde = RoutineDayExercise(
                    id=None, routine_day_id=day_id, exercise_id=exercise.id,
                    sort_order=ei, set_scheme=SetScheme(set_scheme_str),
                    notes=ex_data.get("notes"), is_optional=bool(ex_data.get("is_optional", False)),
                )
                rde_id = self._routine_repo.add_day_exercise(rde)

                targets = []
                for si, s in enumerate(ex_data["sets"]):
                    targets.append(SetTarget(
                        id=None, routine_day_exercise_id=rde_id,
                        set_number=si + 1, set_kind=SetKind(s["set_kind"]),
                        target_reps_min=s.get("reps_min"),
                        target_reps_max=s.get("reps_max"),
                        target_weight=s.get("weight"),
                        target_duration_seconds=s.get("duration_seconds"),
                        target_distance=s.get("distance"),
                    ))
                self._routine_repo.set_targets(rde_id, targets)

        # Import benchmarks if present
        benchmarking = data.get("benchmarking")
        if benchmarking and benchmarking.get("enabled"):
            default_freq = benchmarking.get("frequency_weeks", 6)
            for item in benchmarking.get("items", []):
                exercise = self._exercise_repo.get_by_name_insensitive(item["exercise_name"])
                if not exercise:
                    continue

                from src.models.benchmark import BenchmarkDefinition
                freq = item.get("frequency_weeks") or default_freq
                defn = BenchmarkDefinition(
                    id=None,
                    exercise_id=exercise.id,
                    method=BenchmarkMethod(item["method"]),
                    reference_weight=item.get("reference_weight"),
                    frequency_weeks=freq,
                    muscle_group_label=item.get("muscle_group_label", ""),
                )
                self._benchmark_repo.create_definition(defn)

        if activate:
            active = self._routine_repo.get_active_routine()
            if active:
                active.is_active = False
                active.updated_at = now
                self._routine_repo.update_routine(active)

            routine_obj = self._routine_repo.get_routine(routine_id)
            routine_obj.is_active = True
            routine_obj.updated_at = now
            self._routine_repo.update_routine(routine_obj)

        self._routine_repo.commit()
        return routine_id

    def _resolve_exercise(self, name: str, ex_type: ExerciseType, mapping: Dict[str, int]) -> Exercise:
        """Resolve an exercise name: mapping → name match → create new."""
        # 1. Check user-provided mapping
        if name in mapping:
            exercise = self._exercise_repo.get_by_id(mapping[name])
            if exercise:
                return exercise

        # 2. Case-insensitive name match
        existing = self._exercise_repo.get_by_name_insensitive(name)
        if existing:
            return existing

        # 3. Create new
        exercise = Exercise(id=None, name=name, type=ex_type)
        exercise.id = self._exercise_repo.create(exercise)
        return exercise
```

- [ ] **Step 2: Write `tests/test_import_export.py`**

```python
import pytest
import json
from src.services.import_export_service import ImportExportService, ImportValidationError, ImportPreview
from src.models.exercise import ExerciseType
from src.models.routine import SetScheme, SetKind
from src.models.benchmark import BenchmarkMethod


@pytest.fixture
def import_export_service(exercise_repo, routine_repo, benchmark_repo):
    return ImportExportService(exercise_repo, routine_repo, benchmark_repo)


def _minimal_valid_import():
    return {
        "schema_version": 1,
        "name": "Test Routine",
        "days": [
            {
                "label": "A",
                "name": "Push",
                "exercises": [
                    {
                        "name": "Bench Press",
                        "type": "reps_weight",
                        "set_scheme": "uniform",
                        "notes": None,
                        "is_optional": False,
                        "sets": [
                            {"set_kind": "reps_weight", "reps_min": 10, "reps_max": 10, "weight": 135},
                        ],
                    }
                ],
            }
        ],
    }


class TestImportPreview:
    """Tests for the two-step import: preview_import() is step 1."""

    def test_valid_preview(self, import_export_service):
        preview = import_export_service.preview_import(_minimal_valid_import())
        assert preview.is_valid is True
        assert preview.name == "Test Routine"
        assert preview.day_count == 1
        assert preview.errors == []

    def test_preview_shows_exercises_per_day(self, import_export_service):
        preview = import_export_service.preview_import(_minimal_valid_import())
        assert preview.exercises_per_day == [["Bench Press"]]

    def test_preview_shows_unmatched_exercises(self, import_export_service):
        preview = import_export_service.preview_import(_minimal_valid_import())
        assert len(preview.unmatched_exercises) == 1
        assert preview.unmatched_exercises[0]["name"] == "Bench Press"

    def test_preview_no_unmatched_when_exercise_exists(self, import_export_service, make_exercise):
        make_exercise("Bench Press")
        preview = import_export_service.preview_import(_minimal_valid_import())
        assert len(preview.unmatched_exercises) == 0

    def test_preview_shows_benchmark_summary(self, import_export_service):
        data = _minimal_valid_import()
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [{"exercise_name": "Bench Press", "method": "max_weight"}],
        }
        preview = import_export_service.preview_import(data)
        assert preview.benchmark_summary is not None
        assert preview.benchmark_summary["item_count"] == 1

    def test_preview_invalid_returns_errors(self, import_export_service):
        data = {"schema_version": 99}
        preview = import_export_service.preview_import(data)
        assert preview.is_valid is False
        assert len(preview.errors) > 0

    def test_missing_schema_version(self, import_export_service):
        data = _minimal_valid_import()
        del data["schema_version"]
        preview = import_export_service.preview_import(data)
        assert not preview.is_valid
        assert any("schema_version" in e for e in preview.errors)

    def test_no_days(self, import_export_service):
        data = _minimal_valid_import()
        data["days"] = []
        preview = import_export_service.preview_import(data)
        assert not preview.is_valid

    def test_duplicate_day_labels(self, import_export_service):
        data = _minimal_valid_import()
        data["days"].append({
            "label": "A", "name": "Also Push",
            "exercises": data["days"][0]["exercises"],
        })
        preview = import_export_service.preview_import(data)
        assert any("unique" in e.lower() for e in preview.errors)

    def test_invalid_exercise_type(self, import_export_service):
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["type"] = "invalid"
        preview = import_export_service.preview_import(data)
        assert any("invalid type" in e.lower() for e in preview.errors)

    def test_set_kind_incompatible(self, import_export_service):
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["sets"][0]["set_kind"] = "duration"
        preview = import_export_service.preview_import(data)
        assert any("not compatible" in e.lower() for e in preview.errors)

    def test_reps_out_of_range(self, import_export_service):
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["sets"][0]["reps_min"] = 0
        preview = import_export_service.preview_import(data)
        assert any("reps_min" in e for e in preview.errors)

    def test_reps_min_gt_reps_max(self, import_export_service):
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["sets"][0]["reps_min"] = 12
        data["days"][0]["exercises"][0]["sets"][0]["reps_max"] = 8
        preview = import_export_service.preview_import(data)
        assert any("reps_min must be <= reps_max" in e for e in preview.errors)

    def test_cardio_missing_duration_and_distance(self, import_export_service):
        data = {
            "schema_version": 1, "name": "Cardio",
            "days": [{"label": "A", "name": "Cardio", "exercises": [
                {"name": "Treadmill", "type": "cardio", "set_scheme": "uniform",
                 "sets": [{"set_kind": "cardio"}]}
            ]}],
        }
        preview = import_export_service.preview_import(data)
        assert any("at least one" in e.lower() for e in preview.errors)


class TestImportExecution:
    """Tests for step 2: import_routine() with optional exercise_mapping."""

    def test_import_creates_routine(self, import_export_service, routine_repo):
        data = _minimal_valid_import()
        routine_id = import_export_service.import_routine(data)
        routine = routine_repo.get_routine(routine_id)
        assert routine is not None
        assert routine.name == "Test Routine"
        assert routine.is_active is False

    def test_import_auto_creates_exercises(self, import_export_service, exercise_repo):
        data = _minimal_valid_import()
        import_export_service.import_routine(data)
        ex = exercise_repo.get_by_name("Bench Press")
        assert ex is not None
        assert ex.type == ExerciseType.REPS_WEIGHT

    def test_import_matches_existing_exercise(self, import_export_service, make_exercise, exercise_repo):
        make_exercise("Bench Press")
        data = _minimal_valid_import()
        import_export_service.import_routine(data)
        all_ex = exercise_repo.list_all()
        bench_count = sum(1 for e in all_ex if e.name == "Bench Press")
        assert bench_count == 1

    def test_import_case_insensitive_match(self, import_export_service, make_exercise, exercise_repo):
        make_exercise("bench press")
        data = _minimal_valid_import()
        import_export_service.import_routine(data)
        all_ex = exercise_repo.list_all()
        assert len(all_ex) == 1

    def test_import_with_exercise_mapping(self, import_export_service, make_exercise, exercise_repo, routine_repo):
        """User maps an unmatched exercise to an existing one via exercise_mapping."""
        existing = make_exercise("Flat Bench Press")
        data = _minimal_valid_import()  # Contains "Bench Press" which won't match "Flat Bench Press"
        routine_id = import_export_service.import_routine(
            data, exercise_mapping={"Bench Press": existing.id},
        )
        # Should use the mapped exercise, not create "Bench Press"
        assert exercise_repo.get_by_name("Bench Press") is None
        days = routine_repo.get_days(routine_id)
        rdes = routine_repo.get_day_exercises(days[0].id)
        assert rdes[0].exercise_id == existing.id

    def test_import_mapping_not_in_dict_creates_new(self, import_export_service, exercise_repo):
        """Exercises not in the mapping are auto-created."""
        data = _minimal_valid_import()
        import_export_service.import_routine(data, exercise_mapping={})
        ex = exercise_repo.get_by_name("Bench Press")
        assert ex is not None  # Created because not in mapping and not in catalog

    def test_import_creates_set_targets(self, import_export_service, routine_repo):
        data = _minimal_valid_import()
        routine_id = import_export_service.import_routine(data)
        days = routine_repo.get_days(routine_id)
        rdes = routine_repo.get_day_exercises(days[0].id)
        targets = routine_repo.get_targets(rdes[0].id)
        assert len(targets) == 1
        assert targets[0].target_weight == 135

    def test_import_with_activate(self, import_export_service, routine_repo):
        data = _minimal_valid_import()
        routine_id = import_export_service.import_routine(data, activate=True)
        routine = routine_repo.get_routine(routine_id)
        assert routine.is_active is True

    def test_import_validation_error_rejects(self, import_export_service):
        data = {"schema_version": 99}
        with pytest.raises(ImportValidationError):
            import_export_service.import_routine(data)

    def test_import_with_benchmarks(self, import_export_service, make_exercise, benchmark_repo):
        make_exercise("Bench Press")
        data = _minimal_valid_import()
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [
                {
                    "exercise_name": "Bench Press",
                    "method": "max_weight",
                    "reference_weight": None,
                    "muscle_group_label": "Upper",
                    "frequency_weeks": None,
                },
            ],
        }
        import_export_service.import_routine(data)
        defns = benchmark_repo.list_definitions()
        assert len(defns) == 1
        assert defns[0].frequency_weeks == 6

    def test_import_benchmark_frequency_override(self, import_export_service, make_exercise, benchmark_repo):
        make_exercise("Plank")
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["name"] = "Plank"
        data["days"][0]["exercises"][0]["type"] = "time"
        data["days"][0]["exercises"][0]["sets"] = [{"set_kind": "duration", "duration_seconds": 60}]
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [
                {
                    "exercise_name": "Plank",
                    "method": "timed_hold",
                    "reference_weight": None,
                    "muscle_group_label": "Core",
                    "frequency_weeks": 8,
                },
            ],
        }
        import_export_service.import_routine(data)
        defns = benchmark_repo.list_definitions()
        assert defns[0].frequency_weeks == 8


class TestExportRoutine:

    def test_round_trip(self, import_export_service, routine_repo):
        data = _minimal_valid_import()
        routine_id = import_export_service.import_routine(data)
        exported = import_export_service.export_routine(routine_id)

        assert exported["schema_version"] == 1
        assert exported["name"] == "Test Routine"
        assert len(exported["days"]) == 1
        assert exported["days"][0]["label"] == "A"
        assert len(exported["days"][0]["exercises"]) == 1
        assert exported["days"][0]["exercises"][0]["name"] == "Bench Press"

        exported["name"] = "Test Routine Copy"
        routine_id2 = import_export_service.import_routine(exported)
        assert routine_id2 != routine_id

    def test_progressive_export(self, import_export_service, routine_service, make_exercise, routine_repo):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)
        routine_service.set_progressive_targets(rde.id, [
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 12, "reps_max": 12, "weight": 50},
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 8, "reps_max": 8, "weight": 60},
        ])

        exported = import_export_service.export_routine(r.id)
        ex_data = exported["days"][0]["exercises"][0]
        assert ex_data["set_scheme"] == "progressive"
        assert len(ex_data["sets"]) == 2
        assert ex_data["sets"][0]["weight"] == 50
        assert ex_data["sets"][1]["weight"] == 60
```

- [ ] **Step 3: Run tests**

```bash
python -m pytest tests/test_import_export.py -v
```

Expected: All tests PASS.

- [ ] **Step 4: Run all tests**

```bash
python -m pytest tests/ -v
```

Expected: ALL tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/services/import_export_service.py tests/test_import_export.py
git commit -m "feat: import/export service with validation, exercise matching, round-trip, benchmarks"
```

---

## Task 7: Seed Data

**Files:**
- Create: `src/db/seed.py`

Dev-only seed data for default benchmark exercises. Not run in production.

- [ ] **Step 1: Create `src/db/seed.py`**

```python
"""Dev-only seed data — default benchmark exercises and sample data.

NOT run in production builds. Call seed_benchmarks() to populate
the default benchmark definitions from the spec.
"""
from src.models.exercise import Exercise, ExerciseType
from src.models.benchmark import BenchmarkDefinition, BenchmarkMethod
from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.benchmark_repo import BenchmarkRepo


DEFAULT_BENCHMARK_EXERCISES = [
    # Upper
    {"name": "Chest Press", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Upper"},
    {"name": "Shoulder Press", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Upper"},
    {"name": "Bicep Curl Machine", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Upper"},
    {"name": "Cable Tricep Pushdown", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Upper"},
    # Lower
    {"name": "Leg Extension", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    {"name": "Leg Curl", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    {"name": "Adductor", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    {"name": "Leg Press", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    {"name": "Calf Raise", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Lower"},
    # Back
    {"name": "Lat Pulldown", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Back"},
    {"name": "Seated Row", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Back"},
    # Core
    {"name": "Plank", "type": ExerciseType.TIME, "method": BenchmarkMethod.TIMED_HOLD, "group": "Core"},
    {"name": "Cable/Machine Crunch", "type": ExerciseType.REPS_WEIGHT, "method": BenchmarkMethod.MAX_WEIGHT, "group": "Core"},
]


def seed_benchmarks(exercise_repo: ExerciseRepo, benchmark_repo: BenchmarkRepo, frequency_weeks: int = 6) -> None:
    """Create default benchmark exercises and definitions.

    Skips exercises that already exist (by name, case-insensitive).
    """
    for item in DEFAULT_BENCHMARK_EXERCISES:
        existing = exercise_repo.get_by_name_insensitive(item["name"])
        if existing:
            exercise = existing
        else:
            exercise = Exercise(id=None, name=item["name"], type=item["type"])
            exercise.id = exercise_repo.create(exercise)

        defn = BenchmarkDefinition(
            id=None,
            exercise_id=exercise.id,
            method=item["method"],
            reference_weight=None,
            frequency_weeks=frequency_weeks,
            muscle_group_label=item["group"],
        )
        benchmark_repo.create_definition(defn)

    exercise_repo.commit()
```

- [ ] **Step 2: Commit**

```bash
git add src/db/seed.py
git commit -m "feat: seed data for default benchmark exercises"
```

---

## Verification Checkpoint

After completing all 8 tasks (1, 2, 3, 4, 5A, 5B, 6, 7), run the full test suite:

```bash
python -m pytest tests/ -v --tb=short
```

**Expected result:** All tests pass. The following modules are implemented and tested:

| Module | Key behaviors tested |
|--------|---------------------|
| Shared validation | Set_kind compatibility, cardio fields, AMRAP weight rules |
| Workout service | Session lifecycle (start/finish/end_early), single-session constraint, cycle advance on finish, zero-set no-advance, set logging with validation, edit/delete/add past sets, resequencing, snapshots, ON DELETE SET NULL |
| Settings + units | Key-value CRUD, lbs↔kg conversion, full-DB weight conversion (including max_weight benchmark results) |
| Benchmark service | Definition CRUD, due calculation (never tested + frequency), result recording with snapshots, snapshot preservation after definition edit |
| Stats 5A | Session count (zero-set excluded), last workout summary, weight history, best set, edit/delete updates stats, add set to past session |
| Stats 5B | Benchmark history trends, plan-vs-actual comparison (with and without targets), total volume trend |
| Import/export | Two-step API: preview_import (errors, warnings, unmatched exercises, benchmark summary) + import_routine (with exercise_mapping for manual mapping), validation, round-trip, benchmarks |
| Seed data | Default benchmark exercise creation |
