import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakPill } from "@/features/today/StreakPill";

describe("StreakPill", () => {
  it("renders session count and copy when count > 0", () => {
    render(<StreakPill count={3} />);
    expect(screen.getByText(/3 sessions this week/i)).not.toBeNull();
  });

  it("renders nothing when count is 0", () => {
    const { container } = render(<StreakPill count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when count is negative", () => {
    const { container } = render(<StreakPill count={-1} />);
    expect(container.firstChild).toBeNull();
  });

  it("applies sage-soft palette classes", () => {
    const { container } = render(<StreakPill count={2} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/bg-sage-soft/);
    expect(el.className).toMatch(/text-sage-deep/);
    expect(el.className).toMatch(/rounded-\[var\(--radius-pill\)\]/);
  });

  it("renders the Flame icon", () => {
    const { container } = render(<StreakPill count={1} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });
});
