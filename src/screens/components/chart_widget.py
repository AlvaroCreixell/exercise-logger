"""Chart widget using Kivy canvas primitives instead of matplotlib."""
from kivy.clock import Clock
from kivy.graphics import Color, Ellipse, Line, Rectangle
from kivy.metrics import dp
from kivy.uix.widget import Widget
from kivy.utils import get_color_from_hex
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.label import MDLabel

from src.theme import DIVIDER, SURFACE, TEXT_SECONDARY

GREEN = "#4ADE80"
BLUE = "#60A5FA"


class ChartWidget(MDBoxLayout):
    """Simple chart renderer for line and bar charts."""

    def __init__(self, **kwargs):
        super().__init__(orientation="vertical", spacing=dp(6), **kwargs)
        self.size_hint_y = None
        self.height = dp(220)
        self.padding = [0, dp(4), 0, 0]

        self._mode = None
        self._x_labels = []
        self._primary_values = []
        self._secondary_values = []
        self._primary_color = self._resolve_color(GREEN)
        self._secondary_color = self._resolve_color(BLUE)

        self._ylabel = MDLabel(
            text="",
            size_hint_y=None,
            height=dp(18),
            theme_text_color="Custom",
            text_color=TEXT_SECONDARY,
            font_style="Label",
            role="small",
            opacity=0,
        )
        self.add_widget(self._ylabel)

        self._plot_area = Widget()
        self._plot_area.bind(pos=self._schedule_redraw, size=self._schedule_redraw)
        self.add_widget(self._plot_area)

        self._x_axis = MDBoxLayout(
            size_hint_y=None,
            height=dp(24),
            spacing=dp(4),
        )
        self.add_widget(self._x_axis)

    def plot_line(self, x_data, y_data, color=GREEN, ylabel="", secondary_data=None, secondary_color=BLUE):
        """Render one or two line series."""
        self._mode = "line"
        self._x_labels = [str(x) for x in x_data]
        self._primary_values = self._normalize_values(y_data)
        self._secondary_values = self._normalize_values(secondary_data or [])
        self._primary_color = self._resolve_color(color)
        self._secondary_color = self._resolve_color(secondary_color)
        self._set_ylabel(ylabel)
        self._rebuild_axis_labels()
        self._schedule_redraw()

    def plot_bar(self, x_data, y_data, color=GREEN, ylabel=""):
        """Render a bar chart."""
        self._mode = "bar"
        self._x_labels = [str(x) for x in x_data]
        self._primary_values = self._normalize_values(y_data)
        self._secondary_values = []
        self._primary_color = self._resolve_color(color)
        self._set_ylabel(ylabel)
        self._rebuild_axis_labels()
        self._schedule_redraw()

    def _set_ylabel(self, ylabel: str):
        self._ylabel.text = ylabel or ""
        self._ylabel.opacity = 1 if ylabel else 0

    def _rebuild_axis_labels(self):
        self._x_axis.clear_widgets()
        labels = self._sample_labels(self._x_labels)
        for text in labels:
            self._x_axis.add_widget(MDLabel(
                text=text,
                halign="center",
                theme_text_color="Custom",
                text_color=TEXT_SECONDARY,
                font_style="Label",
                role="small",
            ))

    def _schedule_redraw(self, *_args):
        Clock.unschedule(self._redraw)
        Clock.schedule_once(self._redraw, 0)

    def _redraw(self, *_args):
        self._plot_area.canvas.clear()

        width = self._plot_area.width
        height = self._plot_area.height
        if width <= 0 or height <= 0 or not self._primary_values:
            return

        pad_x = dp(12)
        pad_y = dp(10)
        left = self._plot_area.x + pad_x
        bottom = self._plot_area.y + pad_y
        chart_w = max(1, width - (pad_x * 2))
        chart_h = max(1, height - (pad_y * 2))

        values = [v for v in self._primary_values if v is not None]
        values.extend(v for v in self._secondary_values if v is not None)
        if not values:
            return

        min_val = min(values)
        max_val = max(values)
        if self._mode == "bar" or min_val >= 0:
            min_val = 0
        if min_val == max_val:
            spread = abs(max_val) * 0.1 or 1
            min_val -= spread
            max_val += spread

        with self._plot_area.canvas:
            Color(*SURFACE)
            Rectangle(pos=self._plot_area.pos, size=self._plot_area.size)

            Color(*DIVIDER)
            Line(rectangle=(left, bottom, chart_w, chart_h), width=1)
            for step in range(1, 4):
                y = bottom + (chart_h * step / 4.0)
                Line(points=[left, y, left + chart_w, y], width=1)

            if self._mode == "bar":
                self._draw_bars(left, bottom, chart_w, chart_h, min_val, max_val)
            else:
                self._draw_line(self._primary_values, self._primary_color, left, bottom, chart_w, chart_h, min_val, max_val)
                if self._secondary_values:
                    self._draw_line(self._secondary_values, self._secondary_color, left, bottom, chart_w, chart_h, min_val, max_val)

    def _draw_bars(self, left, bottom, chart_w, chart_h, min_val, max_val):
        count = len(self._primary_values)
        if count == 0:
            return

        step = chart_w / max(count, 1)
        bar_w = max(dp(8), step * 0.68)
        Color(*self._primary_color)
        for index, value in enumerate(self._primary_values):
            x = left + (step * index) + (step - bar_w) / 2.0
            top = self._value_to_y(value, bottom, chart_h, min_val, max_val)
            Rectangle(pos=(x, bottom), size=(bar_w, max(dp(2), top - bottom)))

    def _draw_line(self, values, color, left, bottom, chart_w, chart_h, min_val, max_val):
        count = len(values)
        if count == 0:
            return

        if count == 1:
            x_positions = [left + chart_w / 2.0]
        else:
            x_positions = [left + (chart_w * index / (count - 1)) for index in range(count)]

        points = []
        for index, value in enumerate(values):
            if value is None:
                continue
            points.extend([x_positions[index], self._value_to_y(value, bottom, chart_h, min_val, max_val)])

        if len(points) < 2:
            return

        Color(*color)
        if len(points) >= 4:
            Line(points=points, width=dp(1.8))

        radius = dp(2.8)
        for point_index in range(0, len(points), 2):
            Ellipse(pos=(points[point_index] - radius, points[point_index + 1] - radius), size=(radius * 2, radius * 2))

    @staticmethod
    def _normalize_values(values):
        return [0 if value is None else float(value) for value in values]

    @staticmethod
    def _sample_labels(labels):
        if not labels:
            return []
        if len(labels) <= 4:
            return labels

        last_index = len(labels) - 1
        sample_indexes = [0, last_index // 3, (last_index * 2) // 3, last_index]
        sampled = []
        for index in sample_indexes:
            label = labels[index]
            if not sampled or sampled[-1] != label:
                sampled.append(label)
        return sampled

    @staticmethod
    def _resolve_color(color):
        if isinstance(color, str):
            return get_color_from_hex(color)
        return color

    @staticmethod
    def _value_to_y(value, bottom, chart_h, min_val, max_val):
        ratio = (value - min_val) / (max_val - min_val)
        return bottom + (chart_h * ratio)
