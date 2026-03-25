"""Units screen — weight unit toggle with conversion confirmation."""
from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText
from kivymd.uix.label import MDLabel

from src.screens.manage.manage_detail_screen import ManageDetailScreen
from src.screens.components.bottom_sheet import AppBottomSheet
from src.theme import TEXT_PRIMARY, TEXT_SECONDARY


class UnitsScreen(ManageDetailScreen):
    def __init__(self, **kwargs):
        super().__init__(title="Units", **kwargs)

    def build_content(self, container):
        container.clear_widgets()
        layout = MDBoxLayout(
            orientation="vertical",
            padding=[dp(16), dp(24), dp(16), dp(16)],
            spacing=dp(24),
        )

        current = self.app.settings_service.get_weight_unit()
        other = "kg" if current == "lbs" else "lbs"

        layout.add_widget(Widget(size_hint_y=0.2))
        layout.add_widget(MDLabel(
            text=f"Current unit: {current.upper()}",
            halign="center",
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Headline",
            role="small",
            adaptive_height=True,
        ))
        layout.add_widget(MDLabel(
            text="Changing units converts all stored weights.",
            halign="center",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        btn = MDButton(
            style="outlined",
            size_hint_x=None,
            width=dp(250),
            pos_hint={"center_x": 0.5},
        )
        btn.add_widget(MDButtonText(text=f"Switch to {other.upper()}"))
        btn.bind(on_release=lambda *a: self._confirm(current, other))
        layout.add_widget(btn)
        layout.add_widget(Widget())
        container.add_widget(layout)

    def _confirm(self, from_unit, to_unit):
        sheet = AppBottomSheet(title=f"Convert to {to_unit.upper()}?")
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text=(
                f"All weights will be converted from {from_unit} to {to_unit}."
                " This cannot be undone."
            ),
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_confirm(*a):
            self.app.settings_service.set_weight_unit(to_unit)
            sheet.dismiss()
            self.build_content(self._content_area)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Convert", on_confirm, destructive=True)  # text style, not filled
        sheet.open()
