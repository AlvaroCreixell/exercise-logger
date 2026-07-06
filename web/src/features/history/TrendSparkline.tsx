import type { UnitSystem } from "@/domain/enums";
import { toDisplayWeight } from "@/domain/unit-conversion";
import type { TrendMeasure, TrendSeries } from "./lib/trendPoints";

interface TrendSparklineProps {
  series: TrendSeries;
  units: UnitSystem;
}

/** Format a canonical trend value for labels and the aria sentence. */
function formatTrendValue(
  value: number,
  measure: TrendMeasure,
  units: UnitSystem
): string {
  switch (measure) {
    case "weight":
      return `${toDisplayWeight(value, units)}${units}`;
    case "reps":
      return `×${value}`;
    case "duration":
      return `${value}s`;
    case "distance":
      return `${value}m`;
  }
}

const VIEW_W = 300;
const VIEW_H = 64;
const PAD_Y = 6;
const PAD_X = 5;

/**
 * Compact inline-SVG spark-line of top-set values across sessions.
 * Polyline + filled dot on the newest point; min/max labels beside the chart.
 * No axes, no grid, no animation. A flat series renders at mid-height.
 */
export function TrendSparkline({ series, units }: TrendSparklineProps) {
  const { measure, points } = series;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  const xStep =
    points.length > 1 ? (VIEW_W - 2 * PAD_X) / (points.length - 1) : 0;
  const toY = (value: number): number =>
    range === 0
      ? VIEW_H / 2
      : PAD_Y + (1 - (value - min) / range) * (VIEW_H - 2 * PAD_Y);
  const coords = points.map((p, i) => ({
    x: PAD_X + i * xStep,
    y: toY(p.value),
  }));
  const last = coords[coords.length - 1]!;

  const first = formatTrendValue(points[0]!.value, measure, units);
  const newest = formatTrendValue(
    points[points.length - 1]!.value,
    measure,
    units
  );
  const ariaLabel = `Top set trend across ${points.length} sessions: ${first} to ${newest}`;

  return (
    <div role="img" aria-label={ariaLabel} className="flex items-stretch gap-3">
      <div className="flex shrink-0 flex-col justify-between py-0.5 text-right">
        <span className="text-meta tabular-nums">
          {formatTrendValue(max, measure, units)}
        </span>
        <span className="text-meta tabular-nums">
          {formatTrendValue(min, measure, units)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-16 w-full min-w-0 flex-1"
        aria-hidden="true"
      >
        <line
          x1={0}
          y1={VIEW_H - 0.5}
          x2={VIEW_W}
          y2={VIEW_H - 0.5}
          className="stroke-line-soft"
          strokeWidth={1}
        />
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          className="stroke-accent-cli-bright"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last.x} cy={last.y} r={3} className="fill-accent-cli-bright" />
      </svg>
    </div>
  );
}
