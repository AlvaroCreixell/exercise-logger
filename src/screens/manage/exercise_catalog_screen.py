"""Exercise catalog screen — list, create, archive/unarchive exercises."""
from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText, MDIconButton
from kivymd.uix.label import MDLabel
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.textfield import MDTextField, MDTextFieldHintText

from src.models.exercise import ExerciseType
from src.screens.manage.manage_detail_screen import ManageDetailScreen
from src.screens.components.bottom_sheet import AppBottomSheet
from src.theme import TEXT_PRIMARY, TEXT_SECONDARY, SURFACE, DIVIDER, PRIMARY


# Human-readable labels for exercise types
_TYPE_LABELS = {
    ExerciseType.REPS_WEIGHT: "Reps + Weight",
    ExerciseType.REPS_ONLY: "Reps Only",
    ExerciseType.TIME: "Time",
    ExerciseType.CARDIO: "Cardio",
}


class ExerciseCatalogScreen(ManageDetailScreen):
    def __init__(self, **kwargs):
        super().__init__(title="Exercise Catalog", **kwargs)
        self._show_archived = False

    def build_content(self, container):
        container.clear_widgets()

        # Top bar: toggle archived + create button
        top_bar = MDBoxLayout(
            size_hint_y=None,
            height=dp(52),
            padding=[dp(16), dp(4), dp(8), dp(4)],
            spacing=dp(8),
        )

        archived_label = "Hide Archived" if self._show_archived else "Show Archived"
        toggle_btn = MDButton(
            style="text",
            size_hint_x=None,
        )
        toggle_btn.add_widget(MDButtonText(
            text=archived_label,
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
        ))
        toggle_btn.bind(on_release=lambda *a: self._toggle_archived(container))
        top_bar.add_widget(toggle_btn)

        top_bar.add_widget(Widget())  # spacer

        create_btn = MDButton(style="filled", size_hint_x=None)
        create_btn.add_widget(MDButtonText(text="+ New Exercise"))
        create_btn.bind(on_release=lambda *a: self._open_create_sheet(container))
        top_bar.add_widget(create_btn)

        container.add_widget(top_bar)

        # Scrollable exercise list
        exercises = self.app.exercise_service.list_exercises(
            include_archived=self._show_archived
        )

        if not exercises:
            empty = MDBoxLayout(orientation="vertical", spacing=dp(16), padding=dp(32))
            empty.add_widget(Widget())
            empty.add_widget(MDLabel(
                text="No exercises yet.",
                halign="center",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="large",
                adaptive_height=True,
            ))
            create_btn2 = MDButton(
                style="outlined",
                size_hint_x=None,
                width=dp(200),
                pos_hint={"center_x": 0.5},
            )
            create_btn2.add_widget(MDButtonText(text="Create Exercise"))
            create_btn2.bind(on_release=lambda *a: self._open_create_sheet(container))
            empty.add_widget(create_btn2)
            empty.add_widget(Widget())
            container.add_widget(empty)
            return

        scroll = MDScrollView()
        list_layout = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(1),
        )

        for ex in exercises:
            list_layout.add_widget(self._build_exercise_row(ex, container))

        scroll.add_widget(list_layout)
        container.add_widget(scroll)

    def _build_exercise_row(self, exercise, container):
        """Build a single exercise row with name, type badge, and archive toggle."""
        row = MDBoxLayout(
            size_hint_y=None,
            height=dp(56),
            padding=[dp(16), 0, dp(8), 0],
            spacing=dp(8),
            md_bg_color=SURFACE,
        )

        # Name + type column
        info_col = MDBoxLayout(orientation="vertical", spacing=dp(2))
        name_label = MDLabel(
            text=exercise.name,
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY if exercise.is_archived else TEXT_PRIMARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        )
        type_label = MDLabel(
            text=_TYPE_LABELS.get(exercise.type, exercise.type.value),
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="small",
            adaptive_height=True,
        )
        info_col.add_widget(name_label)
        info_col.add_widget(type_label)
        row.add_widget(info_col)

        # Archived indicator
        if exercise.is_archived:
            row.add_widget(MDLabel(
                text="archived",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="small",
                size_hint_x=None,
                width=dp(64),
                halign="right",
                adaptive_height=True,
            ))

        # Archive / unarchive icon button
        icon = "archive-arrow-up-outline" if exercise.is_archived else "archive-arrow-down-outline"
        archive_btn = MDIconButton(
            icon=icon,
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        ex_ref = exercise
        if exercise.is_archived:
            archive_btn.bind(on_release=lambda *a, e=ex_ref: self._confirm_unarchive(e, container))
        else:
            archive_btn.bind(on_release=lambda *a, e=ex_ref: self._confirm_archive(e, container))
        row.add_widget(archive_btn)

        return row

    def _toggle_archived(self, container):
        self._show_archived = not self._show_archived
        self.build_content(container)

    def _open_create_sheet(self, container):
        """Bottom sheet to create a new exercise."""
        sheet = AppBottomSheet(title="New Exercise")
        sheet.set_height(360)

        name_field = MDTextField()
        name_field.add_widget(MDTextFieldHintText(text="Exercise name"))
        sheet.add_content(name_field)

        # Exercise type selection
        type_state = {"value": ExerciseType.REPS_WEIGHT}

        type_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        type_btns = {}
        for ex_type, label in _TYPE_LABELS.items():
            btn = MDButton(
                style="filled" if ex_type == type_state["value"] else "outlined",
                size_hint_x=None,
            )
            btn.add_widget(MDButtonText(text=label))
            type_btns[ex_type] = btn
            type_row.add_widget(btn)

        def _select_type(selected_type):
            type_state["value"] = selected_type
            for t, b in type_btns.items():
                b.style = "filled" if t == selected_type else "outlined"

        for ex_type in type_btns:
            t_ref = ex_type
            type_btns[ex_type].bind(on_release=lambda *a, t=t_ref: _select_type(t))

        sheet.add_content(type_row)

        # Error label (hidden until needed)
        error_label = MDLabel(
            text="",
            theme_text_color="Custom",
            text_color=(0.97, 0.44, 0.44, 1),
            font_style="Body",
            role="small",
            adaptive_height=True,
        )
        sheet.add_content(error_label)

        def on_save(*a):
            name = name_field.text.strip()
            if not name:
                error_label.text = "Name is required."
                return
            try:
                self.app.exercise_service.create_exercise(name, type_state["value"])
                sheet.dismiss()
                self.build_content(container)
            except ValueError as e:
                error_label.text = str(e)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Save", on_save, style="filled")
        sheet.open()

    def _confirm_archive(self, exercise, container):
        """Confirm and archive an exercise."""
        sheet = AppBottomSheet(title=f"Archive {exercise.name}?")
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text="Archived exercises won't appear in routine or workout pickers.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_confirm(*a):
            self.app.exercise_service.archive_exercise(exercise.id)
            sheet.dismiss()
            self.build_content(container)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Archive", on_confirm, destructive=True)  # text style, not filled
        sheet.open()

    def _confirm_unarchive(self, exercise, container):
        """Unarchive an exercise immediately (no destructive action needed)."""
        self.app.exercise_service.unarchive_exercise(exercise.id)
        self.build_content(container)
