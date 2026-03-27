"""BenchmarkService — due calculation and result recording."""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from src.models.benchmark import BenchmarkResult
from src.models.enums import BenchmarkMethod
from src.registries.benchmark_registry import BenchmarkRegistry
from src.registries.exercise_registry import ExerciseRegistry
from src.repositories.benchmark_repo import BenchmarkRepo


class BenchmarkService:
    def __init__(
        self,
        benchmark_repo: BenchmarkRepo,
        benchmark_registry: BenchmarkRegistry,
        exercise_registry: ExerciseRegistry,
    ):
        self._repo = benchmark_repo
        self._config = benchmark_registry
        self._exercises = exercise_registry

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # Due calculation
    # ------------------------------------------------------------------

    def get_due_items(self) -> List[dict]:
        """Return benchmark items that are due for testing.

        An item is due when:
        - It has no recorded result, OR
        - Its latest tested_at is older than frequency_weeks * 7 days.

        Returns list of dicts:
            exercise_key, exercise_name, method, is_due, last_tested_at
        """
        frequency_weeks = self._config.frequency_weeks
        cutoff = datetime.now(timezone.utc) - timedelta(days=frequency_weeks * 7)
        cutoff_iso = cutoff.isoformat()

        due = []
        for item in self._config.list_items():
            exercise = self._exercises.get(item.exercise_key)
            if exercise is None:
                continue

            latest = self._repo.get_latest_result(item.exercise_key)
            if latest is None or latest.tested_at < cutoff_iso:
                due.append({
                    "exercise_key": item.exercise_key,
                    "exercise_name": exercise.name,
                    "method": item.method.value,
                    "is_due": True,
                    "last_tested_at": latest.tested_at if latest else None,
                })

        return due

    def is_any_due(self) -> bool:
        """Quick check: are any benchmark items due?"""
        return len(self.get_due_items()) > 0

    # ------------------------------------------------------------------
    # Result recording
    # ------------------------------------------------------------------

    def record_result(
        self,
        exercise_key: str,
        method: str,
        result_value: float,
        bodyweight: Optional[float] = None,
    ) -> BenchmarkResult:
        """Record a benchmark result.

        Validates:
        - result_value > 0
        - exercise_key exists in exercise catalog
        - exercise_key is in benchmark config
        - method matches config for this exercise
        """
        if result_value <= 0:
            raise ValueError("result_value must be positive")

        exercise = self._exercises.get(exercise_key)
        if exercise is None:
            raise ValueError(f"Exercise '{exercise_key}' not found in catalog")

        config_item = self._config.get_item(exercise_key)
        if config_item is None:
            raise ValueError(
                f"Exercise '{exercise_key}' not in benchmark config"
            )

        if config_item.method.value != method:
            raise ValueError(
                f"Invalid method '{method}' for exercise '{exercise_key}'. "
                f"Expected '{config_item.method.value}'"
            )

        result = BenchmarkResult(
            id=None,
            exercise_key_snapshot=exercise.key,
            exercise_name_snapshot=exercise.name,
            method=BenchmarkMethod(method),
            result_value=result_value,
            bodyweight=bodyweight,
            tested_at=self._now(),
        )
        result.id = self._repo.add_result(result)
        self._repo.commit()
        return result

    # ------------------------------------------------------------------
    # History
    # ------------------------------------------------------------------

    def get_history(self, exercise_key: str) -> List[BenchmarkResult]:
        """All results for an exercise, oldest first (for charts)."""
        results = self._repo.get_results_for_exercise(exercise_key)
        # Repo returns newest-first; reverse for charts
        return list(reversed(results))

    # Alias for callers using the task-spec name
    def get_results(self, exercise_key: str) -> List[BenchmarkResult]:
        """All results for an exercise, oldest first. Alias for get_history."""
        return self.get_history(exercise_key)
