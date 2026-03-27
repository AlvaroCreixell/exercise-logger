"""Tests for settings repository."""
import pytest


class TestSettingsRepo:
    def test_get_missing_returns_none(self, settings_repo):
        assert settings_repo.get("nonexistent") is None

    def test_set_and_get(self, settings_repo):
        settings_repo.set("weight_unit", "lb")
        assert settings_repo.get("weight_unit") == "lb"

    def test_set_overwrites(self, settings_repo):
        settings_repo.set("weight_unit", "lb")
        settings_repo.set("weight_unit", "kg")
        assert settings_repo.get("weight_unit") == "kg"

    def test_delete(self, settings_repo):
        settings_repo.set("weight_unit", "lb")
        settings_repo.delete("weight_unit")
        assert settings_repo.get("weight_unit") is None

    def test_delete_nonexistent_no_error(self, settings_repo):
        settings_repo.delete("nonexistent")  # Should not raise

    def test_get_all_empty(self, settings_repo):
        assert settings_repo.get_all() == {}

    def test_get_all(self, settings_repo):
        settings_repo.set("weight_unit", "lb")
        settings_repo.set("active_routine_key", "ppl")
        result = settings_repo.get_all()
        assert result == {"active_routine_key": "ppl", "weight_unit": "lb"}
