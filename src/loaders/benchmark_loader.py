"""Load benchmark config from YAML.

Fail-fast: any invalid data raises LoaderError.
"""
from __future__ import annotations
import yaml
from src.loaders.exercise_loader import LoaderError
from src.models.enums import BenchmarkMethod
from src.models.bundled import BenchmarkItem, BenchmarkConfig
from src.registries.exercise_registry import ExerciseRegistry


_VALID_METHODS = {m.value: m for m in BenchmarkMethod}


def load_benchmark_config(
    yaml_path: str, exercise_registry: ExerciseRegistry
) -> BenchmarkConfig:
    """Load and validate benchmark configuration from YAML.

    Args:
        yaml_path: Path to benchmarks.yaml.
        exercise_registry: For validating exercise_key references.

    Returns:
        Validated BenchmarkConfig dataclass.

    Raises:
        LoaderError: On any validation failure.
        FileNotFoundError: If the YAML file doesn't exist.
    """
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    if not isinstance(data, dict):
        raise LoaderError(f"{yaml_path}: expected a YAML mapping at top level")

    # Validate frequency_weeks
    freq = data.get("frequency_weeks")
    if freq is None:
        raise LoaderError(f"{yaml_path}: missing 'frequency_weeks'")
    try:
        frequency_weeks = int(freq)
    except (ValueError, TypeError):
        raise LoaderError(f"{yaml_path}: 'frequency_weeks' must be an integer")
    if frequency_weeks < 1:
        raise LoaderError(f"{yaml_path}: 'frequency_weeks' must be >= 1")

    # Validate items
    items_raw = data.get("items")
    if not items_raw or not isinstance(items_raw, list):
        raise LoaderError(f"{yaml_path}: missing or empty 'items' list")

    seen_keys: set[str] = set()
    items = []

    for idx, item_data in enumerate(items_raw):
        if not isinstance(item_data, dict):
            raise LoaderError(f"{yaml_path}: items[{idx}] is not a mapping")

        exercise_key = item_data.get("exercise_key")
        if not exercise_key or not isinstance(exercise_key, str):
            raise LoaderError(f"{yaml_path}: items[{idx}] missing 'exercise_key'")

        # Check for duplicate exercise_key
        if exercise_key in seen_keys:
            raise LoaderError(
                f"{yaml_path}: duplicate exercise_key '{exercise_key}' in benchmark items"
            )
        seen_keys.add(exercise_key)

        # Validate exercise_key exists in registry
        if not exercise_registry.contains(exercise_key):
            raise LoaderError(
                f"{yaml_path}: items[{idx}]: unknown exercise_key '{exercise_key}'"
            )

        method_str = item_data.get("method")
        if not method_str or not isinstance(method_str, str):
            raise LoaderError(f"{yaml_path}: items[{idx}] missing 'method'")
        if method_str not in _VALID_METHODS:
            raise LoaderError(
                f"{yaml_path}: items[{idx}]: invalid method '{method_str}'. "
                f"Valid: {sorted(_VALID_METHODS.keys())}"
            )

        items.append(BenchmarkItem(
            exercise_key=exercise_key,
            method=_VALID_METHODS[method_str],
        ))

    return BenchmarkConfig(
        frequency_weeks=frequency_weeks,
        items=tuple(items),
    )
