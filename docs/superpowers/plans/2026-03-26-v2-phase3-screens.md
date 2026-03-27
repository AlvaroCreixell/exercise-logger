# v2 Phase 3: Screens & UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entire UI layer for Exercise Logger v2. This phase produces a running Kivy+KivyMD app with three tabs (Home, Workout, Dashboard), all screens, and all user interactions described in the v2 spec. The data layer (registries, repos, services) from Phases 1-2 is complete and tested; this phase consumes it.

**Architecture:** `Screens -> Services -> Repositories/Registries -> SQLite/Bundled Files`. Screens call services via `self.app.<service>`. No direct repo or registry access from screens. Components are reusable Kivy widgets carried forward from v1 with targeted adaptations for v2's simplified model layer.

**Tech Stack:** Python 3.10+, Kivy 2.3.1, KivyMD 2.x (pinned commit), SQLite3 (stdlib).

**Spec reference:** `docs/superpowers/specs/2026-03-26-exercise-logger-v2-simplified.md`

**Phase 1-2 code reference:** Models in `src/models/`, schema in `src/db/schema.py`, registries in `src/registries/`, repos in `src/repositories/`, services in `src/services/`.

**Verification method:** Since these are UI files (not testable without a running Kivy instance), verification for each step is `python -m compileall <file> -q`. This ensures the module parses, imports resolve, and there are no syntax errors. Full behavioral testing is manual on-device.

---

## v2 Model Differences That Affect UI Code

The v2 rewrite eliminates several v1 concepts. Every screen file must reflect these changes:

1. **No exercise IDs from database.** Exercises live in `ExerciseRegistry` keyed by `exercise_key` (string), not `exercise.id` (int). ExercisePicker returns `exercise_key`, not `exercise_id`.
2. **No routine IDs from database.** Routines live in `RoutineRegistry` keyed by `routine_key` (string). No `routine.id`.
3. **No `reps_only` or `amrap` exercise types.** Only three types: `reps_weight`, `time`, `cardio`. Bodyweight exercises are `reps_weight` with weight=0.
4. **No `SetKind` enum.** Exercise type on `session_exercises.exercise_type_snapshot` determines stepper layout. No `set_kind` field on logged sets.
5. **No `SetTarget` rows.** Targets are denormalized onto `session_exercises` (`planned_sets`, `target_reps_min`, `target_reps_max`, `target_duration_seconds`, `target_distance_km`). Chips derive from these fields, not from a list of per-set targets.
6. **`scheme_snapshot` on session_exercises.** Progressive vs uniform is read from `session_exercises.scheme_snapshot`, not looked up via a service call.
7. **No `RoutineDayExercise` lookups.** Plan data is snapshotted into `session_exercises` at session creation time. The workout screen reads snapshots, never the routine template.
8. **Settings as key-value.** `active_routine_key`, `current_day_key`, `weight_unit` stored as settings rows, accessed via `SettingsService` or `AppStateService`.
9. **Benchmark results are sessionless.** No workout session created for benchmarks. Bodyweight is stored per-result.
10. **`distance_km` not `distance`.** Field name change on logged sets and session exercises.

---

## File Map

```
src/
├── main.py                              # REWRITE — 3 tabs (no Manage), registry init, v2 service wiring
├── theme.py                             # KEEP AS-IS — already correct (WARNING color added)
├── screens/
│   ├── __init__.py                      # KEEP
│   ├── base_screen.py                   # KEEP AS-IS — already correct
│   ├── components/
│   │   ├── __init__.py                  # KEEP
│   │   ├── bottom_sheet.py              # CARRY FROM V1 — no changes needed
│   │   ├── stepper.py                   # CARRY FROM V1 — no changes needed
│   │   ├── stepper.kv                   # CARRY FROM V1 — no changes needed
│   │   ├── set_chip.py                  # ADAPT — remove reps_only/amrap branches, rename duration->time, distance->distance_km
│   │   ├── set_chip.kv                  # CARRY FROM V1 — no changes needed
│   │   ├── exercise_card.py             # ADAPT — v2 snapshot model, remove set_kind/target list, add progressive tooltip
│   │   ├── exercise_card.kv             # ADAPT — add progressive ⓘ button, hide Repeat Last on first set
│   │   ├── exercise_picker.py           # ADAPT — read from ExerciseRegistry, return exercise_key not exercise_id
│   │   └── chart_widget.py              # CARRY FROM V1 — no changes needed
│   ├── home/
│   │   ├── __init__.py                  # CREATE
│   │   ├── home_screen.py               # REWRITE — v2 services, settings gear, benchmark flow
│   │   ├── home_screen.kv               # REWRITE — settings gear icon, benchmark alert card
│   │   └── settings_sheet.py            # CREATE — routine picker + unit toggle bottom sheet
│   ├── workout/
│   │   ├── __init__.py                  # CREATE
│   │   ├── workout_screen.py            # REWRITE — v2 snapshot model, pre-fill cascade, progressive tooltip, no day picker
│   │   └── workout_screen.kv            # REWRITE — cancel button for zero-set sessions
│   └── dashboard/
│       ├── __init__.py                  # CREATE
│       ├── dashboard_screen.py          # REWRITE — v2 stats API, exercise_key not exercise_id
│       ├── exercise_detail_screen.py    # REWRITE — v2 types (no reps_only), exercise_key based
│       └── benchmark_history_screen.py  # REWRITE — v2 benchmark API, grouped by exercise, bodyweight display
```

---

## Task Decomposition

```
Task 0: Theme (WARNING color constant)                    → foundation
Task 1: Component adaptations (set_chip, exercise_card, exercise_picker)  → components
Task 2: Base screen + app shell (main.py)                 → app framework
Task 3: Home screen + settings sheet                      → home tab
Task 4: Workout screen                                    → workout tab (core UX loop)
Task 5: Dashboard + exercise detail + benchmark history    → dashboard tab
```

Each task is independently committable. Tasks 0-1 are prerequisites for Tasks 3-5. Task 2 is the prerequisite for running the app.

---

## Task 0: Theme — Add WARNING Color

**Files:**
- Modify: `src/theme.py`

The v2 spec defines a Warning color (#F59E0B amber) for benchmark due alerts. The v1 theme is missing this constant.

- [ ] **Step 0.1: Add WARNING constant to `src/theme.py`**

Add after the DESTRUCTIVE constant:

```python
WARNING = (0.961, 0.620, 0.043, 1)       # #F59E0B
```

Also verify the existing `setup_theme()` function is correct for v2. It should remain as-is.

**Verify:** `python -m compileall src/theme.py -q`

---

## Task 1: Component Adaptations

### Task 1A: Adapt SetChip for v2 Types

**Files:**
- Modify: `src/screens/components/set_chip.py`

v2 eliminates `reps_only` and `amrap` types. The `set_kind` property is renamed to `chip_type` to match v2's three exercise types. The `duration` value becomes `time` to match `ExerciseType.TIME`.

- [ ] **Step 1A.1: Rewrite `set_chip.py` `_update_text()` method**

Replace the entire `_update_text` method. The new logic handles exactly three `set_kind` values:
- `reps_weight`: display as `{weight}x{reps}` (same as v1)
- `time`: display as `{duration_seconds}s` (was `duration` in v1)
- `cardio`: display as `{mins}m / {distance_km}km` with parts joined by ` / ` (rename `distance` -> `distance_km`)

Remove the `reps_only` and `amrap` branches entirely.

- [ ] **Step 1A.2: Rename `distance` property to `distance_km`**

Change the Kivy `NumericProperty` name from `distance` to `distance_km`. Update the `on_distance` callback to `on_distance_km`. Update `_update_text` to read `self.distance_km`.

**Verify:** `python -m compileall src/screens/components/set_chip.py -q`

### Task 1B: Adapt ExerciseCard for v2 Snapshot Model

**Files:**
- Modify: `src/screens/components/exercise_card.py`
- Modify: `src/screens/components/exercise_card.kv`

The v2 ExerciseCard no longer receives a list of `SetTarget` objects. Instead, targets are flat fields on the session_exercise snapshot. The card reads: `planned_sets`, `target_reps_min`, `target_reps_max`, `target_duration_seconds`, `target_distance_km`, `scheme_snapshot`. Progressive exercises get an info tooltip.

- [ ] **Step 1B.1: Rewrite `exercise_card.py` properties and init**

Replace the v1 properties with v2 equivalents:

```python
session_exercise_id = NumericProperty(0)
exercise_name = StringProperty("")
exercise_type = StringProperty("reps_weight")  # "reps_weight", "time", "cardio"
scheme = StringProperty("uniform")             # "uniform" or "progressive"
planned_sets = NumericProperty(0)              # 0 means ad-hoc (no plan)
target_reps_min = NumericProperty(0)
target_reps_max = NumericProperty(0)
target_duration_seconds = NumericProperty(0)
target_distance_km = NumericProperty(0)
plan_notes = StringProperty("")
is_expanded = BooleanProperty(False)
progress_text = StringProperty("0/0")
logged_sets = ListProperty([])  # List of dicts from logged_sets rows
```

Remove: `exercise_id`, `set_scheme`, `targets` (list), `current_reps`, `current_weight`, `current_duration`, `current_distance`.

- [ ] **Step 1B.2: Rewrite `refresh_chips()` for v2 flat-target model**

The new logic:
1. Clear chip row.
2. Add one green `SetChip` per logged set (from `self.logged_sets`).
3. Determine remaining target chips: if `planned_sets > 0`, add `planned_sets - len(logged_sets)` gray chips showing the target values. For progressive exercises, gray chips show no reps (just the set count indicator). For ad-hoc exercises (`planned_sets == 0`), show no gray chips.
4. Update `progress_text`: `"{logged_count}/{planned_sets}"` if planned, else just `"{logged_count}"` for ad-hoc.

Each logged set dict has keys: `id`, `reps`, `weight`, `duration_seconds`, `distance_km`, `logged_at`, `set_number`.

SetChip `set_kind` maps from `self.exercise_type`:
- `reps_weight` -> `reps_weight`
- `time` -> `time`
- `cardio` -> `cardio`

- [ ] **Step 1B.3: Rewrite `_setup_steppers()` for v2 types**

Three cases:
- `reps_weight`: reps stepper (step=1, min=1, integer) + weight stepper (step=5, min=0, label from unit setting)
- `time`: duration stepper (step=5, min=1, label="sec", integer)
- `cardio`: duration stepper (step=30, min=0, label="sec", integer) + distance stepper (step=0.1, min=0, label="km", float)

Remove `reps_only` and `duration` branches.

The weight stepper label should read the unit from `self.app.settings_service.get_weight_unit()` (or fallback to "lbs"). Access app via lazy import of MDApp.

- [ ] **Step 1B.4: Rewrite `_prefill_steppers()` with v2 four-tier cascade**

The spec defines a strict pre-fill priority:
1. **Plan targets** (if they exist): reps from `target_reps_min`, duration from `target_duration_seconds`, distance from `target_distance_km`. Weight is NOT pre-filled from plan (plans don't specify weight).
2. **Previous set in current exercise** (if no plan target, or progressive/ad-hoc): copy the values from `self.logged_sets[-1]`.
3. **Last session history** (if no previous set): the screen will pass a `last_session_values` dict when constructing the card. Pre-fill from that.
4. **Blank**: weight defaults to 0, everything else remains at stepper minimums.

Add a new property:
```python
last_session_values = DictProperty({})  # {reps, weight, duration_seconds, distance_km}
```

Pre-fill logic per stepper expansion:
```
logged_count = len(self.logged_sets)

# Tier 1: plan targets (uniform exercises with plan)
if self.scheme == "uniform" and self.planned_sets > 0:
    if self._reps_stepper and self.target_reps_min:
        self._reps_stepper.value = self.target_reps_min
    if self._duration_stepper and self.target_duration_seconds:
        self._duration_stepper.value = self.target_duration_seconds
    if self._distance_stepper and self.target_distance_km:
        self._distance_stepper.value = self.target_distance_km
    # Weight: fall through to tier 2/3

# Tier 2: previous set in current exercise
if self.logged_sets:
    last = self.logged_sets[-1]
    # Fill any stepper not yet filled by tier 1
    ...

# Tier 3: last session history
elif self.last_session_values:
    ...

# Tier 4: blank (steppers already at their minimums/defaults)
# Weight always defaults to 0 if nothing else set it
```

- [ ] **Step 1B.5: Add `show_progressive_tooltip()` method**

For progressive exercises, display the spec's coaching guidance in a bottom sheet:

```python
def show_progressive_tooltip(self):
    from src.screens.components.bottom_sheet import AppBottomSheet
    from kivymd.uix.label import MDLabel
    from src.theme import TEXT_SECONDARY

    sheet = AppBottomSheet(title="Progressive Loading")
    sheet.set_height(280)
    sheet.add_content(MDLabel(
        text=(
            "Start light ~15 reps (leave 3 in the tank). "
            "Increase weight, ~8 reps (leave 1-2 in the tank). "
            "Go heavy, 4+ reps (aim for failure \u2014 keep going "
            "until you can't)."
        ),
        theme_text_color="Custom",
        text_color=TEXT_SECONDARY,
        font_style="Body",
        role="medium",
        adaptive_height=True,
    ))
    sheet.add_action("Got it", lambda *a: sheet.dismiss(), style="filled")
    sheet.open()
```

- [ ] **Step 1B.6: Rewrite `repeat_last()` to be hidden-aware**

`repeat_last()` dispatches `on_set_logged` with the previous set's values. No change to the method body, but the KV file will conditionally hide the button when `len(logged_sets) == 0`.

- [ ] **Step 1B.7: Update `exercise_card.kv`**

Changes to the KV file:
1. Add an `MDIconButton` with icon `information-outline` next to the exercise name in the header. Only visible when `root.scheme == "progressive"`. On release, calls `root.show_progressive_tooltip()`.
2. Make the "Repeat Last" button visibility conditional: `opacity: 1 if len(root.logged_sets) > 0 else 0` and `disabled: len(root.logged_sets) == 0`.
3. Add a `plan_notes` label below the header, visible only when `root.plan_notes` is non-empty. Style: `text_color: TEXT_SECONDARY`, `font_style: "Body"`, `role: "small"`.

**Verify:** `python -m compileall src/screens/components/exercise_card.py -q`

### Task 1C: Adapt ExercisePicker for v2 Registry

**Files:**
- Modify: `src/screens/components/exercise_picker.py`

The v1 picker reads from `app.exercise_service.list_exercises()` which returns Exercise dataclasses with `id` (int) fields. v2 reads from `ExerciseRegistry` which returns Exercise dataclasses keyed by `key` (string). The picker callback signature changes from `on_select(exercise_id, exercise_name)` to `on_select(exercise_key, exercise_name)`.

- [ ] **Step 1C.1: Rewrite `ExercisePickerSheet` to use ExerciseRegistry**

Changes:
1. `self._app.exercise_registry.list_all()` instead of `self._app.exercise_service.list_exercises()`. (The exact method name depends on what Phase 1 implemented — check the registry API.)
2. `_PickerRow.__init__` takes `exercise_key: str` instead of `exercise_id: int`.
3. The `on_select` callback receives `(exercise_key, exercise_name)`.
4. Update `_TYPE_LABELS` to use v2's three types only. Remove `ExerciseType.REPS_ONLY` if present. Import `ExerciseType` from `src.models.bundled` (v2 location).
5. Exercise objects have `.key`, `.name`, `.type`, `.equipment`, `.muscle_group` (from v2 bundled model). Adapt field access accordingly.

**Verify:** `python -m compileall src/screens/components/exercise_picker.py -q`

---

## Task 2: App Shell — main.py + base_screen.py

**Files:**
- Rewrite: `src/main.py`
- Keep: `src/screens/base_screen.py` (no changes needed)

The v2 app has 3 tabs (Home, Workout, Dashboard) — no Manage tab. Service wiring uses v2 registries + repos + services. Registries are loaded once at startup. The app object exposes registries and services for screen access.

- [ ] **Step 2.1: Rewrite `src/main.py`**

The new `main.py` must:

1. **Import v2 infrastructure:**
   - `src.db.connection.create_connection`
   - `src.db.schema.init_db`
   - `src.registries.exercise_registry.ExerciseRegistry`
   - `src.registries.routine_registry.RoutineRegistry`
   - `src.registries.benchmark_registry.BenchmarkRegistry`
   - `src.repositories.base.BaseRepository`
   - `src.repositories.settings_repo.SettingsRepo`
   - `src.repositories.workout_repo.WorkoutRepo`
   - `src.repositories.benchmark_repo.BenchmarkRepo`
   - `src.services.app_state_service.AppStateService`
   - `src.services.workout_service.WorkoutService`
   - `src.services.benchmark_service.BenchmarkService`
   - `src.services.stats_service.StatsService`
   - `src.services.settings_service.SettingsService`

2. **Define 3 tabs:**
   ```python
   TABS = [
       ("home", "home"),
       ("workout", "dumbbell"),
       ("dashboard", "chart-line"),
   ]
   ```

3. **`ExerciseLoggerApp` class:**
   - Properties for registries: `exercise_registry`, `routine_registry`, `benchmark_registry`
   - Properties for services: `app_state_service`, `workout_service`, `benchmark_service`, `stats_service`, `settings_service`
   - `build()`: call `setup_theme()`, `_init_registries()`, `_init_services()`, `_run_startup_reconciliation()`, `_build_ui()`.
   - `_init_registries()`: Load CSV/YAML files via registry constructors. Fatal on error (print error and exit, or let exception propagate — the spec says invalid bundled data is fatal).
   - `_init_services()`: Create DB connection, init schema, create repos, create services with constructor injection.
   - `_run_startup_reconciliation()`: Call `app_state_service.reconcile_on_startup()` which handles stale routine keys, missing day keys, orphaned in-progress sessions.
   - `_build_ui()`: Same pattern as v1 — ScreenManager + MDNavigationBar. Import and add 3 screens: HomeScreen, WorkoutScreen, DashboardScreen. No ManageScreen.
   - `go_tab()`: Same as v1.
   - `on_stop()`: Close DB connection.

4. **`main()` function** at bottom.

- [ ] **Step 2.2: Create `__init__.py` files for screen subdirectories**

Create empty `__init__.py` in:
- `src/screens/home/__init__.py` (if not exists)
- `src/screens/workout/__init__.py` (if not exists)
- `src/screens/dashboard/__init__.py` (if not exists)

**Verify:** `python -m compileall src/main.py -q`

---

## Task 3: Home Screen + Settings Sheet

**Files:**
- Rewrite: `src/screens/home/home_screen.py`
- Rewrite: `src/screens/home/home_screen.kv`
- Create: `src/screens/home/settings_sheet.py`

### Task 3A: Home Screen

- [ ] **Step 3A.1: Rewrite `home_screen.kv`**

Layout structure:
```
<HomeScreen>:
    md_bg_color: BACKGROUND

    MDBoxLayout:
        orientation: "vertical"

        # Top bar with settings gear (right-aligned)
        MDBoxLayout:
            size_hint_y: None
            height: dp(56)
            padding: [dp(16), 0, dp(8), 0]

            Widget:  # spacer

            MDIconButton:
                icon: "cog"
                theme_icon_color: "Custom"
                icon_color: TEXT_SECONDARY
                on_release: root.open_settings()

        # In-progress session banner (hidden by default)
        MDCard:
            id: session_banner
            ...  (same pattern as v1, but calls resume/end)

        # Spacer
        Widget:
            size_hint_y: 0.1

        # Hero — routine name + current day
        MDLabel:
            id: routine_name_label
            ...

        MDLabel:
            id: current_day_label
            ...

        # Start Workout button (full-width green)
        MDButton:
            id: start_button
            style: "filled"
            ...

        Widget:
            size_hint_y: 0.05

        # Last workout summary
        MDLabel:
            id: last_workout_label
            ...

        # Benchmark due alert card (amber)
        MDCard:
            id: benchmark_alert_card
            ...  (amber border/accent, tappable, hidden when no benchmarks due)

        # Empty state (no routine)
        MDBoxLayout:
            id: empty_state_container
            ...

        Widget:
            size_hint_y: 0.3
```

Key KV differences from v1:
- Settings gear icon in top-right (replaces "Create Routine" / go_to_manage)
- Benchmark alert is a single amber card with tap handler, not a list of labels
- No "Create Routine" button — settings sheet handles routine selection

- [ ] **Step 3A.2: Rewrite `home_screen.py`**

The `HomeScreen` class:

```python
class HomeScreen(BaseScreen):
    _in_progress_session_id = None

    def on_enter(self):
        self._refresh()

    def _refresh(self):
        self._update_routine_info()
        self._update_last_workout()
        self._update_session_banner()
        self._update_benchmark_alert()
```

**`_update_routine_info()`:**
- Read active routine key from `self.app.settings_service` (or `self.app.app_state_service`).
- If no active routine: show "No routine selected", disable Start Workout button, show empty state with "Select a routine in Settings" text.
- If active routine: look up routine from `self.app.routine_registry` by key. Display routine name. Read `current_day_key` from settings, look up day in the routine. Display "Day {label} - {name}" as hero text.

**`_update_last_workout()`:**
- Call `self.app.stats_service.get_last_workout_summary()`. Display date + day + duration, same pattern as v1. Use `day_label` and `day_name` from the returned dict (not `day_label_snapshot`/`day_name_snapshot`).

**`_update_session_banner()`:**
- Call `self.app.workout_service.get_in_progress_session()`. If exists, show banner with Resume/End buttons. Same UX as v1.

**`_update_benchmark_alert()`:**
- Call `self.app.stats_service.get_benchmark_due_summary()`, which returns a dict `{"total_items": N, "due_count": N, "due_items": [...]}`. Use `due_count` for the alert badge/count. If `due_count > 0`, show an amber card: "Benchmarks due ({due_count})" with tap handler to open benchmark flow.
- If `due_count == 0`, hide the card.

**`open_settings()`:**
- Import and open `SettingsSheet`.

**`start_workout()`:**
- Navigate to workout tab: `self.app.go_tab("workout")`.

**`resume_session()`:**
- Navigate to workout tab: `self.app.go_tab("workout")`.

**`end_session()`:**
- Same confirmation bottom sheet pattern as v1. Call `self.app.workout_service.end_early(session_id)` on confirm. Refresh.

**`start_benchmark_flow()`:**
- Open the benchmark bottom sheet. See step 3A.4.

- [ ] **Step 3A.3: Implement benchmark flow bottom sheet**

The benchmark flow is a bottom sheet opened from the Home screen when the user taps the amber benchmark alert card. The sheet contains:

1. **Bodyweight input** at top: a `ValueStepper` for bodyweight entry (step=0.5, min=0, label from unit setting).
2. **List of due benchmark items**: each item shows exercise name + method. Tapping an item opens a **result entry sub-sheet** with the appropriate stepper (weight stepper for max_weight, reps stepper for max_reps, duration stepper for timed_hold).
3. Each result is saved immediately via `self.app.benchmark_service.record_result(exercise_key, method, result_value, bodyweight)`.

Implementation approach: a method `start_benchmark_flow()` on HomeScreen that creates the bottom sheet, populates it with due items, and handles the recording callbacks.

```python
def start_benchmark_flow(self):
    from src.screens.components.bottom_sheet import AppBottomSheet
    from src.screens.components.stepper import ValueStepper
    ...

    summary = self.app.stats_service.get_benchmark_due_summary()
    due_items = summary["due_items"]
    if not due_items:
        return

    sheet = AppBottomSheet(title="Benchmarks")
    sheet.set_height(500)

    # Bodyweight input
    bw_stepper = ValueStepper(value=0, step=0.5, min_val=0, label=unit, is_integer=False)
    sheet.add_content(MDLabel(text="Bodyweight", ...))
    sheet.add_content(bw_stepper)

    # List of due items (each tappable)
    for item in due_items:
        exercise = self.app.exercise_registry.get(item["exercise_key"])
        row = _BenchmarkItemRow(...)  # tappable row
        row.bind(on_release=lambda *a, i=item: self._open_benchmark_entry(i, bw_stepper.value, sheet))
        sheet.add_content(row)

    sheet.add_action("Done", lambda *a: sheet.dismiss())
    sheet.open()
```

`_open_benchmark_entry()` opens a second bottom sheet with the stepper appropriate for the benchmark method, saves on confirm. When calling `record_result`, convert bodyweight stepper value 0 to `None` before passing it: `bodyweight = bw_val if bw_val != 0 else None`. This ensures `benchmark_results.bodyweight` is always NULL or > 0, never 0.

### Task 3B: Settings Sheet

- [ ] **Step 3B.1: Create `src/screens/home/settings_sheet.py`**

```python
"""Settings bottom sheet — routine picker + unit toggle.

Opened from Home screen's settings gear icon. Contains:
1. Routine picker: list of all bundled routine templates, tap to activate
2. Unit toggle: lb <-> kg with conversion warning
"""
```

Class `SettingsSheet`:

```python
class SettingsSheet:
    """Not a Kivy widget — instantiate and call open()."""

    def __init__(self, app):
        self._app = app
        self._sheet = None

    def open(self):
        self._sheet = AppBottomSheet(title="Settings")
        self._sheet.set_height(450)

        # --- Routine section ---
        self._sheet.add_content(MDLabel(text="Routine", ...))
        routines = self._app.routine_registry.list_all()
        active_key = self._app.settings_service.get("active_routine_key")
        for routine in routines:
            row = self._make_routine_row(routine, is_active=(routine.key == active_key))
            self._sheet.add_content(row)

        # --- Unit section ---
        self._sheet.add_content(MDLabel(text="Weight Unit", ...))
        current_unit = self._app.settings_service.get("weight_unit") or "lb"
        toggle_text = "Switch to kg" if current_unit == "lb" else "Switch to lb"
        # ... toggle button

        self._sheet.open()
```

**Routine picker behavior:**
- List all bundled templates. Active one gets a checkmark or green highlight.
- Tapping a routine: if switching mid-cycle (different from current active), show a confirmation: "Switch to {name}? This resets the day cycle to Day A."
- On confirm: call `self._app.app_state_service.set_active_routine(routine_key)` (which also resets `current_day_key` to the first day).
- Block switching if a workout is in progress: show a warning instead.

**Unit toggle behavior:**
- Show current unit.
- On tap: show confirmation with the text from spec: "This will convert all historical weights. You can convert back later."
- On confirm: call `self._app.settings_service.toggle_weight_unit()`.

**Verify:** `python -m compileall src/screens/home/settings_sheet.py -q && python -m compileall src/screens/home/home_screen.py -q`

---

## Task 4: Workout Screen

**Files:**
- Rewrite: `src/screens/workout/workout_screen.py`
- Rewrite: `src/screens/workout/workout_screen.kv`

The workout screen has two states: **pre-session** (day preview + start button) and **active session** (exercise cards + bottom bar). This is the core UX loop.

### Task 4A: Workout Screen KV

- [ ] **Step 4A.1: Rewrite `workout_screen.kv`**

Layout structure:
```
<WorkoutScreen>:
    md_bg_color: BACKGROUND

    MDBoxLayout:
        orientation: "vertical"

        # Header
        MDBoxLayout:
            size_hint_y: None
            height: dp(56)
            padding: [dp(16), 0, dp(16), 0]

            MDLabel:
                id: header_label
                text: "Workout"
                ...

        # Pre-session view
        MDBoxLayout:
            id: pre_session_view
            orientation: "vertical"
            padding: [dp(16), dp(16), dp(16), dp(16)]
            spacing: dp(12)

            # Day header (e.g., "Day A — Push")
            MDLabel:
                id: day_info_label
                ...

            # Exercise list preview (name + sets x target)
            ScrollView:
                MDBoxLayout:
                    id: preview_container
                    orientation: "vertical"
                    adaptive_height: True
                    spacing: dp(4)

            # Start Workout button
            MDButton:
                id: start_session_btn
                style: "filled"
                ...

        # Active session view (hidden by default)
        MDBoxLayout:
            id: active_session_view
            orientation: "vertical"
            opacity: 0
            size_hint_y: 0 if self.opacity == 0 else 1

            # Scrollable exercise cards
            ScrollView:
                MDBoxLayout:
                    id: card_container
                    orientation: "vertical"
                    adaptive_height: True
                    spacing: dp(8)
                    padding: [dp(8), dp(8), dp(8), dp(8)]

            # Bottom action bar
            MDBoxLayout:
                size_hint_y: None
                height: dp(56)
                padding: [dp(12), dp(4), dp(12), dp(4)]
                spacing: dp(8)
                md_bg_color: SURFACE

                MDButton:  # + Add Exercise
                    style: "outlined"
                    ...

                Widget:  # spacer

                MDButton:  # Cancel (zero sets) / End Early (has sets)
                    id: cancel_end_btn
                    style: "text"
                    ...

                MDButton:  # Finish Workout (green)
                    style: "filled"
                    ...
```

Key differences from v1:
- Pre-session has an exercise list preview (not just day label)
- No day picker buttons (v2 spec says "No manual day override — always follows cycle")
- Bottom bar has Cancel/End Early that dynamically changes based on set count
- Cancel (zero sets) deletes session, no cycle advance

### Task 4B: Workout Screen Python

- [ ] **Step 4B.1: Rewrite `workout_screen.py` — pre-session state**

```python
class WorkoutScreen(BaseScreen):
    current_session_id = NumericProperty(0)
    _expanded_card = ObjectProperty(None, allownone=True)

    def on_enter(self):
        self._refresh_state()

    def _refresh_state(self):
        session = self.app.workout_service.get_in_progress_session()
        if session:
            self.current_session_id = session.id
            self._show_active_session(session)
        else:
            self.current_session_id = 0
            self._show_pre_session()
```

**`_show_pre_session()`:**
1. Show pre_session_view, hide active_session_view.
2. Read active routine key + current day key from settings.
3. If no active routine: show "No active routine", disable start button.
4. Look up routine + day from registries.
5. Set `day_info_label` to "Day {label} - {name}".
6. Populate `preview_container` with exercise preview rows:
   - For each exercise in the day template:
     - Look up exercise from ExerciseRegistry by key.
     - Display: "{exercise_name} — {sets} x {target_summary}"
     - Where target_summary is: reps range for reps_weight, duration for time, "duration / distance" for cardio, "open" for progressive.

- [ ] **Step 4B.2: Rewrite `workout_screen.py` — start session**

```python
def start_session(self):
    try:
        session = self.app.workout_service.start_session()
    except ValueError as e:
        print(f"[Workout] Failed to start: {e}")
        return
    self.current_session_id = session.id
    self._show_active_session(session)
```

The v2 `WorkoutService.start_session()` reads the active routine + current day from settings, creates the session + session_exercises in one transaction. No `day_id` parameter needed — it's read from settings.

- [ ] **Step 4B.3: Rewrite `workout_screen.py` — active session and card building**

**`_show_active_session(session)`:**
1. Hide pre_session_view, show active_session_view.
2. Set header: "Day {session.day_label_snapshot} - {session.day_name_snapshot}".
3. Call `_rebuild_cards()`.

**`_rebuild_cards()`:**
1. Get session exercises: `self.app.workout_service.get_session_exercises(session_id)`.
2. For each session_exercise, build an ExerciseCard with v2 properties:
   ```python
   card = ExerciseCard(
       session_exercise_id=se.id,
       exercise_name=se.exercise_name_snapshot,
       exercise_type=se.exercise_type_snapshot,
       scheme=se.scheme_snapshot or "uniform",
       planned_sets=se.planned_sets or 0,
       target_reps_min=se.target_reps_min or 0,
       target_reps_max=se.target_reps_max or 0,
       target_duration_seconds=se.target_duration_seconds or 0,
       target_distance_km=se.target_distance_km or 0,
       plan_notes=se.plan_notes_snapshot or "",
       logged_sets=logged_data,
       last_session_values=last_session_vals,
   )
   ```
3. Get logged sets for each exercise: `self.app.workout_service.get_logged_sets(se.id)`.
4. Get last session values for pre-fill tier 3: `self.app.stats_service.get_last_set_for_exercise(se.exercise_key_snapshot)` (or similar — check stats service API). Convert to dict `{reps, weight, duration_seconds, distance_km}`.
5. Bind events: `on_set_logged`, `on_chip_tapped`, `on_toggle`.
6. Call `card.refresh_chips()`.
7. Auto-expand first card.

- [ ] **Step 4B.4: Rewrite `_on_set_logged()` for v2 simplified logging**

v2 has no `set_kind` or `exercise_set_target_id` — the service determines what fields to expect based on the session_exercise's type snapshot.

```python
def _on_set_logged(self, card, se_id, vals):
    try:
        self.app.workout_service.log_set(
            session_exercise_id=se_id,
            reps=vals.get("reps"),
            weight=vals.get("weight"),
            duration_seconds=vals.get("duration_seconds"),
            distance_km=vals.get("distance_km"),
        )
    except ValueError as e:
        print(f"[Workout] Failed to log: {e}")
        return
    self._refresh_card(card)
```

- [ ] **Step 4B.5: Rewrite chip tap edit/delete sheet for v2**

Same UX pattern as v1 but with v2 field names:
- `distance` -> `distance_km`
- No `set_kind` field on the set dict
- The edit stepper types are determined by the card's `exercise_type` (not the set's `set_kind`)

```python
def _on_chip_tapped(self, card, chip):
    set_id = chip.set_id
    set_data = next((s for s in card.logged_sets if s.get("id") == set_id), None)
    if not set_data:
        return

    sheet = AppBottomSheet(title="Edit Set")
    steppers = {}

    if card.exercise_type == "reps_weight":
        steppers["reps"] = ValueStepper(value=set_data.get("reps", 0), ...)
        steppers["weight"] = ValueStepper(value=set_data.get("weight", 0), ...)
    elif card.exercise_type == "time":
        steppers["duration_seconds"] = ValueStepper(...)
    elif card.exercise_type == "cardio":
        steppers["duration_seconds"] = ValueStepper(...)
        steppers["distance_km"] = ValueStepper(...)

    # Save / Delete / Cancel actions (same pattern as v1)
    ...
```

- [ ] **Step 4B.6: Implement session end actions (Finish, End Early, Cancel)**

Three actions on the bottom bar:

**Finish Workout:**
- Confirmation sheet: "Finish workout?" / "Session will be saved and cycle advances."
- On confirm: `self.app.workout_service.finish_session(session_id)` -> advance cycle, status=finished, completed_fully=1.

**End Early:**
- Only available when >=1 set logged across the session.
- Confirmation sheet: "End workout early?" / "Session saved. Cycle advances."
- On confirm: `self.app.workout_service.end_early(session_id)` -> status=finished, completed_fully=0.

**Cancel:**
- Only available when zero sets logged.
- Confirmation sheet: "Cancel workout?" / "Empty session will be deleted. Cycle does not advance."
- On confirm: `self.app.workout_service.cancel_session(session_id)` -> delete session row.

Dynamic button: The bottom bar's left text button shows "Cancel" when total logged sets == 0, and "End Early" when total logged sets > 0. Update this on every set log/delete.

```python
def _update_cancel_end_button(self):
    total = sum(len(card.logged_sets) for card in self._get_all_cards())
    btn_text = self.ids.cancel_end_btn_text  # or however it's referenced
    if total == 0:
        btn_text.text = "Cancel"
    else:
        btn_text.text = "End Early"
```

- [ ] **Step 4B.7: Implement ad-hoc exercise add**

```python
def add_exercise(self):
    from src.screens.components.exercise_picker import ExercisePickerSheet

    def on_select(exercise_key, exercise_name):
        self.app.workout_service.add_ad_hoc_exercise(
            self.current_session_id, exercise_key
        )
        self._rebuild_cards()

    picker = ExercisePickerSheet(self.app, on_select=on_select, title="Add Exercise")
    picker.open()
```

Note: v2 passes `exercise_key` (string) not `exercise_id` (int).

**Verify:** `python -m compileall src/screens/workout/workout_screen.py -q`

---

## Task 5: Dashboard + Detail Screens

**Files:**
- Rewrite: `src/screens/dashboard/dashboard_screen.py`
- Rewrite: `src/screens/dashboard/exercise_detail_screen.py`
- Rewrite: `src/screens/dashboard/benchmark_history_screen.py`

### Task 5A: Dashboard Overview Screen

- [ ] **Step 5A.1: Rewrite `dashboard_screen.py`**

Same architectural pattern as v1 (nested ScreenManager for drill-in), but adapted for v2:

1. **Empty state** check: `self.app.stats_service.get_session_count()`. If zero finished sessions ever, show "No workouts yet" + "Start Workout" button.

2. **Stat cards**: session count this week + this month. Shown even if 0, as long as any historical session exists.
   ```python
   week_count = self.app.stats_service.get_session_count(since=week_start)
   month_count = self.app.stats_service.get_session_count(since=month_start)
   ```

3. **Volume trend chart** (4 weeks, bar): `self.app.stats_service.get_total_volume_trend(weeks=4)`. Volume = `SUM(weight * reps)` for `reps_weight` only. Use ChartWidget.plot_bar().

4. **Personal bests** (top 3): `self.app.stats_service.get_personal_bests(limit=3)`. Type-appropriate formatting:
   - `reps_weight`: "{weight} x {reps}"
   - `time`: "{duration}s" or "{m}m {s}s"
   - `cardio`: "{distance}km / {duration}m"
   Note: no `reps_only` in v2.

5. **Exercise list**: Get all exercises that have history. Each row is tappable, drills into ExerciseDetailScreen. Pass `exercise_key` (string) not `exercise_id` (int).
   ```python
   exercises = self.app.stats_service.get_exercises_with_history()
   # Returns list of {exercise_key, exercise_name, exercise_type}
   ```

6. **Benchmark history link**: tappable row → BenchmarkHistoryScreen. Show due count if any.

Navigation methods: `show_exercise_detail(exercise_key, name)`, `show_benchmark_history()`, `pop_to_overview()`. Same nested ScreenManager pattern as v1.

**Verify:** `python -m compileall src/screens/dashboard/dashboard_screen.py -q`

### Task 5B: Exercise Detail Screen

- [ ] **Step 5B.1: Rewrite `exercise_detail_screen.py`**

Constructor takes `exercise_key: str` and `exercise_name: str` (was `exercise_id: int`).

Content sections:

1. **Header** with back arrow + exercise name.

2. **Type-appropriate history chart**: Call `self.app.stats_service.get_exercise_history(exercise_key)`.
   - `reps_weight`: weight-over-time line chart + volume bar chart
   - `time`: max-duration line chart
   - `cardio`: max-distance line chart (or max-duration if no distance data)

3. **Personal best card**: `self.app.stats_service.get_exercise_best_set(exercise_key)`.
   - Type-appropriate formatting (same rules as dashboard PR display)
   - Show date of the best set

4. **Plan-vs-actual**: `self.app.stats_service.get_latest_plan_vs_actual(exercise_key)`.
   - Table with Set / Planned / Actual columns
   - v2 simplification: no `amrap` or `reps_only` set kinds. Only `reps_weight`, `time`, `cardio` formatting needed.
   - Planned values come from `session_exercises` snapshot fields (`target_reps_min`, `target_reps_max`, `target_duration_seconds`, `target_distance_km`).

Back navigation: same parent-traversal pattern as v1 to find DashboardScreen and call `pop_to_overview()`.

**Verify:** `python -m compileall src/screens/dashboard/exercise_detail_screen.py -q`

### Task 5C: Benchmark History Screen

- [ ] **Step 5C.1: Rewrite `benchmark_history_screen.py`**

v2 benchmark results are sessionless. The screen groups results by exercise and shows trend charts with bodyweight.

Content sections:

1. **Header** with back arrow + "Benchmark History".

2. **Grouped by exercise**: Iterate over benchmark config items (from `self.app.benchmark_registry`). For each:
   - Exercise name (from exercise registry lookup by key)
   - Method label (Max Weight / Max Reps / Timed Hold)
   - Latest result + date
   - Trend chart if >= 2 data points
   - Bodyweight displayed alongside each result

```python
config = self.app.benchmark_registry.get_config()
for item in config.items:
    exercise = self.app.exercise_registry.get(item.exercise_key)
    history = self.app.stats_service.get_benchmark_history(item.exercise_key)
    # history is a list of {result_value, bodyweight, tested_at}
    ...
```

v2 changes from v1:
- No `BenchmarkDefinition.id` — lookup by `exercise_key` + `method`
- No `muscle_group_label` on benchmark definitions — group by exercise name or show flat list
- Bodyweight displayed per result (v1 didn't track bodyweight on benchmark results)
- Results have `exercise_key_snapshot` and `exercise_name_snapshot` for display

For each benchmark item card, show:
- Exercise name + method as header
- Latest result value + tested date
- Bodyweight at time of test (if available)
- Line chart of result_value over time (dates on x-axis)
- Optional: secondary line for bodyweight trend on same chart (using ChartWidget's dual-series `plot_line`)

**Verify:** `python -m compileall src/screens/dashboard/benchmark_history_screen.py -q`

---

## Integration Verification

After all tasks are complete, run a full compile check on all screen files:

```bash
python -m compileall src/main.py src/theme.py src/screens/ -q
```

This ensures every module parses correctly and all cross-file imports resolve. Manual testing on desktop (via `python -m src.main` or equivalent) validates the full UI behavior.

---

## Summary of Spec Behaviors Covered

| Behavior | Task | Notes |
|----------|------|-------|
| 3 tabs (Home, Workout, Dashboard) | Task 2 | No Manage tab |
| Settings gear on Home | Task 3A | Opens bottom sheet |
| Routine picker in settings | Task 3B | List of bundled templates |
| Unit toggle (lb/kg) | Task 3B | Conversion with confirmation |
| Benchmark due alert on Home | Task 3A | Amber card, tap to start flow |
| Benchmark logging flow | Task 3A | Bottom sheet with bodyweight + per-item recording |
| Pre-session exercise preview | Task 4A | Name + sets x target for each exercise |
| Active session exercise cards | Task 4B | Accordion, one expanded at a time |
| Progressive info tooltip | Task 1B | Bottom sheet with RIR guidance text |
| Stepper pre-fill cascade | Task 1B | Plan -> prev set -> last session -> blank |
| Repeat Last (hidden on first set) | Task 1B | Copies previous set values |
| Log set (immediate save) | Task 4B | Crash safety — each set committed to DB |
| Edit/delete logged set | Task 4B | Bottom sheet from chip tap |
| Finish workout (advance cycle) | Task 4B | Confirmation required |
| End Early (advance cycle) | Task 4B | Only when >=1 set, confirmation required |
| Cancel (no advance) | Task 4B | Only when zero sets, confirmation, deletes session |
| Ad-hoc exercise add | Task 4B | Exercise picker from catalog |
| Dashboard empty state | Task 5A | "No workouts yet" + Start button |
| Session count cards | Task 5A | This week / this month |
| Volume trend chart | Task 5A | 4-week bar chart |
| Personal bests | Task 5A | Top 3, type-aware |
| Exercise list drill-in | Task 5A | exercise_key based navigation |
| Exercise detail charts | Task 5B | Type-appropriate (weight, duration, distance) |
| Exercise personal best | Task 5B | Type-appropriate formatting |
| Plan-vs-actual table | Task 5B | From session_exercises snapshots |
| Benchmark history | Task 5C | Grouped by exercise, trend charts, bodyweight |
| Destructive = text style | Tasks 3-4 | Confirmation sheets, never filled red buttons |
| All transitions < 200ms | Task 2 | SlideTransition(duration=0.2) |
| Minimum touch target 48dp | All | Maintained in KV files |
