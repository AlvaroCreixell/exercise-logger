"""Lightweight error toast — wraps KivyMD MDSnackbar for consistent error display."""
from kivy.metrics import dp
from kivymd.uix.snackbar import MDSnackbar, MDSnackbarText
from src.theme import DESTRUCTIVE


def show_error_toast(message: str) -> None:
    """Show a brief error message at the bottom of the screen.

    Uses MDSnackbar with DESTRUCTIVE background color.
    Auto-dismisses after 3 seconds.
    """
    MDSnackbar(
        MDSnackbarText(text=message),
        y=dp(24),
        pos_hint={"center_x": 0.5},
        size_hint_x=0.9,
        background_color=DESTRUCTIVE,
    ).open()
