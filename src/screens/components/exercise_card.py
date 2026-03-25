"""Exercise Card — accordion card for workout logging.

Displays exercise name, chips (logged/target), steppers, and log/repeat buttons.
Only one card is expanded at a time (managed by parent).

Usage:
    card = ExerciseCard(
        session_exercise_id=42,
        exercise_name="Bench Press",
        exercise_type="reps_weight",
        set_scheme="uniform",
    )
    card.bind(on_set_logged=my_callback)
    card.bind(on_chip_tapped=my_chip_callback)
"""
import os
from kivy.lang import Builder
from kivy.properties import (
    BooleanProperty, NumericProperty, StringProperty, ListProperty,
)
from kivy.uix.behaviors import ButtonBehavior
from kivymd.uix.boxlayout import MDBoxLayout

from src.screens.components.set_chip import SetChip
from src.screens.components.stepper import ValueStepper
from src.theme import PRIMARY, TEXT_SECONDARY

Builder.load_file(os.path.join(os.path.dirname(__file__), "exercise_card.kv"))


class CardHeader(ButtonBehavior, MDBoxLayout):
    """Tappable header row for the exercise card. Provides on_release."""
    pass


class ExerciseCard(MDBoxLayout):
    """An exercise card in the workout screen."""

    session_exercise_id = NumericProperty(0)
    exercise_id = NumericProperty(0)
    exercise_name = StringProperty("")
    exercise_type = StringProperty("reps_weight")  # ExerciseType.value
    set_scheme = StringProperty("uniform")
    is_expanded = BooleanProperty(False)
    progress_text = StringProperty("0/0")

    # Current stepper values
    current_reps = NumericProperty(10)
    current_weight = NumericProperty(0)
    current_duration = NumericProperty(60)
    current_distance = NumericProperty(0)

    # Target info (for pre-filling steppers)
    targets = ListProperty([])  # List of SetTarget-like dicts
    logged_sets = ListProperty([])  # List of LoggedSet-like dicts

    __events__ = ("on_set_logged", "on_chip_tapped", "on_toggle")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._reps_stepper = None
        self._weight_stepper = None
        self._duration_stepper = None
        self._distance_stepper = None

    def on_is_expanded(self, *args):
        if self.is_expanded:
            self._setup_steppers()
            self._prefill_steppers()

    def refresh_chips(self):
        """Rebuild chip row from current logged_sets and targets."""
        chip_row = self.ids.chip_row
        chip_row.clear_widgets()

        # Logged sets as green chips
        for ls in self.logged_sets:
            chip = SetChip(
                is_logged=True,
                set_kind=ls.get("set_kind", "reps_weight"),
                reps=ls.get("reps") or 0,
                weight=ls.get("weight") or 0,
                duration_seconds=ls.get("duration_seconds") or 0,
                distance=ls.get("distance") or 0,
                set_id=ls.get("id", 0),
            )
            chip.bind(on_chip_tap=lambda inst, c: self.dispatch("on_chip_tapped", c))
            chip_row.add_widget(chip)

        # Remaining targets as gray chips
        logged_count = len(self.logged_sets)
        for i, target in enumerate(self.targets):
            if i < logged_count:
                continue  # Already covered by a logged set
            chip = SetChip(
                is_logged=False,
                set_kind=target.get("set_kind", "reps_weight"),
                reps=target.get("target_reps_min") or target.get("target_reps_max") or 0,
                weight=target.get("target_weight") or 0,
                duration_seconds=target.get("target_duration_seconds") or 0,
                distance=target.get("target_distance") or 0,
            )
            chip_row.add_widget(chip)

        # Update progress
        total = max(len(self.targets), logged_count)
        self.progress_text = f"{logged_count}/{total}" if total else ""

    def _setup_steppers(self):
        """Create steppers based on exercise type."""
        container = self.ids.stepper_container
        container.clear_widgets()

        et = self.exercise_type
        if et in ("reps_weight", "reps_only"):
            self._reps_stepper = ValueStepper(
                value=self.current_reps, step=1, min_val=1,
                label="reps", is_integer=True,
            )
            container.add_widget(self._reps_stepper)

        if et == "reps_weight":
            self._weight_stepper = ValueStepper(
                value=self.current_weight, step=5, min_val=0,
                label="lbs", is_integer=False,
            )
            container.add_widget(self._weight_stepper)

        if et in ("time", "duration"):
            self._duration_stepper = ValueStepper(
                value=self.current_duration, step=5, min_val=1,
                label="sec", is_integer=True,
            )
            container.add_widget(self._duration_stepper)

        if et == "cardio":
            self._duration_stepper = ValueStepper(
                value=self.current_duration, step=30, min_val=0,
                label="sec", is_integer=True,
            )
            container.add_widget(self._duration_stepper)
            self._distance_stepper = ValueStepper(
                value=self.current_distance, step=0.1, min_val=0,
                label="km", is_integer=False,
            )
            container.add_widget(self._distance_stepper)

    def _prefill_steppers(self):
        """Pre-fill steppers from next target or last logged set."""
        logged_count = len(self.logged_sets)

        # Try next target first
        if logged_count < len(self.targets):
            target = self.targets[logged_count]
            if self._reps_stepper and target.get("target_reps_min"):
                self._reps_stepper.value = target["target_reps_min"]
            if self._weight_stepper and target.get("target_weight") is not None:
                self._weight_stepper.value = target["target_weight"]
            if self._duration_stepper and target.get("target_duration_seconds"):
                self._duration_stepper.value = target["target_duration_seconds"]
            if self._distance_stepper and target.get("target_distance"):
                self._distance_stepper.value = target["target_distance"]
            return

        # Fall back to last logged set
        if self.logged_sets:
            last = self.logged_sets[-1]
            if self._reps_stepper and last.get("reps"):
                self._reps_stepper.value = last["reps"]
            if self._weight_stepper and last.get("weight") is not None:
                self._weight_stepper.value = last["weight"]
            if self._duration_stepper and last.get("duration_seconds"):
                self._duration_stepper.value = last["duration_seconds"]
            if self._distance_stepper and last.get("distance"):
                self._distance_stepper.value = last["distance"]

    def _get_stepper_values(self) -> dict:
        """Read current values from steppers."""
        vals = {}
        if self._reps_stepper:
            vals["reps"] = int(self._reps_stepper.value)
        if self._weight_stepper:
            vals["weight"] = self._weight_stepper.value
        if self._duration_stepper:
            vals["duration_seconds"] = int(self._duration_stepper.value)
        if self._distance_stepper:
            vals["distance"] = self._distance_stepper.value
        return vals

    def log_current(self):
        """Log a set with current stepper values."""
        vals = self._get_stepper_values()
        self.dispatch("on_set_logged", self.session_exercise_id, vals)

    def repeat_last(self):
        """Log a set copying the last set's values (or stepper values if no previous)."""
        if self.logged_sets:
            last = self.logged_sets[-1]
            vals = {
                "reps": last.get("reps"),
                "weight": last.get("weight"),
                "duration_seconds": last.get("duration_seconds"),
                "distance": last.get("distance"),
            }
        else:
            vals = self._get_stepper_values()
        self.dispatch("on_set_logged", self.session_exercise_id, vals)

    def on_set_logged(self, se_id, vals):
        """Default handler."""
        pass

    def on_chip_tapped(self, chip):
        """Default handler."""
        pass

    def on_toggle(self):
        """Default handler — dispatched when header is tapped."""
        pass
