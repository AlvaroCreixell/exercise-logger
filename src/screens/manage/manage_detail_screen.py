"""Base class for all Manage sub-screens. Provides header with back button."""
from kivy.metrics import dp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDIconButton
from kivymd.uix.label import MDLabel

from src.screens.base_screen import BaseScreen
from src.theme import BACKGROUND, TEXT_PRIMARY, TEXT_SECONDARY


class ManageDetailScreen(BaseScreen):
    """Base for Manage drill-in screens. Subclasses override build_content()."""

    def __init__(self, title="", **kwargs):
        super().__init__(**kwargs)
        self._title = title
        self.md_bg_color = BACKGROUND
        self._header = None
        self._content_area = None

    def on_enter(self):
        self._build_layout()
        self.build_content(self._content_area)

    def _build_layout(self):
        self.clear_widgets()
        layout = MDBoxLayout(orientation="vertical")

        # Header with back button
        self._header = MDBoxLayout(size_hint_y=None, height=dp(56),
                                    padding=[dp(8), 0, dp(16), 0], spacing=dp(8))
        self._header.add_widget(MDIconButton(
            icon="arrow-left",
            theme_icon_color="Custom", icon_color=TEXT_SECONDARY,
            on_release=lambda *a: self.go_back(),
        ))
        self._header.add_widget(MDLabel(
            text=self._title,
            theme_text_color="Custom", text_color=TEXT_PRIMARY,
            font_style="Headline", role="small",
        ))
        layout.add_widget(self._header)

        # Content area for subclass
        self._content_area = MDBoxLayout(orientation="vertical")
        layout.add_widget(self._content_area)
        self.add_widget(layout)

    def build_content(self, container):
        """Override in subclasses to populate the content area."""
        pass

    def go_back(self):
        """Navigate back to manage section list."""
        screen = self
        while screen:
            from src.screens.manage.manage_screen import ManageScreen
            if isinstance(screen, ManageScreen):
                screen.pop_screen()
                return
            screen = screen.parent
