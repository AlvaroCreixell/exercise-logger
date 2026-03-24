import pytest
import json
from src.services.import_export_service import ImportExportService, ImportValidationError, ImportPreview
from src.models.exercise import ExerciseType
from src.models.routine import SetScheme, SetKind
from src.models.benchmark import BenchmarkMethod


@pytest.fixture
def import_export_service(exercise_repo, routine_repo, benchmark_repo, cycle_service):
    return ImportExportService(exercise_repo, routine_repo, benchmark_repo, cycle_service)


def _minimal_valid_import():
    return {
        "schema_version": 1,
        "name": "Test Routine",
        "days": [
            {
                "label": "A",
                "name": "Push",
                "exercises": [
                    {
                        "name": "Bench Press",
                        "type": "reps_weight",
                        "set_scheme": "uniform",
                        "notes": None,
                        "is_optional": False,
                        "sets": [
                            {"set_kind": "reps_weight", "reps_min": 10, "reps_max": 10, "weight": 135},
                        ],
                    }
                ],
            }
        ],
    }


class TestImportPreview:
    """Tests for the two-step import: preview_import() is step 1."""

    def test_valid_preview(self, import_export_service):
        preview = import_export_service.preview_import(_minimal_valid_import())
        assert preview.is_valid is True
        assert preview.name == "Test Routine"
        assert preview.day_count == 1
        assert preview.errors == []

    def test_preview_shows_exercises_per_day(self, import_export_service):
        preview = import_export_service.preview_import(_minimal_valid_import())
        assert preview.exercises_per_day == [["Bench Press"]]

    def test_preview_shows_unmatched_exercises(self, import_export_service):
        preview = import_export_service.preview_import(_minimal_valid_import())
        assert len(preview.unmatched_exercises) == 1
        assert preview.unmatched_exercises[0]["name"] == "Bench Press"

    def test_preview_no_unmatched_when_exercise_exists(self, import_export_service, make_exercise):
        make_exercise("Bench Press")
        preview = import_export_service.preview_import(_minimal_valid_import())
        assert len(preview.unmatched_exercises) == 0

    def test_preview_shows_benchmark_summary(self, import_export_service):
        data = _minimal_valid_import()
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [{"exercise_name": "Bench Press", "method": "max_weight"}],
        }
        preview = import_export_service.preview_import(data)
        assert preview.benchmark_summary is not None
        assert preview.benchmark_summary["item_count"] == 1

    def test_preview_invalid_returns_errors(self, import_export_service):
        data = {"schema_version": 99}
        preview = import_export_service.preview_import(data)
        assert preview.is_valid is False
        assert len(preview.errors) > 0

    def test_missing_schema_version(self, import_export_service):
        data = _minimal_valid_import()
        del data["schema_version"]
        preview = import_export_service.preview_import(data)
        assert not preview.is_valid
        assert any("schema_version" in e for e in preview.errors)

    def test_no_days(self, import_export_service):
        data = _minimal_valid_import()
        data["days"] = []
        preview = import_export_service.preview_import(data)
        assert not preview.is_valid

    def test_duplicate_day_labels(self, import_export_service):
        data = _minimal_valid_import()
        data["days"].append({
            "label": "A", "name": "Also Push",
            "exercises": data["days"][0]["exercises"],
        })
        preview = import_export_service.preview_import(data)
        assert any("unique" in e.lower() for e in preview.errors)

    def test_invalid_exercise_type(self, import_export_service):
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["type"] = "invalid"
        preview = import_export_service.preview_import(data)
        assert any("invalid type" in e.lower() for e in preview.errors)

    def test_set_kind_incompatible(self, import_export_service):
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["sets"][0]["set_kind"] = "duration"
        preview = import_export_service.preview_import(data)
        assert any("not compatible" in e.lower() for e in preview.errors)

    def test_reps_out_of_range(self, import_export_service):
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["sets"][0]["reps_min"] = 0
        preview = import_export_service.preview_import(data)
        assert any("reps_min" in e for e in preview.errors)

    def test_reps_min_gt_reps_max(self, import_export_service):
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["sets"][0]["reps_min"] = 12
        data["days"][0]["exercises"][0]["sets"][0]["reps_max"] = 8
        preview = import_export_service.preview_import(data)
        assert any("reps_min must be <= reps_max" in e for e in preview.errors)

    def test_cardio_missing_duration_and_distance(self, import_export_service):
        data = {
            "schema_version": 1, "name": "Cardio",
            "days": [{"label": "A", "name": "Cardio", "exercises": [
                {"name": "Treadmill", "type": "cardio", "set_scheme": "uniform",
                 "sets": [{"set_kind": "cardio"}]}
            ]}],
        }
        preview = import_export_service.preview_import(data)
        assert any("at least one" in e.lower() for e in preview.errors)


class TestImportExecution:
    """Tests for step 2: import_routine() with optional exercise_mapping."""

    def test_import_creates_routine(self, import_export_service, routine_repo):
        data = _minimal_valid_import()
        routine_id = import_export_service.import_routine(data)
        routine = routine_repo.get_routine(routine_id)
        assert routine is not None
        assert routine.name == "Test Routine"
        assert routine.is_active is False

    def test_import_auto_creates_exercises(self, import_export_service, exercise_repo):
        data = _minimal_valid_import()
        import_export_service.import_routine(data)
        ex = exercise_repo.get_by_name("Bench Press")
        assert ex is not None
        assert ex.type == ExerciseType.REPS_WEIGHT

    def test_import_matches_existing_exercise(self, import_export_service, make_exercise, exercise_repo):
        make_exercise("Bench Press")
        data = _minimal_valid_import()
        import_export_service.import_routine(data)
        all_ex = exercise_repo.list_all()
        bench_count = sum(1 for e in all_ex if e.name == "Bench Press")
        assert bench_count == 1

    def test_import_case_insensitive_match(self, import_export_service, make_exercise, exercise_repo):
        make_exercise("bench press")
        data = _minimal_valid_import()
        import_export_service.import_routine(data)
        all_ex = exercise_repo.list_all()
        assert len(all_ex) == 1

    def test_import_with_exercise_mapping(self, import_export_service, make_exercise, exercise_repo, routine_repo):
        """User maps an unmatched exercise to an existing one via exercise_mapping."""
        existing = make_exercise("Flat Bench Press")
        data = _minimal_valid_import()  # Contains "Bench Press" which won't match "Flat Bench Press"
        routine_id = import_export_service.import_routine(
            data, exercise_mapping={"Bench Press": existing.id},
        )
        # Should use the mapped exercise, not create "Bench Press"
        assert exercise_repo.get_by_name("Bench Press") is None
        days = routine_repo.get_days(routine_id)
        rdes = routine_repo.get_day_exercises(days[0].id)
        assert rdes[0].exercise_id == existing.id

    def test_import_mapping_not_in_dict_creates_new(self, import_export_service, exercise_repo):
        """Exercises not in the mapping are auto-created."""
        data = _minimal_valid_import()
        import_export_service.import_routine(data, exercise_mapping={})
        ex = exercise_repo.get_by_name("Bench Press")
        assert ex is not None  # Created because not in mapping and not in catalog

    def test_import_creates_set_targets(self, import_export_service, routine_repo):
        data = _minimal_valid_import()
        routine_id = import_export_service.import_routine(data)
        days = routine_repo.get_days(routine_id)
        rdes = routine_repo.get_day_exercises(days[0].id)
        targets = routine_repo.get_targets(rdes[0].id)
        assert len(targets) == 1
        assert targets[0].target_weight == 135

    def test_import_with_activate(self, import_export_service, routine_repo):
        data = _minimal_valid_import()
        routine_id = import_export_service.import_routine(data, activate=True)
        routine = routine_repo.get_routine(routine_id)
        assert routine.is_active is True

    def test_import_validation_error_rejects(self, import_export_service):
        data = {"schema_version": 99}
        with pytest.raises(ImportValidationError):
            import_export_service.import_routine(data)

    def test_import_with_benchmarks(self, import_export_service, make_exercise, benchmark_repo):
        make_exercise("Bench Press")
        data = _minimal_valid_import()
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [
                {
                    "exercise_name": "Bench Press",
                    "method": "max_weight",
                    "reference_weight": None,
                    "muscle_group_label": "Upper",
                    "frequency_weeks": None,
                },
            ],
        }
        import_export_service.import_routine(data)
        defns = benchmark_repo.list_definitions()
        assert len(defns) == 1
        assert defns[0].frequency_weeks == 6

    def test_import_benchmark_frequency_override(self, import_export_service, make_exercise, benchmark_repo):
        make_exercise("Plank")
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["name"] = "Plank"
        data["days"][0]["exercises"][0]["type"] = "time"
        data["days"][0]["exercises"][0]["sets"] = [{"set_kind": "duration", "duration_seconds": 60}]
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [
                {
                    "exercise_name": "Plank",
                    "method": "timed_hold",
                    "reference_weight": None,
                    "muscle_group_label": "Core",
                    "frequency_weeks": 8,
                },
            ],
        }
        import_export_service.import_routine(data)
        defns = benchmark_repo.list_definitions()
        assert defns[0].frequency_weeks == 8


class TestExportRoutine:

    def test_round_trip(self, import_export_service, routine_repo):
        data = _minimal_valid_import()
        routine_id = import_export_service.import_routine(data)
        exported = import_export_service.export_routine(routine_id)

        assert exported["schema_version"] == 1
        assert exported["name"] == "Test Routine"
        assert len(exported["days"]) == 1
        assert exported["days"][0]["label"] == "A"
        assert len(exported["days"][0]["exercises"]) == 1
        assert exported["days"][0]["exercises"][0]["name"] == "Bench Press"

        exported["name"] = "Test Routine Copy"
        routine_id2 = import_export_service.import_routine(exported)
        assert routine_id2 != routine_id

    def test_progressive_export(self, import_export_service, routine_service, make_exercise, routine_repo):
        r = routine_service.create_routine("Test")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)
        routine_service.set_progressive_targets(rde.id, [
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 12, "reps_max": 12, "weight": 50},
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 8, "reps_max": 8, "weight": 60},
        ])

        exported = import_export_service.export_routine(r.id)
        ex_data = exported["days"][0]["exercises"][0]
        assert ex_data["set_scheme"] == "progressive"
        assert len(ex_data["sets"]) == 2
        assert ex_data["sets"][0]["weight"] == 50
        assert ex_data["sets"][1]["weight"] == 60


class TestImportRegressions:
    """Regression tests for import bugs found in review."""

    def test_activate_initializes_cycle_state(self, import_export_service, cycle_service, routine_repo):
        """Import with activate=True must initialize cycle state (not just flip is_active)."""
        data = _minimal_valid_import()
        routine_id = import_export_service.import_routine(data, activate=True)

        current = cycle_service.get_current_day(routine_id)
        assert current is not None
        assert current.label == "A"

    def test_amrap_without_weight_rejected(self, import_export_service):
        """AMRAP set on reps_weight exercise must have weight — import must reject."""
        data = _minimal_valid_import()
        data["days"][0]["exercises"][0]["sets"] = [
            {"set_kind": "amrap"},  # Missing weight for reps_weight exercise
        ]
        preview = import_export_service.preview_import(data)
        assert any("require a weight" in e.lower() for e in preview.errors)
        assert not preview.is_valid

    def test_amrap_reps_only_with_weight_rejected(self, import_export_service):
        """AMRAP set on reps_only exercise must NOT have weight."""
        data = {
            "schema_version": 1, "name": "Test",
            "days": [{"label": "A", "name": "Pull", "exercises": [
                {"name": "Pull-ups", "type": "reps_only", "set_scheme": "uniform",
                 "sets": [{"set_kind": "amrap", "weight": 50.0}]}
            ]}],
        }
        preview = import_export_service.preview_import(data)
        assert any("must not have a weight" in e.lower() for e in preview.errors)

    def test_benchmark_invalid_exercise_rejected(self, import_export_service):
        """Benchmark referencing unknown exercise (not in plan or catalog) must error."""
        data = _minimal_valid_import()
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [
                {"exercise_name": "Nonexistent Exercise", "method": "max_weight",
                 "muscle_group_label": "Upper"},
            ],
        }
        preview = import_export_service.preview_import(data)
        assert any("not found in plan or catalog" in e for e in preview.errors)

    def test_benchmark_invalid_method_rejected(self, import_export_service):
        """Benchmark with invalid method must error."""
        data = _minimal_valid_import()
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [
                {"exercise_name": "Bench Press", "method": "invalid_method",
                 "muscle_group_label": "Upper"},
            ],
        }
        preview = import_export_service.preview_import(data)
        assert any("invalid method" in e.lower() for e in preview.errors)

    def test_benchmark_exercise_in_plan_passes_validation(self, import_export_service):
        """Benchmark referencing an exercise in the plan (but not catalog) should pass."""
        data = _minimal_valid_import()
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [
                {"exercise_name": "Bench Press", "method": "max_weight",
                 "muscle_group_label": "Upper"},
            ],
        }
        preview = import_export_service.preview_import(data)
        assert preview.is_valid

    def test_benchmark_uses_exercise_mapping(self, import_export_service, make_exercise, benchmark_repo):
        """Benchmark exercises should resolve through exercise_mapping, not just name lookup."""
        existing = make_exercise("Flat Bench")
        data = _minimal_valid_import()
        data["benchmarking"] = {
            "enabled": True,
            "frequency_weeks": 6,
            "items": [
                {"exercise_name": "Bench Press", "method": "max_weight",
                 "muscle_group_label": "Upper"},
            ],
        }
        # Map "Bench Press" to existing "Flat Bench" exercise
        import_export_service.import_routine(
            data, exercise_mapping={"Bench Press": existing.id},
        )
        defns = benchmark_repo.list_definitions()
        assert len(defns) == 1
        assert defns[0].exercise_id == existing.id
