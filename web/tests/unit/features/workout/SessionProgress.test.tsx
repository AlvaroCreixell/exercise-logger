import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SessionProgress } from "@/features/workout/SessionProgress";

afterEach(cleanup);

describe("SessionProgress", () => {
  it("renders N/M counter with tabular numerals", () => {
    render(<SessionProgress totalSets={20} loggedSets={2} />);
    const counter = screen.getByText("2/20");
    expect(counter).toBeVisible();
    expect(counter).toHaveClass("tabular-nums");
  });

  it("announces via aria-label for screen readers", () => {
    render(<SessionProgress totalSets={20} loggedSets={2} />);
    expect(
      screen.getByLabelText(/2 of 20 sets logged/i),
    ).toBeInTheDocument();
  });

  it("renders an accent progress bar at the correct width", () => {
    const { container } = render(<SessionProgress totalSets={20} loggedSets={5} />);
    const bar = container.querySelector("[data-progress-bar]") as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.style.width).toBe("25%");
    expect(bar.className).toMatch(/bg-accent-cli/);
  });

  it("clamps width to 100% when loggedSets exceeds totalSets", () => {
    const { container } = render(<SessionProgress totalSets={10} loggedSets={12} />);
    const bar = container.querySelector("[data-progress-bar]") as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("renders 0% when totalSets is 0 (empty routine)", () => {
    const { container } = render(<SessionProgress totalSets={0} loggedSets={0} />);
    const bar = container.querySelector("[data-progress-bar]") as HTMLElement;
    expect(bar.style.width).toBe("0%");
  });
});
