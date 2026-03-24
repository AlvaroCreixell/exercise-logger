"""App configuration constants."""
import os

# Database
DB_FILENAME = "exercise_logger.db"


def get_db_path() -> str:
    """Get the database file path.

    On Android (Kivy), uses App.get_running_app().user_data_dir.
    On desktop, uses ~/.exercise_logger/ (user's home directory).
    """
    try:
        from kivy.app import App
        app = App.get_running_app()
        if app is not None:
            return os.path.join(app.user_data_dir, DB_FILENAME)
    except ImportError:
        pass
    # Desktop fallback: user home directory
    app_dir = os.path.join(os.path.expanduser("~"), ".exercise_logger")
    os.makedirs(app_dir, exist_ok=True)
    return os.path.join(app_dir, DB_FILENAME)


# Defaults
DEFAULT_WEIGHT_UNIT = "lbs"
DEFAULT_BENCHMARK_FREQUENCY_WEEKS = 6
