"""Reusable exercise picker bottom sheet.

Opens a searchable list of exercises in an AppBottomSheet. Used by the
routine editor (add exercise to day) and the workout screen (ad-hoc add).

Usage:
    picker = ExercisePickerSheet(app, on_select=my_callback, title="Add Exercise")
    picker.open()

    def my_callback(exercise_id, exercise_name):
        ...
"""
from kivy.metrics import dp
from kivy.uix.behaviors import ButtonBehavior
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.textfield import MDTextField, MDTextFieldHintText

from src.models.exercise import ExerciseType
from src.screens.components.bottom_sheet import AppBottomSheet
from src.theme import TEXT_PRIMARY, TEXT_SECONDARY, SURFACE, PRIMARY


# Human-readable labels for exercise types
_TYPE_LABELS = {
    ExerciseType.REPS_WEIGHT: "Reps + Weight",
    ExerciseType.REPS_ONLY: "Reps Only",
    ExerciseType.TIME: "Time",
    ExerciseType.CARDIO: "Cardio",
}


class _PickerRow(ButtonBehavior, MDBoxLayout):
    """A single tappable exercise row in the picker list.

    Attributes:
        exercise_id: The exercise's database ID (plain int, not a Kivy property).
        exercise_name: The exercise's display name (plain str, not a Kivy property).
    """

    def __init__(self, exercise_id, exercise_name, exercise_type, on_select, sheet, **kwargs):
        super().__init__(**kwargs)
        self.exercise_id = exercise_id
        self.exercise_name = exercise_name
        self._on_select = on_select
        self._sheet = sheet

        self.size_hint_y = None
        self.height = dp(56)
        self.padding = [dp(16), 0, dp(16), 0]
        self.spacing = dp(8)
        self.md_bg_color = SURFACE

        # Name + type column
        info_col = MDBoxLayout(orientation="vertical", spacing=dp(2))

        name_label = MDLabel(
            text=exercise_name,
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        )
        type_text = _TYPE_LABELS.get(exercise_type, exercise_type.value if hasattr(exercise_type, "value") else str(exercise_type))
        type_label = MDLabel(
            text=type_text,
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="small",
            adaptive_height=True,
        )
        info_col.add_widget(name_label)
        info_col.add_widget(type_label)
        self.add_widget(info_col)

        self.bind(on_release=self._handle_tap)

    def _handle_tap(self, *args):
        self._on_select(self.exercise_id, self.exercise_name)
        self._sheet.dismiss()


class ExercisePickerSheet:
    """Helper that opens a searchable exercise picker as a bottom sheet.

    Not a Kivy widget — instantiate, then call open() to display.
    """

    def __init__(self, app, on_select, title="Select Exercise"):
        self._app = app
        self._on_select = on_select
        self._title = title
        self._sheet = None
        self._list_layout = None
        self._all_exercises = []

    def open(self):
        """Fetch exercises and open the picker sheet."""
        self._all_exercises = self._app.exercise_service.list_exercises()

        self._sheet = AppBottomSheet(title=self._title)
        self._sheet.set_height(400)

        # Search field
        search_field = MDTextField()
        search_field.add_widget(MDTextFieldHintText(text="Search exercises..."))
        search_field.bind(text=self._on_search_change)
        self._sheet.add_content(search_field)

        # Scrollable exercise list
        scroll = MDScrollView(size_hint_y=1)
        self._list_layout = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(1),
        )
        self._populate_list(self._all_exercises)
        scroll.add_widget(self._list_layout)
        self._sheet.add_content(scroll)

        self._sheet.open()

    def _on_search_change(self, instance, text):
        """Filter exercise list as user types."""
        query = text.strip().lower()
        if query:
            filtered = [ex for ex in self._all_exercises if query in ex.name.lower()]
        else:
            filtered = self._all_exercises
        self._populate_list(filtered)

    def _populate_list(self, exercises):
        """Rebuild the picker row list with the given exercises."""
        self._list_layout.clear_widgets()

        if not exercises:
            self._list_layout.add_widget(MDLabel(
                text="No exercises found.",
                halign="center",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="medium",
                size_hint_y=None,
                height=dp(56),
            ))
            return

        for ex in exercises:
            row = _PickerRow(
                exercise_id=ex.id,
                exercise_name=ex.name,
                exercise_type=ex.type,
                on_select=self._on_select,
                sheet=self._sheet,
            )
            self._list_layout.add_widget(row)
