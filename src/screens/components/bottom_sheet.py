"""Reusable bottom sheet component per spec L860-879.

The spec says: use bottom sheets exclusively, no centered dialogs.
- 12dp rounded top corners
- Slight backdrop dim (40% black overlay)
- Drag handle: small centered pill
- Full-width action buttons pinned to bottom

Usage:
    sheet = AppBottomSheet(title="Edit Set")
    sheet.add_content(my_widget)
    sheet.add_action("Cancel", on_cancel)
    sheet.add_action("Save", on_save, style="filled")
    sheet.open()
"""
from kivy.lang import Builder
from kivy.metrics import dp
from kivy.properties import StringProperty
from kivy.uix.modalview import ModalView
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText
from kivymd.uix.label import MDLabel

from src.theme import SURFACE, TEXT_PRIMARY, TEXT_SECONDARY, BACKGROUND, PRIMARY, DESTRUCTIVE


class AppBottomSheet(ModalView):
    """A bottom-aligned sheet that slides up from the bottom.

    Uses ModalView for the backdrop dim + dismiss-on-tap-outside behavior,
    positioned at the bottom of the screen.
    """

    title = StringProperty("")

    def __init__(self, title="", **kwargs):
        super().__init__(**kwargs)
        self.title = title
        self.size_hint = (1, None)
        self.height = dp(320)
        self.pos_hint = {"bottom": 1}
        self.background_color = (0, 0, 0, 0)  # Transparent — we draw our own bg
        self.overlay_color = (0, 0, 0, 0.4)  # 40% black backdrop per spec

        # Main container
        self._container = MDBoxLayout(
            orientation="vertical",
            md_bg_color=SURFACE,
            radius=[dp(12), dp(12), 0, 0],
            padding=[dp(16), dp(8), dp(16), dp(16)],
            spacing=dp(12),
        )

        # Drag handle
        handle_row = MDBoxLayout(size_hint_y=None, height=dp(20))
        handle_row.add_widget(Widget())
        handle = Widget(size_hint=(None, None), size=(dp(32), dp(4)))
        handle.canvas.before.add(
            self._make_handle_bg(handle)
        )
        handle_row.add_widget(handle)
        handle_row.add_widget(Widget())
        self._container.add_widget(handle_row)

        # Title
        if title:
            self._container.add_widget(MDLabel(
                text=title,
                theme_text_color="Custom",
                text_color=TEXT_PRIMARY,
                font_style="Title",
                role="large",
                bold=True,
                adaptive_height=True,
            ))

        # Content area (caller adds widgets here)
        self._content_area = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(8),
        )
        self._container.add_widget(self._content_area)

        # Spacer
        self._container.add_widget(Widget(size_hint_y=1))

        # Action button row
        self._action_row = MDBoxLayout(
            size_hint_y=None,
            height=dp(48),
            spacing=dp(8),
        )
        self._container.add_widget(self._action_row)

        super().add_widget(self._container)

    @staticmethod
    def _make_handle_bg(widget):
        """Create a rounded rectangle for the drag handle."""
        from kivy.graphics import Color, RoundedRectangle

        def update_rect(instance, value):
            rect.pos = instance.pos
            rect.size = instance.size

        color = Color(*TEXT_SECONDARY)
        rect = RoundedRectangle(pos=widget.pos, size=widget.size, radius=[dp(2)])
        widget.bind(pos=update_rect, size=update_rect)
        return color

    def add_content(self, widget):
        """Add a widget to the content area."""
        self._content_area.add_widget(widget)

    def add_action(self, text, callback, style="text", color=None, destructive=False):
        """Add an action button to the bottom row.

        Args:
            text: Button label
            callback: on_release callback (receives button instance)
            style: "text", "outlined", or "filled"
            color: Override text/bg color (RGBA tuple)
            destructive: If True, uses DESTRUCTIVE color
        """
        btn_text = MDButtonText(text=text)

        if destructive:
            btn_text.theme_text_color = "Custom"
            btn_text.text_color = DESTRUCTIVE if style == "text" else [1, 1, 1, 1]

        if color and style == "text":
            btn_text.theme_text_color = "Custom"
            btn_text.text_color = color

        btn_kwargs = {"style": style, "on_release": callback}

        if style == "filled":
            btn_kwargs["theme_bg_color"] = "Custom"
            if destructive:
                btn_kwargs["md_bg_color"] = DESTRUCTIVE
            elif color:
                btn_kwargs["md_bg_color"] = color
            else:
                btn_kwargs["md_bg_color"] = PRIMARY
            btn_text.theme_text_color = "Custom"
            btn_text.text_color = BACKGROUND

        btn = MDButton(btn_text, **btn_kwargs)
        self._action_row.add_widget(btn)

    def add_spacer(self):
        """Add a flexible spacer to the action row (pushes buttons apart)."""
        self._action_row.add_widget(Widget())

    def set_height(self, height_dp):
        """Override the sheet height."""
        self.height = dp(height_dp)
