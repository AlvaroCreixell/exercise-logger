"""Exercise detail screen — weight/volume charts, personal best, plan-vs-actual.

Drill-in from dashboard overview. Back arrow returns to overview.
"""
from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDIconButton
from kivymd.uix.label import MDLabel
from kivymd.uix.screen import MDScreen
from kivymd.uix.scrollview import MDScrollView

from src.screens.components.chart_widget import ChartWidget
from src.theme import BACKGROUND, SURFACE, TEXT_PRIMARY, TEXT_SECONDARY, PRIMARY, DIVIDER


class ExerciseDetailScreen(MDScreen):
    """Exercise detail — charts, personal best, plan-vs-actual comparison."""

    def __init__(self, exercise_id: int, exercise_name: str, **kwargs):
        super().__init__(**kwargs)
        self.exercise_id = exercise_id
        self.exercise_name = exercise_name
        self.md_bg_color = BACKGROUND

    @property
    def app(self):
        from kivymd.app import MDApp
        return MDApp.get_running_app()

    def on_enter(self):
        self._build()

    def _build(self):
        self.clear_widgets()
        exercise = self.app.exercise_service.get_exercise(self.exercise_id)
        ex_type = exercise.type if exercise else None
        from src.models.exercise import ExerciseType
        layout = MDBoxLayout(orientation="vertical", md_bg_color=BACKGROUND)

        # --- Header ---
        header = MDBoxLayout(
            size_hint_y=None, height=dp(56),
            padding=[dp(8), 0, dp(16), 0], spacing=dp(8),
        )
        back_btn = MDIconButton(
            icon="arrow-left",
            theme_icon_color="Custom", icon_color=TEXT_SECONDARY,
        )
        back_btn.bind(on_release=lambda *a: self._go_back())
        header.add_widget(back_btn)
        header.add_widget(MDLabel(
            text=self.exercise_name,
            theme_text_color="Custom", text_color=TEXT_PRIMARY,
            font_style="Headline", role="small",
        ))
        layout.add_widget(header)

        # --- Scrollable content ---
        scroll = MDScrollView()
        content = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            padding=[dp(16), 0, dp(16), dp(16)],
            spacing=dp(16),
        )

        history = self.app.stats_service.get_exercise_history(self.exercise_id)

        if not history:
            content.add_widget(Widget(size_hint_y=None, height=dp(48)))
            content.add_widget(MDLabel(
                text="No data yet", halign="center",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Body", role="large", adaptive_height=True,
            ))
            scroll.add_widget(content)
            layout.add_widget(scroll)
            self.add_widget(layout)
            return

        dates = [d["session_date"] for d in history]

        if ex_type == ExerciseType.REPS_WEIGHT:
            content.add_widget(self._section_label("Weight Over Time"))
            c1 = ChartWidget()
            c1.plot_line(dates, [d.get("max_weight", 0) for d in history], ylabel="kg/lbs")
            content.add_widget(c1)
            content.add_widget(self._section_label("Volume Over Time"))
            c2 = ChartWidget()
            c2.plot_bar(dates, [d.get("total_volume", 0) for d in history], ylabel="Volume")
            content.add_widget(c2)
        elif ex_type == ExerciseType.REPS_ONLY:
            content.add_widget(self._section_label("Max Reps Over Time"))
            c1 = ChartWidget()
            c1.plot_line(dates, [d.get("max_reps", 0) for d in history], ylabel="Reps")
            content.add_widget(c1)
        elif ex_type == ExerciseType.TIME:
            content.add_widget(self._section_label("Max Duration Over Time"))
            c1 = ChartWidget()
            c1.plot_line(dates, [d.get("max_duration", 0) for d in history], ylabel="Seconds")
            content.add_widget(c1)
        elif ex_type == ExerciseType.CARDIO:
            has_distance = any(d.get("max_distance", 0) > 0 for d in history)
            if has_distance:
                content.add_widget(self._section_label("Max Distance Over Time"))
                c1 = ChartWidget()
                c1.plot_line(dates, [d.get("max_distance", 0) for d in history], ylabel="km")
                content.add_widget(c1)
            else:
                content.add_widget(self._section_label("Max Duration Over Time"))
                c1 = ChartWidget()
                c1.plot_line(dates, [d.get("max_duration", 0) for d in history], ylabel="Seconds")
                content.add_widget(c1)

        # --- Personal Best card ---
        best = self.app.stats_service.get_exercise_best_set(self.exercise_id)
        if best:
            content.add_widget(self._section_label("Personal Best"))
            pb_card = MDBoxLayout(
                size_hint_y=None, height=dp(64), md_bg_color=SURFACE,
                padding=[dp(16), dp(8), dp(16), dp(8)], spacing=dp(8),
            )
            if ex_type == ExerciseType.REPS_WEIGHT:
                reps_text = f" \u00d7 {best['reps']} reps" if best.get("reps") else ""
                pb_text = f"{best.get('weight', 0)}{reps_text}"
            elif ex_type == ExerciseType.REPS_ONLY:
                pb_text = f"{best.get('reps', 0)} reps"
            elif ex_type == ExerciseType.TIME:
                secs = best.get("duration_seconds", 0)
                pb_text = f"{secs // 60}m {secs % 60}s" if secs >= 60 else f"{secs}s"
            elif ex_type == ExerciseType.CARDIO:
                parts = []
                if best.get("distance"):
                    parts.append(f"{best['distance']} km")
                if best.get("duration_seconds"):
                    parts.append(f"{best['duration_seconds'] // 60}m")
                pb_text = " / ".join(parts) if parts else "\u2014"
            else:
                pb_text = "\u2014"
            pb_card.add_widget(MDLabel(
                text=pb_text, theme_text_color="Custom", text_color=PRIMARY,
                font_style="Headline", role="small", adaptive_height=True,
            ))
            pb_card.add_widget(MDLabel(
                text=best.get("session_date", ""), theme_text_color="Custom",
                text_color=TEXT_SECONDARY, font_style="Body", role="medium",
                adaptive_height=True, halign="right",
            ))
            content.add_widget(pb_card)

        # --- Plan vs Actual ---
        pva = self.app.stats_service.get_latest_plan_vs_actual_for_exercise(self.exercise_id)
        if pva:
            content.add_widget(MDLabel(
                text="Plan vs Actual (Latest)",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
            ))
            content.add_widget(self._build_pva_table(pva, ex_type))

        scroll.add_widget(content)
        layout.add_widget(scroll)
        self.add_widget(layout)

    def _build_pva_table(self, pva_rows, ex_type=None):
        """Build a plan-vs-actual comparison table."""
        table = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            spacing=dp(2),
        )

        # Header row
        header = MDBoxLayout(
            size_hint_y=None, height=dp(36),
            md_bg_color=SURFACE,
            padding=[dp(12), 0, dp(12), 0],
            spacing=dp(8),
        )
        for col_text in ("Set", "Planned", "Actual"):
            header.add_widget(MDLabel(
                text=col_text,
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
            ))
        table.add_widget(header)

        # Data rows
        for row in pva_rows:
            set_num = row.get("set_number", "?")
            row_kind = row.get("set_kind", "")

            if row_kind == "amrap":
                pw = row.get("planned_weight")
                planned_text = f"{pw} \u00d7 AMRAP" if pw is not None else "AMRAP"
                ar = row.get("actual_reps")
                aw = row.get("actual_weight")
                if aw is not None and ar is not None:
                    actual_text = f"{aw} \u00d7 {ar}"
                elif ar is not None:
                    actual_text = f"{ar} reps"
                else:
                    actual_text = "\u2014"
            elif row_kind in ("reps_weight", "reps_only"):
                pr_min = row.get("planned_reps_min")
                pr_max = row.get("planned_reps_max")
                pw = row.get("planned_weight")
                if pr_min is not None:
                    reps_str = f"{pr_min}" if pr_min == pr_max else f"{pr_min}-{pr_max}"
                    planned_text = f"{pw} \u00d7 {reps_str}" if pw is not None else reps_str
                else:
                    planned_text = "\u2014"
                ar = row.get("actual_reps")
                aw = row.get("actual_weight")
                if aw is not None and ar is not None:
                    actual_text = f"{aw} \u00d7 {ar}"
                elif ar is not None:
                    actual_text = str(ar)
                else:
                    actual_text = "\u2014"
            elif row_kind == "duration":
                pd = row.get("planned_duration")
                planned_text = f"{pd}s" if pd is not None else "\u2014"
                ad = row.get("actual_duration")
                actual_text = f"{ad}s" if ad is not None else "\u2014"
            elif row_kind == "cardio":
                parts_p, parts_a = [], []
                if row.get("planned_duration") is not None:
                    parts_p.append(f"{row['planned_duration']}s")
                if row.get("planned_distance") is not None:
                    parts_p.append(f"{row['planned_distance']}km")
                planned_text = " / ".join(parts_p) if parts_p else "\u2014"
                if row.get("actual_duration") is not None:
                    parts_a.append(f"{row['actual_duration']}s")
                if row.get("actual_distance") is not None:
                    parts_a.append(f"{row['actual_distance']}km")
                actual_text = " / ".join(parts_a) if parts_a else "\u2014"
            else:
                planned_text = "\u2014"
                actual_text = "\u2014"

            data_row = MDBoxLayout(
                size_hint_y=None, height=dp(40),
                md_bg_color=SURFACE,
                padding=[dp(12), 0, dp(12), 0],
                spacing=dp(8),
            )
            for cell_text in (str(set_num), planned_text, actual_text):
                data_row.add_widget(MDLabel(
                    text=cell_text,
                    theme_text_color="Custom", text_color=TEXT_PRIMARY,
                    font_style="Body", role="medium",
                    adaptive_height=True,
                ))
            table.add_widget(data_row)

        return table

    def _section_label(self, text):
        return MDLabel(
            text=text, theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Label", role="large", adaptive_height=True,
        )

    def _go_back(self):
        """Navigate back to dashboard overview."""
        screen = self
        while screen:
            from src.screens.dashboard.dashboard_screen import DashboardScreen
            if isinstance(screen, DashboardScreen):
                screen.pop_to_overview()
                return
            screen = screen.parent
