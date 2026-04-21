import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ValueBox } from "@/features/workout/ValueBox";

afterEach(cleanup);

describe("ValueBox", () => {
  it("renders label and value", () => {
    render(
      <ValueBox
        label="Weight"
        value="70"
        unit="kg"
        isActive={false}
        onFocus={() => {}}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
      />,
    );
    expect(screen.getByText("Weight")).toBeVisible();
    expect(screen.getByText("70")).toBeVisible();
    expect(screen.getByText("kg")).toBeVisible();
  });

  it("renders an em-dash when value is empty", () => {
    render(
      <ValueBox
        label="Reps"
        value=""
        isActive={false}
        onFocus={() => {}}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
      />,
    );
    expect(screen.getByText("—")).toBeVisible();
  });

  it("calls onFocus when the tile is clicked", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <ValueBox
        label="Weight"
        value="70"
        isActive={false}
        onFocus={spy}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: /weight value/i }));
    expect(spy).toHaveBeenCalled();
  });

  it("calls onNudgeDown and onNudgeUp with independent clicks", async () => {
    const down = vi.fn();
    const up = vi.fn();
    const user = userEvent.setup();
    render(
      <ValueBox
        label="Weight"
        value="70"
        isActive={false}
        onFocus={() => {}}
        onNudgeDown={down}
        onNudgeUp={up}
      />,
    );
    await user.click(screen.getByRole("button", { name: /decrease weight/i }));
    await user.click(screen.getByRole("button", { name: /increase weight/i }));
    expect(down).toHaveBeenCalledTimes(1);
    expect(up).toHaveBeenCalledTimes(1);
  });

  it("sets data-active='true' when isActive is true", () => {
    const { container } = render(
      <ValueBox
        label="Weight"
        value="70"
        isActive={true}
        onFocus={() => {}}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
      />,
    );
    const tile = container.querySelector("[data-active='true']");
    expect(tile).not.toBeNull();
  });

  it("renders the unitToggle slot when provided", () => {
    render(
      <ValueBox
        label="Weight"
        value="70"
        unit="kg"
        isActive={false}
        onFocus={() => {}}
        onNudgeDown={() => {}}
        onNudgeUp={() => {}}
        unitToggle={<button type="button">lbs</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "lbs" })).toBeVisible();
  });
});
