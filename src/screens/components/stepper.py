"""Value Stepper — +/- control with large touch targets for gym use.

Usage:
    stepper = ValueStepper(value=135.0, step=5.0, min_val=0, label="lbs")
    stepper.bind(on_value_change=my_callback)
"""
import os
from kivy.lang import Builder
from kivy.properties import BooleanProperty, NumericProperty, StringProperty
from kivymd.uix.boxlayout import MDBoxLayout

Builder.load_file(os.path.join(os.path.dirname(__file__), "stepper.kv"))


class ValueStepper(MDBoxLayout):
    """A +/- stepper with a large tappable value display."""

    value = NumericProperty(0)
    step = NumericProperty(1)
    min_val = NumericProperty(0)
    max_val = NumericProperty(9999)
    label = StringProperty("")
    display_text = StringProperty("0")
    is_integer = BooleanProperty(True)

    __events__ = ("on_value_change",)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._update_display()

    def on_value(self, *args):
        self._update_display()

    def _update_display(self):
        if self.is_integer or self.value == int(self.value):
            self.display_text = str(int(self.value))
        else:
            self.display_text = f"{self.value:.1f}"

    def increment(self):
        new_val = min(self.value + self.step, self.max_val)
        if new_val != self.value:
            self.value = new_val
            self.dispatch("on_value_change", self.value)

    def decrement(self):
        new_val = max(self.value - self.step, self.min_val)
        if new_val != self.value:
            self.value = new_val
            self.dispatch("on_value_change", self.value)

    def open_input(self):
        """Open a bottom sheet with text input for direct value entry."""
        from src.screens.components.bottom_sheet import AppBottomSheet
        from kivymd.uix.textfield import MDTextField, MDTextFieldHintText

        sheet = AppBottomSheet(title=f"Enter {self.label or 'value'}")
        sheet.set_height(220)

        text_field = MDTextField(
            text=self.display_text,
            input_filter="float",
        )
        text_field.add_widget(MDTextFieldHintText(text=self.label or "Value"))
        sheet.add_content(text_field)

        def on_confirm(*args):
            try:
                val = float(text_field.text)
                val = max(self.min_val, min(val, self.max_val))
                self.value = val
                self.dispatch("on_value_change", self.value)
            except ValueError:
                pass
            sheet.dismiss()

        def on_cancel(*args):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("OK", on_confirm, style="filled")
        sheet.open()

    def on_value_change(self, value):
        """Default handler."""
        pass
