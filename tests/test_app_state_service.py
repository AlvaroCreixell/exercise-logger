# tests/test_app_state_service.py
"""Tests for AppStateService — startup reconciliation and cycle management."""
import pytest
from datetime import datetime, timezone

from src.models.enums import SessionStatus
from src.models.workout import WorkoutSession
from tests.conftest import make_routine, make_second_routine


def _create_in_progress_session(workout_repo):
    """Helper: insert a minimal in-progress session directly via the repo."""
    session = WorkoutSession(
        id=None,
        routine_key_snapshot="push_pull_legs",
        routine_name_snapshot="Push Pull Legs",
        day_key_snapshot="push",
        day_label_snapshot="A",
        day_name_snapshot="Push",
        status=SessionStatus.IN_PROGRESS,
        started_at=datetime.now(timezone.utc).isoformat(),
    )
    session.id = workout_repo.create_session(session)
    workout_repo.commit()
    return session


class TestReconcileOnStartup:
    """Startup reconciliation validates settings against registries."""

    def test_no_settings_is_clean(self, app_state_service):
        """No active routine set — nothing to reconcile."""
        result = app_state_service.reconcile_on_startup()
        assert result["routine_cleared"] is False
        assert result["day_reset"] is False
        assert result["has_in_progress_session"] is False

    def test_valid_routine_and_day_unchanged(self, app_state_service,
                                              settings_repo):
        """Valid routine + valid day — no changes."""
        settings_repo.set("active_routine_key", "push_pull_legs")
        settings_repo.set("current_day_key", "pull")
        settings_repo.commit()

        result = app_state_service.reconcile_on_startup()
        assert result["routine_cleared"] is False
        assert result["day_reset"] is False
        assert settings_repo.get("active_routine_key") == "push_pull_legs"
        assert settings_repo.get("current_day_key") == "pull"

    def test_stale_routine_clears_both(self, app_state_service,
                                        settings_repo):
        """Routine key references a removed template — clear both."""
        settings_repo.set("active_routine_key", "nonexistent_routine")
        settings_repo.set("current_day_key", "some_day")
        settings_repo.commit()

        result = app_state_service.reconcile_on_startup()
        assert result["routine_cleared"] is True
        assert settings_repo.get("active_routine_key") is None
        assert settings_repo.get("current_day_key") is None

    def test_stale_day_resets_to_first(self, app_state_service,
                                        settings_repo):
        """Day key missing from active routine — reset to first day."""
        settings_repo.set("active_routine_key", "push_pull_legs")
        settings_repo.set("current_day_key", "nonexistent_day")
        settings_repo.commit()

        result = app_state_service.reconcile_on_startup()
        assert result["routine_cleared"] is False
        assert result["day_reset"] is True
        assert settings_repo.get("current_day_key") == "push"  # first day

    def test_detects_in_progress_session(self, app_state_service,
                                          settings_repo, workout_repo):
        """Detects in-progress session for resume prompt."""
        settings_repo.set("active_routine_key", "push_pull_legs")
        settings_repo.set("current_day_key", "push")
        settings_repo.commit()

        _create_in_progress_session(workout_repo)

        result = app_state_service.reconcile_on_startup()
        assert result["has_in_progress_session"] is True


class TestActiveRoutine:
    """Setting and getting the active routine."""

    def test_no_active_routine_returns_none(self, app_state_service):
        assert app_state_service.get_active_routine() is None

    def test_set_active_routine(self, app_state_service, settings_repo):
        app_state_service.set_active_routine("push_pull_legs")
        routine = app_state_service.get_active_routine()
        assert routine is not None
        assert routine.key == "push_pull_legs"
        # Current day set to first day
        day = app_state_service.get_current_day()
        assert day is not None
        assert day.key == "push"

    def test_switch_routine_resets_day(self, app_state_service, settings_repo):
        """Switching routines resets current day to new routine's first day."""
        app_state_service.set_active_routine("push_pull_legs")
        # Advance to pull day
        app_state_service.advance_day()  # push -> pull
        assert app_state_service.get_current_day().key == "pull"

        # Switch to upper_lower
        app_state_service.set_active_routine("upper_lower")
        day = app_state_service.get_current_day()
        assert day.key == "upper"

    def test_set_invalid_routine_raises(self, app_state_service):
        with pytest.raises(ValueError, match="not found"):
            app_state_service.set_active_routine("nonexistent")

    def test_switch_blocked_during_workout(self, app_state_service,
                                            settings_repo, workout_repo):
        """Cannot switch routines while a workout is in progress."""
        app_state_service.set_active_routine("push_pull_legs")

        _create_in_progress_session(workout_repo)

        with pytest.raises(ValueError, match="in progress"):
            app_state_service.set_active_routine("upper_lower")


class TestCycleAdvancement:
    """Day cycle management: advance, wrap."""

    def test_advance_to_next_day(self, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        assert app_state_service.get_current_day().key == "push"

        new_key = app_state_service.advance_day()
        assert new_key == "pull"
        assert app_state_service.get_current_day().key == "pull"

    def test_advance_wraps_at_end(self, app_state_service):
        app_state_service.set_active_routine("push_pull_legs")
        app_state_service.advance_day()  # push -> pull
        app_state_service.advance_day()  # pull -> legs

        new_key = app_state_service.advance_day()  # legs -> push (wrap)
        assert new_key == "push"

    def test_advance_without_routine_raises(self, app_state_service):
        with pytest.raises(ValueError, match="No active routine"):
            app_state_service.advance_day()

    def test_get_current_day_without_routine_returns_none(
            self, app_state_service):
        assert app_state_service.get_current_day() is None
