"""Workout screen — pre-session day picker and active session with exercise cards.

Two states:
1. Pre-session: shows day info + Start button
2. Active session: exercise cards + bottom bar (add, end early, finish)

Edit/delete bottom sheet: tap a logged set chip to edit or delete it.
Confirmation sheets: End Early and Finish Workout require confirmation.
"""
import os
from kivy.lang import Builder
from kivy.properties import NumericProperty, ObjectProperty
from kivymd.uix.boxlayout import MDBoxLayout

from src.screens.base_screen import BaseScreen
from src.screens.components.exercise_card import ExerciseCard
from src.models.routine import SetKind

Builder.load_file(os.path.join(os.path.dirname(__file__), "workout_screen.kv"))


class WorkoutScreen(BaseScreen):

    current_session_id = NumericProperty(0)
    _expanded_card = ObjectProperty(None, allownone=True)

    def on_enter(self):
        """Check for in-progress session or show pre-session view."""
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

    def _show_pre_session(self):
        """Show day picker + start button."""
        self.ids.pre_session_view.opacity = 1
        self.ids.pre_session_view.size_hint_y = 1
        self.ids.active_session_view.opacity = 0
        self.ids.active_session_view.size_hint_y = 0

        routine = self.app.routine_service.get_active_routine()
        if not routine:
            self.ids.day_info_label.text = "No active routine"
            self.ids.start_session_btn.disabled = True
            self.ids.start_session_btn.opacity = 0.3
            return

        self.ids.start_session_btn.disabled = False
        self.ids.start_session_btn.opacity = 1

        current_day = self.app.cycle_service.get_current_day(routine.id)
        if current_day:
            self.ids.day_info_label.text = f"Day {current_day.label} — {current_day.name}"
            self._current_day_id = current_day.id
        else:
            self.ids.day_info_label.text = routine.name
            self._current_day_id = None

    def _show_active_session(self, session):
        """Show exercise cards and bottom bar."""
        self.ids.pre_session_view.opacity = 0
        self.ids.pre_session_view.size_hint_y = 0
        self.ids.active_session_view.opacity = 1
        self.ids.active_session_view.size_hint_y = 1

        if session.day_label_snapshot and session.day_name_snapshot:
            self.ids.header_label.text = f"Day {session.day_label_snapshot} — {session.day_name_snapshot}"
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

        session_exercises = self.app.workout_service.get_session_exercises(self.current_session_id)

        for se in session_exercises:
            exercise = self.app.exercise_service.get_exercise(se.exercise_id)
            if not exercise:
                continue

            # Get targets if linked to a plan exercise
            targets_data = []
            if se.routine_day_exercise_id:
                targets = self.app.routine_service.get_targets(se.routine_day_exercise_id)
                targets_data = [
                    {
                        "id": t.id,  # DB id for plan-vs-actual linking
                        "set_kind": t.set_kind.value,
                        "target_reps_min": t.target_reps_min,
                        "target_reps_max": t.target_reps_max,
                        "target_weight": t.target_weight,
                        "target_duration_seconds": t.target_duration_seconds,
                        "target_distance": t.target_distance,
                    }
                    for t in targets
                ]

            # Get logged sets
            logged = self.app.workout_service.get_logged_sets(se.id)
            logged_data = [
                {
                    "id": ls.id,
                    "set_kind": ls.set_kind.value,
                    "reps": ls.reps,
                    "weight": ls.weight,
                    "duration_seconds": ls.duration_seconds,
                    "distance": ls.distance,
                }
                for ls in logged
            ]

            # Determine set_scheme via public service method
            set_scheme = "uniform"
            if se.routine_day_exercise_id:
                rde = self.app.routine_service.get_day_exercise(se.routine_day_exercise_id)
                if rde:
                    set_scheme = rde.set_scheme.value

            card = ExerciseCard(
                session_exercise_id=se.id,
                exercise_id=se.exercise_id,
                exercise_name=se.exercise_name_snapshot,
                exercise_type=exercise.type.value,
                set_scheme=set_scheme,
                targets=targets_data,
                logged_sets=logged_data,
            )
            card.bind(on_set_logged=self._on_set_logged)
            card.bind(on_chip_tapped=self._on_chip_tapped)
            card.refresh_chips()

            # Bind card's on_toggle event for accordion behavior
            card.bind(on_toggle=lambda inst: self._on_card_toggle(inst))

            container.add_widget(card)

        # Auto-expand first card
        if container.children:
            first_card = container.children[-1]  # children are reversed
            self._expand_card(first_card)

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

    def _on_set_logged(self, card_instance, se_id, vals):
        """Handle set logged from exercise card."""
        exercise = self.app.exercise_service.get_exercise(card_instance.exercise_id)
        if not exercise:
            return

        # Determine set_kind: use target's kind if available, else derive from exercise type
        logged_count = len(card_instance.logged_sets)
        target_id = None

        if logged_count < len(card_instance.targets):
            target = card_instance.targets[logged_count]
            set_kind = SetKind(target.get("set_kind", exercise.type.value))
            # Link to plan target for plan-vs-actual
            target_id = target.get("id")
        else:
            # Ad-hoc / extra set — derive from exercise type
            type_to_kind = {
                "reps_weight": "reps_weight",
                "reps_only": "reps_only",
                "time": "duration",
                "cardio": "cardio",
            }
            set_kind = SetKind(type_to_kind.get(exercise.type.value, "reps_weight"))

        try:
            self.app.workout_service.log_set(
                session_exercise_id=se_id,
                set_kind=set_kind,
                exercise_set_target_id=target_id,
                reps=vals.get("reps"),
                weight=vals.get("weight"),
                duration_seconds=vals.get("duration_seconds"),
                distance=vals.get("distance"),
            )
        except ValueError as e:
            print(f"[Workout] Failed to log set: {e}")
            return

        # Refresh the card's data
        self._refresh_card(card_instance)

    def _refresh_card(self, card):
        """Refresh a single card's logged sets and chips."""
        logged = self.app.workout_service.get_logged_sets(card.session_exercise_id)
        card.logged_sets = [
            {
                "id": ls.id,
                "set_kind": ls.set_kind.value,
                "reps": ls.reps,
                "weight": ls.weight,
                "duration_seconds": ls.duration_seconds,
                "distance": ls.distance,
            }
            for ls in logged
        ]
        card.refresh_chips()
        if card.is_expanded:
            card._prefill_steppers()

    def _on_chip_tapped(self, card_instance, chip):
        """Open edit/delete bottom sheet for a logged set."""
        from src.screens.components.bottom_sheet import AppBottomSheet
        from src.screens.components.stepper import ValueStepper

        set_id = chip.set_id
        # Find the set data from the card's loaded list (no repo access needed)
        set_data = None
        for ls in card_instance.logged_sets:
            if ls.get("id") == set_id:
                set_data = ls
                break
        if not set_data:
            return

        sheet = AppBottomSheet(title="Edit Set")
        edit_steppers = {}

        if set_data.get("reps") is not None:
            s = ValueStepper(value=set_data["reps"], step=1, min_val=1, label="reps", is_integer=True)
            sheet.add_content(s)
            edit_steppers["reps"] = s
        if set_data.get("weight") is not None:
            s = ValueStepper(value=set_data["weight"], step=5, min_val=0, label="lbs", is_integer=False)
            sheet.add_content(s)
            edit_steppers["weight"] = s
        if set_data.get("duration_seconds") is not None:
            s = ValueStepper(value=set_data["duration_seconds"], step=5, min_val=1, label="sec", is_integer=True)
            sheet.add_content(s)
            edit_steppers["duration_seconds"] = s
        if set_data.get("distance") is not None:
            s = ValueStepper(value=set_data["distance"], step=0.1, min_val=0, label="km", is_integer=False)
            sheet.add_content(s)
            edit_steppers["distance"] = s

        def on_save(*args):
            vals = {}
            if "reps" in edit_steppers:
                vals["reps"] = int(edit_steppers["reps"].value)
            if "weight" in edit_steppers:
                vals["weight"] = edit_steppers["weight"].value
            if "duration_seconds" in edit_steppers:
                vals["duration_seconds"] = int(edit_steppers["duration_seconds"].value)
            if "distance" in edit_steppers:
                vals["distance"] = edit_steppers["distance"].value
            try:
                self.app.workout_service.update_set(set_id, **vals)
            except ValueError as e:
                print(f"[Workout] Failed to update: {e}")
            sheet.dismiss()
            self._refresh_card(card_instance)

        def on_delete(*args):
            self.app.workout_service.delete_set(set_id)
            sheet.dismiss()
            self._refresh_card(card_instance)

        def on_cancel(*args):
            sheet.dismiss()

        sheet.add_action("Delete", on_delete, destructive=True)
        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("Save", on_save, style="filled")
        sheet.open()

    # --- Session actions ---

    def start_session(self):
        """Start a new workout session for the current cycle day."""
        if not hasattr(self, "_current_day_id") or not self._current_day_id:
            return

        try:
            session = self.app.workout_service.start_routine_session_with_exercises(
                self._current_day_id
            )
        except ValueError as e:
            print(f"[Workout] Failed to start session: {e}")
            return

        self.current_session_id = session.id
        self._show_active_session(session)

    def add_exercise(self):
        """Open exercise picker to add an ad-hoc exercise.

        TODO: Phase 3C will implement an exercise picker dialog.
        For now, just print a placeholder message.
        """
        print("[Workout] Add exercise — picker not yet implemented")

    def end_early(self):
        """Confirm before ending session early."""
        if not self.current_session_id:
            return
        self._show_confirmation(
            title="End workout early?",
            description="Your session will be saved. Cycle advances only if you logged at least one set.",
            confirm_text="End Early",
            is_destructive=True,
            on_confirm=self._do_end_early,
        )

    def finish_workout(self):
        """Confirm before finishing workout."""
        if not self.current_session_id:
            return
        self._show_confirmation(
            title="Finish workout?",
            description="Your session will be saved and the cycle will advance to the next day.",
            confirm_text="Finish",
            is_destructive=False,
            on_confirm=self._do_finish,
        )

    def _do_end_early(self):
        self.app.workout_service.end_early(self.current_session_id)
        self.current_session_id = 0
        self._show_pre_session()

    def _do_finish(self):
        self.app.workout_service.finish_session(self.current_session_id)
        self.current_session_id = 0
        self._show_pre_session()

    def _show_confirmation(self, title, description, confirm_text, is_destructive, on_confirm):
        """Show a confirmation bottom sheet per spec L874-879."""
        from src.screens.components.bottom_sheet import AppBottomSheet
        from kivymd.uix.label import MDLabel
        from src.theme import TEXT_SECONDARY

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
        sheet.add_action(confirm_text, on_ok, style="filled", destructive=is_destructive)
        sheet.open()
