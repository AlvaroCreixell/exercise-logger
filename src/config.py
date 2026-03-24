"""App configuration constants."""
import os

# Database
DB_FILENAME = "exercise_logger.db"


def get_db_path() -> str:
    """Get the database file path.

    On Android (Kivy), uses App.get_running_app().user_data_dir.
    On desktop, falls back to the src/ directory.
    """
    try:
        from kivy.app import App
        app = App.get_running_app()
        if app is not None:
            return os.path.join(app.user_data_dir, DB_FILENAME)
    except ImportError:
        pass
    return os.path.join(os.path.dirname(__file__), DB_FILENAME)


# Defaults
DEFAULT_WEIGHT_UNIT = "lbs"
DEFAULT_BENCHMARK_FREQUENCY_WEEKS = 6
