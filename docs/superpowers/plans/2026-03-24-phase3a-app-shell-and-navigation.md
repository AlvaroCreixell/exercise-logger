# Phase 3A: App Shell, Theme & Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the Kivy+KivyMD app running with dark theme, four-tab bottom navigation, a functional Home screen, and a Manage screen with drill-in navigation stub. This is the foundation all other screens build on.

**Architecture:** MDApp with a root ScreenManager for tab content. Each tab owns a nested ScreenManager for drill-in sub-screens (e.g., Manage → Routines → Editor). A small navigation helper (`go_tab`, `push_screen`, `pop_screen`) keeps screen transitions consistent and ensures the nav bar stays in sync. Services are instantiated once at app start and stored on the app instance. Screens access services via `BaseScreen._get_app()`.

**Tech Stack:** Python 3.10+, Kivy 2.3.1, KivyMD 2.0.1.dev0, SQLite3 (via Phase 1+2 services).

**Spec reference:** `docs/superpowers/specs/2026-03-23-exercise-logger-greenfield-design.md` — Navigation (L373-407), Frontend Design Addendum (L704-953).

---

## Phase 3 Decomposition

| Sub-phase | Scope | Depends on |
|-----------|-------|------------|
| **Phase 3A** (this plan) | App shell, theme, nav layer, Home screen, Manage screen | Phase 1+2 |
| **Phase 3B** (separate plan) | Workout screen + components (exercise cards, steppers, chips) | Phase 3A |
| **Phase 3C** (separate plan) | Dashboard, routine editor, exercise catalog, benchmark screens, charts | Phase 3A |

---

## Module/Packaging Strategy

The project root is `.` (where `pyproject.toml` lives). All Python imports use `src.` as the package prefix (e.g., `from src.services.workout_service import WorkoutService`). This is consistent with Phase 1+2 code and the pytest `pythonpath = ["."]` setting.

For Buildozer (Android), `source.dir = .` and the entry point is `src/main.py`. Buildozer is an **optional tail task** — not on the critical path for getting the app running on desktop.

**WSL note:** Buildozer requires Linux. On Windows, run from WSL2 with the project on the WSL filesystem (not `/mnt/c/`).

---

## Design Reference (from Frontend Addendum)

### Color Palette
```
Background:        #121212  → RGBA (0.071, 0.071, 0.071, 1)
Surface/Cards:     #1E1E1E  → RGBA (0.118, 0.118, 0.118, 1)
Primary accent:    #4ADE80  → RGBA (0.290, 0.871, 0.502, 1)  green
Secondary accent:  #60A5FA  → RGBA (0.376, 0.647, 0.980, 1)  blue
Destructive:       #F87171  → RGBA (0.973, 0.443, 0.443, 1)  red
Text primary:      #F5F5F5  → RGBA (0.961, 0.961, 0.961, 1)
Text secondary:    #9CA3AF  → RGBA (0.612, 0.639, 0.686, 1)
Dividers:          #2A2A2A  → RGBA (0.165, 0.165, 0.165, 1)
```

### Bottom Navigation
- 4 tabs: Home, Workout, Dashboard, Manage
- Icons only, no labels (4 tabs is few enough)
- Active: `#4ADE80` icon. Inactive: `#9CA3AF` icons.

### Transitions
- Tab switch: none/crossfade 150ms
- Drill-in: slide left 200ms. Back: slide right 200ms.

### Empty States
- Centered text (text-secondary) + one outlined action button. No illustrations.

---

## File Structure

```
src/
├── main.py                          # NEW — MDApp, service init, root layout
├── theme.py                         # NEW — Color constants, theme setup
├── screens/
│   ├── __init__.py                  # NEW
│   ├── base_screen.py               # NEW — BaseScreen with _get_app() helper
│   ├── home/
│   │   ├── __init__.py              # NEW
│   │   ├── home_screen.py           # NEW — Home screen logic
│   │   └── home_screen.kv           # NEW — Home screen layout
│   └── manage/
│       ├── __init__.py              # NEW
│       ├── manage_screen.py         # NEW — Manage screen with section list
│       └── manage_screen.kv         # NEW — Manage screen layout
pyproject.toml                       # MODIFY — add pinned kivy, kivymd deps
buildozer.spec                       # NEW (optional tail task)
```

---

## Task 1: Dependencies + Theme + BaseScreen

**Files:**
- Modify: `pyproject.toml`
- Create: `src/theme.py`, `src/screens/__init__.py`, `src/screens/base_screen.py`

- [ ] **Step 1: Update `pyproject.toml`**

```toml
[project]
name = "exercise-logger"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "kivy>=2.3.0,<2.4",
    "kivymd>=2.0.0,<2.1",
]

[project.optional-dependencies]
dev = ["pytest>=7.0"]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
```

- [ ] **Step 2: Create `src/theme.py`**

```python
"""App theme — color palette and KivyMD theme configuration.

All colors from spec Frontend Design Addendum.
Industrial minimalism. Dark. Two accents (green + blue) + red for destructive.
"""

# RGBA tuples (0-1 range) for Python/Kivy use
BACKGROUND = (0.071, 0.071, 0.071, 1)       # #121212
SURFACE = (0.118, 0.118, 0.118, 1)          # #1E1E1E
PRIMARY = (0.290, 0.871, 0.502, 1)          # #4ADE80
SECONDARY = (0.376, 0.647, 0.980, 1)        # #60A5FA
DESTRUCTIVE = (0.973, 0.443, 0.443, 1)      # #F87171
TEXT_PRIMARY = (0.961, 0.961, 0.961, 1)      # #F5F5F5
TEXT_SECONDARY = (0.612, 0.639, 0.686, 1)   # #9CA3AF
DIVIDER = (0.165, 0.165, 0.165, 1)          # #2A2A2A


def setup_theme(app):
    """Configure KivyMD dark theme. Call in build()."""
    app.theme_cls.theme_style = "Dark"
    app.theme_cls.primary_palette = "Green"
```

- [ ] **Step 3: Create `src/screens/__init__.py`** (empty)

- [ ] **Step 4: Create `src/screens/base_screen.py`**

```python
"""Base screen with app/service access helpers."""
from kivymd.uix.screen import MDScreen


class BaseScreen(MDScreen):
    """Base class for all app screens. Provides service access."""

    @property
    def app(self):
        from kivymd.app import MDApp
        return MDApp.get_running_app()
```

- [ ] **Step 5: Install dependencies**

```bash
pip install "kivy>=2.3.0,<2.4" "kivymd>=2.0.0,<2.1"
```

- [ ] **Step 6: Verify existing tests still pass**

```bash
python -m pytest tests/ --tb=short -q
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml src/theme.py src/screens/__init__.py src/screens/base_screen.py
git commit -m "feat: theme module, base screen helper, pinned Kivy/KivyMD deps"
```

---

## Task 2: App Shell + Navigation Layer

**Files:**
- Create: `src/main.py`

This is the core entry point: DB init, service wiring, screen manager, bottom nav, and navigation helpers (`go_tab`).

- [ ] **Step 1: Create `src/main.py`**

```python
"""Exercise Logger — main app entry point.

Initializes database, services, screen manager, and bottom navigation.
"""
from kivy.metrics import dp
from kivy.properties import ObjectProperty, StringProperty
from kivy.uix.screenmanager import ScreenManager, NoTransition, SlideTransition
from kivymd.app import MDApp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel
from kivymd.uix.navigationbar import (
    MDNavigationBar,
    MDNavigationItem,
    MDNavigationItemIcon,
)
from kivymd.uix.screen import MDScreen

from src.theme import setup_theme, BACKGROUND, TEXT_SECONDARY
from src.config import get_db_path
from src.db.connection import create_connection
from src.db.schema import init_db

from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.routine_repo import RoutineRepo
from src.repositories.cycle_repo import CycleRepo
from src.repositories.workout_repo import WorkoutRepo
from src.repositories.benchmark_repo import BenchmarkRepo
from src.repositories.settings_repo import SettingsRepo

from src.services.exercise_service import ExerciseService
from src.services.routine_service import RoutineService
from src.services.cycle_service import CycleService
from src.services.workout_service import WorkoutService
from src.services.benchmark_service import BenchmarkService
from src.services.stats_service import StatsService
from src.services.import_export_service import ImportExportService
from src.services.settings_service import SettingsService


# Tab name <-> nav icon mapping (order matters — matches nav bar item order)
TABS = [
    ("home", "home"),
    ("workout", "dumbbell"),
    ("dashboard", "chart-line"),
    ("manage", "cog"),
]


class PlaceholderScreen(MDScreen):
    """Temporary placeholder for screens not yet built."""

    def __init__(self, screen_name, **kwargs):
        super().__init__(**kwargs)
        self.name = screen_name
        self.md_bg_color = BACKGROUND
        self.add_widget(MDLabel(
            text=f"{screen_name.title()} — Coming Soon",
            halign="center",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
        ))


class ExerciseLoggerApp(MDApp):
    """Main application."""

    # Services (set during build, accessed by screens via app.X_service)
    exercise_service = ObjectProperty(None)
    routine_service = ObjectProperty(None)
    cycle_service = ObjectProperty(None)
    workout_service = ObjectProperty(None)
    benchmark_service = ObjectProperty(None)
    stats_service = ObjectProperty(None)
    import_export_service = ObjectProperty(None)
    settings_service = ObjectProperty(None)

    current_tab = StringProperty("home")

    def build(self):
        self.title = "Exercise Logger"
        setup_theme(self)
        self._init_services()
        return self._build_ui()

    def _init_services(self):
        """Create DB connection and instantiate all services."""
        db_path = get_db_path()
        self.conn = create_connection(db_path)
        init_db(self.conn)

        # Repos
        exercise_repo = ExerciseRepo(self.conn)
        routine_repo = RoutineRepo(self.conn)
        cycle_repo = CycleRepo(self.conn)
        workout_repo = WorkoutRepo(self.conn)
        benchmark_repo = BenchmarkRepo(self.conn)
        settings_repo = SettingsRepo(self.conn)

        # Services
        self.cycle_service = CycleService(cycle_repo, routine_repo)
        self.exercise_service = ExerciseService(exercise_repo)
        self.routine_service = RoutineService(routine_repo, exercise_repo, self.cycle_service)
        self.workout_service = WorkoutService(workout_repo, routine_repo, exercise_repo, self.cycle_service)
        self.benchmark_service = BenchmarkService(benchmark_repo, exercise_repo)
        self.stats_service = StatsService(workout_repo, exercise_repo)
        self.import_export_service = ImportExportService(
            exercise_repo, routine_repo, benchmark_repo, self.cycle_service,
        )
        self.settings_service = SettingsService(settings_repo, self.conn)

    def _build_ui(self):
        """Assemble root layout: screen manager + bottom nav."""
        self.root_layout = MDBoxLayout(orientation="vertical")

        # Tab screen manager (top-level, no transition for tab switches)
        self.tab_manager = ScreenManager(transition=NoTransition())

        # Import real screens
        from src.screens.home.home_screen import HomeScreen
        from src.screens.manage.manage_screen import ManageScreen

        self.tab_manager.add_widget(HomeScreen(name="home"))
        self.tab_manager.add_widget(PlaceholderScreen("workout"))
        self.tab_manager.add_widget(PlaceholderScreen("dashboard"))
        self.tab_manager.add_widget(ManageScreen(name="manage"))

        self.root_layout.add_widget(self.tab_manager)

        # Bottom navigation — store items by tab name for direct sync
        self._nav_items = {}
        nav_widgets = []
        for tab_name, icon in TABS:
            item = MDNavigationItem(
                MDNavigationItemIcon(icon=icon),
                active=(tab_name == "home"),
            )
            self._nav_items[tab_name] = item
            nav_widgets.append(item)

        self.nav_bar = MDNavigationBar(
            *nav_widgets,
            on_switch_tabs=self._on_nav_switch,
        )
        self.root_layout.add_widget(self.nav_bar)

        return self.root_layout

    def _on_nav_switch(self, bar, item, item_icon, item_text):
        """Handle bottom nav tap."""
        for tab_name, icon in TABS:
            if icon == item_icon:
                self.go_tab(tab_name)
                break

    # --- Navigation helpers (used by screens) ---

    def go_tab(self, tab_name: str):
        """Switch to a tab by name. Updates screen manager and nav bar selection."""
        if tab_name == self.current_tab:
            return
        self.tab_manager.current = tab_name
        self.current_tab = tab_name
        # Sync nav bar — direct reference, no child-order guessing
        if tab_name in self._nav_items:
            self.nav_bar.set_active_item(self._nav_items[tab_name])

    def on_stop(self):
        """Clean up DB connection."""
        if hasattr(self, "conn") and self.conn:
            self.conn.close()


def main():
    ExerciseLoggerApp().run()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify imports work**

```bash
python -c "from src.main import ExerciseLoggerApp; print('OK')"
```

- [ ] **Step 3: Verify tests still pass**

```bash
python -m pytest tests/ --tb=short -q
```

- [ ] **Step 4: Commit**

```bash
git add src/main.py
git commit -m "feat: app shell with service init, tab manager, bottom nav, go_tab helper"
```

---

## Task 3: Home Screen

**Files:**
- Create: `src/screens/home/__init__.py`, `src/screens/home/home_screen.py`, `src/screens/home/home_screen.kv`

Home screen: active routine + current day (hero text), Start Workout button, last workout summary, benchmark due alerts, in-progress session banner, empty state.

- [ ] **Step 1: Create `src/screens/home/__init__.py`** (empty)

- [ ] **Step 2: Create `src/screens/home/home_screen.kv`**

```yaml
#:import BACKGROUND src.theme.BACKGROUND
#:import SURFACE src.theme.SURFACE
#:import PRIMARY src.theme.PRIMARY
#:import SECONDARY src.theme.SECONDARY
#:import TEXT_PRIMARY src.theme.TEXT_PRIMARY
#:import TEXT_SECONDARY src.theme.TEXT_SECONDARY
#:import dp kivy.metrics.dp

<HomeScreen>:
    md_bg_color: BACKGROUND

    MDBoxLayout:
        orientation: "vertical"
        padding: [dp(16), dp(16), dp(16), dp(16)]
        spacing: dp(16)

        # In-progress session banner
        MDCard:
            id: session_banner
            size_hint_y: None
            height: 0
            opacity: 0
            md_bg_color: SURFACE
            padding: [dp(12), dp(8), dp(12), dp(8)]
            radius: [dp(8)]

            MDBoxLayout:
                spacing: dp(8)

                MDLabel:
                    text: "Unfinished workout"
                    theme_text_color: "Custom"
                    text_color: TEXT_PRIMARY
                    font_style: "Body"
                    role: "large"
                    size_hint_x: 0.5

                MDButton:
                    style: "filled"
                    theme_bg_color: "Custom"
                    md_bg_color: PRIMARY
                    on_release: root.resume_session()
                    size_hint_x: 0.25

                    MDButtonText:
                        text: "Resume"
                        theme_text_color: "Custom"
                        text_color: [0.071, 0.071, 0.071, 1]

                MDButton:
                    style: "text"
                    on_release: root.end_session()
                    size_hint_x: 0.25

                    MDButtonText:
                        text: "End"
                        theme_text_color: "Custom"
                        text_color: TEXT_SECONDARY

        # Spacer
        Widget:
            size_hint_y: 0.15

        # Hero — routine name + current day
        MDLabel:
            id: routine_name_label
            text: "No routine set up"
            halign: "center"
            theme_text_color: "Custom"
            text_color: TEXT_SECONDARY
            font_style: "Headline"
            role: "small"
            adaptive_height: True

        MDLabel:
            id: current_day_label
            text: ""
            halign: "center"
            theme_text_color: "Custom"
            text_color: TEXT_PRIMARY
            font_style: "Headline"
            role: "medium"
            adaptive_height: True
            bold: True

        # Start Workout button
        MDButton:
            id: start_button
            style: "filled"
            theme_bg_color: "Custom"
            md_bg_color: PRIMARY
            size_hint_x: 1
            height: dp(56)
            on_release: root.start_workout()

            MDButtonText:
                text: "Start Workout"
                theme_text_color: "Custom"
                text_color: [0.071, 0.071, 0.071, 1]
                font_style: "Title"
                role: "medium"
                bold: True

        Widget:
            size_hint_y: 0.05

        # Last workout summary
        MDLabel:
            id: last_workout_label
            text: ""
            halign: "center"
            theme_text_color: "Custom"
            text_color: TEXT_SECONDARY
            font_style: "Body"
            role: "medium"
            adaptive_height: True

        # Benchmark due alerts
        MDBoxLayout:
            id: benchmark_alerts
            orientation: "vertical"
            spacing: dp(4)
            adaptive_height: True

        # Empty state action
        MDButton:
            id: empty_state_button
            style: "outlined"
            size_hint_x: None
            width: dp(200)
            pos_hint: {"center_x": 0.5}
            opacity: 0
            disabled: True
            on_release: root.go_to_manage()

            MDButtonText:
                text: "Create Routine"
                theme_text_color: "Custom"
                text_color: TEXT_SECONDARY

        Widget:
            size_hint_y: 0.3
```

- [ ] **Step 3: Create `src/screens/home/home_screen.py`**

```python
"""Home screen — current routine, start button, session recovery, benchmark alerts."""
import os
from kivy.lang import Builder
from kivy.metrics import dp
from kivymd.uix.label import MDLabel

from src.screens.base_screen import BaseScreen
from src.theme import SECONDARY

Builder.load_file(os.path.join(os.path.dirname(__file__), "home_screen.kv"))


class HomeScreen(BaseScreen):

    _in_progress_session_id = None

    def on_enter(self):
        self._refresh()

    def _refresh(self):
        if not self.app:
            return
        self._update_routine_info()
        self._update_last_workout()
        self._update_session_banner()
        self._update_benchmark_alerts()

    def _update_routine_info(self):
        routine = self.app.routine_service.get_active_routine()
        if not routine:
            self.ids.routine_name_label.text = "No routine set up"
            self.ids.current_day_label.text = ""
            self.ids.start_button.disabled = True
            self.ids.start_button.opacity = 0.3
            self.ids.empty_state_button.opacity = 1
            self.ids.empty_state_button.disabled = False
            return

        self.ids.empty_state_button.opacity = 0
        self.ids.empty_state_button.disabled = True
        self.ids.start_button.disabled = False
        self.ids.start_button.opacity = 1
        self.ids.routine_name_label.text = routine.name

        current_day = self.app.cycle_service.get_current_day(routine.id)
        if current_day:
            self.ids.current_day_label.text = f"Day {current_day.label} — {current_day.name}"
        else:
            self.ids.current_day_label.text = ""

    def _update_last_workout(self):
        summary = self.app.stats_service.get_last_workout_summary()
        if not summary:
            self.ids.last_workout_label.text = ""
            return
        parts = []
        if summary["started_at"]:
            parts.append(summary["started_at"][:10])
        if summary["day_label"] and summary["day_name"]:
            parts.append(f"Day {summary['day_label']} {summary['day_name']}")
        if summary["duration_minutes"] is not None:
            parts.append(f"{summary['duration_minutes']} min")
        self.ids.last_workout_label.text = " — ".join(parts)

    def _update_session_banner(self):
        session = self.app.workout_service.get_in_progress_session()
        banner = self.ids.session_banner
        if session:
            banner.opacity = 1
            banner.height = dp(56)
            self._in_progress_session_id = session.id
        else:
            banner.opacity = 0
            banner.height = 0
            self._in_progress_session_id = None

    def _update_benchmark_alerts(self):
        container = self.ids.benchmark_alerts
        container.clear_widgets()
        due = self.app.benchmark_service.get_due_benchmarks()
        for defn in due[:3]:
            exercise = self.app.exercise_service.get_exercise(defn.exercise_id)
            if not exercise:
                continue
            container.add_widget(MDLabel(
                text=f"Benchmark due: {exercise.name} ({defn.method.value.replace('_', ' ')})",
                theme_text_color="Custom",
                text_color=SECONDARY,
                font_style="Body",
                role="small",
                halign="center",
                adaptive_height=True,
            ))

    def start_workout(self):
        self.app.go_tab("workout")

    def resume_session(self):
        self.app.go_tab("workout")

    def end_session(self):
        # TODO: Phase 3B — replace with confirmation bottom sheet per spec L876.
        # Direct end_early() is an intentional temporary deviation for 3A scaffolding.
        if self._in_progress_session_id:
            self.app.workout_service.end_early(self._in_progress_session_id)
            self._refresh()

    def go_to_manage(self):
        self.app.go_tab("manage")
```

- [ ] **Step 4: Verify app launches with Home screen**

Desktop with display:
```bash
python -m src.main
```

Verify: dark background, "No routine set up" centered, "Create Routine" button, bottom nav with 4 icons.

- [ ] **Step 5: Verify tests pass**

```bash
python -m pytest tests/ --tb=short -q
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/home/
git commit -m "feat: home screen with routine info, session banner, benchmark alerts"
```

---

## Task 4: Manage Screen with Nested Navigation

**Files:**
- Create: `src/screens/manage/__init__.py`, `src/screens/manage/manage_screen.py`, `src/screens/manage/manage_screen.kv`

Manage screen uses a **nested ScreenManager** for drill-in sub-screens. The section list is the "root" screen. Tapping a row pushes a placeholder detail screen (slide-left). A back button pops back (slide-right). Phase 3C replaces placeholders with real screens.

This also adds `push_screen()` / `pop_screen()` helpers to `ManageScreen` that Phase 3C sub-screens will call.

- [ ] **Step 1: Create `src/screens/manage/__init__.py`** (empty)

- [ ] **Step 2: Create `src/screens/manage/manage_screen.kv`**

```yaml
#:import BACKGROUND src.theme.BACKGROUND
#:import TEXT_PRIMARY src.theme.TEXT_PRIMARY
#:import TEXT_SECONDARY src.theme.TEXT_SECONDARY
#:import dp kivy.metrics.dp

<ManageSectionItem>:
    size_hint_y: None
    height: dp(56)
    padding: [dp(16), 0, dp(16), 0]
    md_bg_color: BACKGROUND

    MDBoxLayout:
        spacing: dp(16)

        MDIcon:
            icon: root.icon
            theme_text_color: "Custom"
            text_color: TEXT_SECONDARY
            pos_hint: {"center_y": 0.5}

        MDLabel:
            text: root.label_text
            theme_text_color: "Custom"
            text_color: TEXT_PRIMARY
            font_style: "Title"
            role: "small"
            pos_hint: {"center_y": 0.5}

        MDIcon:
            icon: "chevron-right"
            theme_text_color: "Custom"
            text_color: TEXT_SECONDARY
            pos_hint: {"center_y": 0.5}


<ManageSectionList>:
    md_bg_color: BACKGROUND

    MDBoxLayout:
        orientation: "vertical"

        MDBoxLayout:
            size_hint_y: None
            height: dp(56)
            padding: [dp(16), 0, dp(16), 0]

            MDLabel:
                text: "Manage"
                theme_text_color: "Custom"
                text_color: TEXT_PRIMARY
                font_style: "Headline"
                role: "small"
                pos_hint: {"center_y": 0.5}

        ScrollView:
            MDBoxLayout:
                id: section_list
                orientation: "vertical"
                adaptive_height: True
                spacing: dp(1)


<PlaceholderDetailScreen>:
    md_bg_color: BACKGROUND

    MDBoxLayout:
        orientation: "vertical"

        MDBoxLayout:
            size_hint_y: None
            height: dp(56)
            padding: [dp(8), 0, dp(16), 0]
            spacing: dp(8)

            MDIconButton:
                icon: "arrow-left"
                theme_icon_color: "Custom"
                icon_color: TEXT_SECONDARY
                on_release: root.go_back()
                pos_hint: {"center_y": 0.5}

            MDLabel:
                text: root.title_text
                theme_text_color: "Custom"
                text_color: TEXT_PRIMARY
                font_style: "Headline"
                role: "small"
                pos_hint: {"center_y": 0.5}

        MDLabel:
            text: "Coming in Phase 3C"
            halign: "center"
            theme_text_color: "Custom"
            text_color: TEXT_SECONDARY
            font_style: "Body"
            role: "large"
```

- [ ] **Step 3: Create `src/screens/manage/manage_screen.py`**

```python
"""Manage screen — section list with nested drill-in navigation.

Uses a nested ScreenManager so tapping a section slides in a detail screen.
Phase 3C replaces PlaceholderDetailScreen with real sub-screens.
"""
import os
from kivy.lang import Builder
from kivy.properties import StringProperty
from kivy.uix.behaviors import ButtonBehavior
from kivy.uix.screenmanager import ScreenManager, SlideTransition
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.screen import MDScreen

from src.screens.base_screen import BaseScreen

Builder.load_file(os.path.join(os.path.dirname(__file__), "manage_screen.kv"))

MANAGE_SECTIONS = [
    {"icon": "clipboard-list-outline", "label": "Routines", "screen": "routines"},
    {"icon": "format-list-bulleted", "label": "Exercise Catalog", "screen": "exercises"},
    {"icon": "trophy-outline", "label": "Benchmarks", "screen": "benchmarks"},
    {"icon": "swap-horizontal", "label": "Import / Export", "screen": "import_export"},
    {"icon": "scale", "label": "Units", "screen": "units"},
]


class ManageSectionItem(ButtonBehavior, MDBoxLayout):
    """Tappable section row. ButtonBehavior provides on_release."""
    icon = StringProperty("")
    label_text = StringProperty("")
    screen_name = StringProperty("")

    def on_release(self):
        # Walk up to find the ManageScreen and push the detail screen
        screen = self
        while screen and not isinstance(screen, ManageScreen):
            screen = screen.parent
        if screen:
            screen.push_screen(self.screen_name, self.label_text)


class ManageSectionList(MDScreen):
    """The root 'list' screen inside Manage's nested ScreenManager."""
    pass


class PlaceholderDetailScreen(MDScreen):
    """Temporary detail screen for sections not yet implemented."""
    title_text = StringProperty("")

    def go_back(self):
        screen = self
        while screen and not isinstance(screen, ManageScreen):
            screen = screen.parent
        if screen:
            screen.pop_screen()


class ManageScreen(BaseScreen):
    """Manage tab — flat section list with nested drill-in navigation.

    Phase 3C adds real detail screens by calling:
        manage_screen.add_detail_screen("routines", RoutineEditorScreen(...))
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Nested screen manager for drill-in
        self._nav_stack = []
        self.sub_manager = ScreenManager()
        self.add_widget(self.sub_manager)

        # Add root section list
        self._section_list = ManageSectionList(name="manage_root")
        self.sub_manager.add_widget(self._section_list)

        # Pre-create placeholder detail screens for each section
        for section in MANAGE_SECTIONS:
            placeholder = PlaceholderDetailScreen(
                name=f"manage_{section['screen']}",
                title_text=section["label"],
            )
            self.sub_manager.add_widget(placeholder)

    def on_enter(self):
        container = self._section_list.ids.section_list
        if container.children:
            return
        for section in MANAGE_SECTIONS:
            container.add_widget(ManageSectionItem(
                icon=section["icon"],
                label_text=section["label"],
                screen_name=section["screen"],
            ))

    def push_screen(self, screen_name: str, title: str = ""):
        """Navigate to a detail screen (slide left)."""
        full_name = f"manage_{screen_name}"
        self.sub_manager.transition = SlideTransition(direction="left", duration=0.2)
        self._nav_stack.append(self.sub_manager.current)
        self.sub_manager.current = full_name

    def pop_screen(self):
        """Go back to previous screen (slide right)."""
        if self._nav_stack:
            prev = self._nav_stack.pop()
            self.sub_manager.transition = SlideTransition(direction="right", duration=0.2)
            self.sub_manager.current = prev

    def add_detail_screen(self, section_name: str, screen: MDScreen):
        """Replace a placeholder detail screen with a real one (for Phase 3C).

        Usage: manage_screen.add_detail_screen("routines", RoutineEditorScreen(...))
        """
        full_name = f"manage_{section_name}"
        old = self.sub_manager.get_screen(full_name)
        if old:
            self.sub_manager.remove_widget(old)
        screen.name = full_name
        self.sub_manager.add_widget(screen)
```

- [ ] **Step 4: Verify drill-in navigation works**

```bash
python -m src.main
```

Verify:
- Home → tap cog → Manage shows 5 rows
- Tap "Routines" → slides left to "Routines — Coming in Phase 3C" with back arrow
- Tap back arrow → slides right back to section list
- Tap other sections → same drill-in behavior
- Bottom nav still works (tap home → Home screen)

- [ ] **Step 5: Verify tests pass**

```bash
python -m pytest tests/ --tb=short -q
```

- [ ] **Step 6: Commit**

```bash
git add src/screens/manage/
git commit -m "feat: manage screen with nested navigation (push/pop drill-in, placeholder details)"
```

---

## Task 5 (Optional): Buildozer Spec + .gitignore

This is NOT on the critical path. Skip if you're focused on desktop dev.

**Files:**
- Create: `buildozer.spec` (project root)
- Modify: `.gitignore`

- [ ] **Step 1: Create `buildozer.spec`**

```ini
[app]
title = Exercise Logger
package.name = exerciselogger
package.domain = com.exerciselogger

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,ttf,json

version = 0.1.0

# NOTE: KivyMD is pulled from master.zip for Buildozer because pip-installed
# KivyMD often fails to package correctly. This intentionally diverges from
# pyproject.toml's pinned range. Pin to a specific commit hash before release.
requirements = python3,kivy,https://github.com/kivymd/KivyMD/archive/master.zip,materialyoucolor,materialshapes,pycairo,pillow,exceptiongroup,asyncgui,asynckivy,android

orientation = portrait
fullscreen = 0

android.api = 34
android.minapi = 23
android.accept_sdk_license = True

# NOTE: Buildozer must be run from WSL2/Linux, not Windows.
# Clone the project onto the WSL filesystem (not /mnt/c/) for best performance.

[buildozer]
log_level = 2
warn_on_root = 1
```

- [ ] **Step 2: Append to `.gitignore`**

```
# Buildozer artifacts
.buildozer/
bin/
```

- [ ] **Step 3: Commit**

```bash
git add buildozer.spec .gitignore
git commit -m "feat: buildozer spec for Android APK (WSL/Linux required)"
```

---

## Verification Checkpoint

After completing Tasks 1-4 (Task 5 optional):

1. **Tests:** `python -m pytest tests/ --tb=short -q` — all existing tests pass
2. **App launch:** `python -m src.main` — dark-themed app with 4-tab navigation
3. **Home:** routine info or empty state, session banner logic, benchmark alerts
4. **Manage:** 5 section rows → tap drills into placeholder detail → back arrow returns
5. **Navigation:** `go_tab()` switches tabs and syncs nav bar; `push_screen`/`pop_screen` handle drill-in

**Navigation foundation for 3B/3C:**
- `app.go_tab(name)` — tab switch with nav bar sync
- `ManageScreen.push_screen(name)` / `pop_screen()` — slide-left/right drill-in
- `ManageScreen.add_detail_screen(name, screen)` — Phase 3C replaces placeholders with real screens
- `BaseScreen.app` — property for service access from any screen

**Ready for Phase 3B:** The app shell, theme, navigation, and service wiring are in place. Phase 3B will replace the workout placeholder with the full workout screen (exercise cards, steppers, chips, set logging).
