from __future__ import annotations

import os
from pathlib import Path

APP_NAME = "Exercise Logger"
APP_VERSION = "0.1.0"

# Database path: use FLET_APP_DATA on Android, local dir on desktop
_data_dir = os.environ.get("FLET_APP_DATA", str(Path(__file__).parent.parent))
DB_PATH = os.path.join(_data_dir, "exercise_logger.db")

# Weight units
DEFAULT_WEIGHT_UNIT = "lbs"
WEIGHT_UNIT_KEY = "weight_unit"

# Benchmark defaults
DEFAULT_BENCHMARK_FREQUENCY_WEEKS = 6

# Cycle
ROUTINE_CYCLE_START_INDEX = 0
