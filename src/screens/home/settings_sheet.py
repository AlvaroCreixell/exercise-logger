"""Settings bottom sheet — routine picker + unit toggle."""
from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText
from kivymd.uix.label import MDLabel

from src.screens.components.bottom_sheet import AppBottomSheet
from src.screens.components.toast import show_error_toast
from src.theme import PRIMARY, TEXT_PRIMARY, TEXT_SECONDARY, BACKGROUND


class SettingsSheet:
    """Not a Kivy widget — instantiate and call open()."""

    def __init__(self, app):
        self._app = app
        self._sheet = None
        self.on_dismiss = None  # callback when sheet closes

    def open(self):
        self._sheet = AppBottomSheet(title="Settings")
        self._sheet.set_height(450)

        # --- Routine section ---
        self._sheet.add_content(MDLabel(
            text="Routine",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Label",
            role="large",
            adaptive_height=True,
        ))
        routines = self._app.routine_registry.list_all()
        active_key = self._app.settings_service.get("active_routine_key")
        for routine in routines:
            is_active = (routine.key == active_key)
            row = self._make_routine_row(routine, is_active)
            self._sheet.add_content(row)

        # --- Unit section ---
        self._sheet.add_content(Widget(size_hint_y=None, height=dp(12)))
        self._sheet.add_content(MDLabel(
            text="Weight Unit",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Label",
            role="large",
            adaptive_height=True,
        ))
        current_unit = self._app.settings_service.get_weight_unit()
        toggle_text = f"Switch to {'kg' if current_unit == 'lb' else 'lb'}"
        toggle_btn = MDButton(style="outlined", size_hint_x=1)
        toggle_btn.add_widget(MDButtonText(text=toggle_text))
        toggle_btn.bind(on_release=lambda *a: self._confirm_unit_toggle())
        self._sheet.add_content(toggle_btn)

        if self.on_dismiss:
            self._sheet.bind(on_dismiss=lambda *a: self.on_dismiss())

        self._sheet.open()

    # ------------------------------------------------------------------
    # Routine picker
    # ------------------------------------------------------------------

    def _make_routine_row(self, routine, is_active):
        """Create a tappable row for a routine."""
        label_text = f"{'✓  ' if is_active else ''}{routine.name}"
        btn = MDButton(style="text", size_hint_x=1)
        name_label = MDButtonText(
            text=label_text,
            theme_text_color="Custom",
            text_color=PRIMARY if is_active else TEXT_SECONDARY,
        )
        btn.add_widget(name_label)
        btn.bind(on_release=lambda *a, r=routine: self._on_routine_tap(r))
        return btn

    def _on_routine_tap(self, routine):
        """Handle tap on a routine row."""
        active_key = self._app.settings_service.get("active_routine_key")
        if routine.key == active_key:
            # Already active, nothing to do
            return

        # Check if a workout is in progress
        if self._app.app_state_service.has_in_progress_session():
            self._show_warning("Can't switch routines during a workout")
            return

        self._confirm_routine_switch(routine)

    def _confirm_routine_switch(self, routine):
        """Show a confirmation sheet before switching routine."""
        confirm_sheet = AppBottomSheet(title="Switch Routine?")
        confirm_sheet.set_height(250)
        confirm_sheet.add_content(MDLabel(
            text=f"Switch to {routine.name}? This resets to Day A.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_cancel(*a):
            confirm_sheet.dismiss()

        def on_confirm(*a):
            confirm_sheet.dismiss()
            try:
                self._app.app_state_service.set_active_routine(routine.key)
            except ValueError as e:
                show_error_toast(str(e))
            self._sheet.dismiss()

        confirm_sheet.add_spacer()
        confirm_sheet.add_action("Cancel", on_cancel)
        confirm_sheet.add_action("Switch", on_confirm, style="filled")
        confirm_sheet.open()

    # ------------------------------------------------------------------
    # Unit toggle
    # ------------------------------------------------------------------

    def _confirm_unit_toggle(self):
        """Show confirmation before toggling weight unit."""
        current_unit = self._app.settings_service.get_weight_unit()
        new_unit = "kg" if current_unit == "lb" else "lb"

        confirm_sheet = AppBottomSheet(title="Change Weight Unit?")
        confirm_sheet.set_height(250)
        confirm_sheet.add_content(MDLabel(
            text=f"Switch to {new_unit}? This will convert all historical weights.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_cancel(*a):
            confirm_sheet.dismiss()

        def on_confirm(*a):
            confirm_sheet.dismiss()
            self._app.settings_service.toggle_weight_unit()
            self._sheet.dismiss()

        confirm_sheet.add_spacer()
        confirm_sheet.add_action("Cancel", on_cancel)
        confirm_sheet.add_action(f"Switch to {new_unit}", on_confirm, style="filled")
        confirm_sheet.open()

    # ------------------------------------------------------------------
    # Warning helper
    # ------------------------------------------------------------------

    def _show_warning(self, message):
        """Show a simple informational sheet."""
        warn_sheet = AppBottomSheet(title="Cannot Switch Routine")
        warn_sheet.set_height(200)
        warn_sheet.add_content(MDLabel(
            text=message,
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))
        warn_sheet.add_action("OK", lambda *a: warn_sheet.dismiss(), style="filled")
        warn_sheet.open()
