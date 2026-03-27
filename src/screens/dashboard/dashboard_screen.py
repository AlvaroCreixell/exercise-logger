"""Dashboard screen — overview with session stats, volume trend, recent PRs.

Uses an internal ScreenManager for drill-in navigation (same pattern as ManageScreen).
"""
from datetime import datetime, timezone, timedelta

from kivy.metrics import dp
from kivy.uix.behaviors import ButtonBehavior
from kivy.uix.screenmanager import ScreenManager, SlideTransition
from kivy.uix.widget import Widget
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDButton, MDButtonText, MDIconButton
from kivymd.uix.label import MDLabel
from kivymd.uix.screen import MDScreen
from kivymd.uix.scrollview import MDScrollView

from src.screens.base_screen import BaseScreen
from src.screens.components.chart_widget import ChartWidget
from src.theme import BACKGROUND, SURFACE, TEXT_PRIMARY, TEXT_SECONDARY, PRIMARY, DIVIDER


class _TapBox(ButtonBehavior, MDBoxLayout):
    """Tappable MDBoxLayout — ButtonBehavior provides on_release."""
    pass


class _OverviewScreen(MDScreen):
    """The root overview inside the Dashboard's nested ScreenManager."""
    pass


class DashboardScreen(BaseScreen):
    """Dashboard tab — overview with drill-in navigation for exercise detail and benchmarks."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.md_bg_color = BACKGROUND
        self._nav_stack = []

        self._sub_manager = ScreenManager(transition=SlideTransition(duration=0.2))
        self.add_widget(self._sub_manager)

        # Root overview screen
        self._overview = _OverviewScreen(name="dash_overview")
        self._sub_manager.add_widget(self._overview)

    def on_enter(self):
        """Rebuild overview content on each enter (data may have changed)."""
        self._build_overview()

    def _build_overview(self):
        """Build the full overview view."""
        self._overview.clear_widgets()
        layout = MDBoxLayout(orientation="vertical", md_bg_color=BACKGROUND)

        # --- Header ---
        header = MDBoxLayout(
            size_hint_y=None, height=dp(56),
            padding=[dp(16), 0, dp(16), 0],
        )
        header.add_widget(MDLabel(
            text="Dashboard",
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

        # Check if there are any sessions — all-time for empty state
        total_sessions = self.app.stats_service.get_session_count()

        if total_sessions == 0:
            # --- True empty state: user has never completed a workout ---
            empty = MDBoxLayout(orientation="vertical", spacing=dp(16), padding=[0, dp(48), 0, 0])
            empty.add_widget(MDLabel(
                text="No workouts yet",
                halign="center",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Headline", role="small",
                adaptive_height=True,
            ))
            start_btn = MDButton(
                style="outlined",
                size_hint_x=None, width=dp(200),
                pos_hint={"center_x": 0.5},
            )
            start_btn.add_widget(MDButtonText(text="Start Workout"))
            start_btn.bind(on_release=lambda *a: self.app.go_tab("workout"))
            empty.add_widget(start_btn)
            content.add_widget(empty)
            scroll.add_widget(content)
            layout.add_widget(scroll)
            self._overview.add_widget(layout)
            return

        # --- Stat cards row (shown even if this week/month are 0) ---
        now = datetime.now(timezone.utc)
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        ).isoformat()
        month_start = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        ).isoformat()

        week_count = self.app.stats_service.get_session_count(since=week_start)
        month_count = self.app.stats_service.get_session_count(since=month_start)

        stat_row = MDBoxLayout(
            size_hint_y=None, height=dp(80),
            spacing=dp(12),
        )
        stat_row.add_widget(self._stat_card("This Week", str(week_count), "sessions"))
        stat_row.add_widget(self._stat_card("This Month", str(month_count), "sessions"))
        content.add_widget(stat_row)

        # --- Volume trend chart ---
        trend_data = self.app.stats_service.get_total_volume_trend(weeks=4)
        if trend_data:
            content.add_widget(MDLabel(
                text="Volume Trend (4 weeks)",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
            ))
            chart = ChartWidget()
            labels = [d["week"] for d in trend_data]
            values = [d["total_volume"] or 0 for d in trend_data]
            chart.plot_bar(labels, values, ylabel="Volume")
            content.add_widget(chart)

        # --- Recent Personal Bests ---
        prs = self.app.stats_service.get_personal_bests(limit=3)
        if prs:
            content.add_widget(MDLabel(
                text="Personal Bests",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
            ))
            for pr in prs:
                pr_row = MDBoxLayout(
                    size_hint_y=None, height=dp(40),
                    md_bg_color=SURFACE,
                    padding=[dp(12), 0, dp(12), 0],
                )
                et = pr.get("exercise_type", "reps_weight")
                if et == "reps_weight":
                    reps_text = f" \u00d7 {pr['reps']}" if pr.get("reps") else ""
                    val_text = f"{pr.get('weight', 0)}{reps_text}"
                elif et == "time":
                    secs = pr.get("duration_seconds", 0) or 0
                    val_text = f"{secs // 60}m {secs % 60}s" if secs >= 60 else f"{secs}s"
                elif et == "cardio":
                    parts = []
                    if pr.get("distance_km"):
                        parts.append(f"{pr['distance_km']}km")
                    if pr.get("duration_seconds"):
                        parts.append(f"{pr['duration_seconds'] // 60}m")
                    val_text = " / ".join(parts) if parts else "\u2014"
                else:
                    val_text = "\u2014"

                pr_text = f"{pr['exercise_name']} \u2014 {val_text} \u2014 {pr['session_date']}"
                pr_row.add_widget(MDLabel(
                    text=pr_text,
                    theme_text_color="Custom", text_color=TEXT_PRIMARY,
                    font_style="Body", role="medium", adaptive_height=True,
                ))
                content.add_widget(pr_row)

        # --- Benchmark history link ---
        due_summary = self.app.stats_service.get_benchmark_due_summary()
        due_count = due_summary.get("due_count", 0)
        bm_label = f"Benchmark History ({due_count} due)" if due_count > 0 else "Benchmark History"

        bm_tap = _TapBox(
            size_hint_y=None, height=dp(48),
            md_bg_color=SURFACE,
            padding=[dp(12), 0, dp(8), 0],
            spacing=dp(8),
        )
        bm_tap.add_widget(MDLabel(
            text=bm_label,
            theme_text_color="Custom",
            text_color=PRIMARY if due_count > 0 else TEXT_PRIMARY,
            font_style="Body", role="large",
            adaptive_height=True,
        ))
        bm_tap.add_widget(MDIconButton(
            icon="chevron-right",
            theme_icon_color="Custom", icon_color=TEXT_SECONDARY,
            size_hint_x=None,
        ))
        bm_tap.bind(on_release=lambda *a: self.show_benchmark_history())
        content.add_widget(bm_tap)

        # --- Exercise list for drill-in (only exercises with history) ---
        exercise_keys = self.app.stats_service.get_exercises_with_history()
        if exercise_keys:
            content.add_widget(MDLabel(
                text="Exercises",
                theme_text_color="Custom", text_color=TEXT_SECONDARY,
                font_style="Label", role="large",
                adaptive_height=True,
            ))
            for key in exercise_keys:
                ex = self.app.exercise_registry.get(key)
                if ex is None:
                    continue
                ex_tap = _TapBox(
                    size_hint_y=None, height=dp(52),
                    md_bg_color=SURFACE,
                    padding=[dp(12), 0, dp(8), 0],
                    spacing=dp(8),
                )
                ex_tap.add_widget(MDLabel(
                    text=ex.name,
                    theme_text_color="Custom", text_color=TEXT_PRIMARY,
                    font_style="Body", role="large",
                    adaptive_height=True,
                ))
                ex_tap.add_widget(MDIconButton(
                    icon="chevron-right",
                    theme_icon_color="Custom", icon_color=TEXT_SECONDARY,
                    size_hint_x=None,
                ))
                ex_key = ex.key
                ex_name = ex.name
                ex_tap.bind(on_release=lambda *a, k=ex_key, n=ex_name: self.show_exercise_detail(k, n))
                content.add_widget(ex_tap)

        scroll.add_widget(content)
        layout.add_widget(scroll)
        self._overview.add_widget(layout)

    def _stat_card(self, label: str, value: str, unit: str):
        """Build a stat card widget."""
        card = MDBoxLayout(
            orientation="vertical",
            md_bg_color=SURFACE,
            padding=[dp(12), dp(8), dp(12), dp(8)],
            spacing=dp(4),
        )
        card.add_widget(MDLabel(
            text=label,
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Label", role="medium",
            adaptive_height=True, halign="center",
        ))
        card.add_widget(MDLabel(
            text=value,
            theme_text_color="Custom", text_color=TEXT_PRIMARY,
            font_style="Headline", role="small",
            adaptive_height=True, halign="center",
        ))
        card.add_widget(MDLabel(
            text=unit,
            theme_text_color="Custom", text_color=TEXT_SECONDARY,
            font_style="Label", role="small",
            adaptive_height=True, halign="center",
        ))
        return card

    # --- Navigation ---

    def show_exercise_detail(self, exercise_key: str, name: str):
        """Drill into exercise detail screen."""
        from src.screens.dashboard.exercise_detail_screen import ExerciseDetailScreen

        screen_name = f"dash_exercise_{exercise_key}"
        if not self._sub_manager.has_screen(screen_name):
            detail = ExerciseDetailScreen(
                exercise_key=exercise_key,
                exercise_name=name,
                name=screen_name,
            )
            self._sub_manager.add_widget(detail)

        self._sub_manager.transition = SlideTransition(direction="left", duration=0.2)
        self._nav_stack.append(self._sub_manager.current)
        self._sub_manager.current = screen_name

    def show_benchmark_history(self):
        """Drill into benchmark history screen."""
        from src.screens.dashboard.benchmark_history_screen import BenchmarkHistoryScreen

        screen_name = "dash_benchmarks"
        if not self._sub_manager.has_screen(screen_name):
            bm_screen = BenchmarkHistoryScreen(name=screen_name)
            self._sub_manager.add_widget(bm_screen)

        self._sub_manager.transition = SlideTransition(direction="left", duration=0.2)
        self._nav_stack.append(self._sub_manager.current)
        self._sub_manager.current = screen_name

    def pop_to_overview(self):
        """Go back one level in the drill-in stack."""
        if self._nav_stack:
            prev = self._nav_stack.pop()
            self._sub_manager.transition = SlideTransition(direction="right", duration=0.2)
            self._sub_manager.current = prev
