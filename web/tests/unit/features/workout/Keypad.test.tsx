import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Keypad } from "@/features/workout/Keypad";

afterEach(cleanup);

describe("Keypad", () => {
  it("renders 12 buttons: 1-9, ., 0, backspace", () => {
    render(<Keypad onKey={() => {}} />);
    for (const d of ["1","2","3","4","5","6","7","8","9","0"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${d}$`) })).toBeVisible();
    }
    expect(screen.getByRole("button", { name: /^\.$/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /backspace/i })).toBeVisible();
  });

  it("fires onKey with the digit string when a number button is tapped", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Keypad onKey={spy} />);
    await user.click(screen.getByRole("button", { name: /^7$/ }));
    expect(spy).toHaveBeenCalledWith("7");
  });

  it("fires onKey with '.' for the decimal button", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Keypad onKey={spy} />);
    await user.click(screen.getByRole("button", { name: /^\.$/ }));
    expect(spy).toHaveBeenCalledWith(".");
  });

  it("fires onKey with 'back' for the backspace button", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Keypad onKey={spy} />);
    await user.click(screen.getByRole("button", { name: /backspace/i }));
    expect(spy).toHaveBeenCalledWith("back");
  });

  it("is disabled when the disabled prop is true", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<Keypad onKey={spy} disabled />);
    await user.click(screen.getByRole("button", { name: /^5$/ }));
    expect(spy).not.toHaveBeenCalled();
  });
});
