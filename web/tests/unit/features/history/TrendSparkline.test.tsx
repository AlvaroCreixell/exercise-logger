import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TrendSparkline } from "@/features/history/TrendSparkline";
import type { TrendSeries } from "@/features/history/lib/trendPoints";

function weightSeries(values: number[]): TrendSeries {
  return {
    measure: "weight",
    points: values.map((value, i) => ({
      startedAt: `2026-06-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`,
      value,
    })),
  };
}

describe("TrendSparkline", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders an image role with a one-sentence trend aria-label", () => {
    render(<TrendSparkline series={weightSeries([60, 70, 85])} units="kg" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAccessibleName(
      "Top set trend across 3 sessions: 60kg to 85kg"
    );
  });

  it("draws a polyline through the points and a dot on the newest point", () => {
    const { container } = render(
      <TrendSparkline series={weightSeries([60, 70, 85])} units="kg" />
    );
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
    expect(polyline!.getAttribute("points")!.split(" ")).toHaveLength(3);
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("renders a flat series without NaN coordinates", () => {
    const { container } = render(
      <TrendSparkline series={weightSeries([80, 80, 80])} units="kg" />
    );
    const points = container.querySelector("polyline")!.getAttribute("points")!;
    expect(points).not.toMatch(/NaN/);
    expect(
      container.querySelector("circle")!.getAttribute("cy")
    ).not.toMatch(/NaN/);
    // Min and max labels collapse to the same value.
    expect(screen.getAllByText("80kg").length).toBeGreaterThanOrEqual(1);
  });

  it("shows min and max weight labels converted to display units", () => {
    render(<TrendSparkline series={weightSeries([60, 70, 85])} units="lbs" />);
    // toDisplayWeight: 60kg -> 132.28lbs, 85kg -> 187.39lbs
    expect(screen.getByText("132.28lbs")).toBeInTheDocument();
    expect(screen.getByText("187.39lbs")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Top set trend across 3 sessions: 132.28lbs to 187.39lbs"
    );
  });

  it("formats reps series labels as ×N", () => {
    const series: TrendSeries = {
      measure: "reps",
      points: [
        { startedAt: "2026-06-01T10:00:00.000Z", value: 8 },
        { startedAt: "2026-06-03T10:00:00.000Z", value: 12 },
      ],
    };
    render(<TrendSparkline series={series} units="kg" />);
    expect(screen.getByText("×8")).toBeInTheDocument();
    expect(screen.getByText("×12")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Top set trend across 2 sessions: ×8 to ×12"
    );
  });

  it("formats duration labels in seconds and distance labels in meters", () => {
    const duration: TrendSeries = {
      measure: "duration",
      points: [
        { startedAt: "2026-06-01T10:00:00.000Z", value: 30 },
        { startedAt: "2026-06-03T10:00:00.000Z", value: 45 },
      ],
    };
    const { unmount } = render(<TrendSparkline series={duration} units="kg" />);
    expect(screen.getByText("30s")).toBeInTheDocument();
    expect(screen.getByText("45s")).toBeInTheDocument();
    unmount();

    const distance: TrendSeries = {
      measure: "distance",
      points: [
        { startedAt: "2026-06-01T10:00:00.000Z", value: 400 },
        { startedAt: "2026-06-03T10:00:00.000Z", value: 500 },
      ],
    };
    render(<TrendSparkline series={distance} units="kg" />);
    expect(screen.getByText("400m")).toBeInTheDocument();
    expect(screen.getByText("500m")).toBeInTheDocument();
  });
});
