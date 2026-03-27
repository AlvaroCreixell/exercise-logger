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

from src.models.enums import ExerciseType
from src.screens.components.chart_widget import ChartWidget
from src.theme import BACKGROUND, SURFACE, TEXT_PRIMARY, TEXT_SECONDARY, PRIMARY, DIVIDER


class ExerciseDetailScreen(MDScreen):
    """Exercise detail — charts, personal best, plan-vs-actual comparison."""

    def __init__(self, exercise_key: str, exercise_name: str, **kwargs):
        super().__init__(**kwargs)
        self.exercise_key = exercise_key
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

        exercise = self.app.exercise_registry.get(self.exercise_key)
        ex_type = exercise.type if exercise else None

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

        history = self.app.stats_service.get_exercise_history(self.exercise_key)

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
        best = self.app.stats_service.get_exercise_best_set(self.exercise_key)
        if best:
            content.add_widget(self._section_label("Personal Best"))
            pb_card = MDBoxLayout(
                size_hint_y=None, height=dp(64), md_bg_color=SURFACE,
                padding=[dp(16), dp(8), dp(16), dp(8)], spacing=dp(8),
            )
            if ex_type == ExerciseType.REPS_WEIGHT:
                reps_text = f" \u00d7 {best['reps']} reps" if best.get("reps") else ""
                pb_text = f"{best.get('weight', 0)}{reps_text}"
            elif ex_type == ExerciseType.TIME:
                secs = best.get("duration_seconds", 0) or 0
                pb_text = f"{secs // 60}m {secs % 60}s" if secs >= 60 else f"{secs}s"
            elif ex_type == ExerciseType.CARDIO:
                parts = []
                if best.get("distance_km"):
                    parts.append(f"{best['distance_km']} km")
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
        pva = self.app.stats_service.get_latest_plan_vs_actual(self.exercise_key)
        if pva:
            content.add_widget(MDLabel(
                text="Plan vs Actual (Latest)",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
            ))
            content.add_widget(self._build_pva_summary(pva, ex_type))

        scroll.add_widget(content)
        layout.add_widget(scroll)
        self.add_widget(layout)

    def _build_pva_summary(self, pva: dict, ex_type=None):
        """Build a plan-vs-actual summary card for the latest session."""
        card = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            md_bg_color=SURFACE,
            padding=[dp(12), dp(8), dp(12), dp(8)],
            spacing=dp(4),
        )

        planned_sets = pva.get("planned_sets")
        actual_sets = pva.get("actual_sets")

        # Sets row
        sets_row = MDBoxLayout(size_hint_y=None, height=dp(32), spacing=dp(8))
        sets_row.add_widget(MDLabel(
            text="Sets:",
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Label", role="large",
            adaptive_height=True,
            size_hint_x=None, width=dp(64),
        ))
        plan_str = str(planned_sets) if planned_sets is not None else "\u2014"
        act_str = str(actual_sets) if actual_sets is not None else "\u2014"
        sets_row.add_widget(MDLabel(
            text=f"Planned {plan_str}  \u2192  Actual {act_str}",
            theme_text_color="Custom", text_color=TEXT_PRIMARY,
            font_style="Body", role="medium",
            adaptive_height=True,
        ))
        card.add_widget(sets_row)

        # Type-specific target/actual row
        if ex_type == ExerciseType.REPS_WEIGHT:
            rmin = pva.get("target_reps_min")
            rmax = pva.get("target_reps_max")
            avg_reps = pva.get("actual_reps_avg")
            avg_weight = pva.get("actual_weight_avg")

            if rmin is not None:
                reps_str = f"{rmin}" if rmin == rmax else f"{rmin}-{rmax}"
            else:
                reps_str = "\u2014"

            reps_row = MDBoxLayout(size_hint_y=None, height=dp(32), spacing=dp(8))
            reps_row.add_widget(MDLabel(
                text="Reps:",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
                size_hint_x=None, width=dp(64),
            ))
            avg_reps_str = f"{avg_reps:.1f}" if avg_reps is not None else "\u2014"
            reps_row.add_widget(MDLabel(
                text=f"Target {reps_str}  \u2192  Avg {avg_reps_str}",
                theme_text_color="Custom", text_color=TEXT_PRIMARY,
                font_style="Body", role="medium",
                adaptive_height=True,
            ))
            card.add_widget(reps_row)

            weight_row = MDBoxLayout(size_hint_y=None, height=dp(32), spacing=dp(8))
            weight_row.add_widget(MDLabel(
                text="Weight:",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
                size_hint_x=None, width=dp(64),
            ))
            avg_w_str = f"{avg_weight:.1f}" if avg_weight is not None else "\u2014"
            weight_row.add_widget(MDLabel(
                text=f"Avg {avg_w_str}",
                theme_text_color="Custom", text_color=TEXT_PRIMARY,
                font_style="Body", role="medium",
                adaptive_height=True,
            ))
            card.add_widget(weight_row)

        elif ex_type == ExerciseType.TIME:
            avg_reps = pva.get("actual_reps_avg")
            target_rmin = pva.get("target_reps_min")

            dur_row = MDBoxLayout(size_hint_y=None, height=dp(32), spacing=dp(8))
            dur_row.add_widget(MDLabel(
                text="Duration:",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
                size_hint_x=None, width=dp(80),
            ))
            target_str = f"{target_rmin}s" if target_rmin is not None else "\u2014"
            act_str = f"{avg_reps:.0f}s" if avg_reps is not None else "\u2014"
            dur_row.add_widget(MDLabel(
                text=f"Target {target_str}  \u2192  Avg {act_str}",
                theme_text_color="Custom", text_color=TEXT_PRIMARY,
                font_style="Body", role="medium",
                adaptive_height=True,
            ))
            card.add_widget(dur_row)

        elif ex_type == ExerciseType.CARDIO:
            avg_reps = pva.get("actual_reps_avg")
            avg_weight = pva.get("actual_weight_avg")
            target_rmin = pva.get("target_reps_min")

            dist_row = MDBoxLayout(size_hint_y=None, height=dp(32), spacing=dp(8))
            dist_row.add_widget(MDLabel(
                text="Distance:",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
                size_hint_x=None, width=dp(80),
            ))
            target_str = f"{target_rmin}km" if target_rmin is not None else "\u2014"
            act_str = f"{avg_weight:.2f}km" if avg_weight is not None else "\u2014"
            dist_row.add_widget(MDLabel(
                text=f"Target {target_str}  \u2192  Avg {act_str}",
                theme_text_color="Custom", text_color=TEXT_PRIMARY,
                font_style="Body", role="medium",
                adaptive_height=True,
            ))
            card.add_widget(dist_row)

        return card

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
