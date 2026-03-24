"""Set Chip — displays a logged set or upcoming target.

Usage:
    chip = SetChip(is_logged=True, set_kind="reps_weight", reps=10, weight=135.0)
    chip.bind(on_chip_tap=my_callback)
"""
import os
from kivy.lang import Builder
from kivy.properties import BooleanProperty, NumericProperty, StringProperty, ObjectProperty
from kivy.uix.behaviors import ButtonBehavior
from kivymd.uix.boxlayout import MDBoxLayout

Builder.load_file(os.path.join(os.path.dirname(__file__), "set_chip.kv"))


class SetChip(ButtonBehavior, MDBoxLayout):
    """A chip representing a logged set or a planned target."""

    is_logged = BooleanProperty(False)
    set_kind = StringProperty("reps_weight")
    reps = NumericProperty(0)
    weight = NumericProperty(0)
    duration_seconds = NumericProperty(0)
    distance = NumericProperty(0)
    chip_text = StringProperty("")
    set_id = NumericProperty(0)  # DB id, for edit/delete

    # Event dispatched when a logged chip is tapped
    __events__ = ("on_chip_tap",)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._update_text()

    def on_is_logged(self, *args):
        self._update_text()

    def on_set_kind(self, *args):
        self._update_text()

    def on_reps(self, *args):
        self._update_text()

    def on_weight(self, *args):
        self._update_text()

    def on_duration_seconds(self, *args):
        self._update_text()

    def on_distance(self, *args):
        self._update_text()

    def _update_text(self):
        sk = self.set_kind
        if sk == "reps_weight":
            w = int(self.weight) if self.weight == int(self.weight) else self.weight
            self.chip_text = f"{w}×{int(self.reps)}"
        elif sk == "reps_only":
            self.chip_text = f"{int(self.reps)}"
        elif sk == "duration":
            self.chip_text = f"{int(self.duration_seconds)}s"
        elif sk == "cardio":
            parts = []
            if self.duration_seconds:
                mins = int(self.duration_seconds) // 60
                parts.append(f"{mins}m")
            if self.distance:
                parts.append(f"{self.distance}km")
            self.chip_text = " / ".join(parts) if parts else "—"
        elif sk == "amrap":
            if self.is_logged and self.reps:
                w = int(self.weight) if self.weight and self.weight == int(self.weight) else self.weight
                prefix = f"{w}×" if w else ""
                self.chip_text = f"{prefix}AMRAP {int(self.reps)}"
            else:
                w = int(self.weight) if self.weight and self.weight == int(self.weight) else self.weight
                prefix = f"{w}×" if w else ""
                self.chip_text = f"{prefix}AMRAP"
        else:
            self.chip_text = "—"

    def on_release(self):
        if self.is_logged:
            self.dispatch("on_chip_tap", self)

    def on_chip_tap(self, chip):
        """Default handler — override or bind externally."""
        pass
