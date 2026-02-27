# Exercise Logger - Project Conventions

## Overview

Mobile workout logger for Android built with Python + Flet. Users define workout routines, log sets/reps/weight at the gym, track cardio, and run periodic benchmarks to measure progress. All data stored locally via SQLite.

## Tech Stack

- **Language:** Python 3.10+
- **Framework:** Flet (Flutter-based, builds to APK via `flet build apk`)
- **Database:** SQLite3 (stdlib, no ORM)
- **Charts:** Flet built-in charts (`flet-charts`)
- **Testing:** pytest
- **Target:** Android (primary), desktop (development)
- **Min Android:** API 23 (Android 6.0+)

## Architecture

Three-layer architecture. Each layer only calls the layer directly below it.

```
Views (UI) -> Services (business logic) -> Repositories (data access) -> SQLite
```

- **Views** (`src/views/`) - Flet UI components. Never run SQL directly.
- **Services** (`src/services/`) - Business logic. Call repositories, never render UI.
- **Repositories** (`src/repositories/`) - Raw SQL queries. Return dataclasses.
- **Models** (`src/models/`) - Pure dataclasses, 1:1 with DB tables. No behavior.
- **DB** (`src/db/`) - Connection management and schema definitions.

## Project Structure

```
src/
├── main.py              # Entry point
├── config.py            # Constants, DB path, defaults
├── models/              # Dataclasses (no logic)
├── db/                  # Connection + schema
├── repositories/        # SQL queries (one per aggregate)
├── services/            # Business logic
├── views/               # Flet UI
│   └── components/      # Reusable UI widgets
└── assets/              # Icons, images
tests/                   # pytest tests
```

## Coding Conventions

### Python
- Use `dataclasses` for all models. No Pydantic, no ORM.
- Use `Optional[type]` for nullable fields, not `type | None` (Python 3.10 compat).
- Use `Enum` classes for category/method types (not raw strings in app code).
- Use `from __future__ import annotations` in all model files.
- Raw SQL via `sqlite3` - no ORM, no query builder.
- Use parameterized queries (`?` placeholders) always. Never format SQL strings.

### Repositories
- One repository class per aggregate root (e.g., `RoutineRepo` handles routines + routine_days + routine_day_exercises).
- All repos extend `BaseRepository` which provides `_execute`, `_fetchone`, `_fetchall`, `_insert`.
- Return dataclass instances, not raw Row objects.
- Accept dataclass instances for inserts/updates.

### Services
- Accept and return dataclass instances.
- Contain all business logic (validation, cycle advancement, benchmark due-date checks).
- Receive repository instances via constructor injection.

### Views (Flet UI)
- Each view is a function or class that returns a `ft.View`.
- Use route-based navigation: `page.go("/route")`.
- Bottom NavigationBar for main tabs (Home, Workout, Progress, Settings).
- Mobile-first: large touch targets, number steppers, minimal typing.
- Dark theme default.

### Database
- All datetimes stored as ISO 8601 text (`datetime('now')`).
- Weights stored in user's preferred unit (lbs or kg). Single unit, no per-row unit column.
- On unit change: convert ALL historical weights in a single transaction.
- Foreign keys enforced (`PRAGMA foreign_keys=ON`).
- WAL mode enabled (`PRAGMA journal_mode=WAL`).
- Use `FLET_APP_DATA` env var for DB path on Android, fallback to local dir on desktop.
- Every logged set/cardio is committed to DB immediately (not held in memory). This enables session recovery.

## Key Design Decisions

1. **Per-set logging** - Each set is its own row in `logged_sets`. Makes trend queries trivial.
2. **Template vs Log separation** - Routine definitions (templates) and workout logs are independent table hierarchies. Editing a routine never rewrites history.
3. **Soft-delete exercises** - `is_archived` flag instead of DELETE. Preserves referential integrity with historical logs.
4. **Routine cycling** - Modulo counter in `routine_cycle_state` table. Auto-advances on Finish Workout only (not on Start). Manual override supported.
5. **Benchmark methods** - Single table with `method` enum column + nullable params. Three methods: `max_weight`, `reps_to_failure`, `timed_hold`.
6. **Separate cardio table** - `logged_cardio` vs `logged_sets` because the columns are completely different. Avoids NULL-heavy rows.
7. **Session recovery** - `workout_sessions.status` tracks `in_progress`/`finished`/`abandoned`. Logged data is persisted immediately. On app launch, detect and offer to resume in-progress sessions.
8. **Append-only logs** - No editing past workout logs in MVP. Simplifies data integrity.
9. **No session_type column** - Whether a session is routine vs benchmark is inferred from its data, not stored redundantly.
10. **Benchmark due = computed** - Due-ness computed from `MAX(tested_at) + frequency_weeks`, not stored as `next_due_at`. Avoids stale data.

## Behavioral Rules

- Cycle advances on **Finish Workout** only, never on Start.
- Manual day pick updates cycle state; after finishing, advance is relative to the picked day.
- Only ONE `in_progress` session at a time.
- Ad-hoc exercises allowed during routine workouts (`routine_day_exercise_id=NULL`).
- Benchmark due = never tested OR `days_since_last >= frequency_weeks * 7`. Anchor is last completion date.
- Benchmarks can be completed across multiple sessions (no batch requirement).
- Weight unit conversion: all historical weights multiplied by factor, single transaction, confirmation required.
- One active routine at a time (enforced in app logic).

## Commands

```bash
# Run app (desktop, for development)
flet run src/main.py

# Run tests
pytest tests/

# Build Android APK
flet build apk

# Install on Android device
adb install build/apk/app-release.apk
```

## Testing

- Use in-memory SQLite (`:memory:`) for all tests.
- Shared fixtures in `tests/conftest.py` for DB setup and sample data.
- Test services and repositories, not views (UI tested manually on device).
- Focus tests on: cycle logic edge cases, benchmark due-date calculation, session recovery, query correctness, unit conversion.

## MVP Scope

### In scope
Routine editor, workout logging (weight + cardio), auto-cycle, session recovery, ad-hoc exercises, benchmark system (3 methods, multi-day completion, due alerts), basic progress charts, JSON data export, weight unit toggle with conversion, dark theme.

### Deferred
RPE, heart rate, streak stats, exercise taxonomy filtering UI, dashboard stats, edit past logs, multiple active routines, rest timer, cloud sync, CSV export.

## Documentation

- `CLAUDE.md` (this file) - Project conventions for Claude.
- `PLANS.md` - Detailed design document with data models, SQL schema, behavioral decisions, architecture rationale.
- Keep both files updated as the project evolves.
