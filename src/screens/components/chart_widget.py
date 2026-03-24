"""Chart widget — renders matplotlib figures into Kivy Image widgets.

Applies the spec's dark theme. Usage:
    chart = ChartWidget()
    chart.plot_line(x_data, y_data, color="#4ADE80")
"""
import io
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from kivy.core.image import Image as CoreImage
from kivy.uix.image import Image
from kivy.metrics import dp

CHART_STYLE = {
    "figure.facecolor": "#1E1E1E",
    "axes.facecolor": "#1E1E1E",
    "axes.edgecolor": "#2A2A2A",
    "axes.labelcolor": "#9CA3AF",
    "axes.grid": True,
    "grid.color": "#2A2A2A",
    "grid.linewidth": 0.5,
    "text.color": "#F5F5F5",
    "xtick.color": "#9CA3AF",
    "ytick.color": "#9CA3AF",
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "lines.linewidth": 2,
    "lines.color": "#4ADE80",
    "figure.autolayout": True,
    "axes.spines.top": False,
    "axes.spines.right": False,
}
plt.rcParams.update(CHART_STYLE)

GREEN = "#4ADE80"
BLUE = "#60A5FA"


class ChartWidget(Image):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.size_hint_y = None
        self.height = dp(200)
        self.allow_stretch = True
        self.keep_ratio = True

    def plot_line(self, x_data, y_data, color=GREEN, ylabel="", secondary_data=None, secondary_color=BLUE):
        fig, ax = plt.subplots(figsize=(6, 3), dpi=100)
        ax.plot(x_data, y_data, color=color, linewidth=2)
        if secondary_data:
            ax.plot(x_data[:len(secondary_data)], secondary_data, color=secondary_color, linewidth=2, linestyle="--")
        if ylabel:
            ax.set_ylabel(ylabel, fontsize=9)
        ax.tick_params(axis="x", rotation=45)
        self._render(fig)

    def plot_bar(self, x_data, y_data, color=GREEN, ylabel=""):
        fig, ax = plt.subplots(figsize=(6, 3), dpi=100)
        ax.bar(range(len(x_data)), y_data, color=color, width=0.6, tick_label=x_data)
        if ylabel:
            ax.set_ylabel(ylabel, fontsize=9)
        ax.tick_params(axis="x", rotation=45)
        self._render(fig)

    def _render(self, fig):
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", pad_inches=0.1)
        plt.close(fig)
        buf.seek(0)
        self.texture = CoreImage(buf, ext="png").texture
