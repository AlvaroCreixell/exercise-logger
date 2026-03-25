"""Routine editor screen — three-level drill-in: routines → days → exercises/targets.

Level 1: Routine list (create, activate/deactivate, delete, tap to drill into days)
Level 2: Day list (add, delete, reorder via up/down buttons, tap to drill into exercises)
Level 3: Day detail (add/remove exercises, uniform/progressive target editor)
"""
from kivy.metrics import dp
from kivy.uix.behaviors import ButtonBehavior
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText, MDIconButton
from kivymd.uix.label import MDLabel
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.textfield import MDTextField, MDTextFieldHintText

from src.models.exercise import ExerciseType
from src.models.routine import SetScheme, SetKind
from src.screens.manage.manage_detail_screen import ManageDetailScreen
from src.screens.components.bottom_sheet import AppBottomSheet
from src.screens.components.stepper import ValueStepper
from src.theme import TEXT_PRIMARY, TEXT_SECONDARY, SURFACE, DIVIDER, PRIMARY


# ─── Exercise type helpers ────────────────────────────────────────────────────

# Default SetKind per ExerciseType
_DEFAULT_SET_KIND = {
    ExerciseType.REPS_WEIGHT: SetKind.REPS_WEIGHT,
    ExerciseType.REPS_ONLY: SetKind.REPS_ONLY,
    ExerciseType.TIME: SetKind.DURATION,
    ExerciseType.CARDIO: SetKind.CARDIO,
}


def _describe_target(target) -> str:
    """Return a compact human-readable description of a SetTarget."""
    if target.set_kind == SetKind.REPS_WEIGHT:
        reps = target.target_reps_min or 0
        weight = target.target_weight or 0
        return f"{reps} reps @ {weight:.1f}"
    if target.set_kind in (SetKind.REPS_ONLY, SetKind.AMRAP):
        reps = target.target_reps_min or 0
        return f"{reps} reps"
    if target.set_kind == SetKind.DURATION:
        sec = target.target_duration_seconds or 0
        return f"{sec}s"
    if target.set_kind == SetKind.CARDIO:
        parts = []
        if target.target_duration_seconds:
            parts.append(f"{target.target_duration_seconds}s")
        if target.target_distance:
            parts.append(f"{target.target_distance:.1f}km")
        return " / ".join(parts) if parts else "—"
    return "—"


# ─── Tappable row widget ──────────────────────────────────────────────────────

class _TappableBox(ButtonBehavior, MDBoxLayout):
    """Box layout that responds to touch, used for drill-in rows."""
    pass


# ─── Main screen ─────────────────────────────────────────────────────────────

class RoutineEditorScreen(ManageDetailScreen):
    """Three-level routine editor.

    Internal state:
        _view: "routines" | "days" | "day_detail"
        _selected_routine_id: int or None
        _selected_day_id: int or None
    """

    def __init__(self, **kwargs):
        super().__init__(title="Routines", **kwargs)
        self._view = "routines"
        self._selected_routine_id = None
        self._selected_day_id = None

    # ── ManageDetailScreen override ──────────────────────────────────────────

    def on_enter(self):
        # Reset to top-level on re-entry so back from manage nav always shows list
        self._view = "routines"
        self._selected_routine_id = None
        self._selected_day_id = None
        super().on_enter()

    def build_content(self, container):
        container.clear_widgets()
        if self._view == "routines":
            self._build_routine_list(container)
        elif self._view == "days":
            self._build_day_list(container)
        elif self._view == "day_detail":
            self._build_day_detail(container)

    # Override go_back so internal levels go back within this screen
    def go_back(self):
        if self._view == "day_detail":
            self._view = "days"
            self.build_content(self._content_area)
        elif self._view == "days":
            self._view = "routines"
            self._selected_routine_id = None
            self.build_content(self._content_area)
        else:
            # At routine list — delegate to ManageScreen
            super().go_back()

    # ── Level 1: Routine list ────────────────────────────────────────────────

    def _build_routine_list(self, container):
        # Top bar: title + create button
        top_bar = MDBoxLayout(
            size_hint_y=None,
            height=dp(52),
            padding=[dp(16), dp(4), dp(8), dp(4)],
            spacing=dp(8),
        )
        top_bar.add_widget(Widget())
        create_btn = MDButton(style="filled", size_hint_x=None)
        create_btn.add_widget(MDButtonText(text="+ New Routine"))
        create_btn.bind(on_release=lambda *a: self._open_create_routine_sheet(container))
        top_bar.add_widget(create_btn)
        container.add_widget(top_bar)

        routines = self.app.routine_service.list_routines()

        if not routines:
            empty = MDBoxLayout(orientation="vertical", spacing=dp(16), padding=dp(32))
            empty.add_widget(Widget())
            empty.add_widget(MDLabel(
                text="No routines yet.",
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
            create_btn2.add_widget(MDButtonText(text="Create Routine"))
            create_btn2.bind(on_release=lambda *a: self._open_create_routine_sheet(container))
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
        for routine in routines:
            list_layout.add_widget(self._build_routine_row(routine, container))
        scroll.add_widget(list_layout)
        container.add_widget(scroll)

    def _build_routine_row(self, routine, container):
        """Single routine row: name + active badge + activate/delete buttons."""
        row = _TappableBox(
            size_hint_y=None,
            height=dp(64),
            padding=[dp(16), 0, dp(8), 0],
            spacing=dp(8),
            md_bg_color=SURFACE,
        )

        # Name + active label
        info_col = MDBoxLayout(orientation="vertical", spacing=dp(2))
        name_label = MDLabel(
            text=routine.name,
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        )
        info_col.add_widget(name_label)
        if routine.is_active:
            active_label = MDLabel(
                text="Active",
                theme_text_color="Custom",
                text_color=PRIMARY,
                font_style="Body",
                role="small",
                adaptive_height=True,
            )
            info_col.add_widget(active_label)
        row.add_widget(info_col)

        # Activate / deactivate button
        if routine.is_active:
            toggle_btn = MDButton(style="text", size_hint_x=None)
            toggle_btn.add_widget(MDButtonText(
                text="Deactivate",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
            ))
            r_ref = routine
            toggle_btn.bind(on_release=lambda *a, r=r_ref: self._deactivate_routine(r, container))
        else:
            toggle_btn = MDButton(style="text", size_hint_x=None)
            toggle_btn.add_widget(MDButtonText(
                text="Activate",
                theme_text_color="Custom",
                text_color=PRIMARY,
            ))
            r_ref = routine
            toggle_btn.bind(on_release=lambda *a, r=r_ref: self._activate_routine(r, container))
        row.add_widget(toggle_btn)

        # Delete icon button
        delete_btn = MDIconButton(
            icon="delete-outline",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        r_ref = routine
        delete_btn.bind(on_release=lambda *a, r=r_ref: self._confirm_delete_routine(r, container))
        row.add_widget(delete_btn)

        # Drill into day list on tap
        r_ref = routine
        row.bind(on_release=lambda *a, r=r_ref: self._drill_into_days(r.id))

        return row

    def _drill_into_days(self, routine_id):
        self._selected_routine_id = routine_id
        self._view = "days"
        self.build_content(self._content_area)

    def _activate_routine(self, routine, container):
        self.app.routine_service.activate_routine(routine.id)
        self.build_content(container)

    def _deactivate_routine(self, routine, container):
        """Confirm deactivation since the spec warns before deactivating the current routine."""
        sheet = AppBottomSheet(title=f"Deactivate '{routine.name}'?")
        sheet.set_height(220)
        sheet.add_content(MDLabel(
            text="This routine is currently active. Deactivating it means no routine will be scheduled for workouts.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_confirm(*a):
            self.app.routine_service.deactivate_routine(routine.id)
            sheet.dismiss()
            self.build_content(container)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Deactivate", on_confirm, destructive=True)
        sheet.open()

    def _confirm_delete_routine(self, routine, container):
        sheet = AppBottomSheet(title=f"Delete '{routine.name}'?")
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text="This will permanently delete the routine and all its days and exercises.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_confirm(*a):
            self.app.routine_service.delete_routine(routine.id)
            sheet.dismiss()
            self.build_content(container)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Delete", on_confirm, destructive=True)
        sheet.open()

    def _open_create_routine_sheet(self, container):
        sheet = AppBottomSheet(title="New Routine")
        sheet.set_height(260)

        name_field = MDTextField()
        name_field.add_widget(MDTextFieldHintText(text="Routine name"))
        sheet.add_content(name_field)

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
                self.app.routine_service.create_routine(name)
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

    # ── Level 2: Day list ────────────────────────────────────────────────────

    def _build_day_list(self, container):
        routine = self.app.routine_service.get_routine(self._selected_routine_id)
        days = self.app.routine_service.get_days(self._selected_routine_id)

        # Sub-header: back + routine name + add day button
        header = MDBoxLayout(
            size_hint_y=None,
            height=dp(52),
            padding=[dp(4), dp(4), dp(8), dp(4)],
            spacing=dp(4),
        )
        back_btn = MDIconButton(
            icon="arrow-left",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        back_btn.bind(on_release=lambda *a: self._back_to_routines(container))
        header.add_widget(back_btn)

        routine_label = MDLabel(
            text=routine.name if routine else "Routine",
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Title",
            role="medium",
            adaptive_height=True,
        )
        header.add_widget(routine_label)

        header.add_widget(Widget())

        add_btn = MDButton(style="filled", size_hint_x=None)
        add_btn.add_widget(MDButtonText(text="+ Day"))
        add_btn.bind(on_release=lambda *a: self._open_add_day_sheet(container))
        header.add_widget(add_btn)
        container.add_widget(header)

        if not days:
            empty = MDBoxLayout(orientation="vertical", spacing=dp(16), padding=dp(32))
            empty.add_widget(Widget())
            empty.add_widget(MDLabel(
                text="No days yet. Add a training day.",
                halign="center",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="large",
                adaptive_height=True,
            ))
            empty.add_widget(Widget())
            container.add_widget(empty)
            return

        scroll = MDScrollView()
        list_layout = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(1),
        )
        for day in days:
            list_layout.add_widget(self._build_day_row(day, days, container))
        scroll.add_widget(list_layout)
        container.add_widget(scroll)

    def _build_day_row(self, day, all_days, container):
        """Day row: label + name + move up/down buttons + delete + drill in."""
        row = _TappableBox(
            size_hint_y=None,
            height=dp(60),
            padding=[dp(16), 0, dp(4), 0],
            spacing=dp(4),
            md_bg_color=SURFACE,
        )

        # Label + name
        info_col = MDBoxLayout(orientation="vertical", spacing=dp(2))
        info_col.add_widget(MDLabel(
            text=f"Day {day.label}",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="small",
            adaptive_height=True,
        ))
        info_col.add_widget(MDLabel(
            text=day.name,
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        ))
        row.add_widget(info_col)

        row.add_widget(Widget())

        # Move up
        up_btn = MDIconButton(
            icon="chevron-up",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        day_ref = day
        up_btn.bind(on_release=lambda *a, d=day_ref: self._move_day_up(d.id, all_days, container))
        row.add_widget(up_btn)

        # Move down
        down_btn = MDIconButton(
            icon="chevron-down",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        down_btn.bind(on_release=lambda *a, d=day_ref: self._move_day_down(d.id, all_days, container))
        row.add_widget(down_btn)

        # Delete
        del_btn = MDIconButton(
            icon="delete-outline",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        del_btn.bind(on_release=lambda *a, d=day_ref: self._confirm_delete_day(d, container))
        row.add_widget(del_btn)

        # Drill into day detail
        row.bind(on_release=lambda *a, d=day_ref: self._drill_into_day(d.id))

        return row

    def _back_to_routines(self, container):
        self._view = "routines"
        self._selected_routine_id = None
        self.build_content(container)

    def _move_day_up(self, day_id, days, container):
        idx = next((i for i, d in enumerate(days) if d.id == day_id), None)
        if idx is None or idx == 0:
            return
        ids = [d.id for d in days]
        ids[idx], ids[idx - 1] = ids[idx - 1], ids[idx]
        self.app.routine_service.reorder_days(self._selected_routine_id, ids)
        self.build_content(container)

    def _move_day_down(self, day_id, days, container):
        idx = next((i for i, d in enumerate(days) if d.id == day_id), None)
        if idx is None or idx >= len(days) - 1:
            return
        ids = [d.id for d in days]
        ids[idx], ids[idx + 1] = ids[idx + 1], ids[idx]
        self.app.routine_service.reorder_days(self._selected_routine_id, ids)
        self.build_content(container)

    def _confirm_delete_day(self, day, container):
        sheet = AppBottomSheet(title=f"Delete Day {day.label}?")
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text=f"Delete '{day.name}'? This will remove all exercises planned for this day.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_confirm(*a):
            self.app.routine_service.delete_day(day.id)
            sheet.dismiss()
            self.build_content(container)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Delete", on_confirm, destructive=True)
        sheet.open()

    def _open_add_day_sheet(self, container):
        """Bottom sheet to add a training day — label + name."""
        sheet = AppBottomSheet(title="Add Training Day")
        sheet.set_height(300)

        label_field = MDTextField()
        label_field.add_widget(MDTextFieldHintText(text="Label (e.g. A, B, 1, 2)"))
        sheet.add_content(label_field)

        name_field = MDTextField()
        name_field.add_widget(MDTextFieldHintText(text="Name (e.g. Push, Upper Body)"))
        sheet.add_content(name_field)

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
            label = label_field.text.strip()
            name = name_field.text.strip()
            if not label:
                error_label.text = "Label is required."
                return
            if not name:
                error_label.text = "Name is required."
                return
            try:
                self.app.routine_service.add_day(self._selected_routine_id, label, name)
                sheet.dismiss()
                self.build_content(container)
            except ValueError as e:
                error_label.text = str(e)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Add", on_save, style="filled")
        sheet.open()

    def _drill_into_day(self, day_id):
        self._selected_day_id = day_id
        self._view = "day_detail"
        self.build_content(self._content_area)

    # ── Level 3: Day detail (exercises + targets) ────────────────────────────

    def _build_day_detail(self, container):
        day = self.app.routine_service.get_day(self._selected_day_id)
        exercises_rde = self.app.routine_service.get_day_exercises(self._selected_day_id)

        # Sub-header: back + day label + name + add exercise button
        header = MDBoxLayout(
            size_hint_y=None,
            height=dp(52),
            padding=[dp(4), dp(4), dp(8), dp(4)],
            spacing=dp(4),
        )
        back_btn = MDIconButton(
            icon="arrow-left",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        back_btn.bind(on_release=lambda *a: self._back_to_days(container))
        header.add_widget(back_btn)

        day_label = MDLabel(
            text=f"Day {day.label} — {day.name}" if day else "Day",
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Title",
            role="medium",
            adaptive_height=True,
        )
        header.add_widget(day_label)

        header.add_widget(Widget())

        add_btn = MDButton(style="filled", size_hint_x=None)
        add_btn.add_widget(MDButtonText(text="+ Exercise"))
        add_btn.bind(on_release=lambda *a: self._open_exercise_picker(container))
        header.add_widget(add_btn)
        container.add_widget(header)

        if not exercises_rde:
            empty = MDBoxLayout(orientation="vertical", spacing=dp(16), padding=dp(32))
            empty.add_widget(Widget())
            empty.add_widget(MDLabel(
                text="No exercises yet. Add exercises to this day.",
                halign="center",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="large",
                adaptive_height=True,
            ))
            empty.add_widget(Widget())
            container.add_widget(empty)
            return

        scroll = MDScrollView()
        list_layout = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(1),
        )
        for rde in exercises_rde:
            try:
                exercise = self.app.exercise_service.get_exercise(rde.exercise_id)
            except Exception:
                exercise = None
            list_layout.add_widget(self._build_exercise_rde_row(rde, exercise, container))
        scroll.add_widget(list_layout)
        container.add_widget(scroll)

    def _build_exercise_rde_row(self, rde, exercise, container):
        """Row for an exercise in a day — name, scheme, targets summary, edit/remove buttons."""
        targets = self.app.routine_service.get_targets(rde.id)

        row = MDBoxLayout(
            size_hint_y=None,
            height=dp(72),
            padding=[dp(16), dp(4), dp(8), dp(4)],
            spacing=dp(8),
            md_bg_color=SURFACE,
        )

        # Info column
        info_col = MDBoxLayout(orientation="vertical", spacing=dp(2))
        ex_name = exercise.name if exercise else f"Exercise #{rde.exercise_id}"
        info_col.add_widget(MDLabel(
            text=ex_name,
            theme_text_color="Custom",
            text_color=TEXT_PRIMARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        ))

        scheme_text = rde.set_scheme.value.capitalize()
        if targets:
            target_summary = f"{len(targets)} sets · {_describe_target(targets[0])}"
            if rde.set_scheme == SetScheme.PROGRESSIVE and len(targets) > 1:
                target_summary = f"{len(targets)} sets (progressive)"
        else:
            target_summary = "No targets set"

        info_col.add_widget(MDLabel(
            text=f"{scheme_text} · {target_summary}",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="small",
            adaptive_height=True,
        ))
        row.add_widget(info_col)
        row.add_widget(Widget())

        # Edit targets button
        edit_btn = MDIconButton(
            icon="pencil-outline",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        rde_ref = rde
        ex_ref = exercise
        edit_btn.bind(on_release=lambda *a, r=rde_ref, e=ex_ref: self._open_target_editor(r, e, container))
        row.add_widget(edit_btn)

        # Remove exercise button
        del_btn = MDIconButton(
            icon="close",
            theme_icon_color="Custom",
            icon_color=TEXT_SECONDARY,
        )
        del_btn.bind(on_release=lambda *a, r=rde_ref: self._confirm_remove_exercise(r, container))
        row.add_widget(del_btn)

        return row

    def _back_to_days(self, container):
        self._view = "days"
        self._selected_day_id = None
        self.build_content(container)

    def _open_exercise_picker(self, container):
        from src.screens.components.exercise_picker import ExercisePickerSheet

        def on_select(exercise_id, exercise_name):
            self.app.routine_service.add_exercise_to_day(
                self._selected_day_id, exercise_id, SetScheme.UNIFORM
            )
            self.build_content(container)

        picker = ExercisePickerSheet(self.app, on_select=on_select, title="Add Exercise")
        picker.open()

    def _confirm_remove_exercise(self, rde, container):
        sheet = AppBottomSheet(title="Remove Exercise?")
        sheet.set_height(190)
        sheet.add_content(MDLabel(
            text="Remove this exercise from the day?",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_confirm(*a):
            self.app.routine_service.remove_exercise_from_day(rde.id)
            sheet.dismiss()
            self.build_content(container)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Remove", on_confirm, destructive=True)
        sheet.open()

    # ── Target editor bottom sheet ───────────────────────────────────────────

    def _open_target_editor(self, rde, exercise, container):
        """Bottom sheet that supports both uniform and progressive schemes."""
        ex_type = exercise.type if exercise else ExerciseType.REPS_WEIGHT

        # Determine initial scheme from the RDE
        current_scheme = rde.set_scheme if rde.set_scheme else SetScheme.UNIFORM
        scheme_state = {"value": current_scheme}

        # Load existing targets to pre-fill
        existing_targets = self.app.routine_service.get_targets(rde.id)

        sheet = AppBottomSheet(title=f"Targets: {exercise.name if exercise else 'Exercise'}")
        sheet.set_height(480)

        # ── Scheme toggle row ────────────────────────────────────────────────
        scheme_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))

        uniform_btn = MDButton(
            style="filled" if scheme_state["value"] == SetScheme.UNIFORM else "outlined",
            size_hint_x=None,
        )
        uniform_btn.add_widget(MDButtonText(text="Uniform"))

        progressive_btn = MDButton(
            style="filled" if scheme_state["value"] == SetScheme.PROGRESSIVE else "outlined",
            size_hint_x=None,
        )
        progressive_btn.add_widget(MDButtonText(text="Progressive"))
        scheme_row.add_widget(uniform_btn)
        scheme_row.add_widget(progressive_btn)
        sheet.add_content(scheme_row)

        # ── Dynamic content area (rebuilt on scheme toggle) ──────────────────
        # We use a container MDBoxLayout and a data dict to hold stepper references
        content_box = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(8),
        )
        sheet.add_content(content_box)

        # State dict shared across closures
        state = {
            "num_sets": 3,
            "uniform_reps": 8,
            "uniform_weight": 0.0,
            "uniform_duration": 60,
            "uniform_distance": 0.0,
            "progressive_rows": [],  # list of dicts: {reps, weight, duration, distance}
        }

        # Pre-fill from existing targets
        if existing_targets:
            first = existing_targets[0]
            state["num_sets"] = len(existing_targets)
            state["uniform_reps"] = first.target_reps_min or 8
            state["uniform_weight"] = first.target_weight or 0.0
            state["uniform_duration"] = first.target_duration_seconds or 60
            state["uniform_distance"] = first.target_distance or 0.0
            state["progressive_rows"] = [
                {
                    "reps": t.target_reps_min or 8,
                    "weight": t.target_weight or 0.0,
                    "duration": t.target_duration_seconds or 60,
                    "distance": t.target_distance or 0.0,
                }
                for t in existing_targets
            ]

        # If no progressive rows yet, seed with num_sets copies of uniform values
        if not state["progressive_rows"]:
            state["progressive_rows"] = [
                {"reps": state["uniform_reps"], "weight": state["uniform_weight"],
                 "duration": state["uniform_duration"], "distance": state["uniform_distance"]}
                for _ in range(state["num_sets"])
            ]

        def _rebuild_content():
            content_box.clear_widgets()
            # Update button styles
            uniform_btn.style = "filled" if scheme_state["value"] == SetScheme.UNIFORM else "outlined"
            progressive_btn.style = "filled" if scheme_state["value"] == SetScheme.PROGRESSIVE else "outlined"

            if scheme_state["value"] == SetScheme.UNIFORM:
                _build_uniform_content(content_box)
            else:
                _build_progressive_content(content_box)

        def _build_uniform_content(box):
            """Uniform: num_sets stepper + type-appropriate value steppers."""
            # Number of sets
            sets_row = MDBoxLayout(size_hint_y=None, height=dp(32), spacing=dp(8))
            sets_row.add_widget(MDLabel(
                text="Sets",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="medium",
                size_hint_x=None,
                width=dp(60),
                adaptive_height=True,
            ))
            sets_stepper = ValueStepper(value=state["num_sets"], step=1, min_val=1, max_val=20, label="sets")

            def on_sets_change(val):
                state["num_sets"] = int(val)

            sets_stepper.bind(on_value_change=lambda inst, v: on_sets_change(v))
            sets_row.add_widget(sets_stepper)
            box.add_widget(sets_row)

            # Type-specific steppers
            if ex_type == ExerciseType.REPS_WEIGHT:
                reps_stepper = ValueStepper(value=state["uniform_reps"], step=1, min_val=1, max_val=100, label="reps")
                reps_stepper.bind(on_value_change=lambda inst, v: state.update({"uniform_reps": int(v)}))
                box.add_widget(reps_stepper)

                weight_stepper = ValueStepper(value=state["uniform_weight"], step=2.5, min_val=0, max_val=999, label="kg/lbs", is_integer=False)
                weight_stepper.bind(on_value_change=lambda inst, v: state.update({"uniform_weight": v}))
                box.add_widget(weight_stepper)

            elif ex_type == ExerciseType.REPS_ONLY:
                reps_stepper = ValueStepper(value=state["uniform_reps"], step=1, min_val=1, max_val=100, label="reps")
                reps_stepper.bind(on_value_change=lambda inst, v: state.update({"uniform_reps": int(v)}))
                box.add_widget(reps_stepper)

            elif ex_type == ExerciseType.TIME:
                dur_stepper = ValueStepper(value=state["uniform_duration"], step=5, min_val=5, max_val=3600, label="sec")
                dur_stepper.bind(on_value_change=lambda inst, v: state.update({"uniform_duration": int(v)}))
                box.add_widget(dur_stepper)

            elif ex_type == ExerciseType.CARDIO:
                dur_stepper = ValueStepper(value=state["uniform_duration"], step=60, min_val=0, max_val=7200, label="sec")
                dur_stepper.bind(on_value_change=lambda inst, v: state.update({"uniform_duration": int(v)}))
                box.add_widget(dur_stepper)

                dist_stepper = ValueStepper(value=state["uniform_distance"], step=0.5, min_val=0, max_val=999, label="km", is_integer=False)
                dist_stepper.bind(on_value_change=lambda inst, v: state.update({"uniform_distance": v}))
                box.add_widget(dist_stepper)

        def _build_progressive_content(box):
            """Progressive: a scrollable list of per-set rows + add/remove set buttons."""
            scroll = MDScrollView(size_hint_y=None, height=dp(240))
            rows_layout = MDBoxLayout(orientation="vertical", adaptive_height=True, spacing=dp(4))

            def _add_set_row(idx, row_data):
                row_box = MDBoxLayout(
                    size_hint_y=None,
                    height=dp(56) if ex_type != ExerciseType.REPS_WEIGHT else dp(56),
                    spacing=dp(4),
                    padding=[0, 0, 0, 0],
                )
                row_box.add_widget(MDLabel(
                    text=f"S{idx + 1}",
                    theme_text_color="Custom",
                    text_color=TEXT_SECONDARY,
                    font_style="Body",
                    role="small",
                    size_hint_x=None,
                    width=dp(24),
                    adaptive_height=True,
                ))

                row_ref = row_data  # each row_data is a dict in state["progressive_rows"]

                if ex_type == ExerciseType.REPS_WEIGHT:
                    reps_s = ValueStepper(value=row_data["reps"], step=1, min_val=1, max_val=100, label="reps")
                    reps_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"reps": int(v)}))
                    row_box.add_widget(reps_s)

                    weight_s = ValueStepper(value=row_data["weight"], step=2.5, min_val=0, max_val=999, label="wt", is_integer=False)
                    weight_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"weight": v}))
                    row_box.add_widget(weight_s)

                elif ex_type == ExerciseType.REPS_ONLY:
                    reps_s = ValueStepper(value=row_data["reps"], step=1, min_val=1, max_val=100, label="reps")
                    reps_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"reps": int(v)}))
                    row_box.add_widget(reps_s)

                elif ex_type == ExerciseType.TIME:
                    dur_s = ValueStepper(value=row_data["duration"], step=5, min_val=5, max_val=3600, label="sec")
                    dur_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"duration": int(v)}))
                    row_box.add_widget(dur_s)

                elif ex_type == ExerciseType.CARDIO:
                    dur_s = ValueStepper(value=row_data["duration"], step=60, min_val=0, max_val=7200, label="sec")
                    dur_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"duration": int(v)}))
                    row_box.add_widget(dur_s)

                    dist_s = ValueStepper(value=row_data["distance"], step=0.5, min_val=0, max_val=999, label="km", is_integer=False)
                    dist_s.bind(on_value_change=lambda inst, v, r=row_ref: r.update({"distance": v}))
                    row_box.add_widget(dist_s)

                rows_layout.add_widget(row_box)

            for i, row_data in enumerate(state["progressive_rows"]):
                _add_set_row(i, row_data)

            scroll.add_widget(rows_layout)
            box.add_widget(scroll)

            # Add / remove set buttons
            control_row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
            add_set_btn = MDButton(style="outlined", size_hint_x=None)
            add_set_btn.add_widget(MDButtonText(text="+ Set"))

            def on_add_set(*a):
                last = state["progressive_rows"][-1] if state["progressive_rows"] else {
                    "reps": 8, "weight": 0.0, "duration": 60, "distance": 0.0
                }
                state["progressive_rows"].append(dict(last))
                _rebuild_content()

            add_set_btn.bind(on_release=on_add_set)
            control_row.add_widget(add_set_btn)

            rm_set_btn = MDButton(style="text", size_hint_x=None)
            rm_set_btn.add_widget(MDButtonText(
                text="- Set",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
            ))

            def on_remove_set(*a):
                if len(state["progressive_rows"]) > 1:
                    state["progressive_rows"].pop()
                    _rebuild_content()

            rm_set_btn.bind(on_release=on_remove_set)
            control_row.add_widget(rm_set_btn)
            control_row.add_widget(Widget())
            box.add_widget(control_row)

        def _on_uniform_toggle(*a):
            scheme_state["value"] = SetScheme.UNIFORM
            _rebuild_content()

        def _on_progressive_toggle(*a):
            scheme_state["value"] = SetScheme.PROGRESSIVE
            _rebuild_content()

        uniform_btn.bind(on_release=_on_uniform_toggle)
        progressive_btn.bind(on_release=_on_progressive_toggle)

        # Initial render
        _rebuild_content()

        # ── Action buttons ───────────────────────────────────────────────────
        def on_save(*a):
            new_scheme = scheme_state["value"]
            # Update scheme (authoritative per spec L164)
            self.app.routine_service.update_day_exercise_scheme(rde.id, new_scheme)

            set_kind = _DEFAULT_SET_KIND.get(ex_type, SetKind.REPS_WEIGHT)

            try:
                if new_scheme == SetScheme.UNIFORM:
                    kwargs = {"rde_id": rde.id, "num_sets": state["num_sets"], "set_kind": set_kind}
                    if ex_type == ExerciseType.REPS_WEIGHT:
                        kwargs["reps_min"] = state["uniform_reps"]
                        kwargs["reps_max"] = state["uniform_reps"]
                        kwargs["weight"] = state["uniform_weight"]
                    elif ex_type == ExerciseType.REPS_ONLY:
                        kwargs["reps_min"] = state["uniform_reps"]
                        kwargs["reps_max"] = state["uniform_reps"]
                    elif ex_type == ExerciseType.TIME:
                        kwargs["duration_seconds"] = state["uniform_duration"]
                    elif ex_type == ExerciseType.CARDIO:
                        kwargs["duration_seconds"] = state["uniform_duration"] or None
                        kwargs["distance"] = state["uniform_distance"] or None
                    self.app.routine_service.set_uniform_targets(**kwargs)
                else:
                    targets_data = []
                    for row_data in state["progressive_rows"]:
                        entry = {"set_kind": set_kind}
                        if ex_type == ExerciseType.REPS_WEIGHT:
                            entry["reps_min"] = row_data["reps"]
                            entry["reps_max"] = row_data["reps"]
                            entry["weight"] = row_data["weight"]
                        elif ex_type == ExerciseType.REPS_ONLY:
                            entry["reps_min"] = row_data["reps"]
                            entry["reps_max"] = row_data["reps"]
                        elif ex_type == ExerciseType.TIME:
                            entry["duration_seconds"] = row_data["duration"]
                        elif ex_type == ExerciseType.CARDIO:
                            entry["duration_seconds"] = row_data["duration"] or None
                            entry["distance"] = row_data["distance"] or None
                        targets_data.append(entry)
                    self.app.routine_service.set_progressive_targets(rde.id, targets_data)
            except ValueError:
                pass  # Validation failure silently ignores for now

            sheet.dismiss()
            self.build_content(container)

        def on_cancel(*a):
            sheet.dismiss()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Save", on_save, style="filled")
        sheet.open()
