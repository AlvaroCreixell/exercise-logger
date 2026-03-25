import pytest
from src.utils.unit_conversion import lbs_to_kg, kg_to_lbs, km_to_miles, miles_to_km, convert_all_weights


class TestUnitConversion:
    def test_lbs_to_kg(self):
        assert lbs_to_kg(100) == 45.36
        assert lbs_to_kg(0) == 0.0

    def test_kg_to_lbs(self):
        assert kg_to_lbs(45.36) == 100.0  # Round-trip is approximate
        assert kg_to_lbs(0) == 0.0

    def test_km_to_miles(self):
        assert km_to_miles(1.0) == 0.62

    def test_miles_to_km(self):
        assert miles_to_km(1.0) == 1.61


class TestSettingsRepo:
    def test_get_nonexistent(self, settings_repo):
        assert settings_repo.get("missing_key") is None

    def test_set_and_get(self, settings_repo, db_conn):
        settings_repo.set("weight_unit", "lbs")
        db_conn.commit()
        assert settings_repo.get("weight_unit") == "lbs"

    def test_set_overwrites(self, settings_repo, db_conn):
        settings_repo.set("weight_unit", "lbs")
        settings_repo.set("weight_unit", "kg")
        db_conn.commit()
        assert settings_repo.get("weight_unit") == "kg"

    def test_delete(self, settings_repo, db_conn):
        settings_repo.set("weight_unit", "lbs")
        settings_repo.delete("weight_unit")
        db_conn.commit()
        assert settings_repo.get("weight_unit") is None

    def test_get_all(self, settings_repo, db_conn):
        settings_repo.set("weight_unit", "lbs")
        settings_repo.set("theme", "dark")
        db_conn.commit()
        all_settings = settings_repo.get_all()
        assert all_settings == {"theme": "dark", "weight_unit": "lbs"}


class TestConvertAllWeights:
    def test_lbs_to_kg_conversion(self, db_conn):
        """Convert all weights from lbs to kg in one transaction."""
        # Create prerequisite chain
        db_conn.execute(
            "INSERT INTO exercises (name, type, is_archived) VALUES (?, ?, ?)",
            ("Bench", "reps_weight", 0),
        )
        db_conn.execute(
            "INSERT INTO routines (name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?)",
            ("R", 0, "2026-01-01", "2026-01-01"),
        )
        db_conn.execute(
            "INSERT INTO routine_days (routine_id, label, name, sort_order) VALUES (?, ?, ?, ?)",
            (1, "A", "Push", 0),
        )
        db_conn.execute(
            """INSERT INTO routine_day_exercises
               (routine_day_id, exercise_id, sort_order, set_scheme, is_optional)
               VALUES (?, ?, ?, ?, ?)""",
            (1, 1, 0, "uniform", 0),
        )
        db_conn.execute(
            """INSERT INTO exercise_set_targets
               (routine_day_exercise_id, set_number, set_kind, target_weight)
               VALUES (?, ?, ?, ?)""",
            (1, 1, "reps_weight", 135.0),
        )
        db_conn.commit()

        total = convert_all_weights(db_conn, "lbs", "kg")
        assert total == 1

        row = db_conn.execute("SELECT target_weight FROM exercise_set_targets WHERE id = 1").fetchone()
        assert row["target_weight"] == 61.23  # 135 * 0.45359237 ≈ 61.23 (SQLite ROUND)

    def test_same_unit_no_op(self, db_conn):
        total = convert_all_weights(db_conn, "lbs", "lbs")
        assert total == 0

    def test_invalid_units_raises(self, db_conn):
        with pytest.raises(ValueError, match="Invalid conversion"):
            convert_all_weights(db_conn, "lbs", "stone")
