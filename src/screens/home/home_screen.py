"""Home screen — current routine, start button, session recovery, benchmark alerts."""
import os
from kivy.lang import Builder
from kivy.metrics import dp
from kivymd.uix.label import MDLabel

from src.screens.base_screen import BaseScreen
from src.screens.components.bottom_sheet import AppBottomSheet
from src.theme import SECONDARY, WARNING, TEXT_SECONDARY

Builder.load_file(os.path.join(os.path.dirname(__file__), "home_screen.kv"))


class HomeScreen(BaseScreen):
    _in_progress_session_id = None

    def on_enter(self):
        self._refresh()

    def _refresh(self):
        if not self.app:
            return
        self._update_routine_info()
        self._update_last_workout()
        self._update_session_banner()
        self._update_benchmark_alert()

    # ------------------------------------------------------------------
    # Refresh helpers
    # ------------------------------------------------------------------

    def _update_routine_info(self):
        routine = self.app.app_state_service.get_active_routine()
        container = self.ids.empty_state_container
        container.clear_widgets()

        if not routine:
            self.ids.routine_name_label.text = "No routine selected"
            self.ids.current_day_label.text = ""
            self.ids.start_button.disabled = True
            self.ids.start_button.opacity = 0.3
            container.add_widget(MDLabel(
                text="Select a routine in Settings",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Body",
                role="medium",
                halign="center",
                adaptive_height=True,
            ))
            return

        self.ids.routine_name_label.text = routine.name
        self.ids.start_button.disabled = False
        self.ids.start_button.opacity = 1.0

        day = self.app.app_state_service.get_current_day()
        if day:
            self.ids.current_day_label.text = f"Day {day.label} — {day.name}"
        else:
            self.ids.current_day_label.text = ""

    def _update_last_workout(self):
        summary = self.app.stats_service.get_last_workout_summary()
        if not summary:
            self.ids.last_workout_label.text = ""
            return
        parts = []
        if summary.get("started_at"):
            parts.append(summary["started_at"][:10])
        if summary.get("day_label") and summary.get("day_name"):
            parts.append(f"Day {summary['day_label']} {summary['day_name']}")
        if summary.get("duration_minutes") is not None:
            parts.append(f"{summary['duration_minutes']} min")
        self.ids.last_workout_label.text = " — ".join(parts)

    def _update_session_banner(self):
        session = self.app.workout_service.get_in_progress_session()
        banner = self.ids.session_banner
        if session:
            banner.opacity = 1
            banner.height = dp(56)
            self._in_progress_session_id = session.id
        else:
            banner.opacity = 0
            banner.height = 0
            self._in_progress_session_id = None

    def _update_benchmark_alert(self):
        summary = self.app.stats_service.get_benchmark_due_summary()
        card = self.ids.benchmark_alert_card
        due_count = summary.get("due_count", 0)
        if due_count > 0:
            card.opacity = 1
            card.height = dp(56)
            self.ids.benchmark_alert_label.text = f"Benchmarks due ({due_count})"
        else:
            card.opacity = 0
            card.height = 0

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------

    def open_settings(self):
        from src.screens.home.settings_sheet import SettingsSheet
        sheet = SettingsSheet(self.app)
        sheet.on_dismiss = self._refresh
        sheet.open()

    def start_workout(self):
        self.app.go_tab("workout")

    def resume_session(self):
        self.app.go_tab("workout")

    def end_session(self):
        """End in-progress session with confirmation bottom sheet."""
        if not self._in_progress_session_id:
            return

        session_id = self._in_progress_session_id

        sheet = AppBottomSheet(title="End workout early?")
        sheet.set_height(200)
        sheet.add_content(MDLabel(
            text="Your session will be saved. Cycle advances only if you logged at least one set.",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="medium",
            adaptive_height=True,
        ))

        def on_cancel(*a):
            sheet.dismiss()

        def on_confirm(*a):
            sheet.dismiss()
            self.app.workout_service.end_early(session_id)
            self._refresh()

        sheet.add_spacer()
        sheet.add_action("Cancel", on_cancel)
        sheet.add_action("End Early", on_confirm, destructive=True)
        sheet.open()

    def start_benchmark_flow(self):
        """Open benchmark entry sheet: bodyweight + per-item result rows."""
        summary = self.app.stats_service.get_benchmark_due_summary()
        due_items = summary.get("due_items", [])
        if not due_items:
            return

        unit = self.app.settings_service.get_weight_unit()

        # Shared mutable state for bodyweight stepper value
        bw_state = {"value": 0.0}

        sheet = AppBottomSheet(title="Benchmarks")
        sheet.set_height(500)

        # Bodyweight row
        bw_label = MDLabel(
            text=f"Bodyweight ({unit}): 0",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        )
        sheet.add_content(bw_label)

        # Bodyweight stepper (-, value, +)
        from kivymd.uix.boxlayout import MDBoxLayout
        from kivymd.uix.button import MDButton, MDButtonText

        def make_bw_stepper():
            row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
            btn_minus = MDButton(style="outlined")
            btn_minus.add_widget(MDButtonText(text="-"))
            btn_plus = MDButton(style="outlined")
            btn_plus.add_widget(MDButtonText(text="+"))

            def dec(*a):
                bw_state["value"] = max(0.0, round(bw_state["value"] - 0.5, 1))
                bw_label.text = f"Bodyweight ({unit}): {bw_state['value']}"

            def inc(*a):
                bw_state["value"] = round(bw_state["value"] + 0.5, 1)
                bw_label.text = f"Bodyweight ({unit}): {bw_state['value']}"

            btn_minus.bind(on_release=dec)
            btn_plus.bind(on_release=inc)
            row.add_widget(btn_minus)
            row.add_widget(btn_plus)
            return row

        sheet.add_content(make_bw_stepper())

        # Per-item rows
        from kivy.uix.behaviors import ButtonBehavior
        from kivy.uix.widget import Widget as KivyWidget

        for item in due_items:
            exercise_key = item["exercise_key"]
            exercise_name = item["exercise_name"]
            method = item["method"]

            method_labels = {
                "max_weight": "Max Weight",
                "max_reps": "Max Reps",
                "timed_hold": "Timed Hold",
            }
            label_text = method_labels.get(method, method.replace("_", " ").title())

            row_btn = MDButton(style="text", size_hint_x=1)
            row_btn.add_widget(MDButtonText(
                text=f"{exercise_name}  ·  {label_text}",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
            ))

            def make_entry_handler(ex_key, ex_name, meth, meth_label):
                def open_entry(*a):
                    self._open_benchmark_entry(
                        ex_key, ex_name, meth, meth_label,
                        bw_state, sheet, unit,
                    )
                return open_entry

            row_btn.bind(on_release=make_entry_handler(
                exercise_key, exercise_name, method, label_text
            ))
            sheet.add_content(row_btn)

        sheet.open()

    def _open_benchmark_entry(
        self, exercise_key, exercise_name, method, method_label,
        bw_state, parent_sheet, unit,
    ):
        """Second-level sheet for entering a single benchmark result."""
        from kivymd.uix.boxlayout import MDBoxLayout
        from kivymd.uix.button import MDButton, MDButtonText
        from kivymd.uix.label import MDLabel as MDLbl

        # Determine stepper label and initial value based on method
        if method == "max_weight":
            value_label_text = f"Weight ({unit})"
            step = 2.5
        elif method == "max_reps":
            value_label_text = "Reps"
            step = 1.0
        else:  # timed_hold
            value_label_text = "Duration (seconds)"
            step = 5.0

        result_state = {"value": 0.0}

        entry_sheet = AppBottomSheet(title=exercise_name)
        entry_sheet.set_height(300)

        entry_sheet.add_content(MDLbl(
            text=method_label,
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Label",
            role="large",
            adaptive_height=True,
        ))

        val_label = MDLbl(
            text=f"{value_label_text}: 0",
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Body",
            role="large",
            adaptive_height=True,
        )
        entry_sheet.add_content(val_label)

        row = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(8))
        btn_minus = MDButton(style="outlined")
        btn_minus.add_widget(MDButtonText(text="-"))
        btn_plus = MDButton(style="outlined")
        btn_plus.add_widget(MDButtonText(text="+"))

        def dec(*a):
            result_state["value"] = max(0.0, round(result_state["value"] - step, 2))
            val_label.text = f"{value_label_text}: {result_state['value']}"

        def inc(*a):
            result_state["value"] = round(result_state["value"] + step, 2)
            val_label.text = f"{value_label_text}: {result_state['value']}"

        btn_minus.bind(on_release=dec)
        btn_plus.bind(on_release=inc)
        row.add_widget(btn_minus)
        row.add_widget(btn_plus)
        entry_sheet.add_content(row)

        def on_cancel(*a):
            entry_sheet.dismiss()

        def on_confirm(*a):
            val = result_state["value"]
            if val <= 0:
                return
            bw = bw_state["value"] if bw_state["value"] > 0 else None
            try:
                self.app.benchmark_service.record_result(
                    exercise_key, method, val, bw
                )
            except ValueError:
                pass
            entry_sheet.dismiss()
            parent_sheet.dismiss()
            self._refresh()

        entry_sheet.add_spacer()
        entry_sheet.add_action("Cancel", on_cancel)
        entry_sheet.add_action("Save", on_confirm, style="filled")
        entry_sheet.open()
