"""Tests for workout repository — sessions, exercises, logged sets."""
import pytest
from src.models.enums import ExerciseType, SetScheme, SessionStatus, ExerciseSource
from src.models.workout import WorkoutSession, SessionExercise, LoggedSet


def _make_session(**overrides):
    defaults = dict(
        id=None,
        routine_key_snapshot="ppl",
        routine_name_snapshot="Push Pull Legs",
        day_key_snapshot="push",
        day_label_snapshot="A",
        day_name_snapshot="Push",
        status=SessionStatus.IN_PROGRESS,
        started_at="2026-03-26T10:00:00",
    )
    defaults.update(overrides)
    return WorkoutSession(**defaults)


def _make_planned_exercise(session_id, sort_order=0, **overrides):
    defaults = dict(
        id=None,
        session_id=session_id,
        sort_order=sort_order,
        exercise_key_snapshot="barbell_bench_press",
        exercise_name_snapshot="Barbell Bench Press",
        exercise_type_snapshot=ExerciseType.REPS_WEIGHT,
        source=ExerciseSource.PLANNED,
        scheme_snapshot=SetScheme.UNIFORM,
        planned_sets=3,
        target_reps_min=8,
        target_reps_max=12,
    )
    defaults.update(overrides)
    return SessionExercise(**defaults)


def _make_ad_hoc_exercise(session_id, sort_order=0, **overrides):
    defaults = dict(
        id=None,
        session_id=session_id,
        sort_order=sort_order,
        exercise_key_snapshot="dumbbell_curl",
        exercise_name_snapshot="Dumbbell Curl",
        exercise_type_snapshot=ExerciseType.REPS_WEIGHT,
        source=ExerciseSource.AD_HOC,
    )
    defaults.update(overrides)
    return SessionExercise(**defaults)


def _make_set(session_exercise_id, set_number=1, **overrides):
    defaults = dict(
        id=None,
        session_exercise_id=session_exercise_id,
        set_number=set_number,
        reps=10,
        weight=60.0,
        logged_at="2026-03-26T10:05:00",
    )
    defaults.update(overrides)
    return LoggedSet(**defaults)


class TestSessionCRUD:
    def test_create_and_get_session(self, workout_repo):
        session = _make_session()
        sid = workout_repo.create_session(session)
        assert sid is not None

        fetched = workout_repo.get_session(sid)
        assert fetched is not None
        assert fetched.id == sid
        assert fetched.routine_key_snapshot == "ppl"
        assert fetched.status == SessionStatus.IN_PROGRESS
        assert fetched.completed_fully is None

    def test_get_in_progress_session(self, workout_repo):
        workout_repo.create_session(_make_session())
        ip = workout_repo.get_in_progress_session()
        assert ip is not None
        assert ip.status == SessionStatus.IN_PROGRESS

    def test_no_in_progress_session(self, workout_repo):
        assert workout_repo.get_in_progress_session() is None

    def test_finish_session(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        workout_repo.finish_session(sid, completed_fully=True, finished_at="2026-03-26T11:00:00")
        workout_repo.commit()

        fetched = workout_repo.get_session(sid)
        assert fetched.status == SessionStatus.FINISHED
        assert fetched.completed_fully is True
        assert fetched.finished_at == "2026-03-26T11:00:00"

    def test_delete_session(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        workout_repo.delete_session(sid)
        assert workout_repo.get_session(sid) is None

    def test_list_finished_sessions(self, workout_repo):
        # Create and finish two sessions
        sid1 = workout_repo.create_session(_make_session(started_at="2026-03-25T10:00:00"))
        workout_repo.finish_session(sid1, True, "2026-03-25T11:00:00")
        sid2 = workout_repo.create_session(_make_session(started_at="2026-03-26T10:00:00"))
        workout_repo.finish_session(sid2, True, "2026-03-26T11:00:00")
        workout_repo.commit()

        sessions = workout_repo.list_finished_sessions()
        assert len(sessions) == 2
        assert sessions[0].started_at > sessions[1].started_at  # Most recent first

    def test_list_finished_excludes_in_progress(self, workout_repo):
        workout_repo.create_session(_make_session())
        sessions = workout_repo.list_finished_sessions()
        assert len(sessions) == 0


class TestSessionExerciseCRUD:
    def test_add_and_get_planned_exercise(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se = _make_planned_exercise(sid)
        se_id = workout_repo.add_session_exercise(se)

        fetched = workout_repo.get_session_exercise(se_id)
        assert fetched is not None
        assert fetched.source == ExerciseSource.PLANNED
        assert fetched.scheme_snapshot == SetScheme.UNIFORM
        assert fetched.planned_sets == 3
        assert fetched.target_reps_min == 8
        assert fetched.target_reps_max == 12

    def test_add_and_get_ad_hoc_exercise(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se = _make_ad_hoc_exercise(sid)
        se_id = workout_repo.add_session_exercise(se)

        fetched = workout_repo.get_session_exercise(se_id)
        assert fetched is not None
        assert fetched.source == ExerciseSource.AD_HOC
        assert fetched.planned_sets is None
        assert fetched.scheme_snapshot is None

    def test_get_session_exercises_ordered(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        workout_repo.add_session_exercise(_make_planned_exercise(sid, sort_order=0))
        workout_repo.add_session_exercise(_make_planned_exercise(
            sid, sort_order=1, exercise_key_snapshot="squat",
            exercise_name_snapshot="Squat",
        ))
        workout_repo.add_session_exercise(_make_ad_hoc_exercise(sid, sort_order=2))

        exercises = workout_repo.get_session_exercises(sid)
        assert len(exercises) == 3
        assert exercises[0].sort_order == 0
        assert exercises[1].sort_order == 1
        assert exercises[2].sort_order == 2

    def test_get_max_sort_order(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        assert workout_repo.get_max_sort_order(sid) is None

        workout_repo.add_session_exercise(_make_planned_exercise(sid, sort_order=0))
        assert workout_repo.get_max_sort_order(sid) == 0

        workout_repo.add_session_exercise(_make_planned_exercise(
            sid, sort_order=1, exercise_key_snapshot="squat",
            exercise_name_snapshot="Squat",
        ))
        assert workout_repo.get_max_sort_order(sid) == 1

    def test_cascade_delete(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        workout_repo.add_session_exercise(_make_planned_exercise(sid))
        workout_repo.delete_session(sid)
        exercises = workout_repo.get_session_exercises(sid)
        assert len(exercises) == 0


class TestLoggedSetCRUD:
    def _setup(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se_id = workout_repo.add_session_exercise(_make_planned_exercise(sid))
        return sid, se_id

    def test_add_and_get_set(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        ls = _make_set(se_id)
        ls_id = workout_repo.add_logged_set(ls)

        fetched = workout_repo.get_logged_set(ls_id)
        assert fetched is not None
        assert fetched.reps == 10
        assert fetched.weight == 60.0
        assert fetched.set_number == 1

    def test_get_logged_sets_ordered(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        workout_repo.add_logged_set(_make_set(se_id, set_number=1))
        workout_repo.add_logged_set(_make_set(se_id, set_number=2, reps=8, weight=65.0))
        workout_repo.add_logged_set(_make_set(se_id, set_number=3, reps=6, weight=70.0))

        sets = workout_repo.get_logged_sets(se_id)
        assert len(sets) == 3
        assert [s.set_number for s in sets] == [1, 2, 3]

    def test_get_logged_set_count(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        assert workout_repo.get_logged_set_count(se_id) == 0
        workout_repo.add_logged_set(_make_set(se_id))
        assert workout_repo.get_logged_set_count(se_id) == 1

    def test_get_session_total_set_count(self, workout_repo):
        sid, se_id1 = self._setup(workout_repo)
        se_id2 = workout_repo.add_session_exercise(_make_planned_exercise(
            sid, sort_order=1, exercise_key_snapshot="squat",
            exercise_name_snapshot="Squat",
        ))
        workout_repo.add_logged_set(_make_set(se_id1, set_number=1))
        workout_repo.add_logged_set(_make_set(se_id2, set_number=1))
        assert workout_repo.get_session_total_set_count(sid) == 2

    def test_update_logged_set(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        ls_id = workout_repo.add_logged_set(_make_set(se_id))

        fetched = workout_repo.get_logged_set(ls_id)
        fetched.reps = 12
        fetched.weight = 65.0
        workout_repo.update_logged_set(fetched)

        updated = workout_repo.get_logged_set(ls_id)
        assert updated.reps == 12
        assert updated.weight == 65.0

    def test_delete_logged_set_resequences(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        workout_repo.add_logged_set(_make_set(se_id, set_number=1))
        ls2_id = workout_repo.add_logged_set(_make_set(se_id, set_number=2, reps=8))
        workout_repo.add_logged_set(_make_set(se_id, set_number=3, reps=6))

        workout_repo.delete_logged_set(ls2_id)

        sets = workout_repo.get_logged_sets(se_id)
        assert len(sets) == 2
        assert sets[0].set_number == 1
        assert sets[1].set_number == 2  # Was 3, now resequenced to 2
        assert sets[1].reps == 6

    def test_get_next_set_number(self, workout_repo):
        _, se_id = self._setup(workout_repo)
        assert workout_repo.get_next_set_number(se_id) == 1
        workout_repo.add_logged_set(_make_set(se_id, set_number=1))
        assert workout_repo.get_next_set_number(se_id) == 2

    def test_cascade_delete_session_to_sets(self, workout_repo):
        sid, se_id = self._setup(workout_repo)
        workout_repo.add_logged_set(_make_set(se_id))
        workout_repo.delete_session(sid)
        assert workout_repo.get_logged_set_count(se_id) == 0

    def test_time_set(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se_id = workout_repo.add_session_exercise(_make_planned_exercise(
            sid, exercise_type_snapshot=ExerciseType.TIME,
            exercise_key_snapshot="plank", exercise_name_snapshot="Plank",
        ))
        ls_id = workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se_id, set_number=1,
            duration_seconds=60, logged_at="2026-03-26T10:05:00",
        ))
        fetched = workout_repo.get_logged_set(ls_id)
        assert fetched.duration_seconds == 60
        assert fetched.reps is None

    def test_cardio_set(self, workout_repo):
        sid = workout_repo.create_session(_make_session())
        se_id = workout_repo.add_session_exercise(_make_planned_exercise(
            sid, exercise_type_snapshot=ExerciseType.CARDIO,
            exercise_key_snapshot="running", exercise_name_snapshot="Running",
        ))
        ls_id = workout_repo.add_logged_set(LoggedSet(
            id=None, session_exercise_id=se_id, set_number=1,
            duration_seconds=1800, distance_km=5.0,
            logged_at="2026-03-26T10:05:00",
        ))
        fetched = workout_repo.get_logged_set(ls_id)
        assert fetched.duration_seconds == 1800
        assert fetched.distance_km == 5.0
