import pytest
from src.models.exercise import ExerciseType
from src.models.routine import SetScheme, SetKind
from src.models.workout import SessionStatus, SessionType


class TestWorkoutSessionLifecycle:
    """Tests for session start, finish, end early, and single-session constraint."""

    def _setup_routine_day(self, routine_service, make_exercise):
        """Helper: create a routine with one day and one exercise."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        routine_service.activate_routine(r.id)
        return r, day, ex, rde

    def test_start_routine_session(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        session = workout_service.start_routine_session(day.id)

        assert session.id is not None
        assert session.session_type == SessionType.ROUTINE
        assert session.status == SessionStatus.IN_PROGRESS
        assert session.completed_fully is None
        assert session.day_label_snapshot == "A"
        assert session.day_name_snapshot == "Push"
        assert session.routine_id == r.id

    def test_start_benchmark_session(self, workout_service):
        session = workout_service.start_benchmark_session()
        assert session.session_type == SessionType.BENCHMARK
        assert session.status == SessionStatus.IN_PROGRESS
        assert session.routine_id is None

    def test_only_one_in_progress_session(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        workout_service.start_routine_session(day.id)
        with pytest.raises(ValueError, match="already in progress"):
            workout_service.start_benchmark_session()

    def test_finish_session(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        session = workout_service.start_routine_session(day.id)
        finished = workout_service.finish_session(session.id)

        assert finished.status == SessionStatus.FINISHED
        assert finished.completed_fully is True
        assert finished.finished_at is not None

    def test_finish_advances_cycle(self, workout_service, routine_service, cycle_service, make_exercise):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(d1.id)
        workout_service.finish_session(session.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d2.id

    def test_end_early(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        session = workout_service.start_routine_session(day.id)
        ended = workout_service.end_early(session.id)

        assert ended.status == SessionStatus.FINISHED
        assert ended.completed_fully is False

    def test_end_early_zero_sets_no_cycle_advance(self, workout_service, routine_service, cycle_service, make_exercise):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(d1.id)
        workout_service.end_early(session.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d1.id  # No advance — zero sets

    def test_end_early_with_sets_advances_cycle(self, workout_service, routine_service, cycle_service, make_exercise):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        d2 = routine_service.add_day(r.id, "B", "Pull")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(d1.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        workout_service.end_early(session.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d2.id  # Advanced — had sets

    def test_benchmark_session_no_cycle_advance(self, workout_service, routine_service, cycle_service, make_exercise):
        r = routine_service.create_routine("PPL")
        d1 = routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)

        session = workout_service.start_benchmark_session()
        workout_service.finish_session(session.id)

        current = cycle_service.get_current_day(r.id)
        assert current.id == d1.id  # No advance — benchmark session

    def test_get_in_progress_session(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        session = workout_service.start_routine_session(day.id)
        found = workout_service.get_in_progress_session()
        assert found.id == session.id

    def test_no_in_progress_session(self, workout_service):
        assert workout_service.get_in_progress_session() is None

    def test_can_start_after_finish(self, workout_service, routine_service, make_exercise):
        r, day, ex, rde = self._setup_routine_day(routine_service, make_exercise)
        s1 = workout_service.start_routine_session(day.id)
        workout_service.finish_session(s1.id)
        s2 = workout_service.start_routine_session(day.id)
        assert s2.id != s1.id


class TestWorkoutSetLogging:
    """Tests for logging, editing, and deleting sets."""

    def _start_session_with_exercise(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        return session, se, ex

    def test_log_set(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)

        assert ls.id is not None
        assert ls.set_number == 1
        assert ls.reps == 10
        assert ls.weight == 135.0
        assert ls.logged_at is not None

    def test_log_set_auto_increments_set_number(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls1 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        ls2 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=8, weight=145.0)
        assert ls1.set_number == 1
        assert ls2.set_number == 2

    def test_log_set_validates_set_kind(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        with pytest.raises(ValueError, match="not compatible"):
            workout_service.log_set(se.id, SetKind.DURATION, duration_seconds=60)

    def test_log_set_validates_cardio(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("C")
        day = routine_service.add_day(r.id, "A", "Cardio")
        ex = make_exercise("Treadmill", type=ExerciseType.CARDIO)
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)

        with pytest.raises(ValueError, match="at least one"):
            workout_service.log_set(se.id, SetKind.CARDIO)

    def test_log_set_with_target_link(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        rde = routine_service.add_exercise_to_day(day.id, ex.id, SetScheme.UNIFORM)
        targets = routine_service.set_uniform_targets(rde.id, 3, SetKind.REPS_WEIGHT, 10, 10, 135.0)
        routine_service.activate_routine(r.id)

        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id, routine_day_exercise_id=rde.id)
        ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT,
                                     exercise_set_target_id=targets[0].id,
                                     reps=10, weight=135.0)
        assert ls.exercise_set_target_id == targets[0].id

    def test_add_ad_hoc_exercise(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)

        ex = make_exercise("Tricep Pushdown")
        se = workout_service.add_exercise_to_session(session.id, ex.id)  # No rde_id = ad-hoc
        assert se.routine_day_exercise_id is None
        assert se.exercise_name_snapshot == "Tricep Pushdown"

    def test_update_set(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)

        updated = workout_service.update_set(ls.id, reps=12, weight=140.0)
        assert updated.reps == 12
        assert updated.weight == 140.0

    def test_delete_set_resequences(self, workout_service, routine_service, make_exercise):
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls1 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        ls2 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=8, weight=145.0)
        ls3 = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=6, weight=155.0)

        workout_service.delete_set(ls2.id)

        sets = workout_service.get_logged_sets(se.id)
        assert len(sets) == 2
        assert sets[0].set_number == 1
        assert sets[0].reps == 10
        assert sets[1].set_number == 2
        assert sets[1].reps == 6

    def test_edit_past_session_set(self, workout_service, routine_service, make_exercise):
        """Editing a past session's set works (no append-only restriction)."""
        session, se, ex = self._start_session_with_exercise(workout_service, routine_service, make_exercise)
        ls = workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        workout_service.finish_session(session.id)

        updated = workout_service.update_set(ls.id, reps=12)
        assert updated.reps == 12

    def test_session_exercise_snapshot(self, workout_service, routine_service, make_exercise):
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        assert se.exercise_name_snapshot == "Bench Press"

    def test_routine_deletion_preserves_session(self, workout_service, routine_service, make_exercise, db_conn):
        """ON DELETE SET NULL: deleting routine preserves session with null routine_id."""
        r = routine_service.create_routine("PPL")
        day = routine_service.add_day(r.id, "A", "Push")
        ex = make_exercise("Bench Press")
        routine_service.activate_routine(r.id)
        session = workout_service.start_routine_session(day.id)
        se = workout_service.add_exercise_to_session(session.id, ex.id)
        workout_service.log_set(se.id, SetKind.REPS_WEIGHT, reps=10, weight=135.0)
        workout_service.finish_session(session.id)

        routine_service.delete_routine(r.id)

        preserved = workout_service.get_session(session.id)
        assert preserved is not None
        assert preserved.routine_id is None
        assert preserved.day_label_snapshot == "A"  # Snapshot preserved
