"""App configuration constants."""
import os

DB_FILENAME = "exercise_logger.db"

_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(_SRC_DIR, "data")
EXERCISES_CSV_PATH = os.path.join(DATA_DIR, "exercises.csv")
ROUTINES_DIR = os.path.join(DATA_DIR, "routines")
BENCHMARKS_YAML_PATH = os.path.join(DATA_DIR, "benchmarks.yaml")


def get_db_path() -> str:
    try:
        from kivy.app import App
        app = App.get_running_app()
        if app is not None:
            return os.path.join(app.user_data_dir, DB_FILENAME)
    except ImportError:
        pass
    app_dir = os.path.join(os.path.expanduser("~"), ".exercise_logger")
    os.makedirs(app_dir, exist_ok=True)
    return os.path.join(app_dir, DB_FILENAME)


DEFAULT_WEIGHT_UNIT = "lb"
DEFAULT_BENCHMARK_FREQUENCY_WEEKS = 6
