# Hardening Pass 3: Schema + Code Quality (Revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining 5 audit items: a missing DB CASCADE, a repo layer violation, a test gap, a redundant SQL clause, and a misleading function name. Git cleanup (issue #13) is deferred to a standalone commit outside this pass.

**Architecture:** Tasks 1-2 are TDD (schema + tests). Task 3 is a service refactor. Tasks 4-5 are low-risk cleanup/rename. All tasks are independent except Task 2 depends on Task 1 (must run after). No new files created.

**Key decision — Task 1 migration safety:** This app is pre-release with no production installs. All tests use fresh in-memory DBs. However, to be defensive: add the CASCADE to the schema AND keep the manual delete in `benchmark_repo.py` as belt-and-suspenders. A comment explains why both exist. This is safe for both fresh and hypothetical existing DBs where `CREATE TABLE IF NOT EXISTS` won't alter the FK.

**Tech Stack:** Python 3.10+, pytest, SQLite (in-memory for tests)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/db/schema.py` | Modify | Add ON DELETE CASCADE to benchmark_results FK |
| `tests/test_db_schema.py` | Modify | Test CASCADE on benchmark definition delete |
| `tests/test_benchmark_service.py` | Modify | Test delete definition with results |
| `src/services/stats_service.py` | Modify | Route benchmark_history through benchmark_repo; rename PRs method |
| `tests/conftest.py` | Modify | Add benchmark_repo to stats_service fixture |
| `src/main.py` | Modify | Pass benchmark_repo to StatsService constructor |
| `src/repositories/workout_repo.py` | Modify | Remove redundant EXISTS |
| `src/screens/dashboard/dashboard_screen.py` | Modify | Update method call + label text |
| `tests/test_stats_service.py` | Modify | Update test name for renamed method |

---

### Task 1: Add ON DELETE CASCADE to benchmark_results FK

**Audit issue #10.** Spec says `ON DELETE CASCADE` on `benchmark_definition_id`. Schema has none (defaults NO ACTION).

**Migration note:** `CREATE TABLE IF NOT EXISTS` does not alter existing tables. The CASCADE only takes effect on fresh DBs (including all test runs). The manual delete in `benchmark_repo.py` is kept as a safety net for any hypothetical existing installs. A comment documents this.

**Files:**
- Modify: `src/db/schema.py:119`
- Modify: `src/repositories/benchmark_repo.py:46-49`
- Modify: `tests/test_db_schema.py`

- [ ] **Step 1: Write test — CASCADE deletes results when definition deleted**

Add to `TestSchema` in `tests/test_db_schema.py`:

```python
def test_cascade_delete_benchmark_definition_removes_results(self, db_conn):
    """Deleting a benchmark definition cascades to its results."""
    db_conn.execute(
        "INSERT INTO exercises (name, type) VALUES (?, ?)",
        ("Bench Press", "reps_weight"),
    )
    ex_id = db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    db_conn.execute(
        "INSERT INTO benchmark_definitions (exercise_id, method, frequency_weeks, muscle_group_label) VALUES (?, ?, ?, ?)",
        (ex_id, "max_weight", 6, "Upper"),
    )
    defn_id = db_conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    db_conn.execute(
        "INSERT INTO benchmark_results (benchmark_definition_id, method_snapshot, result_value, tested_at) VALUES (?, ?, ?, ?)",
        (defn_id, "max_weight", 185.0, "2026-01-01T00:00:00"),
    )
    db_conn.commit()

    db_conn.execute("DELETE FROM benchmark_definitions WHERE id = ?", (defn_id,))
    db_conn.commit()

    results = db_conn.execute(
        "SELECT * FROM benchmark_results WHERE benchmark_definition_id = ?", (defn_id,)
    ).fetchall()
    assert len(results) == 0
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pytest tests/test_db_schema.py::TestSchema::test_cascade_delete_benchmark_definition_removes_results -v
```
Expected: FAIL — FK violation or orphaned rows.

- [ ] **Step 3: Add CASCADE to schema**

In `src/db/schema.py`, line 119, change:

```python
        benchmark_definition_id INTEGER NOT NULL REFERENCES benchmark_definitions(id),
```

To:

```python
        benchmark_definition_id INTEGER NOT NULL REFERENCES benchmark_definitions(id) ON DELETE CASCADE,
```

- [ ] **Step 4: Update benchmark_repo comment (keep manual delete)**

In `src/repositories/benchmark_repo.py`, replace lines 46-49:

```python
    def delete_definition(self, defn_id: int) -> None:
        # Delete results first (FK has no CASCADE)
        self._execute("DELETE FROM benchmark_results WHERE benchmark_definition_id = ?", (defn_id,))
        self._execute("DELETE FROM benchmark_definitions WHERE id = ?", (defn_id,))
```

With:

```python
    def delete_definition(self, defn_id: int) -> None:
        # Schema has ON DELETE CASCADE for fresh DBs. Manual delete kept as
        # belt-and-suspenders for existing DBs where CREATE TABLE IF NOT EXISTS
        # won't alter the FK constraint. Safe to remove after a proper migration.
        self._execute("DELETE FROM benchmark_results WHERE benchmark_definition_id = ?", (defn_id,))
        self._execute("DELETE FROM benchmark_definitions WHERE id = ?", (defn_id,))
```

- [ ] **Step 5: Run all tests**

```bash
pytest tests/ -v --tb=short
```
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.py src/repositories/benchmark_repo.py tests/test_db_schema.py
git commit -m "fix: add ON DELETE CASCADE to benchmark_results FK, keep manual delete for safety"
```

---

### Task 2: Test Benchmark Delete with Results at Service Level

**Audit issue #12.** `test_delete_definition` never creates results before deleting.

**Files:**
- Modify: `tests/test_benchmark_service.py`

- [ ] **Step 1: Write test**

Add to `TestBenchmarkService` in `tests/test_benchmark_service.py`:

```python
def test_delete_definition_with_results(self, benchmark_service, make_exercise):
    """Deleting a definition also removes its recorded results."""
    ex = make_exercise("Bench Press")
    defn = benchmark_service.create_definition(ex.id, BenchmarkMethod.MAX_WEIGHT, "Upper")
    benchmark_service.record_result(defn.id, 185.0)
    benchmark_service.record_result(defn.id, 195.0)

    results = benchmark_service.get_results(defn.id)
    assert len(results) == 2

    benchmark_service.delete_definition(defn.id)
    assert benchmark_service.get_definition(defn.id) is None
    assert len(benchmark_service.get_results(defn.id)) == 0
```

- [ ] **Step 2: Run test**

```bash
pytest tests/test_benchmark_service.py::TestBenchmarkService::test_delete_definition_with_results -v
```
Expected: PASS (manual delete in repo handles it; CASCADE also handles it on fresh DBs).

- [ ] **Step 3: Commit**

```bash
git add tests/test_benchmark_service.py
git commit -m "test: verify benchmark delete cascades to results at service level"
```

---

### Task 3: Fix StatsService Repo Boundary Violation

**Audit issue #11.** `get_benchmark_history()` queries `benchmark_results` via `self._workout_repo._fetchall()` — crossing repo boundaries.

**Note:** `benchmark_repo` is a **required** parameter, not optional. Both call sites (conftest + main.py) already have it available.

**Files:**
- Modify: `src/services/stats_service.py:8-15,155-167`
- Modify: `tests/conftest.py:108-109`
- Modify: `src/main.py:105`

- [ ] **Step 1: Add `benchmark_repo` as required dependency**

In `src/services/stats_service.py`, add import after line 9:

```python
from src.repositories.benchmark_repo import BenchmarkRepo
```

Update constructor (lines 12-15):

```python
class StatsService:
    def __init__(self, workout_repo: WorkoutRepo, exercise_repo: ExerciseRepo, benchmark_repo: BenchmarkRepo):
        self._workout_repo = workout_repo
        self._exercise_repo = exercise_repo
        self._benchmark_repo = benchmark_repo
```

No default value — required parameter.

- [ ] **Step 2: Replace `get_benchmark_history` to use benchmark_repo**

Replace lines 155-167:

```python
    def get_benchmark_history(self, defn_id: int) -> List[dict]:
        """Benchmark results over time for charts.

        Returns list of dicts: {tested_at, result_value, method_snapshot, reference_weight_snapshot}
        """
        rows = self._workout_repo._fetchall(
            """SELECT tested_at, result_value, method_snapshot, reference_weight_snapshot
               FROM benchmark_results
               WHERE benchmark_definition_id = ?
               ORDER BY tested_at""",
            (defn_id,),
        )
        return [dict(r) for r in rows]
```

With:

```python
    def get_benchmark_history(self, defn_id: int) -> List[dict]:
        """Benchmark results over time for charts.

        Returns list of dicts: {tested_at, result_value, method_snapshot, reference_weight_snapshot}
        """
        results = self._benchmark_repo.get_results(defn_id)
        # get_results returns newest-first (DESC); charts need oldest-first
        return [
            {
                "tested_at": r.tested_at,
                "result_value": r.result_value,
                "method_snapshot": r.method_snapshot.value,
                "reference_weight_snapshot": r.reference_weight_snapshot,
            }
            for r in reversed(results)
        ]
```

- [ ] **Step 3: Update conftest fixture**

In `tests/conftest.py`, lines 108-109:

```python
@pytest.fixture
def stats_service(workout_repo, exercise_repo, benchmark_repo):
    return StatsService(workout_repo, exercise_repo, benchmark_repo)
```

- [ ] **Step 4: Update main.py**

In `src/main.py`, line 105:

```python
        self.stats_service = StatsService(workout_repo, exercise_repo, benchmark_repo)
```

- [ ] **Step 5: Run all tests**

```bash
pytest tests/ -v --tb=short
```

- [ ] **Step 6: Commit**

```bash
git add src/services/stats_service.py tests/conftest.py src/main.py
git commit -m "fix: route benchmark_history through benchmark_repo, make it a required dependency"
```

---

### Task 4: Remove Redundant EXISTS in get_exercise_logged_sets

**Audit issue #15.** Low-risk behavior-preserving refactor. The query JOINs through `logged_sets`, so the EXISTS subquery is always true. Existing tests cover correctness.

**Files:**
- Modify: `src/repositories/workout_repo.py:190-204`

- [ ] **Step 1: Remove the EXISTS clause**

In `src/repositories/workout_repo.py`, replace lines 190-204:

```python
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
```

With:

```python
        rows = self._fetchall(
            """SELECT ls.*, se.exercise_id, ws.started_at as session_started_at
               FROM logged_sets ls
               JOIN session_exercises se ON ls.session_exercise_id = se.id
               JOIN workout_sessions ws ON se.session_id = ws.id
               WHERE se.exercise_id = ?
               AND ws.status = 'finished'
               ORDER BY ws.started_at DESC, ls.set_number
               LIMIT ?""",
            (exercise_id, limit),
        )
```

- [ ] **Step 2: Run all tests**

```bash
pytest tests/ -v --tb=short
```
Expected: All pass — behavior unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/repositories/workout_repo.py
git commit -m "refactor: remove redundant EXISTS in get_exercise_logged_sets"
```

---

### Task 5: Rename get_recent_prs + Update UI Label

**Audit issue #14.** The method returns all-time bests, not "recent PR events." The dashboard label should match.

**Files:**
- Modify: `src/services/stats_service.py` (rename + alias)
- Modify: `src/screens/dashboard/dashboard_screen.py` (call site + label)
- Modify: `tests/test_stats_service.py` (test name)

- [ ] **Step 1: Rename method in stats_service.py**

In `src/services/stats_service.py`, rename `get_recent_prs` (line 193) to `get_personal_bests`:

```python
    def get_personal_bests(self, limit: int = 5) -> List[dict]:
        """Personal bests across all exercise types, most recent first.

        Note: returns all-time bests per exercise, not PR events.
        True time-series PR detection is deferred to Phase 4.
        """
```

Keep the old name as alias after the method:

```python
    # Alias for backward compatibility
    get_recent_prs = get_personal_bests
```

- [ ] **Step 2: Update dashboard — call site AND label**

In `src/screens/dashboard/dashboard_screen.py`:

Line 129 — change method call:
```python
        prs = self.app.stats_service.get_personal_bests(3)
```

Line 132 — change label text:
```python
                text="Personal Bests",
```

- [ ] **Step 3: Update test name**

In `tests/test_stats_service.py`, rename `test_recent_prs_includes_non_weight` to `test_personal_bests_includes_non_weight` and update the call:

```python
    def test_personal_bests_includes_non_weight(self, stats_service, workout_service, routine_service, make_exercise):
        ...
        prs = stats_service.get_personal_bests(10)
        ...
```

- [ ] **Step 4: Run all tests + compile**

```bash
pytest tests/ -v --tb=short && python -m compileall src/screens/dashboard/dashboard_screen.py -q
```

- [ ] **Step 5: Commit**

```bash
git add src/services/stats_service.py src/screens/dashboard/dashboard_screen.py tests/test_stats_service.py
git commit -m "refactor: rename get_recent_prs to get_personal_bests, update dashboard label"
```

---

## Verification Checkpoint

After all five tasks:

```bash
pytest tests/ -v --tb=short && python -m compileall src -q
```

Expected: All tests pass (~191 total). All source compiles.

### What was NOT included (deliberate)

- **Git cleanup (issue #13):** Deferred. Staging working-tree deletions and untracked docs is branch housekeeping, not product hardening. Do it as a standalone commit.
