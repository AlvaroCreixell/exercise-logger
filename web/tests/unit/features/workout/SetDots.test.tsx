import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SetDots } from "@/features/workout/SetDots";

afterEach(cleanup);

describe("SetDots", () => {
  it("renders one dot per set in a block", () => {
    const { container } = render(<SetDots total={3} current={0} />);
    const dots = container.querySelectorAll("[data-dot]");
    expect(dots.length).toBe(3);
  });

  it("marks the current dot as active", () => {
    const { container } = render(<SetDots total={3} current={1} />);
    const dots = container.querySelectorAll("[data-dot]");
    expect((dots[0] as HTMLElement).dataset.state).toBe("inactive");
    expect((dots[1] as HTMLElement).dataset.state).toBe("active");
    expect((dots[2] as HTMLElement).dataset.state).toBe("inactive");
  });

  it("handles total=0 without crashing", () => {
    const { container } = render(<SetDots total={0} current={0} />);
    expect(container.querySelectorAll("[data-dot]").length).toBe(0);
  });

  it("exposes an aria-label summarizing current/total", () => {
    render(<SetDots total={3} current={1} />);
    expect(screen.getByLabelText("Set 2 of 3")).toBeInTheDocument();
  });

  it("handles total=1 as a single-dot indicator", () => {
    const { container } = render(<SetDots total={1} current={0} />);
    const dots = container.querySelectorAll("[data-dot]");
    expect(dots.length).toBe(1);
    expect((dots[0] as HTMLElement).dataset.state).toBe("active");
  });
});
