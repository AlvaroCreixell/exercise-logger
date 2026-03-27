"""In-memory benchmark registry — loaded once at startup, read-only at runtime."""
from __future__ import annotations
from typing import Optional
from src.models.bundled import BenchmarkConfig, BenchmarkItem


class BenchmarkRegistry:
    """Immutable registry of benchmark configuration loaded from YAML."""

    def __init__(self, config: BenchmarkConfig):
        self._config = config
        self._by_key: dict[str, BenchmarkItem] = {
            item.exercise_key: item for item in config.items
        }

    @property
    def frequency_weeks(self) -> int:
        return self._config.frequency_weeks

    def get_item(self, exercise_key: str) -> Optional[BenchmarkItem]:
        """Get benchmark item by exercise key, or None if not found."""
        return self._by_key.get(exercise_key)

    def list_items(self) -> tuple[BenchmarkItem, ...]:
        """Return all benchmark items in config order."""
        return self._config.items

    def __len__(self) -> int:
        return len(self._config.items)

    def __contains__(self, exercise_key: str) -> bool:
        return exercise_key in self._by_key
