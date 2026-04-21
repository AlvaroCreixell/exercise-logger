import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrToggle } from "@/features/workout/PrToggle";

afterEach(cleanup);

describe("PrToggle", () => {
  it("renders 'Mark PR' when value is false", () => {
    render(<PrToggle value={false} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /mark pr/i })).toBeVisible();
  });

  it("renders 'PR ✓' when value is true", () => {
    render(<PrToggle value={true} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /^pr/i })).toBeVisible();
  });

  it("calls onChange with the flipped value when clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<PrToggle value={false} onChange={spy} />);
    await user.click(screen.getByRole("button"));
    expect(spy).toHaveBeenCalledWith(true);
  });

  it("aria-pressed reflects the current value", () => {
    const { rerender } = render(<PrToggle value={false} onChange={() => {}} />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
    rerender(<PrToggle value={true} onChange={() => {}} />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });
});
