"""Benchmark history screen — trend charts per benchmark item.

Drill-in from dashboard overview. Shows all benchmark config items with
their latest result and a trend chart per exercise.
"""
from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDIconButton
from kivymd.uix.label import MDLabel
from kivymd.uix.screen import MDScreen
from kivymd.uix.scrollview import MDScrollView

from src.models.enums import BenchmarkMethod
from src.screens.components.chart_widget import ChartWidget
from src.theme import BACKGROUND, SURFACE, TEXT_PRIMARY, TEXT_SECONDARY, PRIMARY


# Human-readable method labels
_METHOD_LABELS = {
    BenchmarkMethod.MAX_WEIGHT: "Max Weight",
    BenchmarkMethod.MAX_REPS: "Max Reps",
    BenchmarkMethod.TIMED_HOLD: "Timed Hold",
}


class BenchmarkHistoryScreen(MDScreen):
    """Benchmark history — all config items with trend charts."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
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
            text="Benchmark History",
            theme_text_color="Custom", text_color=TEXT_PRIMARY,
            font_style="Headline", role="small",
        ))
        layout.add_widget(header)

        # --- Content ---
        scroll = MDScrollView()
        content = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            padding=[dp(16), 0, dp(16), dp(16)],
            spacing=dp(16),
        )

        items = self.app.benchmark_registry.list_items()

        if not items:
            content.add_widget(Widget(size_hint_y=None, height=dp(48)))
            content.add_widget(MDLabel(
                text="No benchmarks defined yet",
                halign="center",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Body", role="large",
                adaptive_height=True,
            ))
            scroll.add_widget(content)
            layout.add_widget(scroll)
            self.add_widget(layout)
            return

        for item in items:
            content.add_widget(self._build_item_card(item))

        scroll.add_widget(content)
        layout.add_widget(scroll)
        self.add_widget(layout)

    def _build_item_card(self, item):
        """Build a benchmark item card with latest result and trend chart."""
        card = MDBoxLayout(
            orientation="vertical",
            adaptive_height=True,
            md_bg_color=SURFACE,
            padding=[dp(12), dp(8), dp(12), dp(12)],
            spacing=dp(8),
        )

        # Resolve exercise name
        exercise = self.app.exercise_registry.get(item.exercise_key)
        ex_name = exercise.name if exercise else item.exercise_key

        method_label = _METHOD_LABELS.get(item.method, item.method.value)

        # Card header row: exercise name + method
        header_row = MDBoxLayout(
            size_hint_y=None, height=dp(40),
            spacing=dp(8),
        )
        name_col = MDBoxLayout(orientation="vertical", spacing=dp(2))
        name_col.add_widget(MDLabel(
            text=ex_name,
            theme_text_color="Custom", text_color=TEXT_PRIMARY,
            font_style="Body", role="large",
            adaptive_height=True,
        ))
        name_col.add_widget(MDLabel(
            text=method_label,
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Body", role="small",
            adaptive_height=True,
        ))
        header_row.add_widget(name_col)
        card.add_widget(header_row)

        # Fetch history (list of dicts: result_value, bodyweight, tested_at, method)
        history = self.app.stats_service.get_benchmark_history(item.exercise_key)

        if not history:
            card.add_widget(MDLabel(
                text="No results yet",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Body", role="medium",
                adaptive_height=True,
            ))
            return card

        # Latest result
        latest = history[-1]
        result_val = latest.get("result_value")
        tested_at = (latest.get("tested_at") or "")[:10]
        bodyweight = latest.get("bodyweight")

        latest_row = MDBoxLayout(
            size_hint_y=None, height=dp(32),
            spacing=dp(8),
        )
        latest_row.add_widget(MDLabel(
            text="Latest:",
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Label", role="large",
            adaptive_height=True,
            size_hint_x=None, width=dp(56),
        ))
        result_str = f"{result_val}" if result_val is not None else "\u2014"
        bw_str = f"  (BW: {bodyweight})" if bodyweight is not None else ""
        latest_row.add_widget(MDLabel(
            text=f"{result_str}{bw_str}  ({tested_at})" if tested_at else result_str + bw_str,
            theme_text_color="Custom", text_color=PRIMARY,
            font_style="Body", role="medium",
            adaptive_height=True,
        ))
        card.add_widget(latest_row)

        # Trend chart (only if multiple data points)
        if len(history) >= 2:
            dates = [(r.get("tested_at") or "")[:10] for r in history]
            values = [r.get("result_value") or 0 for r in history]

            # Optional secondary line for bodyweight if any data point has it
            bodyweights = [r.get("bodyweight") for r in history]
            has_bodyweight = any(bw is not None for bw in bodyweights)

            chart = ChartWidget()
            if has_bodyweight:
                bw_values = [bw or 0 for bw in bodyweights]
                chart.plot_line(dates, values, ylabel=method_label, secondary_data=bw_values)
            else:
                chart.plot_line(dates, values, ylabel=method_label)
            card.add_widget(chart)

        return card

    def _go_back(self):
        """Navigate back to dashboard overview."""
        screen = self
        while screen:
            from src.screens.dashboard.dashboard_screen import DashboardScreen
            if isinstance(screen, DashboardScreen):
                screen.pop_to_overview()
                return
            screen = screen.parent
