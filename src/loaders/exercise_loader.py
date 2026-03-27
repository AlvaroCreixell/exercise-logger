"""Load exercise catalog from CSV.

Fail-fast: any invalid data raises LoaderError.
"""
from __future__ import annotations
import csv
from typing import List
from src.models.enums import ExerciseType
from src.models.bundled import Exercise


class LoaderError(Exception):
    """Fatal loader validation error."""
    pass


# Valid type strings → ExerciseType mapping
_VALID_TYPES = {t.value: t for t in ExerciseType}

_REQUIRED_COLUMNS = {"key", "name", "type", "equipment", "muscle_group"}


def load_exercises(csv_path: str) -> List[Exercise]:
    """Load and validate the exercise catalog from CSV.

    Args:
        csv_path: Path to exercises.csv

    Returns:
        List of validated Exercise dataclasses.

    Raises:
        LoaderError: On any validation failure (duplicate keys, invalid types, etc.)
        FileNotFoundError: If the CSV file doesn't exist.
    """
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            # Validate header
            if reader.fieldnames is None:
                raise LoaderError(f"{csv_path}: empty CSV file")
            missing = _REQUIRED_COLUMNS - set(reader.fieldnames)
            if missing:
                raise LoaderError(
                    f"{csv_path}: missing required columns: {sorted(missing)}"
                )

            exercises: List[Exercise] = []
            seen_keys: set[str] = set()

            for line_num, row in enumerate(reader, start=2):  # line 1 is header
                key = row["key"].strip()
                name = row["name"].strip()
                type_str = row["type"].strip()
                equipment = row["equipment"].strip()
                muscle_group = row["muscle_group"].strip()

                # Validate key
                if not key:
                    raise LoaderError(f"{csv_path}:{line_num}: empty exercise key")
                if key in seen_keys:
                    raise LoaderError(
                        f"{csv_path}:{line_num}: duplicate exercise key '{key}'"
                    )
                seen_keys.add(key)

                # Validate name
                if not name:
                    raise LoaderError(f"{csv_path}:{line_num}: empty exercise name for key '{key}'")

                # Validate type
                if type_str not in _VALID_TYPES:
                    raise LoaderError(
                        f"{csv_path}:{line_num}: invalid exercise type '{type_str}' "
                        f"for key '{key}'. Valid types: {sorted(_VALID_TYPES.keys())}"
                    )

                # Validate equipment and muscle_group
                if not equipment:
                    raise LoaderError(
                        f"{csv_path}:{line_num}: empty equipment for key '{key}'"
                    )
                if not muscle_group:
                    raise LoaderError(
                        f"{csv_path}:{line_num}: empty muscle_group for key '{key}'"
                    )

                exercises.append(Exercise(
                    key=key,
                    name=name,
                    type=_VALID_TYPES[type_str],
                    equipment=equipment,
                    muscle_group=muscle_group,
                ))

            if not exercises:
                raise LoaderError(f"{csv_path}: no exercises found in CSV")

            return exercises

    except csv.Error as e:
        raise LoaderError(f"{csv_path}: CSV parsing error: {e}") from e
