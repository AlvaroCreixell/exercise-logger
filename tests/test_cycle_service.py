import pytest
from src.models.exercise import ExerciseType
from src.models.routine import Routine, RoutineDay


class TestCycleService:
    """Tests for cycle advance, wrap-around, delete-current-day, cross-routine validation."""

    def _make_routine_with_days(self, routine_repo, db_conn, name, labels):
        """Helper: create a routine with days directly via repo."""
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        routine_id = routine_repo.create_routine(
            Routine(id=None, name=name, is_active=False, created_at=now, updated_at=now)
        )
        days = []
        for i, (label, day_name) in enumerate(labels):
            day_id = routine_repo.add_day(
                RoutineDay(id=None, routine_id=routine_id, label=label, name=day_name, sort_order=i)
            )
            days.append(routine_repo.get_day(day_id))
        db_conn.commit()
        return routine_repo.get_routine(routine_id), days

    def test_initialize_sets_first_day(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[0].id

    def test_initialize_empty_routine(self, cycle_service, routine_repo, db_conn):
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc).isoformat()
        routine_id = routine_repo.create_routine(
            Routine(id=None, name="Empty", is_active=False, created_at=now, updated_at=now)
        )
        db_conn.commit()
        cycle_service.initialize(routine_id)
        assert cycle_service.get_current_day(routine_id) is None

    def test_advance_to_next(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        next_day = cycle_service.advance(r.id)
        assert next_day.id == days[1].id

    def test_advance_wraps_around(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull")])
        cycle_service.initialize(r.id)
        cycle_service.advance(r.id)  # A -> B
        next_day = cycle_service.advance(r.id)  # B -> A (wrap)
        assert next_day.id == days[0].id

    def test_advance_single_day_stays(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Only")])
        cycle_service.initialize(r.id)
        next_day = cycle_service.advance(r.id)
        assert next_day.id == days[0].id

    def test_set_day_manual_override(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        cycle_service.set_day(r.id, days[2].id)
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[2].id

    def test_set_day_wrong_routine_raises(self, cycle_service, routine_repo, db_conn):
        r1, days1 = self._make_routine_with_days(routine_repo, db_conn, "R1", [("A", "Push")])
        r2, days2 = self._make_routine_with_days(routine_repo, db_conn, "R2", [("X", "Pull")])
        with pytest.raises(ValueError, match="does not belong"):
            cycle_service.set_day(r1.id, days2[0].id)

    def test_handle_day_deleted_current_picks_next(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        cycle_service.set_day(r.id, days[1].id)  # Current = B
        cycle_service.handle_day_deleted(r.id, days[1].id)  # B about to be deleted
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[2].id  # Picked C (next by sort_order)

    def test_handle_day_deleted_last_wraps_to_first(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        cycle_service.set_day(r.id, days[2].id)  # Current = C
        cycle_service.handle_day_deleted(r.id, days[2].id)  # C about to be deleted
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[0].id  # Wrapped to A

    def test_handle_day_deleted_all_gone_clears_state(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Only")])
        cycle_service.initialize(r.id)
        cycle_service.handle_day_deleted(r.id, days[0].id)
        assert cycle_service.get_current_day(r.id) is None

    def test_handle_day_deleted_not_current_no_change(self, cycle_service, routine_repo, db_conn):
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)  # Current = A
        cycle_service.handle_day_deleted(r.id, days[2].id)  # Delete C (not current)
        current = cycle_service.get_current_day(r.id)
        assert current.id == days[0].id  # Still A

    def test_advance_after_manual_set(self, cycle_service, routine_repo, db_conn):
        """After manual override to C, advance goes to next after C."""
        r, days = self._make_routine_with_days(routine_repo, db_conn, "Test", [("A", "Push"), ("B", "Pull"), ("C", "Legs")])
        cycle_service.initialize(r.id)
        cycle_service.set_day(r.id, days[1].id)  # Manual set to B
        next_day = cycle_service.advance(r.id)  # Should go to C
        assert next_day.id == days[2].id
