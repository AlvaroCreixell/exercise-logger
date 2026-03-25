"""Benchmark setup screen — create, edit, and delete benchmark definitions.

Lists definitions grouped by muscle_group_label with exercise name, method, and frequency.
Create/edit via bottom sheet with exercise picker, method dropdown, frequency stepper,
and muscle group text field. Delete with text-style destructive confirmation.
"""
from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText, MDIconButton
from kivymd.uix.label import MDLabel
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.textfield import MDTextField, MDTextFieldHintText

from src.models.benchmark import BenchmarkMethod
from src.screens.manage.manage_detail_screen import ManageDetailScreen
from src.screens.components.bottom_sheet import AppBottomSheet
from src.screens.components.exercise_picker import ExercisePickerSheet
from src.screens.components.stepper import ValueStepper
from src.theme import TEXT_PRIMARY, TEXT_SECONDARY, SURFACE, DIVIDER, PRIMARY


# Human-readable method labels
_METHOD_LABELS = {
    BenchmarkMethod.MAX_WEIGHT: "Max Weight",
    BenchmarkMethod.MAX_REPS: "Max Reps",
    BenchmarkMethod.TIMED_HOLD: "Timed Hold",
}

# Predefined muscle groups for quick selection
_MUSCLE_GROUPS = ["Upper", "Lower", "Back", "Core"]

# Separator between groups
_DEFAULT_GROUP = "Ungrouped"


class BenchmarkSetupScreen(ManageDetailScreen):
    """Benchmark setup screen — list, create, edit, delete benchmark definitions."""

    def __init__(self, **kwargs):
        super().__init__(title="Benchmarks", **kwargs)

    def build_content(self, container):
        container.clear_widgets()

        # Top bar with create button
        top_bar = MDBoxLayout(
            size_hint_y=None,
            height=dp(52),
            padding=[dp(16), dp(4), dp(8), dp(4)],
            spacing=dp(8),
        )
        top_bar.add_widget(Widget())  # spacer

        create_btn = MDButton(style="filled", size_hint_x=None)
        create_btn.add_widget(MDButtonText(text="+ New Benchmark"))
        create_btn.bind(on_release=lambda *a: self._open_create_sheet(container))
        top_bar.add_widget(create_btn)
        container.add_widget(top_bar)

        # Load definitions and group them
        definitions = self.app.benchmark_service.list_definitions()

        if not definitions:
            empty = MDBoxLayout(orientation="vertical", spacing=dp(16), padding=dp(32))
            empty.add_widget(Widget())
            empty.add_widget(MDLabel(
                text="No benchmarks yet.",
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
                width=dp(220),
                pos_hint={"center_x": 0.5},
            )
            create_btn2.add_widget(MDButtonText(text="Create Benchmark"))
            create_btn2.bind(on_release=lambda *a: self._open_create_sheet(container))
            empty.add_widget(create_btn2)
            empty.add_widget(Widget())
            container.add_widget(empty)
            return

        # Group by muscle_group_label
        groups = {}
        for defn in definitions:
            group = defn.muscle_group_label or _DEFAULT_GROUP
            groups.setdefault(group, []).append(defn)

        # Sort group names — known groups first, then alphabetical
        known_order = {g: i for i, g in enumerate(_MUSCLE_GROUPS)}
        sorted_groups = sorted(
            groups.keys(),
            key=lambda g: (known_order.get(g, len(_MUSCLE_GROUPS)), g),
        )

        scroll = MDScrollView()
        list_layout = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(1),
        )

        for group_name in sorted_groups:
            # Group header
            header = MDBoxLayout(
                size_hint_y=None,
                height=dp(36),
                padding=[dp(16), 0, dp(8), 0],
            )
            header.add_widget(MDLabel(
                text=group_name,
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Label",
                role="large",
                adaptive_height=True,
            ))
            list_layout.add_widget(header)

            for defn in groups[group_name]:
                list_layout.add_widget(self._build_defn_row(defn, container))

        scroll.add_widget(list_layout)
        container.add_widget(scroll)

    def _build_defn_row(self, defn, container):
        """Build a single benchmark definition row."""
        row = MDBoxLayout(
            size_hint_y=None,
            height=dp(56),
            padding=[dp(16), 0, dp(8), 0],
            spacing=dp(8),
            md_bg_color=SURFACE,
        )

        # Resolve exercise name
        try:
            exercise = self.app.exercise_service.get_exercise(defn.exercise_id)
            ex_name = exercise.name if exercise else f"Exercise #{defn.exercise_id}"
        except Exception:
            ex_name = f"Exercise #{defn.exercise_id}"

        # Info column: exercise name + method + frequency
        info_col = MDBoxLayout(orientation="vertical", spacing=dp(2))
        info_col.add_widget(MDLabel(
            text=ex_name,
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        ))
        method_label = _METHOD_LABELS.get(defn.method, defn.method.value)
        info_col.add_widget(MDLabel(
            text=f"{method_label} · every {defn.frequency_weeks}w",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="small",
            adaptive_height=True,
        ))
        row.add_widget(info_col)

        # Edit button
        edit_btn = MDIconButton(
            icon="pencil-outline",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        edit_btn.bind(on_release=lambda *a, d=defn: self._open_edit_sheet(d, container))
        row.add_widget(edit_btn)

        # Delete button
        del_btn = MDIconButton(
            icon="trash-can-outline",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        del_btn.bind(on_release=lambda *a, d=defn: self._confirm_delete(d, container))
        row.add_widget(del_btn)

        return row

    def _open_create_sheet(self, container):
        """Bottom sheet to create a new benchmark definition."""
        state = {
            "exercise_id": None,
            "exercise_name": None,
            "method": BenchmarkMethod.MAX_WEIGHT,
        }

        sheet = AppBottomSheet(title="New Benchmark")
        sheet.set_height(500)

        # Exercise picker row
        ex_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        ex_label = MDLabel(
            text="No exercise selected",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        )
        ex_row.add_widget(ex_label)

        def on_exercise_picked(ex_id, ex_name):
            state["exercise_id"] = ex_id
            state["exercise_name"] = ex_name
            ex_label.text = ex_name
            ex_label.theme_text_color = "Custom"
            ex_label.text_color = TEXT_PRIMARY

        pick_btn = MDButton(style="outlined", size_hint_x=None)
        pick_btn.add_widget(MDButtonText(text="Pick Exercise"))

        def open_picker(*a):
            picker = ExercisePickerSheet(self.app, on_select=on_exercise_picked, title="Select Exercise")
            picker.open()

        pick_btn.bind(on_release=open_picker)
        ex_row.add_widget(pick_btn)
        sheet.add_content(ex_row)

        # Method selection
        sheet.add_content(MDLabel(
            text="Method",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Label",
            role="large",
            adaptive_height=True,
        ))
        method_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        method_btns = {}
        for method, label in _METHOD_LABELS.items():
            btn = MDButton(
                style="filled" if method == state["method"] else "outlined",
                size_hint_x=None,
            )
            btn.add_widget(MDButtonText(text=label))
            method_btns[method] = btn
            method_row.add_widget(btn)

        def select_method(m):
            state["method"] = m
            for mt, b in method_btns.items():
                b.style = "filled" if mt == m else "outlined"

        for method in method_btns:
            m_ref = method
            method_btns[method].bind(on_release=lambda *a, m=m_ref: select_method(m))
        sheet.add_content(method_row)

        # Frequency stepper (weeks)
        freq_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        freq_row.add_widget(MDLabel(
            text="Frequency (weeks):",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))
        freq_stepper = ValueStepper(value=6, step=1, min_val=1, max_val=52, label="weeks")
        freq_row.add_widget(freq_stepper)
        sheet.add_content(freq_row)

        # Muscle group
        sheet.add_content(MDLabel(
            text="Muscle Group",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Label",
            role="large",
            adaptive_height=True,
        ))
        muscle_group_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        muscle_state = {"value": ""}
        muscle_btns = {}
        for mg in _MUSCLE_GROUPS:
            btn = MDButton(style="outlined", size_hint_x=None)
            btn.add_widget(MDButtonText(text=mg))
            muscle_btns[mg] = btn
            muscle_group_row.add_widget(btn)
        sheet.add_content(muscle_group_row)

        muscle_field = MDTextField()
        muscle_field.add_widget(MDTextFieldHintText(text="Or type custom group..."))
        sheet.add_content(muscle_field)

        def select_muscle_group(mg):
            muscle_state["value"] = mg
            muscle_field.text = mg
            for g, b in muscle_btns.items():
                b.style = "filled" if g == mg else "outlined"

        for mg in muscle_btns:
            mg_ref = mg
            muscle_btns[mg].bind(on_release=lambda *a, mg=mg_ref: select_muscle_group(mg))

        # Error label
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
            if not state["exercise_id"]:
                error_label.text = "Please select an exercise."
                return
            group = muscle_field.text.strip() or muscle_state["value"] or ""
            try:
                self.app.benchmark_service.create_definition(
                    exercise_id=state["exercise_id"],
                    method=state["method"],
                    muscle_group_label=group,
                    frequency_weeks=int(freq_stepper.value),
                )
                sheet.dismiss()
                self.build_content(container)
            except Exception as e:
                error_label.text = str(e)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Save", on_save, style="filled")
        sheet.open()

    def _open_edit_sheet(self, defn, container):
        """Bottom sheet to edit an existing benchmark definition."""
        # Resolve current exercise name
        try:
            exercise = self.app.exercise_service.get_exercise(defn.exercise_id)
            current_ex_name = exercise.name if exercise else f"Exercise #{defn.exercise_id}"
        except Exception:
            current_ex_name = f"Exercise #{defn.exercise_id}"

        state = {
            "exercise_id": defn.exercise_id,
            "exercise_name": current_ex_name,
            "method": defn.method,
        }

        sheet = AppBottomSheet(title=f"Edit Benchmark")
        sheet.set_height(500)

        # Exercise picker row
        ex_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        ex_label = MDLabel(
            text=current_ex_name,
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        )
        ex_row.add_widget(ex_label)

        def on_exercise_picked(ex_id, ex_name):
            state["exercise_id"] = ex_id
            state["exercise_name"] = ex_name
            ex_label.text = ex_name

        pick_btn = MDButton(style="outlined", size_hint_x=None)
        pick_btn.add_widget(MDButtonText(text="Change"))

        def open_picker(*a):
            picker = ExercisePickerSheet(self.app, on_select=on_exercise_picked, title="Select Exercise")
            picker.open()

        pick_btn.bind(on_release=open_picker)
        ex_row.add_widget(pick_btn)
        sheet.add_content(ex_row)

        # Method selection
        sheet.add_content(MDLabel(
            text="Method",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Label",
            role="large",
            adaptive_height=True,
        ))
        method_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        method_btns = {}
        for method, label in _METHOD_LABELS.items():
            btn = MDButton(
                style="filled" if method == state["method"] else "outlined",
                size_hint_x=None,
            )
            btn.add_widget(MDButtonText(text=label))
            method_btns[method] = btn
            method_row.add_widget(btn)

        def select_method(m):
            state["method"] = m
            for mt, b in method_btns.items():
                b.style = "filled" if mt == m else "outlined"

        for method in method_btns:
            m_ref = method
            method_btns[method].bind(on_release=lambda *a, m=m_ref: select_method(m))
        sheet.add_content(method_row)

        # Frequency stepper
        freq_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        freq_row.add_widget(MDLabel(
            text="Frequency (weeks):",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))
        freq_stepper = ValueStepper(
            value=defn.frequency_weeks,
            step=1,
            min_val=1,
            max_val=52,
            label="weeks",
        )
        freq_row.add_widget(freq_stepper)
        sheet.add_content(freq_row)

        # Muscle group
        sheet.add_content(MDLabel(
            text="Muscle Group",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Label",
            role="large",
            adaptive_height=True,
        ))
        current_group = defn.muscle_group_label or ""
        muscle_group_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        muscle_btns = {}
        for mg in _MUSCLE_GROUPS:
            btn = MDButton(
                style="filled" if mg == current_group else "outlined",
                size_hint_x=None,
            )
            btn.add_widget(MDButtonText(text=mg))
            muscle_btns[mg] = btn
            muscle_group_row.add_widget(btn)
        sheet.add_content(muscle_group_row)

        muscle_field = MDTextField(text=current_group)
        muscle_field.add_widget(MDTextFieldHintText(text="Or type custom group..."))
        sheet.add_content(muscle_field)

        def select_muscle_group(mg):
            muscle_field.text = mg
            for g, b in muscle_btns.items():
                b.style = "filled" if g == mg else "outlined"

        for mg in muscle_btns:
            mg_ref = mg
            muscle_btns[mg].bind(on_release=lambda *a, mg=mg_ref: select_muscle_group(mg))

        # Error label
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
            group = muscle_field.text.strip()
            defn.exercise_id = state["exercise_id"]
            defn.method = state["method"]
            defn.frequency_weeks = int(freq_stepper.value)
            defn.muscle_group_label = group
            try:
                self.app.benchmark_service.update_definition(defn)
                sheet.dismiss()
                self.build_content(container)
            except Exception as e:
                error_label.text = str(e)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Save", on_save, style="filled")
        sheet.open()

    def _confirm_delete(self, defn, container):
        """Confirmation sheet before deleting a benchmark definition."""
        try:
            exercise = self.app.exercise_service.get_exercise(defn.exercise_id)
            ex_name = exercise.name if exercise else f"Exercise #{defn.exercise_id}"
        except Exception:
            ex_name = f"Exercise #{defn.exercise_id}"

        sheet = AppBottomSheet(title=f"Delete benchmark?")
        sheet.set_height(220)
        sheet.add_content(MDLabel(
            text=f"Delete '{ex_name}' benchmark? This cannot be undone.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_delete(*a):
            self.app.benchmark_service.delete_definition(defn.id)
            sheet.dismiss()
            self.build_content(container)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Delete", on_delete, destructive=True)  # text style, not filled
        sheet.open()
