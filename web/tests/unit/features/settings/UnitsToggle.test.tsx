import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnitsToggle } from "@/features/settings/UnitsToggle";

describe("UnitsToggle", () => {
  it("renders both kg and lbs segments", () => {
    render(<UnitsToggle value="kg" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /kg/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /lbs/i })).toBeVisible();
  });

  it("marks the selected segment with aria-pressed='true'", () => {
    render(<UnitsToggle value="lbs" onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /kg/i }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: /lbs/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("applies sage-soft styling to the selected segment", () => {
    render(<UnitsToggle value="kg" onChange={() => {}} />);
    const kg = screen.getByRole("button", { name: /kg/i });
    expect(kg.className).toMatch(/bg-sage-soft|bg-primary/);
  });

  it("calls onChange('lbs') when LBS is clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<UnitsToggle value="kg" onChange={spy} />);
    await user.click(screen.getByRole("button", { name: /lbs/i }));
    expect(spy).toHaveBeenCalledWith("lbs");
  });

  it("does not call onChange when the already-selected value is clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<UnitsToggle value="kg" onChange={spy} />);
    await user.click(screen.getByRole("button", { name: /kg/i }));
    expect(spy).not.toHaveBeenCalled();
  });
});
