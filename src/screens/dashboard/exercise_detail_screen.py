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

        history = self.app.stats_service.get_exercise_weight_history(self.exercise_id)

        if not history:
            content.add_widget(Widget(size_hint_y=None, height=dp(48)))
            content.add_widget(MDLabel(
                text="No data yet",
                halign="center",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Body", role="large",
                adaptive_height=True,
            ))
            scroll.add_widget(content)
            layout.add_widget(scroll)
            self.add_widget(layout)
            return

        dates = [d["session_date"] for d in history]
        weights = [d["max_weight"] for d in history]
        volumes = [d["total_volume"] for d in history]

        # --- Weight chart ---
        content.add_widget(MDLabel(
            text="Weight Over Time",
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Label", role="large",
            adaptive_height=True,
        ))
        weight_chart = ChartWidget()
        weight_chart.plot_line(dates, weights, ylabel="kg/lbs")
        content.add_widget(weight_chart)

        # --- Volume chart ---
        content.add_widget(MDLabel(
            text="Volume Over Time",
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Label", role="large",
            adaptive_height=True,
        ))
        volume_chart = ChartWidget()
        volume_chart.plot_bar(dates, volumes, ylabel="Volume")
        content.add_widget(volume_chart)

        # --- Personal Best card ---
        best = self.app.stats_service.get_exercise_best_set(self.exercise_id)
        if best:
            content.add_widget(MDLabel(
                text="Personal Best",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
            ))
            pb_card = MDBoxLayout(
                size_hint_y=None, height=dp(64),
                md_bg_color=SURFACE,
                padding=[dp(16), dp(8), dp(16), dp(8)],
                spacing=dp(8),
            )
            reps_text = f" × {best['reps']} reps" if best.get("reps") else ""
            pb_card.add_widget(MDLabel(
                text=f"{best['weight']}{reps_text}",
                theme_text_color="Custom", text_color=PRIMARY,
                font_style="Headline", role="small",
                adaptive_height=True,
            ))
            pb_card.add_widget(MDLabel(
                text=best.get("session_date", ""),
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Body", role="medium",
                adaptive_height=True,
                halign="right",
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
            content.add_widget(self._build_pva_table(pva))

        scroll.add_widget(content)
        layout.add_widget(scroll)
        self.add_widget(layout)

    def _build_pva_table(self, pva_rows):
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

            planned_w = row.get("planned_weight")
            planned_r_min = row.get("planned_reps_min")
            planned_r_max = row.get("planned_reps_max")
            if planned_w is not None and planned_r_min is not None:
                reps_str = f"{planned_r_min}" if planned_r_min == planned_r_max else f"{planned_r_min}-{planned_r_max}"
                planned_text = f"{planned_w} × {reps_str}"
            elif planned_r_min is not None:
                reps_str = f"{planned_r_min}" if planned_r_min == planned_r_max else f"{planned_r_min}-{planned_r_max}"
                planned_text = reps_str
            else:
                planned_text = "—"

            actual_w = row.get("actual_weight")
            actual_r = row.get("actual_reps")
            if actual_w is not None and actual_r is not None:
                actual_text = f"{actual_w} × {actual_r}"
            elif actual_r is not None:
                actual_text = str(actual_r)
            else:
                actual_text = "—"

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

    def _go_back(self):
        """Navigate back to dashboard overview."""
        screen = self
        while screen:
            from src.screens.dashboard.dashboard_screen import DashboardScreen
            if isinstance(screen, DashboardScreen):
                screen.pop_to_overview()
                return
            screen = screen.parent
