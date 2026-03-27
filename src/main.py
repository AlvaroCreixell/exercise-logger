"""Exercise Logger — main app entry point.

Initializes registries, database, services, screen manager, and bottom navigation.
"""
from kivy.properties import ObjectProperty, StringProperty
from kivy.uix.screenmanager import ScreenManager, NoTransition
from kivymd.app import MDApp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.navigationbar import (
    MDNavigationBar,
    MDNavigationItem,
    MDNavigationItemIcon,
)

from src.theme import setup_theme
from src.config import get_db_path, EXERCISES_CSV_PATH, ROUTINES_DIR, BENCHMARKS_YAML_PATH
from src.db.connection import create_connection
from src.db.schema import init_db

from src.loaders.exercise_loader import load_exercises
from src.loaders.routine_loader import load_all_routines
from src.loaders.benchmark_loader import load_benchmark_config

from src.registries.exercise_registry import ExerciseRegistry
from src.registries.routine_registry import RoutineRegistry
from src.registries.benchmark_registry import BenchmarkRegistry

from src.repositories.settings_repo import SettingsRepo
from src.repositories.workout_repo import WorkoutRepo
from src.repositories.benchmark_repo import BenchmarkRepo

from src.services.app_state_service import AppStateService
from src.services.workout_service import WorkoutService
from src.services.benchmark_service import BenchmarkService
from src.services.stats_service import StatsService
from src.services.settings_service import SettingsService


# Tab name <-> nav icon mapping (order matters — matches nav bar item order)
TABS = [
    ("home", "home"),
    ("workout", "dumbbell"),
    ("dashboard", "chart-line"),
]


class ExerciseLoggerApp(MDApp):
    """Main application."""

    # Registries (loaded once at startup, read-only)
    exercise_registry = ObjectProperty(None)
    routine_registry = ObjectProperty(None)
    benchmark_registry = ObjectProperty(None)

    # Services (set during build, accessed by screens via app.X_service)
    app_state_service = ObjectProperty(None)
    workout_service = ObjectProperty(None)
    benchmark_service = ObjectProperty(None)
    stats_service = ObjectProperty(None)
    settings_service = ObjectProperty(None)

    current_tab = StringProperty("home")

    def build(self):
        self.title = "Exercise Logger"
        setup_theme(self)
        self._init_registries()
        self._init_services()
        self._run_startup_reconciliation()
        return self._build_ui()

    def _init_registries(self):
        """Load bundled data files and construct in-memory registries."""
        exercises = load_exercises(EXERCISES_CSV_PATH)
        self.exercise_registry = ExerciseRegistry(exercises)

        routines = load_all_routines(ROUTINES_DIR, self.exercise_registry)
        self.routine_registry = RoutineRegistry(routines)

        benchmark_config = load_benchmark_config(BENCHMARKS_YAML_PATH, self.exercise_registry)
        self.benchmark_registry = BenchmarkRegistry(benchmark_config)

    def _init_services(self):
        """Create DB connection, init schema, and instantiate all services."""
        db_path = get_db_path()
        self.conn = create_connection(db_path)
        init_db(self.conn)

        # Repos
        settings_repo = SettingsRepo(self.conn)
        workout_repo = WorkoutRepo(self.conn)
        benchmark_repo = BenchmarkRepo(self.conn)

        # Services (constructor injection, in dependency order)
        self.app_state_service = AppStateService(
            settings_repo, self.routine_registry, workout_repo
        )
        self.workout_service = WorkoutService(
            workout_repo, settings_repo, self.exercise_registry,
            self.routine_registry, self.app_state_service,
        )
        self.benchmark_service = BenchmarkService(
            benchmark_repo, self.benchmark_registry, self.exercise_registry
        )
        self.stats_service = StatsService(
            workout_repo, benchmark_repo, self.exercise_registry, self.benchmark_registry
        )
        self.settings_service = SettingsService(settings_repo, self.conn)

    def _run_startup_reconciliation(self):
        """Run AppStateService reconciliation and log the result."""
        result = self.app_state_service.reconcile_on_startup()
        print(f"[startup] reconciliation: {result}")

    def _build_ui(self):
        """Assemble root layout: screen manager + bottom nav."""
        self.root_layout = MDBoxLayout(orientation="vertical")

        # Tab screen manager (top-level, no transition for tab switches)
        self.tab_manager = ScreenManager(transition=NoTransition())

        # Import real screens
        from src.screens.home.home_screen import HomeScreen
        from src.screens.workout.workout_screen import WorkoutScreen
        from src.screens.dashboard.dashboard_screen import DashboardScreen

        self.tab_manager.add_widget(HomeScreen(name="home"))
        self.tab_manager.add_widget(WorkoutScreen(name="workout"))
        self.tab_manager.add_widget(DashboardScreen(name="dashboard"))

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
