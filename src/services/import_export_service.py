"""Import/export service — two-step routine import, routine export, validation.

Two-step import API:
1. preview_import(data) -> ImportPreview with errors, warnings, unmatched exercises
2. import_routine(data, exercise_mapping=None, activate=False) -> routine_id

Full backup export/restore (DB file replacement) is handled at the UI layer
in Phase 3, since it's a file-system operation, not a service-layer concern.
"""
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from src.models.exercise import Exercise, ExerciseType
from src.models.routine import SetScheme, SetKind
from src.models.benchmark import BenchmarkMethod
from src.repositories.exercise_repo import ExerciseRepo
from src.repositories.routine_repo import RoutineRepo
from src.repositories.benchmark_repo import BenchmarkRepo
from src.services.validation import validate_set_kind, validate_cardio_fields, validate_amrap_fields

SUPPORTED_SCHEMA_VERSIONS = {1}

# Validation ranges per spec
MAX_REPS = 999
MAX_WEIGHT = 9999
MAX_DURATION = 86400


class ImportValidationError(ValueError):
    """Raised when import data fails validation."""
    pass


@dataclass
class ImportPreview:
    """Result of preview_import(). Contains everything the UI needs to show the import preview."""
    name: str = ""
    day_count: int = 0
    exercises_per_day: List[List[str]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    unmatched_exercises: List[dict] = field(default_factory=list)
    benchmark_summary: Optional[dict] = None
    is_valid: bool = False


class ImportExportService:
    def __init__(
        self,
        exercise_repo: ExerciseRepo,
        routine_repo: RoutineRepo,
        benchmark_repo: BenchmarkRepo,
        cycle_service=None,
    ):
        self._exercise_repo = exercise_repo
        self._routine_repo = routine_repo
        self._benchmark_repo = benchmark_repo
        self._cycle_service = cycle_service

    # --- Export ---

    def export_routine(self, routine_id: int) -> dict:
        """Export a routine as a JSON-serializable dict."""
        routine = self._routine_repo.get_routine(routine_id)
        if not routine:
            raise ValueError(f"Routine {routine_id} not found")

        days = self._routine_repo.get_days(routine_id)
        days_data = []
        for day in days:
            exercises_data = []
            rdes = self._routine_repo.get_day_exercises(day.id)
            for rde in rdes:
                exercise = self._exercise_repo.get_by_id(rde.exercise_id)
                targets = self._routine_repo.get_targets(rde.id)
                sets_data = [
                    {
                        "set_kind": t.set_kind.value,
                        "reps_min": t.target_reps_min,
                        "reps_max": t.target_reps_max,
                        "weight": t.target_weight,
                        "duration_seconds": t.target_duration_seconds,
                        "distance": t.target_distance,
                    }
                    for t in targets
                ]
                exercises_data.append({
                    "name": exercise.name,
                    "type": exercise.type.value,
                    "set_scheme": rde.set_scheme.value,
                    "notes": rde.notes,
                    "is_optional": rde.is_optional,
                    "sets": sets_data,
                })
            days_data.append({
                "label": day.label,
                "name": day.name,
                "exercises": exercises_data,
            })

        return {
            "schema_version": 1,
            "name": routine.name,
            "days": days_data,
        }

    # --- Step 1: Preview ---

    def preview_import(self, data: dict) -> ImportPreview:
        """Validate and preview an import. Returns ImportPreview with all info the UI needs.

        This is step 1 of the two-step import. The UI shows this preview and collects
        user decisions (exercise mapping, activate choice) before calling import_routine().
        """
        preview = ImportPreview()
        preview.name = data.get("name", "")

        # Run validation
        preview.errors = self._validate_routine_json(data)
        if preview.errors:
            return preview

        preview.is_valid = True

        # Build preview info
        days = data.get("days", [])
        preview.day_count = len(days)
        for day in days:
            exercises = day.get("exercises", [])
            preview.exercises_per_day.append([ex.get("name", "") for ex in exercises])

        # Find unmatched exercises
        seen = set()
        for day in days:
            for ex in day.get("exercises", []):
                name = ex.get("name", "")
                if name in seen:
                    continue
                seen.add(name)
                existing = self._exercise_repo.get_by_name_insensitive(name)
                if not existing:
                    preview.unmatched_exercises.append({"name": name, "type": ex.get("type")})

        if preview.unmatched_exercises:
            preview.warnings.append(
                f"{len(preview.unmatched_exercises)} exercise(s) not found in catalog"
            )

        # Benchmark summary
        benchmarking = data.get("benchmarking")
        if benchmarking and benchmarking.get("enabled"):
            items = benchmarking.get("items", [])
            preview.benchmark_summary = {
                "enabled": True,
                "default_frequency_weeks": benchmarking.get("frequency_weeks", 6),
                "item_count": len(items),
                "items": [
                    {"exercise_name": i.get("exercise_name"), "method": i.get("method")}
                    for i in items
                ],
            }

        return preview

    # --- Validation ---

    def _validate_routine_json(self, data: dict) -> List[str]:
        """Validate routine import data. Returns list of error messages (empty = valid)."""
        errors = []

        version = data.get("schema_version")
        if version is None:
            errors.append("Missing schema_version")
            return errors
        if version not in SUPPORTED_SCHEMA_VERSIONS:
            errors.append(f"Unsupported schema_version: {version}")
            return errors

        if not data.get("name"):
            errors.append("Missing routine name")

        days = data.get("days")
        if not days or not isinstance(days, list):
            errors.append("At least one day is required")
            return errors

        labels = [d.get("label", "").strip().upper() for d in days]
        if len(labels) != len(set(labels)):
            errors.append("Day labels must be unique")

        for di, day in enumerate(days):
            day_prefix = f"Day {di + 1}"

            if not day.get("label"):
                errors.append(f"{day_prefix}: missing label")
            if not day.get("name"):
                errors.append(f"{day_prefix}: missing name")

            exercises = day.get("exercises")
            if not exercises or not isinstance(exercises, list):
                errors.append(f"{day_prefix}: at least one exercise required")
                continue

            for ei, ex in enumerate(exercises):
                ex_prefix = f"{day_prefix}, Exercise {ei + 1}"

                if not ex.get("name"):
                    errors.append(f"{ex_prefix}: missing name")
                    continue

                ex_type_str = ex.get("type")
                try:
                    ex_type = ExerciseType(ex_type_str)
                except (ValueError, KeyError):
                    errors.append(f"{ex_prefix}: invalid type '{ex_type_str}'")
                    continue

                sets = ex.get("sets")
                if not sets or not isinstance(sets, list):
                    errors.append(f"{ex_prefix}: at least one set required")
                    continue

                for si, s in enumerate(sets):
                    set_prefix = f"{ex_prefix}, Set {si + 1}"
                    sk_str = s.get("set_kind")
                    try:
                        sk = SetKind(sk_str)
                    except (ValueError, KeyError):
                        errors.append(f"{set_prefix}: invalid set_kind '{sk_str}'")
                        continue

                    try:
                        validate_set_kind(sk, ex_type)
                    except ValueError as e:
                        errors.append(f"{set_prefix}: {e}")

                    try:
                        validate_amrap_fields(sk, ex_type, s.get("weight"))
                    except ValueError as e:
                        errors.append(f"{set_prefix}: {e}")

                    self._validate_numeric_ranges(s, sk, set_prefix, errors)

        # Validate benchmark items if present
        benchmarking = data.get("benchmarking")
        if benchmarking and benchmarking.get("enabled"):
            # Collect all exercise names from the plan
            plan_exercise_names = set()
            for day in days:
                for ex in day.get("exercises", []):
                    if ex.get("name"):
                        plan_exercise_names.add(ex["name"].lower())

            for bi, item in enumerate(benchmarking.get("items", [])):
                bm_prefix = f"Benchmark {bi + 1}"
                ex_name = item.get("exercise_name", "")
                if not ex_name:
                    errors.append(f"{bm_prefix}: missing exercise_name")
                    continue

                # Must reference an exercise in the plan or the local catalog
                in_plan = ex_name.lower() in plan_exercise_names
                in_catalog = self._exercise_repo.get_by_name_insensitive(ex_name) is not None
                if not in_plan and not in_catalog:
                    errors.append(f"{bm_prefix}: exercise '{ex_name}' not found in plan or catalog")

                method_str = item.get("method")
                try:
                    BenchmarkMethod(method_str)
                except (ValueError, KeyError):
                    errors.append(f"{bm_prefix}: invalid method '{method_str}'")

        return errors

    def _validate_numeric_ranges(self, s: dict, sk: SetKind, prefix: str, errors: list) -> None:
        reps_min = s.get("reps_min")
        reps_max = s.get("reps_max")
        weight = s.get("weight")
        duration = s.get("duration_seconds")
        distance = s.get("distance")

        if reps_min is not None and (reps_min < 1 or reps_min > MAX_REPS):
            errors.append(f"{prefix}: reps_min must be 1-{MAX_REPS}")
        if reps_max is not None and (reps_max < 1 or reps_max > MAX_REPS):
            errors.append(f"{prefix}: reps_max must be 1-{MAX_REPS}")
        if reps_min is not None and reps_max is not None and reps_min > reps_max:
            errors.append(f"{prefix}: reps_min must be <= reps_max")
        if weight is not None and (weight < 0 or weight > MAX_WEIGHT):
            errors.append(f"{prefix}: weight must be 0-{MAX_WEIGHT}")
        if duration is not None and (duration < 1 or duration > MAX_DURATION):
            errors.append(f"{prefix}: duration_seconds must be 1-{MAX_DURATION}")
        if distance is not None and distance <= 0:
            errors.append(f"{prefix}: distance must be > 0")
        if sk == SetKind.CARDIO and duration is None and distance is None:
            errors.append(f"{prefix}: cardio sets require at least one of duration_seconds or distance")

    # --- Step 2: Import ---

    def import_routine(
        self,
        data: dict,
        exercise_mapping: Optional[Dict[str, int]] = None,
        activate: bool = False,
    ) -> int:
        """Import a validated routine. Returns new routine_id.

        Args:
            data: Validated import JSON.
            exercise_mapping: Optional dict mapping unmatched exercise names to existing
                exercise IDs. For unmatched names not in this mapping, new exercises are
                created. This is the user's decision from the preview step:
                - Map to existing: {"Bench Press": 42}
                - Create as new: omit from mapping (auto-created with type from file)
            activate: If True, activate the imported routine.
        """
        preview = self.preview_import(data)
        if not preview.is_valid:
            raise ImportValidationError(f"Validation failed: {'; '.join(preview.errors)}")

        if exercise_mapping is None:
            exercise_mapping = {}

        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        from src.models.routine import Routine, RoutineDay, RoutineDayExercise, SetTarget

        routine = Routine(id=None, name=data["name"], is_active=False, created_at=now, updated_at=now)
        routine_id = self._routine_repo.create_routine(routine)

        for di, day_data in enumerate(data["days"]):
            day = RoutineDay(
                id=None, routine_id=routine_id,
                label=day_data["label"].strip(), name=day_data["name"].strip(),
                sort_order=di,
            )
            day_id = self._routine_repo.add_day(day)

            for ei, ex_data in enumerate(day_data["exercises"]):
                exercise = self._resolve_exercise(
                    ex_data["name"], ExerciseType(ex_data["type"]), exercise_mapping,
                )

                set_scheme_str = ex_data.get("set_scheme", "uniform")
                rde = RoutineDayExercise(
                    id=None, routine_day_id=day_id, exercise_id=exercise.id,
                    sort_order=ei, set_scheme=SetScheme(set_scheme_str),
                    notes=ex_data.get("notes"), is_optional=bool(ex_data.get("is_optional", False)),
                )
                rde_id = self._routine_repo.add_day_exercise(rde)

                targets = []
                for si, s in enumerate(ex_data["sets"]):
                    targets.append(SetTarget(
                        id=None, routine_day_exercise_id=rde_id,
                        set_number=si + 1, set_kind=SetKind(s["set_kind"]),
                        target_reps_min=s.get("reps_min"),
                        target_reps_max=s.get("reps_max"),
                        target_weight=s.get("weight"),
                        target_duration_seconds=s.get("duration_seconds"),
                        target_distance=s.get("distance"),
                    ))
                self._routine_repo.set_targets(rde_id, targets)

        # Import benchmarks if present — resolve exercises through same mapping path
        benchmarking = data.get("benchmarking")
        if benchmarking and benchmarking.get("enabled"):
            default_freq = benchmarking.get("frequency_weeks", 6)
            for item in benchmarking.get("items", []):
                ex_name = item.get("exercise_name", "")
                # Try mapping first, then name match — same path as routine exercises
                exercise = self._resolve_exercise(ex_name, ExerciseType.REPS_WEIGHT, exercise_mapping)

                from src.models.benchmark import BenchmarkDefinition
                freq = item.get("frequency_weeks") or default_freq
                defn = BenchmarkDefinition(
                    id=None,
                    exercise_id=exercise.id,
                    method=BenchmarkMethod(item["method"]),
                    reference_weight=item.get("reference_weight"),
                    frequency_weeks=freq,
                    muscle_group_label=item.get("muscle_group_label", ""),
                )
                self._benchmark_repo.create_definition(defn)

        if activate:
            active = self._routine_repo.get_active_routine()
            if active:
                active.is_active = False
                active.updated_at = now
                self._routine_repo.update_routine(active)

            routine_obj = self._routine_repo.get_routine(routine_id)
            routine_obj.is_active = True
            routine_obj.updated_at = now
            self._routine_repo.update_routine(routine_obj)

            # Initialize cycle state so the imported routine has a current day
            if self._cycle_service:
                self._cycle_service.initialize(routine_id)

        self._routine_repo.commit()
        return routine_id

    def _resolve_exercise(self, name: str, ex_type: ExerciseType, mapping: Dict[str, int]) -> Exercise:
        """Resolve an exercise name: mapping → name match → create new."""
        # 1. Check user-provided mapping
        if name in mapping:
            exercise = self._exercise_repo.get_by_id(mapping[name])
            if exercise:
                return exercise

        # 2. Case-insensitive name match
        existing = self._exercise_repo.get_by_name_insensitive(name)
        if existing:
            return existing

        # 3. Create new
        exercise = Exercise(id=None, name=name, type=ex_type)
        exercise.id = self._exercise_repo.create(exercise)
        return exercise
