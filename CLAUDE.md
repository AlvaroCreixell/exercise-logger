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
