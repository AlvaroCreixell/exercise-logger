"""Exercise Card — accordion card for workout logging.

Displays exercise name, chips (logged/target), steppers, and log/repeat buttons.
Only one card is expanded at a time (managed by parent).

v2: Targets are flat fields on SessionExercise (no SetTarget list).
    Only three exercise types: reps_weight, time, cardio.
    Progressive exercises get an info tooltip.

Usage:
    card = ExerciseCard(
        session_exercise_id=42,
        exercise_name="Bench Press",
        exercise_type="reps_weight",
        scheme="uniform",
        planned_sets=4,
        target_reps_min=8,
        target_reps_max=12,
    )
    card.bind(on_set_logged=my_callback)
    card.bind(on_chip_tapped=my_chip_callback)
"""
import os
from kivy.lang import Builder
from kivy.properties import (
    BooleanProperty, NumericProperty, StringProperty, ListProperty,
    DictProperty,
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
    """An exercise card in the workout screen.

    v2: Flat target fields instead of SetTarget list.
        scheme indicates uniform/progressive (from scheme_snapshot).
        exercise_type from exercise_type_snapshot.
    """

    session_exercise_id = NumericProperty(0)
    exercise_name = StringProperty("")
    exercise_type = StringProperty("reps_weight")  # "reps_weight", "time", "cardio"
    scheme = StringProperty("uniform")             # "uniform" or "progressive"
    planned_sets = NumericProperty(0)              # 0 means ad-hoc (no plan)
    target_reps_min = NumericProperty(0)
    target_reps_max = NumericProperty(0)
    target_duration_seconds = NumericProperty(0)
    target_distance_km = NumericProperty(0)
    plan_notes = StringProperty("")
    is_expanded = BooleanProperty(False)
    progress_text = StringProperty("0/0")
    logged_sets = ListProperty([])  # List of dicts from logged_sets rows
    last_session_values = DictProperty({})  # {reps, weight, duration_seconds, distance_km}

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
        """Rebuild chip row from current logged_sets and flat target fields."""
        chip_row = self.ids.chip_row
        chip_row.clear_widgets()

        logged_count = len(self.logged_sets)

        # Logged sets as green chips
        for ls in self.logged_sets:
            chip = SetChip(
                is_logged=True,
                set_kind=self.exercise_type,
                reps=ls.get("reps") or 0,
                weight=ls.get("weight") or 0,
                duration_seconds=ls.get("duration_seconds") or 0,
                distance_km=ls.get("distance_km") or 0,
                set_id=ls.get("id", 0),
            )
            chip.bind(on_chip_tap=lambda inst, c: self.dispatch("on_chip_tapped", c))
            chip_row.add_widget(chip)

        # Remaining target chips (gray) — only for planned exercises
        if self.planned_sets > 0:
            remaining = self.planned_sets - logged_count
            for _ in range(max(0, remaining)):
                if self.scheme == "progressive":
                    # Progressive: neutral placeholder chip (shows "—")
                    chip = SetChip(
                        is_logged=False,
                        set_kind="placeholder",
                    )
                else:
                    # Uniform: gray chips show target values
                    chip = SetChip(
                        is_logged=False,
                        set_kind=self.exercise_type,
                        reps=self.target_reps_min or self.target_reps_max or 0,
                        weight=0,
                        duration_seconds=self.target_duration_seconds or 0,
                        distance_km=self.target_distance_km or 0,
                    )
                chip_row.add_widget(chip)

        # Update progress text
        if self.planned_sets > 0:
            self.progress_text = f"{logged_count}/{self.planned_sets}"
        else:
            self.progress_text = f"{logged_count}"

    def _setup_steppers(self):
        """Create steppers based on exercise type."""
        container = self.ids.stepper_container
        container.clear_widgets()
        self._reps_stepper = None
        self._weight_stepper = None
        self._duration_stepper = None
        self._distance_stepper = None

        et = self.exercise_type

        if et == "reps_weight":
            self._reps_stepper = ValueStepper(
                value=10, step=1, min_val=1,
                label="reps", is_integer=True,
            )
            container.add_widget(self._reps_stepper)

            # Get weight unit from settings service
            weight_label = "lbs"
            try:
                from kivymd.app import MDApp
                app = MDApp.get_running_app()
                if app and hasattr(app, "settings_service"):
                    weight_label = app.settings_service.get_weight_unit()
            except Exception:
                pass

            self._weight_stepper = ValueStepper(
                value=0, step=5, min_val=0,
                label=weight_label, is_integer=False,
            )
            container.add_widget(self._weight_stepper)

        elif et == "time":
            self._duration_stepper = ValueStepper(
                value=60, step=5, min_val=1,
                label="sec", is_integer=True,
            )
            container.add_widget(self._duration_stepper)

        elif et == "cardio":
            self._duration_stepper = ValueStepper(
                value=0, step=30, min_val=0,
                label="sec", is_integer=True,
            )
            container.add_widget(self._duration_stepper)

            self._distance_stepper = ValueStepper(
                value=0, step=0.1, min_val=0,
                label="km", is_integer=False,
            )
            container.add_widget(self._distance_stepper)

    def _prefill_steppers(self):
        """Pre-fill steppers using v2 four-tier cascade.

        Tier 1: Plan targets (uniform exercises with plan)
        Tier 2: Previous set in current exercise
        Tier 3: Last session history
        Tier 4: Blank (steppers already at minimums/defaults)
        """
        # Track which steppers have been filled
        reps_filled = False
        weight_filled = False
        duration_filled = False
        distance_filled = False

        # Tier 1: plan targets (uniform exercises with plan)
        if self.scheme == "uniform" and self.planned_sets > 0:
            if self._reps_stepper and self.target_reps_min:
                self._reps_stepper.value = self.target_reps_min
                reps_filled = True
            if self._duration_stepper and self.target_duration_seconds:
                self._duration_stepper.value = self.target_duration_seconds
                duration_filled = True
            if self._distance_stepper and self.target_distance_km:
                self._distance_stepper.value = self.target_distance_km
                distance_filled = True
            # Weight: NOT pre-filled from plan — fall through to tier 2/3

        # Tier 2: previous set in current exercise
        if self.logged_sets:
            last = self.logged_sets[-1]
            if self._reps_stepper and not reps_filled and last.get("reps"):
                self._reps_stepper.value = last["reps"]
                reps_filled = True
            if self._weight_stepper and not weight_filled and last.get("weight") is not None:
                self._weight_stepper.value = last["weight"]
                weight_filled = True
            if self._duration_stepper and not duration_filled and last.get("duration_seconds"):
                self._duration_stepper.value = last["duration_seconds"]
                duration_filled = True
            if self._distance_stepper and not distance_filled and last.get("distance_km"):
                self._distance_stepper.value = last["distance_km"]
                distance_filled = True

        # Tier 3: last session history
        elif self.last_session_values:
            lsv = self.last_session_values
            if self._reps_stepper and not reps_filled and lsv.get("reps"):
                self._reps_stepper.value = lsv["reps"]
            if self._weight_stepper and not weight_filled and lsv.get("weight") is not None:
                self._weight_stepper.value = lsv["weight"]
            if self._duration_stepper and not duration_filled and lsv.get("duration_seconds"):
                self._duration_stepper.value = lsv["duration_seconds"]
            if self._distance_stepper and not distance_filled and lsv.get("distance_km"):
                self._distance_stepper.value = lsv["distance_km"]

        # Tier 4: blank — steppers already at their minimums/defaults
        # Weight defaults to 0 if nothing set it
        if self._weight_stepper and not weight_filled:
            self._weight_stepper.value = 0

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
            vals["distance_km"] = self._distance_stepper.value
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
                "distance_km": last.get("distance_km"),
            }
        else:
            vals = self._get_stepper_values()
        self.dispatch("on_set_logged", self.session_exercise_id, vals)

    def show_progressive_tooltip(self):
        """Show coaching guidance for progressive loading exercises."""
        from src.screens.components.bottom_sheet import AppBottomSheet
        from kivymd.uix.label import MDLabel
        from src.theme import TEXT_SECONDARY as _TEXT_SECONDARY

        sheet = AppBottomSheet(title="Progressive Loading")
        sheet.set_height(280)
        sheet.add_content(MDLabel(
            text=(
                "Start light ~15 reps (leave 3 in the tank). "
                "Increase weight, ~8 reps (leave 1-2 in the tank). "
                "Go heavy, 4+ reps (aim for failure \u2014 keep going "
                "until you can't)."
            ),
            theme_text_color="Custom",
            text_color=_TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))
        sheet.add_action("Got it", lambda *a: sheet.dismiss(), style="filled")
        sheet.open()

    def on_set_logged(self, se_id, vals):
        """Default handler."""
        pass

    def on_chip_tapped(self, chip):
        """Default handler."""
        pass

    def on_toggle(self):
        """Default handler — dispatched when header is tapped."""
        pass
