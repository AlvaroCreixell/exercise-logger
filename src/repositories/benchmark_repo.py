"""Benchmark repository — results CRUD."""
from typing import List, Optional
from src.models.enums import BenchmarkMethod
from src.models.benchmark import BenchmarkResult
from src.repositories.base import BaseRepository


class BenchmarkRepo(BaseRepository):

    def add_result(self, result: BenchmarkResult) -> int:
        """Insert a benchmark result, return its id."""
        return self._insert(
            """INSERT INTO benchmark_results
               (exercise_key_snapshot, exercise_name_snapshot, method,
                result_value, bodyweight, tested_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (result.exercise_key_snapshot, result.exercise_name_snapshot,
             result.method.value, result.result_value,
             result.bodyweight, result.tested_at),
        )

    def get_result(self, result_id: int) -> Optional[BenchmarkResult]:
        """Get a benchmark result by id."""
        row = self._fetchone(
            "SELECT * FROM benchmark_results WHERE id = ?", (result_id,)
        )
        return self._to_result(row) if row else None

    def get_results_for_exercise(
        self, exercise_key: str
    ) -> List[BenchmarkResult]:
        """Get all results for an exercise key, most recent first."""
        rows = self._fetchall(
            """SELECT * FROM benchmark_results
               WHERE exercise_key_snapshot = ?
               ORDER BY tested_at DESC""",
            (exercise_key,),
        )
        return [self._to_result(r) for r in rows]

    def get_latest_result(self, exercise_key: str) -> Optional[BenchmarkResult]:
        """Get the most recent result for an exercise key."""
        row = self._fetchone(
            """SELECT * FROM benchmark_results
               WHERE exercise_key_snapshot = ?
               ORDER BY tested_at DESC LIMIT 1""",
            (exercise_key,),
        )
        return self._to_result(row) if row else None

    def get_all_results(self) -> List[BenchmarkResult]:
        """Get all benchmark results, most recent first."""
        rows = self._fetchall(
            "SELECT * FROM benchmark_results ORDER BY tested_at DESC"
        )
        return [self._to_result(r) for r in rows]

    # --- Row converter ---

    def _to_result(self, row) -> BenchmarkResult:
        return BenchmarkResult(
            id=row["id"],
            exercise_key_snapshot=row["exercise_key_snapshot"],
            exercise_name_snapshot=row["exercise_name_snapshot"],
            method=BenchmarkMethod(row["method"]),
            result_value=row["result_value"],
            bodyweight=row["bodyweight"],
            tested_at=row["tested_at"],
        )
