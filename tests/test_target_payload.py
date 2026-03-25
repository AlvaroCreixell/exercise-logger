"""Tests for build_targets_payload — pure function, no Kivy deps."""
import pytest
from src.models.exercise import ExerciseType
from src.models.routine import SetKind

from src.services.validation import build_targets_payload


class TestBuildTargetsPayload:

    def test_uniform_reps_weight(self):
        state = {
            "scheme": "uniform", "num_sets": 3,
            "is_amrap": False, "use_rep_range": False,
            "uniform_reps": 10, "uniform_reps_max": 10,
            "uniform_weight": 135.0, "uniform_duration": 60, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert len(result) == 3
        for entry in result:
            assert entry["set_kind"] == SetKind.REPS_WEIGHT
            assert entry["reps_min"] == 10
            assert entry["reps_max"] == 10
            assert entry["weight"] == 135.0

    def test_uniform_amrap_reps_weight(self):
        state = {
            "scheme": "uniform", "num_sets": 1,
            "is_amrap": True, "use_rep_range": False,
            "uniform_reps": 10, "uniform_reps_max": 10,
            "uniform_weight": 70.0, "uniform_duration": 60, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert len(result) == 1
        assert result[0]["set_kind"] == SetKind.AMRAP
        assert result[0]["weight"] == 70.0
        assert "reps_min" not in result[0]
        assert "reps_max" not in result[0]

    def test_uniform_rep_range(self):
        state = {
            "scheme": "uniform", "num_sets": 3,
            "is_amrap": False, "use_rep_range": True,
            "uniform_reps": 8, "uniform_reps_max": 12,
            "uniform_weight": 100.0, "uniform_duration": 60, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert result[0]["reps_min"] == 8
        assert result[0]["reps_max"] == 12

    def test_uniform_reps_only_amrap(self):
        state = {
            "scheme": "uniform", "num_sets": 1,
            "is_amrap": True, "use_rep_range": False,
            "uniform_reps": 10, "uniform_reps_max": 10,
            "uniform_weight": 0.0, "uniform_duration": 60, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.REPS_ONLY)
        assert result[0]["set_kind"] == SetKind.AMRAP
        assert "reps_min" not in result[0]

    def test_uniform_time(self):
        state = {
            "scheme": "uniform", "num_sets": 2,
            "is_amrap": False, "use_rep_range": False,
            "uniform_reps": 8, "uniform_reps_max": 8,
            "uniform_weight": 0.0, "uniform_duration": 90, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.TIME)
        assert result[0]["set_kind"] == SetKind.DURATION
        assert result[0]["duration_seconds"] == 90

    def test_uniform_cardio(self):
        state = {
            "scheme": "uniform", "num_sets": 1,
            "is_amrap": False, "use_rep_range": False,
            "uniform_reps": 8, "uniform_reps_max": 8,
            "uniform_weight": 0.0, "uniform_duration": 1800, "uniform_distance": 5.0,
        }
        result = build_targets_payload(state, ExerciseType.CARDIO)
        assert result[0]["set_kind"] == SetKind.CARDIO
        assert result[0]["duration_seconds"] == 1800
        assert result[0]["distance"] == 5.0

    def test_progressive_mixed_amrap(self):
        """Spec-valid: 3x8 reps_weight + 1 AMRAP at end."""
        state = {
            "scheme": "progressive",
            "progressive_rows": [
                {"reps": 8, "reps_max": 8, "weight": 100.0, "duration": 0, "distance": 0.0, "is_amrap": False},
                {"reps": 8, "reps_max": 8, "weight": 100.0, "duration": 0, "distance": 0.0, "is_amrap": False},
                {"reps": 8, "reps_max": 8, "weight": 100.0, "duration": 0, "distance": 0.0, "is_amrap": False},
                {"reps": 0, "reps_max": 0, "weight": 70.0, "duration": 0, "distance": 0.0, "is_amrap": True},
            ],
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert len(result) == 4
        assert result[0]["set_kind"] == SetKind.REPS_WEIGHT
        assert result[0]["reps_min"] == 8
        assert result[3]["set_kind"] == SetKind.AMRAP
        assert result[3]["weight"] == 70.0
        assert "reps_min" not in result[3]

    def test_progressive_per_row_rep_range(self):
        state = {
            "scheme": "progressive",
            "progressive_rows": [
                {"reps": 10, "reps_max": 12, "weight": 50.0, "duration": 0, "distance": 0.0, "is_amrap": False},
                {"reps": 6, "reps_max": 8, "weight": 70.0, "duration": 0, "distance": 0.0, "is_amrap": False},
            ],
        }
        result = build_targets_payload(state, ExerciseType.REPS_WEIGHT)
        assert result[0]["reps_min"] == 10
        assert result[0]["reps_max"] == 12
        assert result[1]["reps_min"] == 6
        assert result[1]["reps_max"] == 8

    def test_cardio_duration_only(self):
        state = {
            "scheme": "uniform", "num_sets": 1,
            "is_amrap": False, "use_rep_range": False,
            "uniform_reps": 0, "uniform_reps_max": 0,
            "uniform_weight": 0.0, "uniform_duration": 1800, "uniform_distance": 0.0,
        }
        result = build_targets_payload(state, ExerciseType.CARDIO)
        assert result[0]["duration_seconds"] == 1800
        assert result[0]["distance"] is None  # 0.0 → None
