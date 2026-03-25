"""Benchmark repository — definitions and results."""
from typing import List, Optional
from src.models.benchmark import BenchmarkDefinition, BenchmarkResult, BenchmarkMethod
from src.repositories.base import BaseRepository


class BenchmarkRepo(BaseRepository):

    # --- Definitions ---

    def create_definition(self, defn: BenchmarkDefinition) -> int:
        return self._insert(
            """INSERT INTO benchmark_definitions
               (exercise_id, method, reference_weight, frequency_weeks, muscle_group_label)
               VALUES (?, ?, ?, ?, ?)""",
            (defn.exercise_id, defn.method.value, defn.reference_weight,
             defn.frequency_weeks, defn.muscle_group_label),
        )

    def get_definition(self, defn_id: int) -> Optional[BenchmarkDefinition]:
        row = self._fetchone("SELECT * FROM benchmark_definitions WHERE id = ?", (defn_id,))
        return self._to_definition(row) if row else None

    def get_definitions_for_exercise(self, exercise_id: int) -> List[BenchmarkDefinition]:
        rows = self._fetchall(
            "SELECT * FROM benchmark_definitions WHERE exercise_id = ?",
            (exercise_id,),
        )
        return [self._to_definition(r) for r in rows]

    def list_definitions(self) -> List[BenchmarkDefinition]:
        rows = self._fetchall(
            "SELECT * FROM benchmark_definitions ORDER BY muscle_group_label, id"
        )
        return [self._to_definition(r) for r in rows]

    def update_definition(self, defn: BenchmarkDefinition) -> None:
        self._execute(
            """UPDATE benchmark_definitions
               SET method = ?, reference_weight = ?, frequency_weeks = ?, muscle_group_label = ?
               WHERE id = ?""",
            (defn.method.value, defn.reference_weight, defn.frequency_weeks,
             defn.muscle_group_label, defn.id),
        )

    def delete_definition(self, defn_id: int) -> None:
        # Schema has ON DELETE CASCADE for fresh DBs. Manual delete kept as
        # belt-and-suspenders for existing DBs where CREATE TABLE IF NOT EXISTS
        # won't alter the FK constraint. Safe to remove after a proper migration.
        self._execute("DELETE FROM benchmark_results WHERE benchmark_definition_id = ?", (defn_id,))
        self._execute("DELETE FROM benchmark_definitions WHERE id = ?", (defn_id,))

    # --- Results ---

    def add_result(self, result: BenchmarkResult) -> int:
        return self._insert(
            """INSERT INTO benchmark_results
               (benchmark_definition_id, session_id, method_snapshot,
                reference_weight_snapshot, result_value, tested_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (result.benchmark_definition_id, result.session_id,
             result.method_snapshot.value, result.reference_weight_snapshot,
             result.result_value, result.tested_at),
        )

    def get_results(self, defn_id: int) -> List[BenchmarkResult]:
        rows = self._fetchall(
            "SELECT * FROM benchmark_results WHERE benchmark_definition_id = ? ORDER BY tested_at DESC",
            (defn_id,),
        )
        return [self._to_result(r) for r in rows]

    def get_latest_result(self, defn_id: int) -> Optional[BenchmarkResult]:
        row = self._fetchone(
            "SELECT * FROM benchmark_results WHERE benchmark_definition_id = ? ORDER BY tested_at DESC LIMIT 1",
            (defn_id,),
        )
        return self._to_result(row) if row else None

    # --- Row converters ---

    def _to_definition(self, row) -> BenchmarkDefinition:
        return BenchmarkDefinition(
            id=row["id"],
            exercise_id=row["exercise_id"],
            method=BenchmarkMethod(row["method"]),
            reference_weight=row["reference_weight"],
            frequency_weeks=row["frequency_weeks"],
            muscle_group_label=row["muscle_group_label"],
        )

    def _to_result(self, row) -> BenchmarkResult:
        return BenchmarkResult(
            id=row["id"],
            benchmark_definition_id=row["benchmark_definition_id"],
            session_id=row["session_id"],
            method_snapshot=BenchmarkMethod(row["method_snapshot"]),
            reference_weight_snapshot=row["reference_weight_snapshot"],
            result_value=row["result_value"],
            tested_at=row["tested_at"],
        )
