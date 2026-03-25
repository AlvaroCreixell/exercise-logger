# Phase 3C: Remaining Screens & Deferred Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all remaining UI screens: 5 Manage sub-screens (routine editor with progressive targets, exercise catalog, benchmark setup, import/export, units), dashboard with charts, and workout tab enhancements (day picker, exercise picker). This makes the app **functionally complete for routine workouts**. Benchmark sessions and full DB backup/restore are explicitly deferred to a follow-up phase.

**Scope decisions:**
- **IN:** Routine editor (uniform + progressive targets, day reorder), exercise catalog, benchmark setup, routine import/export, units toggle, dashboard (stats + charts + exercise detail + benchmark history), workout day picker, workout exercise picker
- **DEFERRED (Phase 4):** Benchmark session UI (separate logging flow), full DB backup/restore (file-system operation, spec L469-473). These are real features but not blocking the core routine workout loop.

**Architecture:** A new `ManageDetailScreen` base class provides the standard header+back pattern for all 5 Manage sub-screens. Stats service gets 2 new methods before dashboard work starts. All bottom sheets use `AppBottomSheet` with spec-correct styling (destructive = text/outlined, never filled red).

**Tech Stack:** Kivy 2.3+, KivyMD 2.0+, matplotlib, existing Phase 1+2 services.

---

## Task Decomposition

```
GROUP A: Foundations (do first)
  Task 1:  ManageDetailScreen base class + chart utility + matplotlib dep
  Task 2:  Stats service additions (get_recent_prs, get_latest_plan_vs_actual_for_exercise)
  Task 3:  RoutineService additions (get_day, update_day_exercise_scheme)

GROUP B: Manage sub-screens
  Task 4:  Units screen
  Task 5:  Exercise catalog screen
  Task 6:  Exercise picker bottom sheet (reusable component)
  Task 7a: Routine editor — routine list + day CRUD + day reorder
  Task 7b: Routine editor — exercise management + target editor (uniform + progressive)
  Task 8:  Benchmark setup screen
  Task 9:  Import/export screen (routine only — full backup deferred)

GROUP C: Dashboard
  Task 10: Dashboard overview (stats, volume trend, recent PRs)
  Task 11: Exercise detail screen (weight + volume charts, best sets, plan-vs-actual)
  Task 12: Benchmark history screen

GROUP D: Workout enhancements
  Task 13: Day picker override (using MDButton, not SetChip)
  Task 14: Exercise picker wiring for ad-hoc add
```

---

## File Structure

```
src/screens/
├── components/
│   ├── chart_widget.py              # NEW — matplotlib → Kivy Image
│   ├── exercise_picker.py           # NEW — reusable exercise picker sheet
│   └── (existing: bottom_sheet.py, set_chip.py, stepper.py, exercise_card.py)
├── manage/
│   ├── manage_detail_screen.py      # NEW — base class with header + back button
│   ├── units_screen.py              # NEW
│   ├── exercise_catalog_screen.py   # NEW
│   ├── routine_editor_screen.py     # NEW (multi-level)
│   ├── benchmark_setup_screen.py    # NEW
│   ├── import_export_screen.py      # NEW
│   └── manage_screen.py             # MODIFY — wire sub-screens
├── dashboard/
│   ├── __init__.py                  # NEW
│   ├── dashboard_screen.py          # NEW — overview with drill-in manager
│   ├── exercise_detail_screen.py    # NEW — charts + best sets + plan-vs-actual
│   └── benchmark_history_screen.py  # NEW
├── workout/
│   └── workout_screen.py            # MODIFY — day picker + exercise picker
src/services/
├── stats_service.py                 # MODIFY — add get_recent_prs()
├── routine_service.py               # MODIFY — add get_day()
src/main.py                          # MODIFY — wire dashboard + manage sub-screens
pyproject.toml                       # MODIFY — add matplotlib
```

---

## Design Rules (enforced across all tasks)

### Destructive Action Styling (spec L872)
Destructive actions in bottom sheets use **text or outlined** style, NOT filled red:
```python
sheet.add_action("Delete", on_delete, destructive=True)  # style defaults to "text"
```
NEVER: `sheet.add_action("Delete", on_delete, style="filled", destructive=True)`

### Manage Sub-screen Pattern
All Manage sub-screens extend `ManageDetailScreen` which provides:
- Header bar with back arrow + title
- `go_back()` that calls `ManageScreen.pop_screen()`
- Standard dark background

### Empty States (spec L895-910)
- Centered text-secondary + one outlined action button. No illustrations.

---

## Task 1: ManageDetailScreen Base + Chart Utility + matplotlib

**Files:**
- Create: `src/screens/manage/manage_detail_screen.py`
- Create: `src/screens/components/chart_widget.py`
- Modify: `pyproject.toml` (add matplotlib)

- [ ] **Step 1: Add matplotlib to `pyproject.toml`**

```toml
dependencies = [
    "kivy>=2.3.0,<2.4",
    "kivymd>=2.0.0,<2.1",
    "matplotlib>=3.8.0",
]
```

- [ ] **Step 2: Create `src/screens/manage/manage_detail_screen.py`**

```python
"""Base class for all Manage sub-screens. Provides header with back button."""
from kivy.metrics import dp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDIconButton
from kivymd.uix.label import MDLabel

from src.screens.base_screen import BaseScreen
from src.theme import BACKGROUND, TEXT_PRIMARY, TEXT_SECONDARY


class ManageDetailScreen(BaseScreen):
    """Base for Manage drill-in screens. Subclasses override build_content()."""

    def __init__(self, title="", **kwargs):
        super().__init__(**kwargs)
        self._title = title
        self.md_bg_color = BACKGROUND
        self._header = None
        self._content_area = None

    def on_enter(self):
        self._build_layout()
        self.build_content(self._content_area)

    def _build_layout(self):
        self.clear_widgets()
        layout = MDBoxLayout(orientation="vertical")

        # Header with back button
        self._header = MDBoxLayout(size_hint_y=None, height=dp(56),
                                    padding=[dp(8), 0, dp(16), 0], spacing=dp(8))
        self._header.add_widget(MDIconButton(
            icon="arrow-left",
            theme_icon_color="Custom", icon_color=TEXT_SECONDARY,
            on_release=lambda *a: self.go_back(),
        ))
        self._header.add_widget(MDLabel(
            text=self._title,
            theme_text_color="Custom", text_color=TEXT_PRIMARY,
            font_style="Headline", role="small",
        ))
        layout.add_widget(self._header)

        # Content area for subclass
        self._content_area = MDBoxLayout(orientation="vertical")
        layout.add_widget(self._content_area)
        self.add_widget(layout)

    def build_content(self, container):
        """Override in subclasses to populate the content area."""
        pass

    def go_back(self):
        """Navigate back to manage section list."""
        screen = self
        while screen:
            from src.screens.manage.manage_screen import ManageScreen
            if isinstance(screen, ManageScreen):
                screen.pop_screen()
                return
            screen = screen.parent
```

- [ ] **Step 3: Create `src/screens/components/chart_widget.py`**

```python
"""Chart widget — renders matplotlib figures into Kivy Image widgets.

Applies the spec's dark theme. Usage:
    chart = ChartWidget()
    chart.plot_line(x_data, y_data, color="#4ADE80")
"""
import io
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from kivy.core.image import Image as CoreImage
from kivy.uix.image import Image
from kivy.metrics import dp

CHART_STYLE = {
    "figure.facecolor": "#1E1E1E",
    "axes.facecolor": "#1E1E1E",
    "axes.edgecolor": "#2A2A2A",
    "axes.labelcolor": "#9CA3AF",
    "axes.grid": True,
    "grid.color": "#2A2A2A",
    "grid.linewidth": 0.5,
    "text.color": "#F5F5F5",
    "xtick.color": "#9CA3AF",
    "ytick.color": "#9CA3AF",
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "lines.linewidth": 2,
    "lines.color": "#4ADE80",
    "figure.autolayout": True,
    "axes.spines.top": False,
    "axes.spines.right": False,
}
plt.rcParams.update(CHART_STYLE)

GREEN = "#4ADE80"
BLUE = "#60A5FA"


class ChartWidget(Image):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.size_hint_y = None
        self.height = dp(200)
        self.allow_stretch = True
        self.keep_ratio = True

    def plot_line(self, x_data, y_data, color=GREEN, ylabel="", secondary_data=None, secondary_color=BLUE):
        fig, ax = plt.subplots(figsize=(6, 3), dpi=100)
        ax.plot(x_data, y_data, color=color, linewidth=2)
        if secondary_data:
            ax.plot(x_data[:len(secondary_data)], secondary_data, color=secondary_color, linewidth=2, linestyle="--")
        if ylabel:
            ax.set_ylabel(ylabel, fontsize=9)
        ax.tick_params(axis="x", rotation=45)
        self._render(fig)

    def plot_bar(self, x_data, y_data, color=GREEN, ylabel=""):
        fig, ax = plt.subplots(figsize=(6, 3), dpi=100)
        ax.bar(range(len(x_data)), y_data, color=color, width=0.6, tick_label=x_data)
        if ylabel:
            ax.set_ylabel(ylabel, fontsize=9)
        ax.tick_params(axis="x", rotation=45)
        self._render(fig)

    def _render(self, fig):
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.1)
        plt.close(fig)
        buf.seek(0)
        self.texture = CoreImage(buf, ext="png").texture
```

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml src/screens/manage/manage_detail_screen.py src/screens/components/chart_widget.py
git commit -m "feat: ManageDetailScreen base class and ChartWidget matplotlib wrapper"
```

---

## Task 2: Stats Service Additions

**Files:**
- Modify: `src/services/stats_service.py`

Add methods needed by the dashboard before building the UI.

- [ ] **Step 1: Add `get_recent_prs()` to StatsService**

```python
    def get_recent_prs(self, limit: int = 5) -> List[dict]:
        """Recent personal records — highest weight per exercise, most recent first.

        Returns list of dicts: {exercise_name, weight, reps, session_date}
        """
        exercises = self._exercise_repo.list_all()
        prs = []
        for ex in exercises:
            best = self.get_exercise_best_set(ex.id)
            if best and best.get("weight"):
                prs.append({
                    "exercise_name": ex.name,
                    "weight": best["weight"],
                    "reps": best.get("reps"),
                    "session_date": best["session_date"],
                })
        # Sort by session_date descending
        prs.sort(key=lambda x: x["session_date"], reverse=True)
        return prs[:limit]
```

- [ ] **Step 2: Add `get_latest_plan_vs_actual_for_exercise()` to StatsService**

The dashboard exercise detail needs plan-vs-actual data. The existing `get_plan_vs_actual(session_exercise_id)` requires knowing the session_exercise_id, but the screen only has exercise_id. This method finds the most recent session_exercise with plan targets and returns the comparison.

```python
    def get_latest_plan_vs_actual_for_exercise(self, exercise_id: int) -> Optional[List[dict]]:
        """Get plan-vs-actual for the most recent session where this exercise had plan targets.

        Returns None if no plan-linked session found, otherwise the get_plan_vs_actual() result.
        """
        # Find recent session_exercises for this exercise that have plan targets
        row = self._workout_repo._fetchone(
            """SELECT se.id FROM session_exercises se
               JOIN workout_sessions ws ON se.session_id = ws.id
               WHERE se.exercise_id = ? AND se.routine_day_exercise_id IS NOT NULL
               AND ws.status = 'finished'
               ORDER BY ws.started_at DESC LIMIT 1""",
            (exercise_id,),
        )
        if not row:
            return None
        return self.get_plan_vs_actual(row["id"])
```

Note: This uses `_fetchone` on the workout_repo which accesses the repo's connection. This is a pragmatic choice — adding a dedicated repo method for this one query is fine too. The implementer can choose either approach.

- [ ] **Step 3: Verify tests pass, commit**

```bash
python -m pytest tests/ --tb=short -q
git add src/services/stats_service.py
git commit -m "feat: add get_recent_prs and get_latest_plan_vs_actual_for_exercise stats methods"
```

---

## Task 3: RoutineService Additions

**Files:**
- Modify: `src/services/routine_service.py`
- Modify: `src/repositories/routine_repo.py` (add `update_day_exercise_scheme`)

- [ ] **Step 1: Add `get_day()` to RoutineService**

```python
    def get_day(self, day_id: int) -> Optional[RoutineDay]:
        """Get a single routine day by ID."""
        return self._repo.get_day(day_id)
```

- [ ] **Step 2: Add `update_day_exercise_scheme()` to RoutineRepo**

The spec says `set_scheme` is authoritative (L164). When the user toggles between uniform/progressive in the target editor, the RDE must be updated.

```python
    # In RoutineRepo:
    def update_day_exercise_scheme(self, rde_id: int, set_scheme: SetScheme) -> None:
        self._execute(
            "UPDATE routine_day_exercises SET set_scheme = ? WHERE id = ?",
            (set_scheme.value, rde_id),
        )
```

- [ ] **Step 3: Add `update_day_exercise_scheme()` to RoutineService**

```python
    def update_day_exercise_scheme(self, rde_id: int, set_scheme: SetScheme) -> None:
        """Update the set scheme for a day exercise. set_scheme is authoritative per spec L164."""
        rde = self._repo.get_day_exercise(rde_id)
        if not rde:
            raise ValueError(f"Day exercise {rde_id} not found")
        self._repo.update_day_exercise_scheme(rde_id, set_scheme)
        day = self._repo.get_day(rde.routine_day_id)
        routine = self._repo.get_routine(day.routine_id)
        routine.updated_at = self._now()
        self._repo.update_routine(routine)
        self._repo.commit()
```

- [ ] **Step 4: Verify tests, commit**

```bash
python -m pytest tests/ --tb=short -q
git add src/services/routine_service.py src/repositories/routine_repo.py
git commit -m "feat: add get_day and update_day_exercise_scheme to RoutineService"
```

---

## Task 4: Units Screen

**Files:**
- Create: `src/screens/manage/units_screen.py`
- Modify: `src/main.py`

Extends `ManageDetailScreen`. Shows current unit, toggle button, conversion confirmation using AppBottomSheet with **text** style for destructive action (not filled).

- [ ] **Step 1: Create `src/screens/manage/units_screen.py`**

```python
"""Units screen — weight unit toggle with conversion confirmation."""
from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText
from kivymd.uix.label import MDLabel

from src.screens.manage.manage_detail_screen import ManageDetailScreen
from src.screens.components.bottom_sheet import AppBottomSheet
from src.theme import TEXT_PRIMARY, TEXT_SECONDARY


class UnitsScreen(ManageDetailScreen):
    def __init__(self, **kwargs):
        super().__init__(title="Units", **kwargs)

    def build_content(self, container):
        container.clear_widgets()
        layout = MDBoxLayout(orientation="vertical", padding=[dp(16), dp(24), dp(16), dp(16)], spacing=dp(24))

        current = self.app.settings_service.get_weight_unit()
        other = "kg" if current == "lbs" else "lbs"

        layout.add_widget(Widget(size_hint_y=0.2))
        layout.add_widget(MDLabel(
            text=f"Current unit: {current.upper()}", halign="center",
            theme_text_color="Custom", text_color=TEXT_PRIMARY,
            font_style="Headline", role="small", adaptive_height=True))
        layout.add_widget(MDLabel(
            text="Changing units converts all stored weights.", halign="center",
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Body", role="medium", adaptive_height=True))

        btn = MDButton(style="outlined", size_hint_x=None, width=dp(250), pos_hint={"center_x": 0.5})
        btn.add_widget(MDButtonText(text=f"Switch to {other.upper()}"))
        btn.bind(on_release=lambda *a: self._confirm(current, other))
        layout.add_widget(btn)
        layout.add_widget(Widget())
        container.add_widget(layout)

    def _confirm(self, from_unit, to_unit):
        sheet = AppBottomSheet(title=f"Convert to {to_unit.upper()}?")
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text=f"All weights will be converted from {from_unit} to {to_unit}. This cannot be undone.",
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Body", role="medium", adaptive_height=True))

        def on_confirm(*a):
            self.app.settings_service.set_weight_unit(to_unit)
            sheet.dismiss()
            self.build_content(self._content_area)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Convert", on_confirm, destructive=True)  # text style, not filled
        sheet.open()
```

- [ ] **Step 2: Wire into main.py and commit**

---

## Task 5: Exercise Catalog Screen

**Files:**
- Create: `src/screens/manage/exercise_catalog_screen.py`
- Modify: `src/main.py`

Extends `ManageDetailScreen`. List exercises, create via bottom sheet (name + type picker), archive/unarchive. Same structure as the original plan but using `ManageDetailScreen` base and correct destructive styling.

The implementer should read the plan's original Task 3 code (which had the full implementation) and adapt it to extend `ManageDetailScreen` instead of `BaseScreen`. Key changes:
- `__init__` passes `title="Exercise Catalog"` to super
- `build_content(container)` replaces `on_enter` + `_refresh`
- All bottom sheet destructive actions use text style

- [ ] **Step 1: Create the screen extending ManageDetailScreen**
- [ ] **Step 2: Wire into main.py and commit**

---

## Task 6: Exercise Picker Bottom Sheet (Reusable)

**Files:**
- Create: `src/screens/components/exercise_picker.py`

Same as the original plan's Task 4 — `ExercisePickerSheet` class with searchable exercise list. Used by routine editor (add exercise to day) and workout screen (ad-hoc add).

- [ ] **Step 1: Create with the original plan's code**
- [ ] **Step 2: Commit**

---

## Task 7a: Routine Editor — Routine List + Day CRUD + Reorder

**Files:**
- Create: `src/screens/manage/routine_editor_screen.py`
- Modify: `src/main.py`

Extends `ManageDetailScreen`. Three view levels managed internally:
1. **Routine list**: create, activate/deactivate, delete, tap to drill into days
2. **Day list**: add days, delete days, **reorder days via move up/down buttons**, tap to drill into exercises

Key additions vs. original plan:
- Day list shows move-up/move-down icon buttons per row
- Reorder calls `routine_service.reorder_days(routine_id, new_day_ids_order)`
- Back button in day list returns to routine list (internal state, not ManageScreen.pop_screen)

```python
# Day reorder — add to _show_day_list:
def _move_day_up(self, routine_id, day_id, days):
    idx = next(i for i, d in enumerate(days) if d.id == day_id)
    if idx == 0:
        return
    ids = [d.id for d in days]
    ids[idx], ids[idx-1] = ids[idx-1], ids[idx]
    self.app.routine_service.reorder_days(routine_id, ids)
    self._show_day_list(routine_id)

def _move_day_down(self, routine_id, day_id, days):
    idx = next(i for i, d in enumerate(days) if d.id == day_id)
    if idx >= len(days) - 1:
        return
    ids = [d.id for d in days]
    ids[idx], ids[idx+1] = ids[idx+1], ids[idx]
    self.app.routine_service.reorder_days(routine_id, ids)
    self._show_day_list(routine_id)
```

- [ ] **Step 1: Create routine_editor_screen.py with routine list + day CRUD + reorder**
- [ ] **Step 2: Wire into main.py and commit**

```bash
git commit -m "feat: routine editor with routine list, day CRUD, and day reorder"
```

---

## Task 7b: Routine Editor — Exercise Management + Target Editor (Uniform + Progressive)

**Files:**
- Modify: `src/screens/manage/routine_editor_screen.py`

Add the day detail view (level 3) with:
1. Exercise list with add (via ExercisePickerSheet) and remove
2. **Target editor bottom sheet** that supports BOTH uniform and progressive schemes

The target editor sheet:
- Shows a scheme selector: Uniform / Progressive toggle
- **Uniform mode**: num_sets stepper + single reps/weight/duration stepper row → calls `set_uniform_targets()`
- **Progressive mode**: per-set rows, each with its own reps/weight steppers. Add/remove set buttons. → calls `set_progressive_targets()` with list of dicts
- Detects exercise type to show appropriate stepper fields (reps+weight, reps only, duration, cardio)

```python
# In target editor sheet:
def _open_target_editor(self, rde_id, exercise):
    sheet = AppBottomSheet(title=f"Targets: {exercise.name}")
    sheet.set_height(400)

    # Scheme toggle
    scheme_state = {"value": "uniform"}
    scheme_row = MDBoxLayout(size_hint_y=None, height=dp(40), spacing=dp(8))

    uniform_btn = MDButton(style="filled" if scheme_state["value"] == "uniform" else "outlined")
    uniform_btn.add_widget(MDButtonText(text="Uniform"))

    progressive_btn = MDButton(style="outlined")
    progressive_btn.add_widget(MDButtonText(text="Progressive"))

    # Toggle between uniform and progressive rebuilds the content below
    # Uniform: num_sets + one row of steppers
    # Progressive: list of per-set stepper rows with add/remove

    # On save — update scheme (authoritative per spec L164) THEN save targets:
    new_scheme = SetScheme(scheme_state["value"])
    self.app.routine_service.update_day_exercise_scheme(rde_id, new_scheme)

    if scheme_state["value"] == "uniform":
        self.app.routine_service.set_uniform_targets(rde_id, ...)
    else:
        targets_data = [{"set_kind": sk, "reps_min": ..., "weight": ...} for each row]
        self.app.routine_service.set_progressive_targets(rde_id, targets_data)
```

**IMPORTANT:** The spec says `set_scheme` is authoritative (L164) — it controls UI display and default behavior. The target editor MUST call `update_day_exercise_scheme()` whenever the user toggles the scheme, before saving targets.

- [ ] **Step 1: Add day detail view with exercise list + target editor**
- [ ] **Step 2: Commit**

```bash
git commit -m "feat: routine editor exercise management + uniform/progressive target editor"
```

---

## Task 8: Benchmark Setup Screen

**Files:**
- Create: `src/screens/manage/benchmark_setup_screen.py`
- Modify: `src/main.py`

Extends `ManageDetailScreen`. Lists benchmark definitions grouped by `muscle_group_label`. Each row: exercise name + method + frequency. Create via exercise picker + method dropdown + frequency stepper + muscle group selector. Edit/delete existing.

Key service calls:
- `benchmark_service.list_definitions()` → group by `muscle_group_label`
- `benchmark_service.create_definition(exercise_id, method, muscle_group_label, reference_weight, frequency_weeks)`
- `benchmark_service.update_definition(defn)` / `delete_definition(defn_id)`
- Exercise lookup: `exercise_service.get_exercise(defn.exercise_id)`

All destructive actions use text style (not filled).

- [ ] **Step 1: Create the screen following exercise catalog pattern**
- [ ] **Step 2: Wire into main.py and commit**

---

## Task 9: Import/Export Screen (Routine Only)

**Files:**
- Create: `src/screens/manage/import_export_screen.py`
- Modify: `src/main.py`

Extends `ManageDetailScreen`. Two sections: Export and Import.

**Export:**
- List routines with "Export" button per row
- Tap → `import_export_service.export_routine(id)` → JSON string
- On desktop: show the JSON in a copyable text area or save to file
- On Android: can use clipboard or file save (defer file picker to polish)

**Import (two-step per spec):**
- Text area or file picker to load JSON
- Parse → `preview_import(data)` → show ImportPreview (name, day count, exercises, warnings, unmatched)
- If unmatched exercises: show mapping options (create new or pick existing via ExercisePickerSheet)
- "Import as Draft" or "Import and Activate" buttons
- `import_routine(data, exercise_mapping, activate)`

**Full backup/restore is explicitly deferred to Phase 4.** The import/export screen should note this: "Full backup coming soon" as a disabled section.

- [ ] **Step 1: Create the screen with export list + import flow**
- [ ] **Step 2: Wire into main.py and commit**

---

## Task 10: Dashboard Overview

**Files:**
- Create: `src/screens/dashboard/__init__.py`, `src/screens/dashboard/dashboard_screen.py`
- Modify: `src/main.py` (replace dashboard placeholder)

Dashboard with internal ScreenManager for drill-in (same pattern as ManageScreen). Overview shows:
- Session counts (this week / this month) as stat cards
- Total volume trend bar chart (4 weeks) via ChartWidget
- Recent PRs (from `stats_service.get_recent_prs(3)`) as single-line items
- Benchmark history link (always visible, shows due count if any are due)
- Exercise list for drill-in to detail view
- Empty state: "No workouts yet" + "Start Workout" button → `app.go_tab("workout")`

- [ ] **Step 1: Create dashboard screen with internal ScreenManager**
- [ ] **Step 2: Wire into main.py and commit**

---

## Task 11: Exercise Detail Screen (Charts)

**Files:**
- Create: `src/screens/dashboard/exercise_detail_screen.py`

Drill-in from dashboard overview. Shows:
- Weight-over-time line chart (ChartWidget)
- Volume-over-time bar chart (ChartWidget)
- Personal Best card (single highest-weight set — spec says "best sets history" but we show the top result; full best-sets timeline is a Phase 4 refinement)
- Plan-vs-actual comparison for the most recent plan-linked session

Plan-vs-actual: use `stats_service.get_latest_plan_vs_actual_for_exercise(exercise_id)` (added in Task 2). This returns a list of dicts with planned vs actual values, or None if no plan-linked session exists. Render as a simple table: set number, planned weight×reps, actual weight×reps.

- [ ] **Step 1: Create exercise detail screen with charts and plan-vs-actual**
- [ ] **Step 2: Commit**

---

## Task 12: Benchmark History Screen

**Files:**
- Create: `src/screens/dashboard/benchmark_history_screen.py`

Drill-in from dashboard. Shows all benchmark definitions grouped by muscle group, each with:
- Exercise name + method
- Latest result value
- Trend chart (ChartWidget.plot_line using `stats_service.get_benchmark_history(defn_id)`)

**Simplification note:** The spec describes "per-exercise trend chart with max weight, max reps, and timed hold lines" (L400), implying multiple method lines on one chart per exercise. This plan uses per-definition trend cards instead (one chart per definition). This is intentional — it's simpler, works well with the data model (one definition = one method), and can be enhanced to multi-method per-exercise charts in Phase 4 if needed.

- [ ] **Step 1: Create benchmark history screen with trend charts**
- [ ] **Step 2: Commit**

---

## Task 13: Day Picker Override

**Files:**
- Modify: `src/screens/workout/workout_screen.py`
- Modify: `src/screens/workout/workout_screen.kv`

Add a day picker row to the pre-session view. **Use MDButton, NOT SetChip** (SetChip overwrites chip_text based on set_kind).

Changes:
1. Add a `day_picker_container` id to the KV pre-session layout (MDBoxLayout, horizontal, height=dp(48))
2. In `_show_pre_session()`, populate it with MDButton per day:
   - Current cycle day: filled green
   - Others: outlined gray
   - Tapping updates `self._current_day_id` and refreshes the info label
3. Only show picker if the routine has more than 1 day

Add a `_selected_day_override` property to `WorkoutScreen.__init__`:
```python
self._selected_day_override = None  # Set by day picker, cleared on session start
```

Then in `_show_pre_session`, after getting `current_day` from cycle service, prefer the override:
```python
# Use manual selection if set, otherwise cycle day
effective_day = None
if self._selected_day_override:
    effective_day = self._selected_day_override
elif current_day:
    effective_day = current_day

self._current_day_id = effective_day.id if effective_day else None
```

Day picker population — uses `effective_day` for selected state:
```python
picker = self.ids.day_picker_container
picker.clear_widgets()
if len(days) > 1:
    for day in days:
        is_selected = effective_day and day.id == effective_day.id
        btn = MDButton(
            style="filled" if is_selected else "outlined",
            size_hint_x=None, width=dp(56),
        )
        if is_selected:
            btn.theme_bg_color = "Custom"
            btn.md_bg_color = PRIMARY
        btn.add_widget(MDButtonText(text=day.label))
        btn.bind(on_release=lambda *a, d=day: self._select_day(d))
        picker.add_widget(btn)
```

Day selection sets the override without calling _show_pre_session (avoids reset):
```python
def _select_day(self, day):
    self._selected_day_override = day
    self._current_day_id = day.id
    self.ids.day_info_label.text = f"Day {day.label} — {day.name}"
    # Rebuild just the picker row to update button states
    self._rebuild_day_picker(day)
```

Clear override on session start:
```python
def start_session(self):
    # ... existing code ...
    self._selected_day_override = None  # Clear override after starting
```

- [ ] **Step 1: Add day_picker_container to KV and implement _select_day**
- [ ] **Step 2: Commit**

```bash
git commit -m "feat: day picker override in workout pre-session view"
```

---

## Task 14: Exercise Picker for Ad-hoc Add

**Files:**
- Modify: `src/screens/workout/workout_screen.py`

Replace the placeholder `add_exercise()` with real ExercisePickerSheet usage:

```python
def add_exercise(self):
    from src.screens.components.exercise_picker import ExercisePickerSheet

    def on_select(exercise_id, exercise_name):
        self.app.workout_service.add_exercise_to_session(self.current_session_id, exercise_id)
        self._rebuild_cards()

    picker = ExercisePickerSheet(self.app, on_select=on_select, title="Add Exercise")
    picker.open()
```

- [ ] **Step 1: Replace add_exercise placeholder**
- [ ] **Step 2: Commit**

```bash
git commit -m "feat: exercise picker for ad-hoc exercise add during workout"
```

---

## Final: Wire All Screens (Verification Reference)

Each task above includes its own wiring step. After all tasks, `main.py._build_ui()` should contain:

```python
# Dashboard (replace placeholder)
from src.screens.dashboard.dashboard_screen import DashboardScreen
# Replace: self.tab_manager.add_widget(PlaceholderScreen("dashboard"))
# With:    self.tab_manager.add_widget(DashboardScreen(name="dashboard"))

# Manage sub-screens
manage_screen = self.tab_manager.get_screen("manage")
from src.screens.manage.units_screen import UnitsScreen
from src.screens.manage.exercise_catalog_screen import ExerciseCatalogScreen
from src.screens.manage.routine_editor_screen import RoutineEditorScreen
from src.screens.manage.benchmark_setup_screen import BenchmarkSetupScreen
from src.screens.manage.import_export_screen import ImportExportScreen

manage_screen.add_detail_screen("units", UnitsScreen(name="manage_units"))
manage_screen.add_detail_screen("exercises", ExerciseCatalogScreen(name="manage_exercises"))
manage_screen.add_detail_screen("routines", RoutineEditorScreen(name="manage_routines"))
manage_screen.add_detail_screen("benchmarks", BenchmarkSetupScreen(name="manage_benchmarks"))
manage_screen.add_detail_screen("import_export", ImportExportScreen(name="manage_import_export"))
```

---

## Verification Checkpoint

After completing all 14 tasks:

1. **Tests:** all existing tests pass
2. **Manage → Units:** toggle lbs/kg with confirmation (text-style destructive button)
3. **Manage → Exercises:** create, list, archive, unarchive, toggle show archived
4. **Manage → Routines:** create → add days → reorder days → add exercises → set uniform AND progressive targets → activate
5. **Manage → Benchmarks:** create/edit/delete definitions, grouped by muscle group
6. **Manage → Import/Export:** export routine as JSON, import with preview + exercise mapping
7. **Dashboard overview:** session counts, volume trend chart, recent PRs, exercise list
8. **Dashboard → Exercise:** weight + volume charts, personal best, plan-vs-actual
9. **Dashboard → Benchmarks:** trend charts grouped by muscle group
10. **Workout day picker:** tap different day → switches selection, start uses picked day
11. **Workout + Add Exercise:** picker opens, select → card appears in session
12. **Full end-to-end:** Create routine with progressive targets → activate → start workout → log sets → finish → dashboard shows data → export routine

**Explicitly deferred to Phase 4:**
- Benchmark session UI (separate logging flow — pick definitions, record results)
- Full DB backup/restore (file-system operation)
- PR detection as time-series events (current "recent PRs" shows best-per-exercise, not true PR timeline)
