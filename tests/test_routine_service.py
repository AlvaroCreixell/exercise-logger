import pytest
from src.models.exercise import ExerciseType
from src.models.routine import SetScheme, SetKind


class TestRoutineServiceRoutines:
    """Tests for routine CRUD and activation."""

    def test_create_routine(self, routine_service):
        r = routine_service.create_routine("PPL")
        assert r.id is not None
        assert r.name == "PPL"
        assert r.is_active is False

    def test_list_routines(self, routine_service):
        routine_service.create_routine("PPL")
        routine_service.create_routine("Upper/Lower")
        assert len(routine_service.list_routines()) == 2

    def test_get_routine(self, routine_service):
        r = routine_service.create_routine("PPL")
        fetched = routine_service.get_routine(r.id)
        assert fetched.name == "PPL"

    def test_activate_routine(self, routine_service):
        r = routine_service.create_routine("PPL")
        routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)
        active = routine_service.get_active_routine()
        assert active.id == r.id
        assert active.is_active is True

    def test_activate_deactivates_previous(self, routine_service):
        r1 = routine_service.create_routine("PPL")
        routine_service.add_day(r1.id, "A", "Push")
        routine_service.activate_routine(r1.id)

        r2 = routine_service.create_routine("Upper/Lower")
        routine_service.add_day(r2.id, "A", "Upper")
        routine_service.activate_routine(r2.id)

        r1_updated = routine_service.get_routine(r1.id)
        assert r1_updated.is_active is False
        assert routine_service.get_active_routine().id == r2.id

    def test_activate_initializes_cycle(self, routine_service, cycle_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        routine_service.add_day(r.id, "B", "Pull")
        routine_service.activate_routine(r.id)
        current = cycle_service.get_current_day(r.id)
        assert current.id == d1.id

    def test_deactivate_routine(self, routine_service):
        r = routine_service.create_routine("PPL")
        routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)
        routine_service.deactivate_routine(r.id)
        assert routine_service.get_active_routine() is None

    def test_delete_routine_cascades(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        routine_service.delete_routine(r.id)
        assert routine_service.get_routine(r.id) is None


class TestRoutineServiceDays:
    """Tests for day management and reordering."""

    def test_add_day(self, routine_service):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        assert day.id is not None
        assert day.label == "A"
        assert day.name == "Push"
        assert day.sort_order == 0

    def test_add_days_auto_sort_order(self, routine_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        d3 = routine_service.add_day(r.id, "C", "Legs")
        assert d1.sort_order == 0
        assert d2.sort_order == 1
        assert d3.sort_order == 2

    def test_update_day(self, routine_service):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        updated = routine_service.update_day(day.id, name="Chest & Triceps")
        assert updated.name == "Chest & Triceps"
        assert updated.label == "A"

    def test_delete_day_resequences(self, routine_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        d3 = routine_service.add_day(r.id, "C", "Legs")

        routine_service.delete_day(d2.id)

        days = routine_service.get_days(r.id)
        assert len(days) == 2
        assert days[0].label == "A"
        assert days[0].sort_order == 0
        assert days[1].label == "C"
        assert days[1].sort_order == 1

    def test_delete_first_day_resequences(self, routine_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")

        routine_service.delete_day(d1.id)

        days = routine_service.get_days(r.id)
        assert len(days) == 1
        assert days[0].label == "B"
        assert days[0].sort_order == 0

    def test_delete_current_cycle_day_adjusts_cycle(self, routine_service, cycle_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        d3 = routine_service.add_day(r.id, "C", "Legs")
        routine_service.activate_routine(r.id)

        cycle_service.set_day(r.id, d2.id)  # Current = B
        routine_service.delete_day(d2.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d3.id  # Should pick C

    def test_reorder_days(self, routine_service):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        d3 = routine_service.add_day(r.id, "C", "Legs")

        routine_service.reorder_days(r.id, [d3.id, d1.id, d2.id])

        days = routine_service.get_days(r.id)
        assert days[0].label == "C"
        assert days[0].sort_order == 0
        assert days[1].label == "A"
        assert days[1].sort_order == 1
        assert days[2].label == "B"
        assert days[2].sort_order == 2

    def test_add_day_updates_routine_timestamp(self, routine_service):
        r = routine_service.create_routine("PPL")
        original_updated = r.updated_at
        routine_service.add_day(r.id, "A", "Push")
        updated_r = routine_service.get_routine(r.id)
        assert updated_r.updated_at >= original_updated


class TestRoutineServiceExercises:
    """Tests for adding/removing exercises on days."""

    def test_add_exercise_to_day(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")

        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        assert rde.id is not None
        assert rde.sort_order == 0
        assert rde.set_scheme == SetScheme.UNIFORM

    def test_add_exercises_auto_sort_order(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex1 = make_exercise("Bench Press")
        ex2 = make_exercise("Shoulder Press")

        rde1 = routine_service.add_exercise_to_day(day.id, ex1.id, SetScheme.UNIFORM)
        rde2 = routine_service.add_exercise_to_day(day.id, ex2.id, SetScheme.UNIFORM)
        assert rde1.sort_order == 0
        assert rde2.sort_order == 1

    def test_remove_exercise_resequences(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex1 = make_exercise("Bench Press")
        ex2 = make_exercise("Shoulder Press")
        ex3 = make_exercise("Tricep Pushdown")

        rde1 = routine_service.add_exercise_to_day(day.id, ex1.id, SetScheme.UNIFORM)
        rde2 = routine_service.add_exercise_to_day(day.id, ex2.id, SetScheme.UNIFORM)
        rde3 = routine_service.add_exercise_to_day(day.id, ex3.id, SetScheme.UNIFORM)

        routine_service.remove_exercise_from_day(rde2.id)

        exercises = routine_service.get_day_exercises(day.id)
        assert len(exercises) == 2
        assert exercises[0].exercise_id == ex1.id
        assert exercises[0].sort_order == 0
        assert exercises[1].exercise_id == ex3.id
        assert exercises[1].sort_order == 1

    def test_add_exercise_with_notes_and_optional(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Lateral Raise")

        rde = routine_service.add_exercise_to_day(
            day.id, ex.id, SetScheme.UNIFORM,
            notes="slow eccentric", is_optional=True,
        )
        assert rde.notes == "slow eccentric"
        assert rde.is_optional is True


class TestRoutineServiceSetTargets:
    """Tests for uniform/progressive set targets and validation."""

    def test_uniform_targets(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, num_sets=4, set_kind=SetKind.REPS_WEIGHT,
            reps_min=10, reps_max=10, weight=135.0,
        )
        assert len(targets) == 4
        for i, t in enumerate(targets):
            assert t.set_number == i + 1
            assert t.target_reps_min == 10
            assert t.target_reps_max == 10
            assert t.target_weight == 135.0

    def test_uniform_targets_with_rep_range(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Lat Pulldown")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, num_sets=3, set_kind=SetKind.REPS_WEIGHT,
            reps_min=8, reps_max=12, weight=100.0,
        )
        assert targets[0].target_reps_min == 8
        assert targets[0].target_reps_max == 12

    def test_progressive_targets(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Incline DB Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        targets = routine_service.set_progressive_targets(rde.id, [
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 12, "reps_max": 12, "weight": 50.0},
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 8, "reps_max": 8, "weight": 60.0},
            {"set_kind": SetKind.AMRAP, "weight": 70.0},
        ])
        assert len(targets) == 3
        assert targets[0].target_reps_min == 12
        assert targets[0].target_weight == 50.0
        assert targets[2].set_kind == SetKind.AMRAP
        assert targets[2].target_weight == 70.0

    def test_set_kind_incompatible_rejected(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press", type=ExerciseType.REPS_WEIGHT)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        with pytest.raises(ValueError, match="not compatible"):
            routine_service.set_uniform_targets(rde.id, 3, SetKind.DURATION, duration_seconds=60)

    def test_reps_only_rejects_reps_weight_kind(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Pull")
        ex = make_exercise("Pull-ups", type=ExerciseType.REPS_ONLY)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        with pytest.raises(ValueError, match="not compatible"):
            routine_service.set_uniform_targets(rde.id, 3, SetKind.REPS_WEIGHT, 10, 10, 135.0)

    def test_amrap_with_reps_weight(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press", type=ExerciseType.REPS_WEIGHT)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        targets = routine_service.set_progressive_targets(rde.id, [
            {"set_kind": SetKind.REPS_WEIGHT, "reps_min": 10, "reps_max": 10, "weight": 135.0},
            {"set_kind": SetKind.AMRAP, "weight": 135.0},
        ])
        assert targets[1].set_kind == SetKind.AMRAP

    def test_amrap_with_reps_only_bodyweight(self, routine_service, make_exercise):
        """Bodyweight AMRAP: reps_only exercise, no weight."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Pull")
        ex = make_exercise("Pull-ups", type=ExerciseType.REPS_ONLY)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        targets = routine_service.set_progressive_targets(rde.id, [
            {"set_kind": SetKind.REPS_ONLY, "reps_min": 10, "reps_max": 10},
            {"set_kind": SetKind.AMRAP},
        ])
        assert targets[1].set_kind == SetKind.AMRAP
        assert targets[1].target_weight is None

    def test_cardio_with_duration_only(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Cardio")
        ex = make_exercise("Treadmill", type=ExerciseType.CARDIO)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, 1, SetKind.CARDIO, duration_seconds=1200,
        )
        assert targets[0].target_duration_seconds == 1200
        assert targets[0].target_distance is None

    def test_cardio_with_both_duration_and_distance(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Cardio")
        ex = make_exercise("Treadmill", type=ExerciseType.CARDIO)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, 1, SetKind.CARDIO, duration_seconds=1200, distance=5.0,
        )
        assert targets[0].target_duration_seconds == 1200
        assert targets[0].target_distance == 5.0

    def test_cardio_requires_duration_or_distance(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Cardio")
        ex = make_exercise("Treadmill", type=ExerciseType.CARDIO)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        with pytest.raises(ValueError, match="at least one"):
            routine_service.set_uniform_targets(rde.id, 1, SetKind.CARDIO)

    def test_replacing_targets_deletes_old(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        routine_service.set_uniform_targets(rde.id, 4, SetKind.REPS_WEIGHT, 10, 10, 135.0)
        assert len(routine_service.get_targets(rde.id)) == 4

        routine_service.set_uniform_targets(rde.id, 3, SetKind.REPS_WEIGHT, 8, 8, 145.0)
        targets = routine_service.get_targets(rde.id)
        assert len(targets) == 3
        assert targets[0].target_weight == 145.0

    def test_duration_targets_for_time_exercise(self, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Core")
        ex = make_exercise("Plank", type=ExerciseType.TIME)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)

        targets = routine_service.set_uniform_targets(
            rde.id, 3, SetKind.DURATION, duration_seconds=60,
        )
        assert len(targets) == 3
        assert targets[0].target_duration_seconds == 60

    def test_amrap_reps_weight_requires_weight(self, routine_service, make_exercise):
        """AMRAP on reps_weight exercise must have weight set."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press", type=ExerciseType.REPS_WEIGHT)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        with pytest.raises(ValueError, match="require a weight"):
            routine_service.set_progressive_targets(rde.id, [
                {"set_kind": SetKind.AMRAP},  # Missing weight
            ])

    def test_amrap_reps_only_rejects_weight(self, routine_service, make_exercise):
        """AMRAP on reps_only exercise must NOT have weight."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Pull")
        ex = make_exercise("Pull-ups", type=ExerciseType.REPS_ONLY)
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.PROGRESSIVE)

        with pytest.raises(ValueError, match="must not have a weight"):
            routine_service.set_progressive_targets(rde.id, [
                {"set_kind": SetKind.AMRAP, "weight": 50.0},  # Weight on bodyweight exercise
            ])


class TestRoutineServiceCascade:
    """Tests for deletion cascade behavior."""

    def test_delete_routine_with_active_cycle_state(self, routine_service, cycle_service):
        """Deleting a routine with cycle state should cascade cleanly."""
        r = routine_service.create_routine("PPL")
        routine_service.add_day(r.id, "A", "Push")
        routine_service.add_day(r.id, "B", "Pull")
        routine_service.activate_routine(r.id)

        # Verify cycle state exists
        assert cycle_service.get_current_day(r.id) is not None

        # Delete should cascade without FK errors
        routine_service.delete_routine(r.id)
        assert routine_service.get_routine(r.id) is None
