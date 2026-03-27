"""App theme — color palette and KivyMD theme configuration.

All colors from spec Frontend Design Addendum.
Industrial minimalism. Dark. Two accents (green + blue) + red for destructive.
"""

# RGBA tuples (0-1 range) for Python/Kivy use
BACKGROUND = (0.071, 0.071, 0.071, 1)       # #121212
SURFACE = (0.118, 0.118, 0.118, 1)          # #1E1E1E
PRIMARY = (0.290, 0.871, 0.502, 1)          # #4ADE80
SECONDARY = (0.376, 0.647, 0.980, 1)        # #60A5FA
DESTRUCTIVE = (0.973, 0.443, 0.443, 1)      # #F87171
WARNING = (0.961, 0.620, 0.043, 1)         # #F59E0B
TEXT_PRIMARY = (0.961, 0.961, 0.961, 1)      # #F5F5F5
TEXT_SECONDARY = (0.612, 0.639, 0.686, 1)   # #9CA3AF
DIVIDER = (0.165, 0.165, 0.165, 1)          # #2A2A2A


def setup_theme(app):
    """Configure KivyMD dark theme. Call in build()."""
    app.theme_cls.theme_style = "Dark"
    app.theme_cls.primary_palette = "Green"
