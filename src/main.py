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
        from src.screens.workout.workout_screen import WorkoutScreen
        from src.screens.dashboard.dashboard_screen import DashboardScreen

        self.tab_manager.add_widget(HomeScreen(name="home"))
        self.tab_manager.add_widget(WorkoutScreen(name="workout"))
        self.tab_manager.add_widget(DashboardScreen(name="dashboard"))
        self.tab_manager.add_widget(ManageScreen(name="manage"))

        # Wire Manage detail screens
        from src.screens.manage.units_screen import UnitsScreen
        from src.screens.manage.exercise_catalog_screen import ExerciseCatalogScreen
        from src.screens.manage.routine_editor_screen import RoutineEditorScreen
        from src.screens.manage.benchmark_setup_screen import BenchmarkSetupScreen
        from src.screens.manage.import_export_screen import ImportExportScreen
        manage_screen = self.tab_manager.get_screen("manage")
        manage_screen.add_detail_screen("units", UnitsScreen(name="manage_units"))
        manage_screen.add_detail_screen("exercises", ExerciseCatalogScreen(name="manage_exercises"))
        manage_screen.add_detail_screen("routines", RoutineEditorScreen(name="manage_routines"))
        manage_screen.add_detail_screen("benchmarks", BenchmarkSetupScreen(name="manage_benchmarks"))
        manage_screen.add_detail_screen("import_export", ImportExportScreen(name="manage_import_export"))

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
