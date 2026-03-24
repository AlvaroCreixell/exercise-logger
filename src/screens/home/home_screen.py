"""Home screen — current routine, start button, session recovery, benchmark alerts."""
import os
from kivy.lang import Builder
from kivy.metrics import dp
from kivymd.uix.label import MDLabel

from src.screens.base_screen import BaseScreen
from src.theme import SECONDARY

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
        self._update_benchmark_alerts()

    def _update_routine_info(self):
        routine = self.app.routine_service.get_active_routine()
        if not routine:
            self.ids.routine_name_label.text = "No routine set up"
            self.ids.current_day_label.text = ""
            self.ids.start_button.disabled = True
            self.ids.start_button.opacity = 0.3
            self.ids.empty_state_button.opacity = 1
            self.ids.empty_state_button.disabled = False
            return

        self.ids.empty_state_button.opacity = 0
        self.ids.empty_state_button.disabled = True
        self.ids.start_button.disabled = False
        self.ids.start_button.opacity = 1
        self.ids.routine_name_label.text = routine.name

        current_day = self.app.cycle_service.get_current_day(routine.id)
        if current_day:
            self.ids.current_day_label.text = f"Day {current_day.label} — {current_day.name}"
        else:
            self.ids.current_day_label.text = ""

    def _update_last_workout(self):
        summary = self.app.stats_service.get_last_workout_summary()
        if not summary:
            self.ids.last_workout_label.text = ""
            return
        parts = []
        if summary["started_at"]:
            parts.append(summary["started_at"][:10])
        if summary["day_label"] and summary["day_name"]:
            parts.append(f"Day {summary['day_label']} {summary['day_name']}")
        if summary["duration_minutes"] is not None:
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

    def _update_benchmark_alerts(self):
        container = self.ids.benchmark_alerts
        container.clear_widgets()
        due = self.app.benchmark_service.get_due_benchmarks()
        for defn in due[:3]:
            exercise = self.app.exercise_service.get_exercise(defn.exercise_id)
            if not exercise:
                continue
            container.add_widget(MDLabel(
                text=f"Benchmark due: {exercise.name} ({defn.method.value.replace('_', ' ')})",
                theme_text_color="Custom",
                text_color=SECONDARY,
                font_style="Body",
                role="small",
                halign="center",
                adaptive_height=True,
            ))

    def start_workout(self):
        self.app.go_tab("workout")

    def resume_session(self):
        self.app.go_tab("workout")

    def end_session(self):
        # TODO: Phase 3B — replace with confirmation bottom sheet per spec L876.
        # Direct end_early() is an intentional temporary deviation for 3A scaffolding.
        if self._in_progress_session_id:
            self.app.workout_service.end_early(self._in_progress_session_id)
            self._refresh()

    def go_to_manage(self):
        self.app.go_tab("manage")
