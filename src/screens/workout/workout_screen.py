"""Workout screen — pre-session preview and active session with exercise cards."""
import os
from kivy.lang import Builder
from kivy.metrics import dp
from kivy.properties import NumericProperty, ObjectProperty
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel

from src.screens.base_screen import BaseScreen
from src.screens.components.exercise_card import ExerciseCard
from src.theme import PRIMARY, TEXT_PRIMARY, TEXT_SECONDARY
from src.screens.components.toast import show_error_toast

Builder.load_file(os.path.join(os.path.dirname(__file__), "workout_screen.kv"))


class WorkoutScreen(BaseScreen):
    current_session_id = NumericProperty(0)
    _expanded_card = ObjectProperty(None, allownone=True)

    def on_enter(self):
        self._refresh_state()

    def _refresh_state(self):
        if not self.app:
            return
        session = self.app.workout_service.get_in_progress_session()
        if session:
            self.current_session_id = session.id
            self._show_active_session(session)
        else:
            self.current_session_id = 0
            self._show_pre_session()

    # ------------------------------------------------------------------
    # Pre-session state
    # ------------------------------------------------------------------

    def _show_pre_session(self):
        """Show day preview + start button."""
        self.ids.pre_session_view.opacity = 1
        self.ids.pre_session_view.size_hint_y = 1
        self.ids.active_session_view.opacity = 0
        self.ids.active_session_view.size_hint_y = 0
        self.ids.header_label.text = "Workout"

        routine = self.app.app_state_service.get_active_routine()
        if not routine:
            self.ids.day_info_label.text = "No active routine"
            self.ids.start_session_btn.disabled = True
            self.ids.start_session_btn.opacity = 0.3
            self.ids.preview_container.clear_widgets()
            return

        self.ids.start_session_btn.disabled = False
        self.ids.start_session_btn.opacity = 1

        day = self.app.app_state_service.get_current_day()
        if day:
            self.ids.day_info_label.text = f"Day {day.label} — {day.name}"
        else:
            self.ids.day_info_label.text = routine.name

        # Populate exercise preview rows
        container = self.ids.preview_container
        container.clear_widgets()

        if day:
            for de in day.exercises:
                exercise = self.app.exercise_registry.get(de.exercise_key)
                name = exercise.name if exercise else de.exercise_key
                target_summary = self._build_target_summary(de)
                row_text = f"{name} — {target_summary}"
                label = MDLabel(
                    text=row_text,
                    theme_text_color="Custom",
                    text_color=TEXT_PRIMARY,
                    font_style="Body",
                    role="medium",
                    adaptive_height=True,
                )
                container.add_widget(label)

    def _build_target_summary(self, de) -> str:
        """Build a human-readable target summary for a DayExercise."""
        from src.models.enums import ExerciseType
        exercise = self.app.exercise_registry.get(de.exercise_key)
        if exercise is None:
            return f"{de.sets} sets"

        ex_type = exercise.type
        if hasattr(ex_type, "value"):
            ex_type = ex_type.value

        sets = de.sets

        if ex_type == "reps_weight":
            if de.reps_min is not None:
                reps_min = de.reps_min
                reps_max = de.reps_max if de.reps_max is not None else reps_min
                if reps_min == reps_max:
                    return f"{sets} x {reps_min}"
                else:
                    return f"{sets} x {reps_min}-{reps_max}"
            else:
                return f"{sets} sets — open"

        elif ex_type == "time":
            if de.duration_seconds is not None:
                return f"{sets} x {de.duration_seconds}s"
            return f"{sets} sets"

        elif ex_type == "cardio":
            parts = []
            if de.duration_seconds is not None:
                parts.append(f"{de.duration_seconds}s")
            if de.distance_km is not None:
                parts.append(f"{de.distance_km}km")
            if parts:
                return f"{sets} x {' / '.join(parts)}"
            return f"{sets} sets"

        return f"{sets} sets"

    # ------------------------------------------------------------------
    # Start session
    # ------------------------------------------------------------------

    def start_session(self):
        try:
            session = self.app.workout_service.start_session()
        except ValueError as e:
            show_error_toast(str(e))
            return
        self.current_session_id = session.id
        self._show_active_session(session)

    # ------------------------------------------------------------------
    # Active session state
    # ------------------------------------------------------------------

    def _show_active_session(self, session):
        """Hide pre-session view and show exercise cards."""
        self.ids.pre_session_view.opacity = 0
        self.ids.pre_session_view.size_hint_y = 0
        self.ids.active_session_view.opacity = 1
        self.ids.active_session_view.size_hint_y = 1

        if session.day_label_snapshot and session.day_name_snapshot:
            self.ids.header_label.text = (
                f"Day {session.day_label_snapshot} — {session.day_name_snapshot}"
            )
        else:
            self.ids.header_label.text = "Workout"

        self._rebuild_cards()

    def _rebuild_cards(self):
        """Rebuild exercise cards from session data."""
        container = self.ids.card_container
        container.clear_widgets()
        self._expanded_card = None

        if not self.current_session_id:
            return

        session_exercises = self.app.workout_service.get_session_exercises(
            self.current_session_id
        )

        for se in session_exercises:
            logged = self.app.workout_service.get_logged_sets(se.id)
            logged_data = [
                {
                    "id": ls.id,
                    "reps": ls.reps,
                    "weight": ls.weight,
                    "duration_seconds": ls.duration_seconds,
                    "distance_km": ls.distance_km,
                    "set_number": ls.set_number,
                    "logged_at": ls.logged_at,
                }
                for ls in logged
            ]

            last_session_vals = (
                self.app.stats_service.get_last_set_for_exercise(
                    se.exercise_key_snapshot
                )
                or {}
            )

            # Normalize enum values to strings
            ex_type = se.exercise_type_snapshot
            if hasattr(ex_type, "value"):
                ex_type = ex_type.value

            scheme = se.scheme_snapshot
            if hasattr(scheme, "value"):
                scheme = scheme.value

            card = ExerciseCard(
                session_exercise_id=se.id,
                exercise_name=se.exercise_name_snapshot,
                exercise_type=ex_type,
                scheme=scheme or "uniform",
                planned_sets=se.planned_sets or 0,
                target_reps_min=se.target_reps_min or 0,
                target_reps_max=se.target_reps_max or 0,
                target_duration_seconds=se.target_duration_seconds or 0,
                target_distance_km=se.target_distance_km or 0,
                plan_notes=se.plan_notes_snapshot or "",
                logged_sets=logged_data,
                last_session_values=last_session_vals,
            )

            card.bind(on_set_logged=self._on_set_logged)
            card.bind(on_chip_tapped=self._on_chip_tapped)
            card.bind(on_toggle=lambda inst: self._on_card_toggle(inst))
            card.refresh_chips()

            container.add_widget(card)

        # Auto-expand first card (children list is reversed in Kivy)
        if container.children:
            first_card = container.children[-1]
            self._expand_card(first_card)

        self._update_cancel_end_button()

    def _expand_card(self, card):
        """Expand a card and collapse the previously expanded one."""
        if self._expanded_card and self._expanded_card != card:
            self._expanded_card.is_expanded = False
        card.is_expanded = True
        self._expanded_card = card

    def _on_card_toggle(self, card):
        """Handle card header tap for accordion."""
        if card.is_expanded:
            card.is_expanded = False
            self._expanded_card = None
        else:
            self._expand_card(card)

    # ------------------------------------------------------------------
    # Set logging
    # ------------------------------------------------------------------

    def _on_set_logged(self, card, se_id, vals):
        try:
            self.app.workout_service.log_set(
                session_exercise_id=se_id,
                reps=vals.get("reps"),
                weight=vals.get("weight"),
                duration_seconds=vals.get("duration_seconds"),
                distance_km=vals.get("distance_km"),
            )
        except ValueError as e:
            show_error_toast(str(e))
            return
        self._refresh_card(card)
        self._update_cancel_end_button()

    def _refresh_card(self, card):
        """Refresh a single card's logged sets and chips."""
        logged = self.app.workout_service.get_logged_sets(card.session_exercise_id)
        card.logged_sets = [
            {
                "id": ls.id,
                "reps": ls.reps,
                "weight": ls.weight,
                "duration_seconds": ls.duration_seconds,
                "distance_km": ls.distance_km,
                "set_number": ls.set_number,
                "logged_at": ls.logged_at,
            }
            for ls in logged
        ]
        card.refresh_chips()
        if card.is_expanded:
            card._prefill_steppers()

    # ------------------------------------------------------------------
    # Chip tap — edit/delete bottom sheet
    # ------------------------------------------------------------------

    def _on_chip_tapped(self, card_instance, chip):
        """Open edit/delete bottom sheet for a logged set."""
        from src.screens.components.bottom_sheet import AppBottomSheet
        from src.screens.components.stepper import ValueStepper

        set_id = chip.set_id
        set_data = None
        for ls in card_instance.logged_sets:
            if ls.get("id") == set_id:
                set_data = ls
                break
        if not set_data:
            return

        sheet = AppBottomSheet(title="Edit Set")
        edit_steppers = {}
        ex_type = card_instance.exercise_type

        if ex_type == "reps_weight":
            s = ValueStepper(
                value=set_data.get("reps") or 1,
                step=1, min_val=1, label="reps", is_integer=True,
            )
            sheet.add_content(s)
            edit_steppers["reps"] = s

            weight_label = "lbs"
            try:
                if self.app and hasattr(self.app, "settings_service"):
                    weight_label = self.app.settings_service.get_weight_unit()
            except (AttributeError, TypeError):
                pass

            s = ValueStepper(
                value=set_data.get("weight") or 0,
                step=5, min_val=0, label=weight_label, is_integer=False,
            )
            sheet.add_content(s)
            edit_steppers["weight"] = s

        elif ex_type == "time":
            s = ValueStepper(
                value=set_data.get("duration_seconds") or 1,
                step=5, min_val=1, label="sec", is_integer=True,
            )
            sheet.add_content(s)
            edit_steppers["duration_seconds"] = s

        elif ex_type == "cardio":
            s = ValueStepper(
                value=set_data.get("duration_seconds") or 0,
                step=30, min_val=0, label="sec", is_integer=True,
            )
            sheet.add_content(s)
            edit_steppers["duration_seconds"] = s

            s = ValueStepper(
                value=set_data.get("distance_km") or 0,
                step=0.1, min_val=0, label="km", is_integer=False,
            )
            sheet.add_content(s)
            edit_steppers["distance_km"] = s

        def on_save(*args):
            vals = {}
            if "reps" in edit_steppers:
                vals["reps"] = int(edit_steppers["reps"].value)
            if "weight" in edit_steppers:
                vals["weight"] = edit_steppers["weight"].value
            if "duration_seconds" in edit_steppers:
                vals["duration_seconds"] = int(edit_steppers["duration_seconds"].value)
            if "distance_km" in edit_steppers:
                vals["distance_km"] = edit_steppers["distance_km"].value
            try:
                self.app.workout_service.edit_set(set_id, **vals)
            except ValueError as e:
                show_error_toast(str(e))
            sheet.dismiss()
            self._refresh_card(card_instance)
            self._update_cancel_end_button()

        def on_delete(*args):
            self.app.workout_service.delete_set(set_id)
            sheet.dismiss()
            self._refresh_card(card_instance)
            self._update_cancel_end_button()

        def on_cancel(*args):
            sheet.dismiss()

        sheet.add_action("Delete", on_delete, destructive=True)
        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Save", on_save, style="filled")
        sheet.open()

    # ------------------------------------------------------------------
    # Cancel / End Early button
    # ------------------------------------------------------------------

    def _update_cancel_end_button(self):
        """Show 'Cancel' if no sets logged, 'End Early' if sets exist."""
        total = sum(len(c.logged_sets) for c in self.ids.card_container.children)
        self.ids.cancel_end_btn_text.text = "End Early" if total > 0 else "Cancel"

    # ------------------------------------------------------------------
    # Session end actions
    # ------------------------------------------------------------------

    def finish_workout(self):
        """Confirm then finish the workout (cycle advances)."""
        if not self.current_session_id:
            return
        self._show_confirmation(
            title="Finish workout?",
            description="Your session will be saved and the cycle will advance to the next day.",
            confirm_text="Finish",
            is_destructive=False,
            on_confirm=self._do_finish,
        )

    def cancel_or_end_early(self):
        """Dynamically cancel (zero sets) or end early (sets logged)."""
        if not self.current_session_id:
            return
        total = sum(len(c.logged_sets) for c in self.ids.card_container.children)
        if total == 0:
            self._show_confirmation(
                title="Cancel workout?",
                description="Empty session deleted. Cycle unchanged.",
                confirm_text="Cancel Workout",
                is_destructive=True,
                on_confirm=self._do_cancel,
            )
        else:
            self._show_confirmation(
                title="End workout early?",
                description="Session saved. Cycle advances.",
                confirm_text="End Early",
                is_destructive=True,
                on_confirm=self._do_end_early,
            )

    def _do_finish(self):
        try:
            self.app.workout_service.finish_session(self.current_session_id)
        except ValueError as e:
            show_error_toast(str(e))
            return
        self.current_session_id = 0
        self._show_pre_session()

    def _do_end_early(self):
        try:
            self.app.workout_service.end_early(self.current_session_id)
        except ValueError as e:
            show_error_toast(str(e))
            return
        self.current_session_id = 0
        self._show_pre_session()

    def _do_cancel(self):
        try:
            self.app.workout_service.cancel_session(self.current_session_id)
        except ValueError as e:
            show_error_toast(str(e))
            return
        self.current_session_id = 0
        self._show_pre_session()

    def _show_confirmation(self, title, description, confirm_text, is_destructive, on_confirm):
        """Show a confirmation bottom sheet."""
        from src.screens.components.bottom_sheet import AppBottomSheet

        sheet = AppBottomSheet(title=title)
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text=description,
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_cancel(*args):
            sheet.dismiss()

        def on_ok(*args):
            sheet.dismiss()
            on_confirm()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        if is_destructive:
            sheet.add_action(confirm_text, on_ok, destructive=True)
        else:
            sheet.add_action(confirm_text, on_ok, style="filled")
        sheet.open()

    # ------------------------------------------------------------------
    # Ad-hoc exercise add
    # ------------------------------------------------------------------

    def add_exercise(self):
        from src.screens.components.exercise_picker import ExercisePickerSheet

        def on_select(exercise_key, exercise_name):
            self.app.workout_service.add_ad_hoc_exercise(
                self.current_session_id, exercise_key
            )
            self._rebuild_cards()

        picker = ExercisePickerSheet(self.app, on_select=on_select, title="Add Exercise")
        picker.open()
