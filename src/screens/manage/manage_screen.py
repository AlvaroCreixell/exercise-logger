"""Manage screen — section list with nested drill-in navigation.

Uses a nested ScreenManager so tapping a section slides in a detail screen.
Phase 3C replaces PlaceholderDetailScreen with real sub-screens.
"""
import os
from kivy.lang import Builder
from kivy.properties import StringProperty
from kivy.uix.behaviors import ButtonBehavior
from kivy.uix.screenmanager import ScreenManager, SlideTransition
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.screen import MDScreen

from src.screens.base_screen import BaseScreen

Builder.load_file(os.path.join(os.path.dirname(__file__), "manage_screen.kv"))

MANAGE_SECTIONS = [
    {"icon": "clipboard-list-outline", "label": "Routines", "screen": "routines"},
    {"icon": "format-list-bulleted", "label": "Exercise Catalog", "screen": "exercises"},
    {"icon": "trophy-outline", "label": "Benchmarks", "screen": "benchmarks"},
    {"icon": "swap-horizontal", "label": "Import / Export", "screen": "import_export"},
    {"icon": "scale", "label": "Units", "screen": "units"},
]


class ManageSectionItem(ButtonBehavior, MDBoxLayout):
    """Tappable section row. ButtonBehavior provides on_release."""
    icon = StringProperty("")
    label_text = StringProperty("")
    screen_name = StringProperty("")

    def on_release(self):
        # Walk up to find the ManageScreen and push the detail screen
        screen = self
        while screen and not isinstance(screen, ManageScreen):
            screen = screen.parent
        if screen:
            screen.push_screen(self.screen_name, self.label_text)


class ManageSectionList(MDScreen):
    """The root 'list' screen inside Manage's nested ScreenManager."""
    pass


class PlaceholderDetailScreen(MDScreen):
    """Temporary detail screen for sections not yet implemented."""
    title_text = StringProperty("")

    def go_back(self):
        screen = self
        while screen and not isinstance(screen, ManageScreen):
            screen = screen.parent
        if screen:
            screen.pop_screen()


class ManageScreen(BaseScreen):
    """Manage tab — flat section list with nested drill-in navigation.

    Phase 3C adds real detail screens by calling:
        manage_screen.add_detail_screen("routines", RoutineEditorScreen(...))
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Nested screen manager for drill-in
        self._nav_stack = []
        self.sub_manager = ScreenManager()
        self.add_widget(self.sub_manager)

        # Add root section list
        self._section_list = ManageSectionList(name="manage_root")
        self.sub_manager.add_widget(self._section_list)

        # Pre-create placeholder detail screens for each section
        for section in MANAGE_SECTIONS:
            placeholder = PlaceholderDetailScreen(
                name=f"manage_{section['screen']}",
                title_text=section["label"],
            )
            self.sub_manager.add_widget(placeholder)

    def on_enter(self):
        container = self._section_list.ids.section_list
        if container.children:
            return
        for section in MANAGE_SECTIONS:
            container.add_widget(ManageSectionItem(
                icon=section["icon"],
                label_text=section["label"],
                screen_name=section["screen"],
            ))

    def push_screen(self, screen_name: str, title: str = ""):
        """Navigate to a detail screen (slide left)."""
        full_name = f"manage_{screen_name}"
        self.sub_manager.transition = SlideTransition(direction="left", duration=0.2)
        self._nav_stack.append(self.sub_manager.current)
        self.sub_manager.current = full_name

    def pop_screen(self):
        """Go back to previous screen (slide right)."""
        if self._nav_stack:
            prev = self._nav_stack.pop()
            self.sub_manager.transition = SlideTransition(direction="right", duration=0.2)
            self.sub_manager.current = prev

    def add_detail_screen(self, section_name: str, screen: MDScreen):
        """Replace a placeholder detail screen with a real one (for Phase 3C).

        Usage: manage_screen.add_detail_screen("routines", RoutineEditorScreen(...))
        """
        full_name = f"manage_{section_name}"
        old = self.sub_manager.get_screen(full_name)
        if old:
            self.sub_manager.remove_widget(old)
        screen.name = full_name
        self.sub_manager.add_widget(screen)
