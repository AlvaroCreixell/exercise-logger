# tests/test_workout_service.py
"""Tests for WorkoutService — session lifecycle, set logging, editing."""
import pytest
from src.models.enums import SessionStatus, ExerciseSource
from src.services.workout_service import WorkoutService
from tests.conftest import days_ago


class TestStartSession:
    """Starting a workout session snapshots the plan."""

    def test_start_session_creates_session_and_exercises(
            self, workout_service, app_state_service, settings_repo):
        app_state_service.set_active_routine("push_pull_legs")
        # Current day is "push" (2 exercises: bench press + plank)

        session = workout_service.start_session()
        assert session.id is not None
        assert session.status == SessionStatus.IN_PROGRESS
        assert session.routine_key_snapshot == "push_pull_legs"
        assert session.routine_name_snapshot == "Push Pull Legs"
        assert session.day_key_snapshot == "push"
        assert session.day_label_snapshot == "A"
        assert session.day_name_snapshot == "Push"

        exercises = workout_service.get_session_exercises(session.id)
        assert len(exercises) == 2
        assert exercises[0].exercise_key_snapshot == "barbell_bench_press"
        assert exercises[0].source == ExerciseSource.PLANNED
        assert exercises[0].scheme_snapshot is not None
        assert exercises[0].scheme_snapshot.value == "progressive"
        assert exercises[0].planned_sets == 3
        assert exercises[0].target_reps_min is None  # progressive
        assert exercises[1].exercise_key_snapshot == "plank"
        assert exercises[1].exercise_type_snapshot.value == "time"
        assert exercises[1].target_duration_seconds == 60

    def test_start_session_blocks_if_already_in_progress(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        workout_service.start_session()

        with pytest.raises(ValueError, match="already in progress"):
            workout_service.start_session()

    def test_start_session_requires_active_routine(self, workout_service):
        with pytest.raises(ValueError, match="No active routine"):
            workout_service.start_session()


class TestLogSet:
    """Logging sets during a workout."""

    def test_log_reps_weight_set(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]  # barbell_bench_press, reps_weight

        logged = workout_service.log_set(
            session_exercise_id=bench_se.id,
            reps=10, weight=60.0,
        )
        assert logged.id is not None
        assert logged.set_number == 1
        assert logged.reps == 10
        assert logged.weight == 60.0

    def test_log_time_set(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        plank_se = exercises[1]  # plank, time

        logged = workout_service.log_set(
            session_exercise_id=plank_se.id,
            duration_seconds=45,
        )
        assert logged.set_number == 1
        assert logged.duration_seconds == 45

    def test_log_cardio_set_with_distance(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        # Advance to pull day which has running
        app_state_service.advance_day()  # push -> pull
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        running_se = [e for e in exercises
                      if e.exercise_key_snapshot == "running"][0]

        logged = workout_service.log_set(
            session_exercise_id=running_se.id,
            duration_seconds=1800, distance_km=5.0,
        )
        assert logged.duration_seconds == 1800
        assert logged.distance_km == 5.0

    def test_log_cardio_set_distance_only(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        app_state_service.advance_day()
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        running_se = [e for e in exercises
                      if e.exercise_key_snapshot == "running"][0]

        logged = workout_service.log_set(
            session_exercise_id=running_se.id,
            distance_km=5.0,
        )
        assert logged.distance_km == 5.0
        assert logged.duration_seconds is None

    def test_log_cardio_set_duration_only(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        app_state_service.advance_day()
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        running_se = [e for e in exercises
                      if e.exercise_key_snapshot == "running"][0]

        logged = workout_service.log_set(
            session_exercise_id=running_se.id,
            duration_seconds=1800,
        )
        assert logged.duration_seconds == 1800

    def test_set_numbers_auto_increment(self, workout_service,
                                         app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        s1 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=10, weight=60.0)
        s2 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=8, weight=70.0)
        s3 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=6, weight=80.0)
        assert s1.set_number == 1
        assert s2.set_number == 2
        assert s3.set_number == 3

    def test_reps_weight_requires_reps_and_weight(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        with pytest.raises(ValueError, match="reps"):
            workout_service.log_set(session_exercise_id=bench_se.id,
                                     weight=60.0)

        with pytest.raises(ValueError, match="weight"):
            workout_service.log_set(session_exercise_id=bench_se.id,
                                     reps=10)

    def test_reps_weight_allows_zero_weight(
            self, workout_service, app_state_service):
        """Bodyweight exercises have weight=0."""
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        logged = workout_service.log_set(session_exercise_id=bench_se.id,
                                          reps=10, weight=0.0)
        assert logged.weight == 0.0

    def test_time_requires_duration(self, workout_service,
                                     app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        plank_se = exercises[1]

        with pytest.raises(ValueError, match="duration"):
            workout_service.log_set(session_exercise_id=plank_se.id,
                                     reps=10)

    def test_cardio_requires_at_least_one_metric(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        app_state_service.advance_day()
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        running_se = [e for e in exercises
                      if e.exercise_key_snapshot == "running"][0]

        with pytest.raises(ValueError, match="duration.*distance"):
            workout_service.log_set(session_exercise_id=running_se.id)


class TestEditSet:
    """Editing logged sets (current or finished sessions)."""

    def test_edit_set_updates_values(self, workout_service,
                                      app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        logged = workout_service.log_set(session_exercise_id=bench_se.id,
                                          reps=10, weight=60.0)
        updated = workout_service.edit_set(logged.id, reps=12, weight=65.0)
        assert updated.reps == 12
        assert updated.weight == 65.0

    def test_edit_set_partial_update(self, workout_service,
                                      app_state_service):
        """Can update just one field."""
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        logged = workout_service.log_set(session_exercise_id=bench_se.id,
                                          reps=10, weight=60.0)
        updated = workout_service.edit_set(logged.id, reps=12)
        assert updated.reps == 12
        assert updated.weight == 60.0  # unchanged

    def test_edit_nonexistent_set_raises(self, workout_service):
        with pytest.raises(ValueError, match="not found"):
            workout_service.edit_set(9999, reps=10)


class TestDeleteSet:
    """Deleting logged sets with resequencing."""

    def test_delete_set_resequences(self, workout_service,
                                     app_state_service, workout_repo):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        s1 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=10, weight=60.0)
        s2 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=8, weight=70.0)
        s3 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=6, weight=80.0)

        workout_service.delete_set(s2.id)

        sets = workout_repo.get_logged_sets(bench_se.id)
        assert len(sets) == 2
        assert sets[0].set_number == 1
        assert sets[0].weight == 60.0
        assert sets[1].set_number == 2
        assert sets[1].weight == 80.0  # was set_number 3, now 2

    def test_delete_last_set_from_finished_session_deletes_session(
            self, workout_service, app_state_service, workout_repo):
        """Finished session with all sets deleted => session deleted."""
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]

        s1 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        # Delete the only set
        workout_service.delete_set(s1.id)

        # Session should be gone
        assert workout_repo.get_session(session.id) is None

    def test_delete_last_set_finished_session_no_cycle_rewind(
            self, workout_service, app_state_service, settings_repo):
        """Cycle advancement is permanent — deleting sets doesn't rewind."""
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        bench_se = exercises[0]
        s1 = workout_service.log_set(session_exercise_id=bench_se.id,
                                      reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        # Day should have advanced to pull
        assert app_state_service.get_current_day().key == "pull"

        # Delete last set => session deleted
        workout_service.delete_set(s1.id)

        # Day should STILL be pull (no rewind)
        assert app_state_service.get_current_day().key == "pull"

    def test_delete_nonexistent_set_raises(self, workout_service):
        with pytest.raises(ValueError, match="not found"):
            workout_service.delete_set(9999)


class TestAddAdHocExercise:
    """Adding ad-hoc exercises during a workout."""

    def test_add_ad_hoc_exercise(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()

        se = workout_service.add_ad_hoc_exercise(
            session_id=session.id,
            exercise_key="running",
        )
        assert se.source == ExerciseSource.AD_HOC
        assert se.exercise_key_snapshot == "running"
        assert se.exercise_type_snapshot.value == "cardio"
        assert se.planned_sets is None
        assert se.target_reps_min is None
        assert se.scheme_snapshot is None

    def test_ad_hoc_appended_at_end(self, workout_service,
                                     app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        # push day has 2 planned exercises (sort_order 0, 1)

        se = workout_service.add_ad_hoc_exercise(
            session_id=session.id,
            exercise_key="running",
        )
        assert se.sort_order == 2  # after the 2 planned exercises

    def test_ad_hoc_invalid_exercise_raises(self, workout_service,
                                             app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()

        with pytest.raises(ValueError, match="not found"):
            workout_service.add_ad_hoc_exercise(
                session_id=session.id,
                exercise_key="nonexistent_exercise",
            )

    def test_ad_hoc_requires_in_progress_session(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        # Log a set so we can finish
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        with pytest.raises(ValueError, match="not in progress"):
            workout_service.add_ad_hoc_exercise(
                session_id=session.id,
                exercise_key="running",
            )

    def test_can_log_sets_on_ad_hoc_exercise(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        se = workout_service.add_ad_hoc_exercise(
            session_id=session.id,
            exercise_key="barbell_back_squat",
        )

        logged = workout_service.log_set(
            session_exercise_id=se.id,
            reps=10, weight=100.0,
        )
        assert logged.set_number == 1
        assert logged.reps == 10


class TestFinishSession:
    """Finishing a workout."""

    def test_finish_session(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)

        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)

        finished = workout_service.finish_session(session.id)
        assert finished.status == SessionStatus.FINISHED
        assert finished.completed_fully is True
        assert finished.finished_at is not None

    def test_finish_advances_cycle(self, workout_service,
                                    app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        assert app_state_service.get_current_day().key == "pull"

    def test_finish_not_in_progress_raises(self, workout_service,
                                            app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        with pytest.raises(ValueError, match="not in progress"):
            workout_service.finish_session(session.id)

    def test_finish_nonexistent_session_raises(self, workout_service):
        with pytest.raises(ValueError, match="not found"):
            workout_service.finish_session(9999)


class TestEndEarly:
    """Ending a workout early."""

    def test_end_early_with_sets(self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)

        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)

        finished = workout_service.end_early(session.id)
        assert finished.status == SessionStatus.FINISHED
        assert finished.completed_fully is False

    def test_end_early_advances_cycle_if_sets_exist(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.end_early(session.id)

        assert app_state_service.get_current_day().key == "pull"

    def test_end_early_requires_at_least_one_set(
            self, workout_service, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()

        with pytest.raises(ValueError, match="at least one set"):
            workout_service.end_early(session.id)


class TestCancelSession:
    """Canceling a workout (zero sets)."""

    def test_cancel_deletes_empty_session(self, workout_service,
                                           app_state_service, workout_repo):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()

        workout_service.cancel_session(session.id)
        assert workout_repo.get_session(session.id) is None

    def test_cancel_does_not_advance_cycle(self, workout_service,
                                            app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        session = workout_service.start_session()
        workout_service.cancel_session(session.id)

        assert app_state_service.get_current_day().key == "push"

    def test_cancel_with_sets_raises(self, workout_service,
                                      app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)

        with pytest.raises(ValueError, match="has logged sets"):
            workout_service.cancel_session(session.id)

    def test_cancel_nonexistent_session_raises(self, workout_service):
        with pytest.raises(ValueError, match="not found"):
            workout_service.cancel_session(9999)

    def test_cancel_finished_session_raises(self, workout_service,
                                             app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        with pytest.raises(ValueError, match="not in progress"):
            workout_service.cancel_session(session.id)


class TestGetInProgressSession:
    """get_in_progress_session — pass-through to repo."""

    def test_returns_none_when_no_session(self, workout_service):
        assert workout_service.get_in_progress_session() is None

    def test_returns_session_when_in_progress(self, workout_service,
                                               app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        started = workout_service.start_session()
        result = workout_service.get_in_progress_session()
        assert result is not None
        assert result.id == started.id

    def test_returns_none_after_finish(self, workout_service,
                                       app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id,
                                 reps=10, weight=60.0)
        workout_service.finish_session(session.id)
        assert workout_service.get_in_progress_session() is None


class TestLifecycleGuards:
    """Guards against invalid lifecycle transitions."""

    def test_log_set_on_finished_session_raises(self, workout_service, app_state_service):
        """Cannot add new sets to a finished session."""
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()
        exercises = workout_service.get_session_exercises(session.id)
        workout_service.log_set(session_exercise_id=exercises[0].id, reps=10, weight=60.0)
        workout_service.finish_session(session.id)

        with pytest.raises(ValueError, match="finished session"):
            workout_service.log_set(session_exercise_id=exercises[0].id, reps=8, weight=70.0)

    def test_finish_zero_set_session_raises(self, workout_service, app_state_service):
        """Cannot finish a session with no logged sets — must cancel instead."""
        app_state_service.set_active_routine("push_pull_legs")
        session = workout_service.start_session()

        with pytest.raises(ValueError, match="no logged sets"):
            workout_service.finish_session(session.id)


class TestSetFieldRangeValidation:
    """Range validation in _validate_set_fields (static method)."""

    def test_reps_zero_rejected(self):
        with pytest.raises(ValueError, match="reps must be between 1 and 999"):
            WorkoutService._validate_set_fields("reps_weight", reps=0, weight=100, duration_seconds=None, distance_km=None)

    def test_reps_negative_rejected(self):
        with pytest.raises(ValueError, match="reps must be between 1 and 999"):
            WorkoutService._validate_set_fields("reps_weight", reps=-1, weight=100, duration_seconds=None, distance_km=None)

    def test_reps_over_999_rejected(self):
        with pytest.raises(ValueError, match="reps must be between 1 and 999"):
            WorkoutService._validate_set_fields("reps_weight", reps=1000, weight=100, duration_seconds=None, distance_km=None)

    def test_reps_999_accepted(self):
        WorkoutService._validate_set_fields("reps_weight", reps=999, weight=100, duration_seconds=None, distance_km=None)

    def test_weight_negative_rejected(self):
        with pytest.raises(ValueError, match="weight must be between 0 and 9999"):
            WorkoutService._validate_set_fields("reps_weight", reps=10, weight=-1, duration_seconds=None, distance_km=None)

    def test_weight_over_9999_rejected(self):
        with pytest.raises(ValueError, match="weight must be between 0 and 9999"):
            WorkoutService._validate_set_fields("reps_weight", reps=10, weight=10000, duration_seconds=None, distance_km=None)

    def test_weight_zero_accepted(self):
        WorkoutService._validate_set_fields("reps_weight", reps=10, weight=0, duration_seconds=None, distance_km=None)

    def test_duration_zero_rejected(self):
        with pytest.raises(ValueError, match="duration_seconds must be between 1 and 86400"):
            WorkoutService._validate_set_fields("time", reps=None, weight=None, duration_seconds=0, distance_km=None)

    def test_duration_over_86400_rejected(self):
        with pytest.raises(ValueError, match="duration_seconds must be between 1 and 86400"):
            WorkoutService._validate_set_fields("time", reps=None, weight=None, duration_seconds=86401, distance_km=None)

    def test_duration_86400_accepted(self):
        WorkoutService._validate_set_fields("time", reps=None, weight=None, duration_seconds=86400, distance_km=None)

    def test_distance_zero_rejected(self):
        with pytest.raises(ValueError, match="distance_km must be greater than 0"):
            WorkoutService._validate_set_fields("cardio", reps=None, weight=None, duration_seconds=None, distance_km=0)

    def test_distance_negative_rejected(self):
        with pytest.raises(ValueError, match="distance_km must be greater than 0"):
            WorkoutService._validate_set_fields("cardio", reps=None, weight=None, duration_seconds=None, distance_km=-0.5)

    def test_distance_positive_accepted(self):
        WorkoutService._validate_set_fields("cardio", reps=None, weight=None, duration_seconds=None, distance_km=0.1)
