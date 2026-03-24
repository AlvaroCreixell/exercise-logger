"""App configuration constants."""
import os

# Database
DB_FILENAME = "exercise_logger.db"
DB_PATH = os.path.join(os.path.dirname(__file__), DB_FILENAME)

# Defaults
DEFAULT_WEIGHT_UNIT = "lbs"
DEFAULT_BENCHMARK_FREQUENCY_WEEKS = 6
