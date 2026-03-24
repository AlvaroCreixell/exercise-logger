"""Benchmark service — due calculations, result recording with snapshots."""
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from src.models.benchmark import BenchmarkDefinition, BenchmarkResult, BenchmarkMethod
from src.repositories.benchmark_repo import BenchmarkRepo
from src.repositories.exercise_repo import ExerciseRepo


class BenchmarkService:
    def __init__(self, benchmark_repo: BenchmarkRepo, exercise_repo: ExerciseRepo):
        self._repo = benchmark_repo
        self._exercise_repo = exercise_repo

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # --- Definitions ---

    def create_definition(
        self,
        exercise_id: int,
        method: BenchmarkMethod,
        muscle_group_label: str,
        reference_weight: Optional[float] = None,
        frequency_weeks: int = 6,
    ) -> BenchmarkDefinition:
        exercise = self._exercise_repo.get_by_id(exercise_id)
        if not exercise:
            raise ValueError(f"Exercise {exercise_id} not found")

        defn = BenchmarkDefinition(
            id=None,
            exercise_id=exercise_id,
            method=method,
            reference_weight=reference_weight,
            frequency_weeks=frequency_weeks,
            muscle_group_label=muscle_group_label,
        )
        defn.id = self._repo.create_definition(defn)
        self._repo.commit()
        return defn

    def get_definition(self, defn_id: int) -> Optional[BenchmarkDefinition]:
        return self._repo.get_definition(defn_id)

    def list_definitions(self) -> List[BenchmarkDefinition]:
        return self._repo.list_definitions()

    def update_definition(self, defn: BenchmarkDefinition) -> BenchmarkDefinition:
        self._repo.update_definition(defn)
        self._repo.commit()
        return defn

    def delete_definition(self, defn_id: int) -> None:
        self._repo.delete_definition(defn_id)
        self._repo.commit()

    # --- Due calculation ---

    def is_due(self, defn_id: int) -> bool:
        """Due = never tested OR days_since_last >= frequency_weeks * 7."""
        defn = self._repo.get_definition(defn_id)
        if not defn:
            raise ValueError(f"Benchmark definition {defn_id} not found")

        latest = self._repo.get_latest_result(defn_id)
        if not latest:
            return True

        tested_at = datetime.fromisoformat(latest.tested_at)
        now = datetime.now(timezone.utc)
        days_since = (now - tested_at).days
        return days_since >= defn.frequency_weeks * 7

    def get_due_benchmarks(self) -> List[BenchmarkDefinition]:
        """Return all benchmark definitions that are due."""
        all_defns = self._repo.list_definitions()
        return [d for d in all_defns if self.is_due(d.id)]

    # --- Results ---

    def record_result(
        self,
        defn_id: int,
        result_value: float,
        session_id: Optional[int] = None,
    ) -> BenchmarkResult:
        """Record a benchmark result with method/weight snapshots from the definition."""
        defn = self._repo.get_definition(defn_id)
        if not defn:
            raise ValueError(f"Benchmark definition {defn_id} not found")

        result = BenchmarkResult(
            id=None,
            benchmark_definition_id=defn_id,
            session_id=session_id,
            method_snapshot=defn.method,
            reference_weight_snapshot=defn.reference_weight,
            result_value=result_value,
            tested_at=self._now(),
        )
        result.id = self._repo.add_result(result)
        self._repo.commit()
        return result

    def get_results(self, defn_id: int) -> List[BenchmarkResult]:
        return self._repo.get_results(defn_id)
