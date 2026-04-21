import { useState } from "react";
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

  it("exposes aria-pressed accurately in both states", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [v, setV] = useState(false);
      return <PrToggle value={v} onChange={setV} />;
    }
    render(<Harness />);
    const btn = screen.getByRole("button", { name: /mark pr/i });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    await user.click(btn);
    // After the toggle, the button's accessible name changes to "PR ✓"
    const btnAfter = screen.getByRole("button", { name: /pr/i });
    expect(btnAfter.getAttribute("aria-pressed")).toBe("true");
    await user.click(btnAfter);
    expect(screen.getByRole("button", { name: /mark pr/i }).getAttribute("aria-pressed")).toBe("false");
  });
});
