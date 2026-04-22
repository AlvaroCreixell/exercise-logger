# Consolidated Audit Report: Exercise Logger

**Date:** 2026-03-24
**Auditors:** Claude (backend/schema focus), Codex (UI/screen focus)
**Codebase:** exercise_logger @ branch `phase-2-fixes`
**Test Suite:** 168/168 passing

---

## Executive Summary

The backend is production-quality. All models, repositories, services, and schema are well-implemented with 168 passing tests covering session lifecycle, cycle management, import/export validation, stats queries, and unit conversion. Intentional drift from spec is well-documented and represents reasonable design improvements.

The primary weakness is the UI layer. Phase 3 screen implementations simplified away spec features that the backend fully supports — AMRAP sets, rep ranges, reference weights, exercise-type-aware analytics. Three bugs cause broken user-visible behavior. Coverage of `src/screens/**/*` is 0% automated (expected per project conventions: "Test services and repos, not screens").

---

## Test Status

```
168/168 tests passing (1.12s)
```

| Test File | Tests | Scope |
|-----------|-------|-------|
| `test_db_schema.py` | 11 | Table creation, CHECKs, cascades, lifecycle |
| `test_exercise_service.py` | 12 | CRUD, duplicate validation, archive |
| `test_cycle_service.py` | 11 | Initialize, advance, wrap, delete handling |
| `test_routine_service.py` | 30 | Routines, days, exercises, targets, validation, cascade |
| `test_workout_service.py` | 20 | Session lifecycle, set logging, snapshots, ON DELETE |
| `test_settings_and_units.py` | 8 | Unit conversion, settings CRUD, DB-wide weight conversion |
| `test_benchmark_service.py` | 10 | Definitions, due calculation, snapshots, delete |
| `test_stats_service.py` | 14 | Session counts, PRs, weight history, plan-vs-actual, volume |
| `test_import_export.py` | 33 | Preview, validation, execution, round-trip, regressions |

Backend e2e smoke test (run manually): create routine/day/targets, activate, start session, log sets, finish, query stats, record benchmark, export routine, convert units — all passed.

---

## What Works

- **Session lifecycle** — `in_progress` / `finished` / `completed_fully` tri-state enforced by DB CHECK constraint
- **Cycle management** — advance, wrap, manual override, day deletion handling all correct
- **Zero-set session filtering** — consistently excluded from all stats (session counts, volume, PRs, last workout)
- **Snapshot preservation** — day_label, day_name, exercise_name, benchmark method/weight all captured
- **Plan-vs-actual linking** — `exercise_set_target_id` properly links logged sets to plan targets
- **Sort order resequencing** — tested for days, exercises, and logged sets
- **Cascade deletes** — routine -> days -> exercises -> targets all CASCADE correctly
- **ON DELETE SET NULL** — session history survives routine/day/exercise deletion
- **Weight unit conversion** — converts all 5 weight columns including max_weight benchmark results
- **Import validation** — comprehensive: schema version, unique labels, type compatibility, numeric ranges, AMRAP, cardio
- **Import exercise resolution** — user mapping -> case-insensitive match -> create new
- **Import rollback on failure** — tested and working
- **UI shell & navigation** — 4-tab bottom nav, manage drill-in, workout accordion cards, bottom sheets
- **Workout logging flow** — start session, expand card, adjust steppers, log set, repeat last, edit/delete chips, finish/end early (all with confirmations in workout screen)

---

## Findings: Prioritized

### P0 — Broken Behavior (Users Will Hit These)

| # | Issue | Auditor | File | Details |
|---|-------|---------|------|---------|
| 1 | **Dashboard false empty state** | Codex | `dashboard_screen.py:79` | Gates empty state on `get_sessions_this_week() == 0 and get_sessions_this_month() == 0`. User who logged workouts last week sees "No workouts yet." Should use all-time `get_session_count()`. |
| 2 | **Home "End" button skips confirmation** | Codex | `home_screen.py:101-106` | Tapping "End" on in-progress banner directly calls `end_early()`. TODO comment acknowledges this was punted from 3A. Every other destructive action uses `AppBottomSheet` confirmation. |

### P1 — Spec Features Missing from UI (Backend Supports, UI Doesn't Expose)

| # | Issue | Auditor | File | Details |
|---|-------|---------|------|---------|
| 3 | **Target editor: no AMRAP sets** | Codex | `routine_editor_screen.py:998` | `_DEFAULT_SET_KIND` hardcodes one SetKind per exercise type. No way to create an AMRAP set. Backend `SetKind.AMRAP` and all validation fully support it. |
| 4 | **Target editor: no rep ranges** | Codex | `routine_editor_screen.py:1004-1005` | Always sets `reps_min = reps_max`. No UI for entering a range like "8-12". Backend supports `target_reps_min != target_reps_max`. |
| 5 | **Target editor: silent validation swallow** | Codex | `routine_editor_screen.py:1034` | `except ValueError: pass` — user gets no feedback when save fails. Sheet dismisses, nothing happens. |
| 6 | **Benchmark setup: no `reference_weight`** | Codex | `benchmark_setup_screen.py:325-330` | `max_reps` benchmarks need a reference weight ("max reps at 100 lbs"). Field exists in model/service/schema but never appears in UI. |
| 7 | **Export omits benchmarking section** | Claude | `import_export_service.py:62-105` | `export_routine()` only exports routine structure. Import handles `benchmarking` block but export doesn't produce one. Round-trip loses benchmarks. |

### P2 — Analytics / Display Gaps

| # | Issue | Auditor | File | Details |
|---|-------|---------|------|---------|
| 8 | **Stats/detail views are weight-centric** | Codex | `stats_service.py`, `exercise_detail_screen.py` | `get_exercise_best_set()` sorts by weight only. For `reps_only` (weight=0), `time` (no weight), and `cardio` (duration/distance) exercises, dashboard shows nothing useful. Need exercise-type-aware stats methods and detail rendering. |
| 9 | **Import preview doesn't show benchmark summary** | Codex | `import_export_screen.py:240-345` | `preview.benchmark_summary` is computed by service but never rendered in the import preview UI. |

### P3 — Schema / Architecture

| # | Issue | Auditor | File | Details |
|---|-------|---------|------|---------|
| 10 | **`benchmark_results` FK missing CASCADE** | Claude | `schema.py:119` | Spec says `ON DELETE CASCADE` on `benchmark_definition_id`. Schema has none (defaults NO ACTION). Repo works around it with manual delete at `benchmark_repo.py:47-48`, but it's fragile. |
| 11 | **`StatsService.get_benchmark_history()` crosses repo boundary** | Claude | `stats_service.py:104` | Uses `self._workout_repo._fetchall()` to query `benchmark_results` table. Should go through `benchmark_repo`. |
| 12 | **Test gap: benchmark delete with results** | Claude | `test_benchmark_service.py:96-100` | `test_delete_definition` creates a definition without results. The manual cascade workaround is untested. |

### P4 — Cleanup / Minor

| # | Issue | Auditor | File | Details |
|---|-------|---------|------|---------|
| 13 | **Unstaged `src/views/` deletions** | Claude | git status | 7 files showing deleted in working tree, not staged. Old directory from rename to `src/screens/`. |
| 14 | **`get_recent_prs()` naming misleading** | Claude | `stats_service.py:137` | Returns all-time bests per exercise, not "when was a PR set." True PR detection deferred to Phase 4. |
| 15 | **Redundant EXISTS in `get_exercise_logged_sets`** | Claude | `workout_repo.py:197-200` | Already JOINing through `logged_sets`, EXISTS is a no-op. Harmless but adds query cost. |

---

## Intentional Drift (Accepted)

These are spec-to-implementation deviations that represent reasonable design improvements. They do NOT need fixing.

| Area | Spec | Implementation | Rationale |
|------|------|---------------|-----------|
| ExerciseRepo API | `get_all()` + `get_archived()` | `list_all(include_archived)` | Simpler API |
| Method names | `restore()` | `unarchive()` | Clearer name |
| Set target CRUD | Individual create/update/delete | `set_targets()` replaces all atomically | Simpler, safer |
| Session start | Single `start_session()` with params | `start_routine_session()` / `start_benchmark_session()` | Clearer intent |
| `log_set()` | Takes `session_id + exercise_id` | Takes `session_exercise_id` | Better separation |
| Stats return types | `get_sessions_this_week()` -> `List[WorkoutSession]` | Returns `int` count | UI only needs count |
| Volume trend | `get_total_volume_trend(days=30)` | `get_total_volume_trend(weeks=8)` | Weekly grouping |
| Seed data | Method on BenchmarkService | Standalone `seed_benchmarks()` | Proper separation |
| DB path | Project-local | `~/.exercise_logger/` on desktop | Standard user data dir |

---

## Acknowledged Deferrals (Phase 4 Backlog)

These were explicitly deferred during planning. They are NOT drift — they're scoped out.

- Benchmark session UI (separate logging flow for max_weight / max_reps / timed_hold)
- Full DB backup/restore (file-system operations)
- Multi-method benchmark charts (multiple trend lines per exercise)
- True PR detection as time-series events (when was a new max set?)
- Distance unit toggle (km <-> miles) — only weight unit toggle implemented

---

## Fix Roadmap

### Pass 1: Fix Broken + Dangerous (Issues #1, #2, #5)
**Plan:** `docs/superpowers/plans/2026-03-24-hardening-pass1-broken-and-dangerous.md`
**Scope:** Dashboard empty state fix, Home End confirmation, target editor error surfacing
**Effort:** ~1 session

### Pass 2: Complete Spec Fidelity (Issues #3, #4, #6, #7, #8, #9)
**Scope:** AMRAP/rep range UI in target editor, benchmark reference_weight, export benchmarks, exercise-type-aware stats, import preview benchmark summary
**Effort:** ~1-2 sessions

### Pass 3: Schema + Code Quality (Issues #10, #11, #12, #13, #14, #15)
**Scope:** Add CASCADE to benchmark FK, fix repo boundary violation, add missing test, git cleanup
**Effort:** ~1 session

---

## Scorecard

| Layer | Grade | Notes |
|-------|-------|-------|
| Models | A+ | All fields match spec, enums correct |
| Schema | A- | One missing CASCADE on benchmark_results |
| Repositories | A | Clean, well-structured |
| Services | A+ | All business logic correct, validation thorough |
| Tests | A | 168 passing, 2-3 gaps identified |
| Import/Export | A- | Import excellent, export missing benchmarks |
| Screens/UI | B | Functional for basic flow, missing spec features |
| Spec Fidelity | B+ | Backend: A+. UI: B-. Intentional drift documented. |
| **Overall** | **A-** | Solid backend, UI needs hardening pass |
