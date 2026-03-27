# Phase 4: Bundled Data + Packaging + QA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the v2 rewrite for deployment. Create all bundled data files (exercise CSV, routine YAML templates, benchmark YAML config), update the Buildozer spec for the new architecture, update the GitHub Actions CI workflow, write an integration test covering the full stack, and produce a device QA checklist.

**Architecture:** Phases 1-3 built the complete app: models, DB schema, repos, registries, loaders, services, and screens. This phase fills in the data files those loaders consume, updates the build pipeline, and validates the full stack end-to-end.

**Tech Stack:** Python 3.10+, Kivy 2.3.1, KivyMD 2.x (pinned commit), SQLite3 (stdlib), pytest, PyYAML, Buildozer.

**Spec reference:** `docs/superpowers/specs/2026-03-26-exercise-logger-v2-simplified.md`

---

## Dependency Map

```
Task 1:  Exercise catalog CSV              → independent (data only)
Task 2:  Routine YAML templates            → needs Task 1 (exercise keys)
Task 3:  Benchmark YAML config             → needs Task 1 (exercise keys)
Task 4:  Buildozer spec                    → independent (build config)
Task 5:  GitHub Actions workflow           → needs Task 4 (references buildozer.spec)
Task 6:  Integration test                  → needs Tasks 1, 2, 3 (loads bundled data)
Task 7:  Device QA checklist               → needs all above (manual testing guide)
```

Each task produces independently committable artifacts.

---

## File Map

```
src/
├── data/
│   ├── exercises.csv                    # NEW — full exercise catalog (v2 format)
│   ├── benchmarks.yaml                  # NEW — benchmark config with exercise keys
│   └── routines/
│       ├── push_pull_legs.yaml          # NEW — PPL 3-day split template
│       └── upper_lower.yaml             # NEW — Upper/Lower 2-day split template

buildozer.spec                           # MODIFY — v2 file structure, new deps, data files

.github/
└── workflows/
    └── build-apk.yml                    # MODIFY — updated for v2

tests/
└── test_integration.py                  # NEW — end-to-end bundled data + session + stats
```

---

## Task 1: Exercise Catalog CSV

**File:** `src/data/exercises.csv`

**Source:** `docs/exercises/gym_exercises_catalog.csv` (80 exercises). Convert to v2 format and add cardio exercises.

**Type mapping rules:**
- `Weight` -> `reps_weight`
- `Bodyweight` -> `reps_weight`
- `Isometric` -> `time`
- Cardio exercises added manually (type = `cardio`)

**Key generation:** `snake_case` of `Name` column. Hyphens become underscores, special characters dropped. Examples: `Pull-Up` -> `pull_up`, `Farmer's Carry` -> `farmers_carry`, `2km Rowing` -> `2km_rowing`.

- [ ] **Step 1: Create `src/data/` directory structure**

  ```bash
  mkdir -p src/data/routines
  ```

- [ ] **Step 2: Create `src/data/exercises.csv`**

  Write the complete CSV with all exercises. 5 columns: `key`, `name`, `type`, `equipment`, `muscle_group`.

  The complete file:

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
  chest_press_machine,Chest Press Machine,reps_weight,Machine,Chest
  pec_deck,Pec Deck / Fly Machine,reps_weight,Machine,Chest
  leg_press,Leg Press,reps_weight,Machine,Legs
  leg_extension,Leg Extension,reps_weight,Machine,Legs
  leg_curl,Leg Curl,reps_weight,Machine,Legs
  calf_raise_machine,Calf Raise Machine,reps_weight,Machine,Legs
  adductor_machine,Adductor Machine,reps_weight,Machine,Legs
  abductor_machine,Abductor Machine,reps_weight,Machine,Legs
  shoulder_press_machine,Shoulder Press Machine,reps_weight,Machine,Shoulders
  reverse_pec_deck,Reverse Pec Deck,reps_weight,Machine,Shoulders
  lat_pulldown,Lat Pulldown,reps_weight,Machine / Cable,Back
  seated_cable_row,Seated Cable Row,reps_weight,Cable,Back
  t_bar_row,T-Bar Row,reps_weight,Machine,Back
  tricep_pushdown,Tricep Pushdown,reps_weight,Cable,Arms
  cable_curl,Cable Curl,reps_weight,Cable,Arms
  cable_crossover,Cable Crossover,reps_weight,Cable,Chest
  face_pull,Face Pull,reps_weight,Cable,Shoulders
  cable_lateral_raise,Cable Lateral Raise,reps_weight,Cable,Shoulders
  cable_crunch,Cable Crunch,reps_weight,Cable,Core
  kettlebell_swing,Kettlebell Swing,reps_weight,Kettlebell,Legs / Back
  farmers_carry,Farmer's Carry,reps_weight,Kettlebell / Dumbbell,Full Body
  pull_up,Pull-Up,reps_weight,Bodyweight,Back
  chin_up,Chin-Up,reps_weight,Bodyweight,Back
  inverted_row,Inverted Row,reps_weight,Bodyweight,Back
  push_up,Push-Up,reps_weight,Bodyweight,Chest
  wide_push_up,Wide Push-Up,reps_weight,Bodyweight,Chest
  diamond_push_up,Diamond Push-Up,reps_weight,Bodyweight,Arms
  decline_push_up,Decline Push-Up,reps_weight,Bodyweight,Chest
  pike_push_up,Pike Push-Up,reps_weight,Bodyweight,Shoulders
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

  **Total: 83 exercises** (70 reps_weight + 8 time + 5 cardio — note: 1 more cardio than the catalog's 80 since we manually added 5 cardio exercises)

- [ ] **Step 3: Validate all keys are unique**

  Quick check — run in Python or use a test:
  ```python
  import csv
  with open("src/data/exercises.csv") as f:
      keys = [row["key"] for row in csv.DictReader(f)]
  assert len(keys) == len(set(keys)), f"Duplicate keys: {[k for k in keys if keys.count(k) > 1]}"
  ```

- [ ] **Step 4: Validate all types are valid**

  Every `type` value must be one of `reps_weight`, `time`, `cardio`.

- [ ] **Step 5: Verify loader accepts the file**

  Run the exercise loader (from Phase 1) against `src/data/exercises.csv` and confirm it loads all exercises into the registry without errors. If the loader expects a different path, update `src/config.py` to point at `src/data/exercises.csv`.

---

## Task 2: Routine YAML Templates

**Files:** `src/data/routines/push_pull_legs.yaml`, `src/data/routines/upper_lower.yaml`

**Rules from spec:**
- `key` required on routine and every day — unique
- `label` user-facing, unique within a routine
- Exercises reference `exercise_key` from the CSV
- `sets` required, >= 1
- `scheme` defaults to `uniform` if omitted; only valid for `reps_weight`
- `reps` can be exact (`8`) or range (`8-12`)
- Progressive: just `sets`, no `reps`
- `duration_seconds` required for `time` exercises in plan
- `distance_km` and `duration_seconds` optional for `cardio`
- `notes` optional

Templates must cover all four exercise categories: progressive reps_weight, uniform reps_weight, time, and cardio. At least one exercise must have notes.

- [ ] **Step 1: Create `src/data/routines/push_pull_legs.yaml`**

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
        - exercise_key: incline_dumbbell_press
          scheme: uniform
          sets: 3
          reps: 8-12
        - exercise_key: dumbbell_shoulder_press
          scheme: uniform
          sets: 4
          reps: 8-12
        - exercise_key: cable_crossover
          sets: 3
          reps: 12-15
          notes: Squeeze at peak contraction
        - exercise_key: dumbbell_lateral_raise
          sets: 3
          reps: 12-15
        - exercise_key: tricep_pushdown
          sets: 3
          reps: 10-12
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
          notes: Add weight if you can do 10+ reps easily
        - exercise_key: barbell_row
          sets: 4
          reps: 8-12
        - exercise_key: seated_cable_row
          sets: 3
          reps: 8-12
        - exercise_key: face_pull
          sets: 3
          reps: 15-20
        - exercise_key: barbell_curl
          sets: 3
          reps: 8-12
        - exercise_key: hammer_curl
          sets: 3
          reps: 10-12
        - exercise_key: dead_hang
          sets: 3
          duration_seconds: 45

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
        - exercise_key: barbell_romanian_deadlift
          sets: 3
          reps: 8-12
          notes: Feel the stretch in hamstrings, hinge at hips
        - exercise_key: leg_curl
          sets: 3
          reps: 10-12
        - exercise_key: leg_extension
          sets: 3
          reps: 10-15
        - exercise_key: calf_raise_machine
          sets: 4
          reps: 12-15
        - exercise_key: wall_sit
          sets: 3
          duration_seconds: 45
        - exercise_key: 2km_rowing
          sets: 1
          distance_km: 2.0
  ```

- [ ] **Step 2: Create `src/data/routines/upper_lower.yaml`**

  ```yaml
  key: upper_lower
  name: Upper / Lower
  description: 2-day upper/lower split, good for 3-4 sessions per week

  days:
    - key: upper
      label: A
      name: Upper Body
      exercises:
        - exercise_key: barbell_bench_press
          scheme: progressive
          sets: 3
        - exercise_key: barbell_row
          scheme: progressive
          sets: 3
        - exercise_key: barbell_overhead_press
          sets: 4
          reps: 6-10
        - exercise_key: lat_pulldown
          sets: 4
          reps: 8-12
        - exercise_key: dumbbell_flyes
          sets: 3
          reps: 10-15
        - exercise_key: face_pull
          sets: 3
          reps: 15-20
        - exercise_key: dumbbell_curl
          sets: 3
          reps: 10-12
        - exercise_key: tricep_pushdown
          sets: 3
          reps: 10-12
        - exercise_key: plank
          sets: 3
          duration_seconds: 60
          notes: Engage core, don't let hips sag

    - key: lower
      label: B
      name: Lower Body
      exercises:
        - exercise_key: barbell_back_squat
          scheme: progressive
          sets: 3
        - exercise_key: barbell_deadlift
          scheme: progressive
          sets: 3
        - exercise_key: leg_press
          sets: 4
          reps: 10-15
        - exercise_key: leg_curl
          sets: 3
          reps: 10-12
        - exercise_key: barbell_hip_thrust
          sets: 3
          reps: 8-12
        - exercise_key: calf_raise_machine
          sets: 4
          reps: 12-15
        - exercise_key: cable_crunch
          sets: 3
          reps: 15-20
        - exercise_key: stationary_bike
          sets: 1
          duration_seconds: 600
  ```

- [ ] **Step 3: Validate both templates against the exercise catalog**

  Every `exercise_key` in the YAML must exist in `exercises.csv`. Run the routine loader to confirm:
  - All exercise keys resolve
  - All scheme/type combos are valid
  - All day keys are unique within their routine
  - All day labels are unique within their routine
  - `duration_seconds` is present for all `time` exercises
  - No `scheme: progressive` on `time` or `cardio` exercises

- [ ] **Step 4: Cross-check exercise type coverage**

  Confirm the templates collectively include at least one exercise from each category:
  - `reps_weight` + `progressive` scheme (e.g., barbell_bench_press, barbell_back_squat, barbell_deadlift)
  - `reps_weight` + `uniform` scheme (e.g., dumbbell_shoulder_press, cable_crossover)
  - `time` (plank, wall_sit, dead_hang)
  - `cardio` (running, 2km_rowing, stationary_bike)
  - At least one exercise with `notes` (cable_crossover, pull_up, barbell_romanian_deadlift, plank)

---

## Task 3: Benchmark YAML Config

**File:** `src/data/benchmarks.yaml`

**Rules from spec:**
- `frequency_weeks` is the cadence for all items
- `method` must be one of `max_weight`, `max_reps`, `timed_hold`
- Items reference `exercise_key` from the CSV
- Same `exercise_key` may appear only once

- [ ] **Step 1: Create `src/data/benchmarks.yaml`**

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

- [ ] **Step 2: Validate against exercise catalog**

  Run the benchmark loader. Confirm:
  - All 5 exercise keys exist in `exercises.csv`
  - No duplicate exercise keys
  - All methods are valid enum values
  - `frequency_weeks` is a positive integer

---

## Task 4: Buildozer Spec

**File:** `buildozer.spec`

**Context from v1 struggles:**
- KivyMD 2.x not on PyPI — install from pinned GitHub commit `365aa9b96eee63e0e29c04de297dd222f478fce5`
- Dependencies: `materialyoucolor`, `materialshapes`, `asyncgui`, `asynckivy`, `pillow`, `certifi`, `filetype`, `pyyaml`
- matplotlib is NOT used (replaced by Kivy canvas charts)
- `warn_on_root = 0` (Docker runs as root)
- `source.include_exts` must include `csv` and `yaml` for bundled data
- v2 file structure: all code under `src/`, entry point is `main.py` at root

- [ ] **Step 1: Replace `buildozer.spec` with the v2 version**

  Complete file content:

  ```ini
  [app]

  # App metadata
  title = Exercise Logger
  package.name = exerciselogger
  package.domain = com.creix
  version = 0.2.0

  # Source configuration
  source.dir = .
  source.include_exts = py,png,jpg,kv,atlas,json,csv,yaml
  source.include_patterns = src/**/*.py,src/**/*.kv,src/data/**/*.csv,src/data/**/*.yaml,main.py
  source.exclude_dirs = tests,.github,.buildozer,docs,.superpowers,.worktrees,bin

  # Python/Kivy requirements
  # KivyMD 2.x pinned to specific commit (not on PyPI)
  # pyyaml needed for routine/benchmark template loading
  # NO matplotlib — charts are Kivy canvas only
  requirements = python3,kivy==2.3.1,https://github.com/kivymd/KivyMD/archive/365aa9b96eee63e0e29c04de297dd222f478fce5.zip,materialyoucolor,materialshapes,asyncgui,asynckivy,pillow,certifi,filetype,pyyaml

  # Android settings
  android.permissions = WRITE_EXTERNAL_STORAGE,READ_EXTERNAL_STORAGE
  android.api = 34
  android.minapi = 24
  android.archs = arm64-v8a
  android.accept_sdk_license = True

  # Display
  orientation = portrait
  fullscreen = 0

  # Logging
  log_level = 2

  [buildozer]
  warn_on_root = 0
  ```

  **Changes from v1:**
  - `version` bumped to `0.2.0`
  - `source.include_exts` adds `csv`, `yaml`
  - `source.include_patterns` adds `src/data/**/*.csv`, `src/data/**/*.yaml`
  - `requirements` uses pinned KivyMD commit, includes `pyyaml`, drops `matplotlib`
  - `android.accept_sdk_license = True`
  - `warn_on_root = 0`
  - Removed `android.ndk` (let Buildozer pick the default)

- [ ] **Step 2: Verify `main.py` shim exists at project root**

  The root `main.py` must exist (Buildozer expects it):
  ```python
  """Buildozer entry point — thin shim that loads the real app from src/."""
  from src.main import main

  main()
  ```

  This file already exists from v1. Confirm it is present and correct.

---

## Task 5: GitHub Actions Workflow

**File:** `.github/workflows/build-apk.yml`

**Context from v1:**
- `kivy/buildozer:latest` Docker image
- Manual trigger only (`workflow_dispatch`)
- Build log always uploaded (even on failure)
- Cache buildozer packages for faster rebuilds
- `git safe.directory` workaround needed for Docker
- `shell: bash` for `pipefail` support

- [ ] **Step 1: Replace `.github/workflows/build-apk.yml` with the v2 version**

  Complete file content:

  ```yaml
  name: Build Debug APK

  on:
    workflow_dispatch:

  jobs:
    build:
      runs-on: ubuntu-22.04
      timeout-minutes: 120
      container:
        image: kivy/buildozer:latest

      steps:
        - name: Checkout
          uses: actions/checkout@v4

        - name: Cache Buildozer Android dependencies
          uses: actions/cache@v4
          with:
            path: |
              /github/home/.buildozer/android/packages
              /github/home/.buildozer/android/platform
            key: ${{ runner.os }}-buildozer-android-v2-${{ hashFiles('buildozer.spec', '.github/workflows/build-apk.yml') }}
            restore-keys: |
              ${{ runner.os }}-buildozer-android-v2-

        - name: Mark workspace as safe for git
          shell: bash
          run: git config --global --add safe.directory "$GITHUB_WORKSPACE"

        - name: Build debug APK
          shell: bash
          run: |
            set -eo pipefail
            buildozer android debug 2>&1 | tee build.log

        - name: Upload APK
          if: success()
          uses: actions/upload-artifact@v4
          with:
            name: exercise-logger-debug
            path: bin/*.apk
            retention-days: 30

        - name: Upload build log
          if: always()
          uses: actions/upload-artifact@v4
          with:
            name: build-log
            path: build.log
            retention-days: 7
  ```

  **Changes from v1:**
  - Cache key bumped from `v1` to `v2` to invalidate old cache (new dependencies)
  - Otherwise identical — the working v1 workflow does not need structural changes

---

## Task 6: Integration Test

**File:** `tests/test_integration.py`

**Goal:** One end-to-end test that loads all bundled data files, creates a workout session, logs sets of every exercise type, finishes the session, and verifies stats. Proves the full stack works with real data.

**Important:** This test uses the actual bundled data files (not synthetic test data). It exercises loaders -> registries -> services -> repos -> SQLite in one flow.

- [ ] **Step 1: Create `tests/test_integration.py`**

  The test must:

  1. **Load all bundled data** — exercise CSV, routine YAMLs, benchmark YAML
  2. **Validate loaders succeed** — no errors from any loader
  3. **Verify registry contents** — exercise count matches CSV row count, routine count matches YAML file count, benchmark items match config
  4. **Create an in-memory database** — same `init_db()` as production
  5. **Set up services** with real registries and repos
  6. **Activate a routine** — pick `push_pull_legs`, verify current day is set to first day (`push`)
  7. **Start a workout session** — verify session created with correct snapshots
  8. **Log sets covering all exercise types:**
     - Log a `reps_weight` set (e.g., barbell_bench_press: reps=8, weight=80.0)
     - Log a `time` set (e.g., plank: duration_seconds=60)
     - Log a `cardio` set (e.g., running: duration_seconds=1200, distance_km=5.0)
  9. **Finish the workout** — verify status=finished, completed_fully=1, cycle advanced to next day (`pull`)
  10. **Check stats** — session count >= 1, volume > 0, last workout summary exists
  11. **Record a benchmark result** — e.g., barbell_bench_press max_weight=100.0
  12. **Verify benchmark history** — result exists with correct snapshot values

  ```python
  """Integration test — loads real bundled data, runs a full workout cycle, checks stats."""
  import os
  import sqlite3
  import pytest

  from src.db.schema import init_db


  def _data_dir():
      """Return the absolute path to src/data/."""
      return os.path.join(
          os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
          "src", "data",
      )


  @pytest.fixture
  def integration_db():
      """In-memory SQLite with v2 schema."""
      conn = sqlite3.connect(":memory:")
      conn.row_factory = sqlite3.Row
      conn.execute("PRAGMA foreign_keys=ON")
      init_db(conn)
      yield conn
      conn.close()


  class TestFullStack:
      """End-to-end: load bundled data -> create session -> log sets -> finish -> stats."""

      def test_bundled_data_loads_and_workout_round_trip(self, integration_db):
          data_dir = _data_dir()

          # --- 1. Load exercise catalog ---
          from src.loaders.exercise_loader import load_exercises
          exercises = load_exercises(os.path.join(data_dir, "exercises.csv"))
          assert len(exercises) >= 80, f"Expected >= 80 exercises, got {len(exercises)}"

          # Verify no duplicate keys
          keys = [e.key for e in exercises]
          assert len(keys) == len(set(keys)), "Duplicate exercise keys found"

          # Verify all three types present
          types = {e.type.value for e in exercises}
          assert types == {"reps_weight", "time", "cardio"}

          # --- 2. Load exercise registry ---
          from src.registries.exercise_registry import ExerciseRegistry
          exercise_registry = ExerciseRegistry(exercises)

          # Spot-check a few exercises
          assert exercise_registry.get("barbell_bench_press") is not None
          assert exercise_registry.get("plank") is not None
          assert exercise_registry.get("running") is not None

          # --- 3. Load routine templates ---
          from src.loaders.routine_loader import load_all_routines
          routines_dir = os.path.join(data_dir, "routines")
          routines = load_all_routines(routines_dir, exercise_registry)
          assert len(routines) >= 2, f"Expected >= 2 routines, got {len(routines)}"

          from src.registries.routine_registry import RoutineRegistry
          routine_registry = RoutineRegistry(routines)
          ppl = routine_registry.get("push_pull_legs")
          assert ppl is not None
          assert len(ppl.days) == 3

          ul = routine_registry.get("upper_lower")
          assert ul is not None
          assert len(ul.days) == 2

          # --- 4. Load benchmark config ---
          from src.loaders.benchmark_loader import load_benchmark_config
          bench_config = load_benchmark_config(
              os.path.join(data_dir, "benchmarks.yaml"),
              exercise_registry,
          )
          assert bench_config.frequency_weeks == 6
          assert len(bench_config.items) == 5

          # --- 5. Set up services with real registries ---
          # NOTE: Adapt these imports to match the actual v2 service constructors.
          # The exact constructor signatures depend on Phase 1-3 implementation.
          # This skeleton shows the expected flow — adjust parameter names as needed.

          from src.repositories.settings_repo import SettingsRepo
          from src.repositories.workout_repo import WorkoutRepo
          from src.repositories.benchmark_repo import BenchmarkRepo
          from src.services.settings_service import SettingsService
          from src.services.workout_service import WorkoutService
          from src.services.benchmark_service import BenchmarkService
          from src.services.stats_service import StatsService
          from src.services.app_state_service import AppStateService

          settings_repo = SettingsRepo(integration_db)
          workout_repo = WorkoutRepo(integration_db)
          benchmark_repo = BenchmarkRepo(integration_db)

          settings_service = SettingsService(settings_repo, integration_db)
          app_state = AppStateService(
              settings_repo, routine_registry, exercise_registry,
          )
          workout_service = WorkoutService(
              workout_repo, routine_registry, exercise_registry, settings_repo,
          )
          benchmark_service = BenchmarkService(
              benchmark_repo, exercise_registry, bench_config,
          )
          stats_service = StatsService(workout_repo, exercise_registry, benchmark_repo)

          # --- 6. Activate routine and verify cycle ---
          app_state.activate_routine("push_pull_legs")
          assert settings_repo.get("active_routine_key") == "push_pull_legs"
          assert settings_repo.get("current_day_key") == "push"

          # --- 7. Start workout ---
          session = workout_service.start_session()
          assert session.status == "in_progress"
          assert session.routine_key_snapshot == "push_pull_legs"
          assert session.day_key_snapshot == "push"

          # --- 8. Log sets of each type ---
          # Find session exercises by type
          session_exercises = workout_service.get_session_exercises(session.id)
          assert len(session_exercises) > 0

          # Log a reps_weight set
          rw_ex = next(
              se for se in session_exercises
              if se.exercise_type_snapshot == "reps_weight"
          )
          workout_service.log_set(rw_ex.id, reps=8, weight=80.0)

          # Log a time set
          time_ex = next(
              se for se in session_exercises
              if se.exercise_type_snapshot == "time"
          )
          workout_service.log_set(time_ex.id, duration_seconds=60)

          # Log a cardio set
          cardio_ex = next(
              se for se in session_exercises
              if se.exercise_type_snapshot == "cardio"
          )
          workout_service.log_set(
              cardio_ex.id, duration_seconds=1200, distance_km=5.0,
          )

          # --- 9. Finish workout ---
          workout_service.finish_session(session.id)
          finished = workout_service.get_session(session.id)
          assert finished.status == "finished"
          assert finished.completed_fully == 1
          assert finished.finished_at is not None

          # Cycle should advance to next day (pull)
          assert settings_repo.get("current_day_key") == "pull"

          # --- 10. Check stats ---
          count = stats_service.get_session_count()
          assert count >= 1

          summary = stats_service.get_last_workout_summary()
          assert summary is not None

          # --- 11. Record a benchmark result ---
          benchmark_service.record_result(
              exercise_key="barbell_bench_press",
              method="max_weight",
              result_value=100.0,
              bodyweight=75.0,
          )

          # --- 12. Verify benchmark history ---
          history = benchmark_service.get_history("barbell_bench_press")
          assert len(history) >= 1
          assert history[0].result_value == 100.0
          assert history[0].exercise_key_snapshot == "barbell_bench_press"
  ```

  **IMPORTANT:** The exact service constructor signatures and method names above are approximations based on the spec. The implementor MUST adjust them to match the actual Phase 1-3 code. The test is a skeleton — read the real service/repo files before finalizing. Key adaptation points are marked with comments.

- [ ] **Step 2: Run the test**

  ```bash
  pytest tests/test_integration.py -v
  ```

  Fix any import errors, constructor mismatches, or method name differences. The test must pass cleanly.

---

## Task 7: Device QA Checklist

This is a manual testing guide for running the APK on a real Android device. Not a code file — include it in this plan as reference.

- [ ] **Step 1: Document the QA checklist**

  The following smoke tests should be performed on a physical Android device after installing the debug APK:

  ### First Launch
  - [ ] App opens without crash
  - [ ] "No routine selected" state is shown on Home screen
  - [ ] Available routines are listed (Push Pull Legs, Upper / Lower)
  - [ ] Tapping a routine activates it — hero text shows routine name + Day A

  ### Settings
  - [ ] Settings gear opens bottom sheet
  - [ ] Routine picker shows both templates
  - [ ] Switching routines resets day to first day
  - [ ] Unit toggle between lbs and kg works
  - [ ] Unit toggle confirmation dialog appears

  ### Workout Flow
  - [ ] Start Workout creates session, shows active workout screen
  - [ ] All planned exercises appear in correct order
  - [ ] Exercise cards expand/collapse (accordion behavior)
  - [ ] Progressive exercise shows info tooltip
  - [ ] Stepper pre-fills from planned targets
  - [ ] Log Set saves a set, chip appears (green)
  - [ ] Repeat Last copies previous set values
  - [ ] Time exercise stepper shows duration only
  - [ ] Cardio exercise stepper shows duration + distance
  - [ ] Tapping a logged chip opens edit/delete sheet
  - [ ] Add Exercise opens picker, ad-hoc exercise added at end
  - [ ] Finish Workout transitions to finished state, cycle advances
  - [ ] End Early (with sets) marks completed_fully=0, cycle advances
  - [ ] Cancel (zero sets) deletes session, cycle unchanged

  ### Dashboard
  - [ ] Session count shows correct numbers
  - [ ] Volume trend chart renders (after at least 1 workout)
  - [ ] Personal bests appear for exercises with logged sets
  - [ ] Exercise list shows all exercises with history
  - [ ] Exercise detail drill-in shows chart + personal best

  ### Benchmarks
  - [ ] Benchmark due alert appears on Home (all 5 due on first launch)
  - [ ] Tapping alert opens benchmark flow
  - [ ] Bodyweight input at top
  - [ ] Each benchmark exercise shows correct method
  - [ ] Logging a result saves immediately
  - [ ] Benchmark history screen shows logged results with trend

  ### Edge Cases
  - [ ] Rotate device — app recovers without crash
  - [ ] Kill app mid-workout — reopen shows resume prompt
  - [ ] Navigate between all three tabs rapidly — no crash
  - [ ] Bottom navigation highlights correct tab
  - [ ] Scroll long exercise lists smoothly

---

## Summary

| Task | Files | Committable? |
|------|-------|--------------|
| 1. Exercise CSV | `src/data/exercises.csv` | Yes |
| 2. Routine YAMLs | `src/data/routines/push_pull_legs.yaml`, `src/data/routines/upper_lower.yaml` | Yes (after Task 1) |
| 3. Benchmark YAML | `src/data/benchmarks.yaml` | Yes (after Task 1) |
| 4. Buildozer spec | `buildozer.spec` | Yes |
| 5. CI workflow | `.github/workflows/build-apk.yml` | Yes |
| 6. Integration test | `tests/test_integration.py` | Yes (after Tasks 1-3) |
| 7. QA checklist | (this plan document) | N/A |
