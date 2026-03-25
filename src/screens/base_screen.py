"""Base screen with app/service access helpers."""
from kivymd.uix.screen import MDScreen


class BaseScreen(MDScreen):
    """Base class for all app screens. Provides service access."""

    @property
    def app(self):
        from kivymd.app import MDApp
        return MDApp.get_running_app()
