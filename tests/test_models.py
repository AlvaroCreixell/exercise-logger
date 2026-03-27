"""Tests for v2 models, enums, config, and utilities."""
from __future__ import annotations
import pytest
from src.models.enums import (
    ExerciseType,
    SetScheme,
    BenchmarkMethod,
    SessionStatus,
    ExerciseSource,
)
from src.models.bundled import (
    Exercise,
    DayExercise,
    RoutineDay,
    Routine,
    BenchmarkItem,
    BenchmarkConfig,
)
from src.models.workout import WorkoutSession, SessionExercise, LoggedSet
from src.models.benchmark import BenchmarkResult
from src.utils.unit_conversion import lbs_to_kg, kg_to_lbs, LBS_TO_KG, KG_TO_LBS


class TestEnums:
    def test_exercise_type_values(self):
        assert ExerciseType.REPS_WEIGHT.value == "reps_weight"
        assert ExerciseType.TIME.value == "time"
        assert ExerciseType.CARDIO.value == "cardio"

    def test_exercise_type_count(self):
        assert len(ExerciseType) == 3

    def test_set_scheme_values(self):
        assert SetScheme.UNIFORM.value == "uniform"
        assert SetScheme.PROGRESSIVE.value == "progressive"

    def test_set_scheme_count(self):
        assert len(SetScheme) == 2

    def test_benchmark_method_values(self):
        assert BenchmarkMethod.MAX_WEIGHT.value == "max_weight"
        assert BenchmarkMethod.MAX_REPS.value == "max_reps"
        assert BenchmarkMethod.TIMED_HOLD.value == "timed_hold"

    def test_benchmark_method_count(self):
        assert len(BenchmarkMethod) == 3

    def test_session_status_values(self):
        assert SessionStatus.IN_PROGRESS.value == "in_progress"
        assert SessionStatus.FINISHED.value == "finished"

    def test_session_status_count(self):
        assert len(SessionStatus) == 2

    def test_exercise_source_values(self):
        assert ExerciseSource.PLANNED.value == "planned"
        assert ExerciseSource.AD_HOC.value == "ad_hoc"

    def test_exercise_source_count(self):
        assert len(ExerciseSource) == 2

    def test_enum_lookup_by_value(self):
        assert ExerciseType("reps_weight") is ExerciseType.REPS_WEIGHT
        assert SetScheme("uniform") is SetScheme.UNIFORM
        assert BenchmarkMethod("timed_hold") is BenchmarkMethod.TIMED_HOLD
        assert SessionStatus("finished") is SessionStatus.FINISHED
        assert ExerciseSource("ad_hoc") is ExerciseSource.AD_HOC

    def test_invalid_enum_value_raises(self):
        with pytest.raises(ValueError):
            ExerciseType("invalid")


class TestBundledModels:
    def test_exercise_is_frozen(self):
        ex = Exercise(
            key="squat",
            name="Barbell Squat",
            type=ExerciseType.REPS_WEIGHT,
            equipment="barbell",
            muscle_group="legs",
        )
        with pytest.raises((AttributeError, TypeError)):
            ex.name = "Changed"  # type: ignore[misc]

    def test_exercise_fields(self):
        ex = Exercise(
            key="squat",
            name="Barbell Squat",
            type=ExerciseType.REPS_WEIGHT,
            equipment="barbell",
            muscle_group="legs",
        )
        assert ex.key == "squat"
        assert ex.name == "Barbell Squat"
        assert ex.type is ExerciseType.REPS_WEIGHT
        assert ex.equipment == "barbell"
        assert ex.muscle_group == "legs"

    def test_day_exercise_required_fields(self):
        de = DayExercise(
            exercise_key="bench_press",
            scheme=SetScheme.UNIFORM,
            sets=3,
        )
        assert de.exercise_key == "bench_press"
        assert de.scheme is SetScheme.UNIFORM
        assert de.sets == 3

    def test_day_exercise_optional_defaults_are_none(self):
        de = DayExercise(
            exercise_key="plank",
            scheme=SetScheme.UNIFORM,
            sets=3,
        )
        assert de.reps_min is None
        assert de.reps_max is None
        assert de.duration_seconds is None
        assert de.distance_km is None
        assert de.notes is None

    def test_day_exercise_is_frozen(self):
        de = DayExercise(exercise_key="squat", scheme=SetScheme.UNIFORM, sets=3)
        with pytest.raises((AttributeError, TypeError)):
            de.sets = 5  # type: ignore[misc]

    def test_routine_day_default_exercises_empty_tuple(self):
        day = RoutineDay(key="push_a", label="A", name="Push Day A")
        assert day.exercises == ()
        assert isinstance(day.exercises, tuple)

    def test_routine_day_with_exercises(self):
        de = DayExercise(exercise_key="bench_press", scheme=SetScheme.UNIFORM, sets=3)
        day = RoutineDay(
            key="push_a",
            label="A",
            name="Push Day A",
            exercises=(de,),
        )
        assert len(day.exercises) == 1
        assert day.exercises[0] is de

    def test_routine_day_is_frozen(self):
        day = RoutineDay(key="push_a", label="A", name="Push Day A")
        with pytest.raises((AttributeError, TypeError)):
            day.label = "B"  # type: ignore[misc]

    def test_routine_default_days_empty_tuple(self):
        r = Routine(key="ppl", name="PPL", description="Push Pull Legs")
        assert r.days == ()
        assert isinstance(r.days, tuple)

    def test_routine_with_days(self):
        day = RoutineDay(key="push_a", label="A", name="Push Day A")
        r = Routine(key="ppl", name="PPL", description="Push Pull Legs", days=(day,))
        assert len(r.days) == 1
        assert r.days[0] is day

    def test_routine_is_frozen(self):
        r = Routine(key="ppl", name="PPL", description="desc")
        with pytest.raises((AttributeError, TypeError)):
            r.name = "Changed"  # type: ignore[misc]

    def test_benchmark_item_is_frozen(self):
        item = BenchmarkItem(exercise_key="squat", method=BenchmarkMethod.MAX_WEIGHT)
        with pytest.raises((AttributeError, TypeError)):
            item.exercise_key = "bench"  # type: ignore[misc]

    def test_benchmark_config_default_items_empty_tuple(self):
        cfg = BenchmarkConfig(frequency_weeks=6)
        assert cfg.items == ()
        assert isinstance(cfg.items, tuple)

    def test_benchmark_config_with_items(self):
        item = BenchmarkItem(exercise_key="squat", method=BenchmarkMethod.MAX_WEIGHT)
        cfg = BenchmarkConfig(frequency_weeks=6, items=(item,))
        assert len(cfg.items) == 1
        assert cfg.items[0].exercise_key == "squat"

    def test_benchmark_config_is_frozen(self):
        cfg = BenchmarkConfig(frequency_weeks=6)
        with pytest.raises((AttributeError, TypeError)):
            cfg.frequency_weeks = 8  # type: ignore[misc]


class TestMutableModels:
    def test_workout_session_fields(self):
        ws = WorkoutSession(
            id=None,
            routine_key_snapshot="ppl",
            routine_name_snapshot="PPL",
            day_key_snapshot="push_a",
            day_label_snapshot="A",
            day_name_snapshot="Push Day A",
            status=SessionStatus.IN_PROGRESS,
            started_at="2026-03-26T10:00:00",
        )
        assert ws.id is None
        assert ws.routine_key_snapshot == "ppl"
        assert ws.status is SessionStatus.IN_PROGRESS
        assert ws.completed_fully is None
        assert ws.finished_at is None

    def test_workout_session_is_mutable(self):
        ws = WorkoutSession(
            id=None,
            routine_key_snapshot="ppl",
            routine_name_snapshot="PPL",
            day_key_snapshot="push_a",
            day_label_snapshot="A",
            day_name_snapshot="Push Day A",
            status=SessionStatus.IN_PROGRESS,
            started_at="2026-03-26T10:00:00",
        )
        ws.id = 42
        ws.status = SessionStatus.FINISHED
        ws.finished_at = "2026-03-26T11:00:00"
        assert ws.id == 42
        assert ws.status is SessionStatus.FINISHED
        assert ws.finished_at == "2026-03-26T11:00:00"

    def test_session_exercise_required_fields(self):
        se = SessionExercise(
            id=None,
            session_id=1,
            sort_order=0,
            exercise_key_snapshot="squat",
            exercise_name_snapshot="Barbell Squat",
            exercise_type_snapshot=ExerciseType.REPS_WEIGHT,
            source=ExerciseSource.PLANNED,
        )
        assert se.session_id == 1
        assert se.exercise_type_snapshot is ExerciseType.REPS_WEIGHT
        assert se.source is ExerciseSource.PLANNED

    def test_session_exercise_optional_defaults(self):
        se = SessionExercise(
            id=None,
            session_id=1,
            sort_order=0,
            exercise_key_snapshot="squat",
            exercise_name_snapshot="Barbell Squat",
            exercise_type_snapshot=ExerciseType.REPS_WEIGHT,
            source=ExerciseSource.PLANNED,
        )
        assert se.scheme_snapshot is None
        assert se.planned_sets is None
        assert se.target_reps_min is None
        assert se.target_reps_max is None
        assert se.target_duration_seconds is None
        assert se.target_distance_km is None
        assert se.plan_notes_snapshot is None

    def test_session_exercise_is_mutable(self):
        se = SessionExercise(
            id=None,
            session_id=1,
            sort_order=0,
            exercise_key_snapshot="squat",
            exercise_name_snapshot="Barbell Squat",
            exercise_type_snapshot=ExerciseType.REPS_WEIGHT,
            source=ExerciseSource.PLANNED,
        )
        se.id = 10
        se.planned_sets = 4
        assert se.id == 10
        assert se.planned_sets == 4

    def test_logged_set_required_fields(self):
        ls = LoggedSet(
            id=None,
            session_exercise_id=5,
            set_number=1,
            logged_at="2026-03-26T10:05:00",
        )
        assert ls.session_exercise_id == 5
        assert ls.set_number == 1
        assert ls.logged_at == "2026-03-26T10:05:00"

    def test_logged_set_optional_defaults(self):
        ls = LoggedSet(
            id=None,
            session_exercise_id=5,
            set_number=1,
            logged_at="2026-03-26T10:05:00",
        )
        assert ls.reps is None
        assert ls.weight is None
        assert ls.duration_seconds is None
        assert ls.distance_km is None

    def test_logged_set_is_mutable(self):
        ls = LoggedSet(
            id=None,
            session_exercise_id=5,
            set_number=1,
            logged_at="2026-03-26T10:05:00",
        )
        ls.reps = 10
        ls.weight = 135.0
        assert ls.reps == 10
        assert ls.weight == 135.0

    def test_benchmark_result_fields(self):
        br = BenchmarkResult(
            id=None,
            exercise_key_snapshot="squat",
            exercise_name_snapshot="Barbell Squat",
            method=BenchmarkMethod.MAX_WEIGHT,
            result_value=225.0,
            tested_at="2026-03-26T09:00:00",
        )
        assert br.id is None
        assert br.exercise_key_snapshot == "squat"
        assert br.method is BenchmarkMethod.MAX_WEIGHT
        assert br.result_value == 225.0
        assert br.bodyweight is None

    def test_benchmark_result_is_mutable(self):
        br = BenchmarkResult(
            id=None,
            exercise_key_snapshot="squat",
            exercise_name_snapshot="Barbell Squat",
            method=BenchmarkMethod.MAX_WEIGHT,
            result_value=225.0,
            tested_at="2026-03-26T09:00:00",
        )
        br.id = 7
        br.bodyweight = 180.0
        assert br.id == 7
        assert br.bodyweight == 180.0


class TestUnitConversion:
    def test_lbs_to_kg_basic(self):
        assert lbs_to_kg(100) == round(100 * LBS_TO_KG, 2)

    def test_kg_to_lbs_basic(self):
        assert kg_to_lbs(45.36) == round(45.36 * KG_TO_LBS, 2)

    def test_lbs_to_kg_roundtrip(self):
        original = 135.0
        converted = lbs_to_kg(original)
        back = kg_to_lbs(converted)
        assert abs(back - original) < 0.1

    def test_lbs_to_kg_zero(self):
        assert lbs_to_kg(0) == 0.0

    def test_kg_to_lbs_zero(self):
        assert kg_to_lbs(0) == 0.0

    def test_lbs_to_kg_returns_float(self):
        result = lbs_to_kg(100)
        assert isinstance(result, float)

    def test_kg_to_lbs_returns_float(self):
        result = kg_to_lbs(45)
        assert isinstance(result, float)

    def test_lbs_to_kg_known_value(self):
        # 1 lb ≈ 0.45 kg
        assert lbs_to_kg(1) == round(LBS_TO_KG, 2)

    def test_kg_to_lbs_known_value(self):
        # 1 kg ≈ 2.2 lbs
        assert kg_to_lbs(1) == round(KG_TO_LBS, 2)
