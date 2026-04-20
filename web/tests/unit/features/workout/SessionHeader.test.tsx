import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionHeader } from "@/features/workout/SessionHeader";

afterEach(cleanup);

describe("SessionHeader", () => {
  it("renders eyebrow with day id + elapsed MM:SS", () => {
    render(
      <SessionHeader
        dayId="A"
        dayLabel="Heavy Squat + Horizontal Push/Pull"
        elapsedSec={34 * 60 + 8}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/DAY A · 34:08 ELAPSED/i)).toBeVisible();
  });

  it("pads seconds with leading zero", () => {
    render(
      <SessionHeader
        dayId="A"
        dayLabel="x"
        elapsedSec={65}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/DAY A · 1:05 ELAPSED/i)).toBeVisible();
  });

  it("renders the serif day title", () => {
    render(
      <SessionHeader
        dayId="A"
        dayLabel="Heavy Squat + Horizontal Push/Pull"
        elapsedSec={0}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Heavy Squat + Horizontal Push/Pull")).toBeVisible();
  });

  it("renders an aria-labelled close button that calls onClose", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <SessionHeader
        dayId="A"
        dayLabel="x"
        elapsedSec={0}
        onClose={spy}
      />,
    );
    const btn = screen.getByRole("button", { name: /close workout/i });
    await user.click(btn);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("uppercases the day id in the eyebrow regardless of input casing", () => {
    render(
      <SessionHeader
        dayId="a"
        dayLabel="x"
        elapsedSec={0}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/DAY A ·/i)).toBeVisible();
  });
});
