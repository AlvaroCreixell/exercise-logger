import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActiveRoutineCard } from "@/features/settings/ActiveRoutineCard";
import type { Routine } from "@/domain/types";

function makeRoutine(overrides: Partial<Routine> = {}): Routine {
  return {
    id: "r1",
    schemaVersion: 1,
    name: "Full Body 3-Day Rotation",
    restDefaultSec: 90,
    restSupersetSec: 60,
    dayOrder: ["A", "B", "C"],
    nextDayId: "A",
    days: {
      A: { id: "A", label: "Heavy", entries: [] },
      B: { id: "B", label: "Moderate", entries: [] },
      C: { id: "C", label: "Unilateral", entries: [] },
    },
    notes: [],
    cardio: null,
    importedAt: "2026-04-17T12:00:00Z",
    ...overrides,
  };
}

describe("ActiveRoutineCard", () => {
  it("renders the 'ACTIVE ROUTINE' eyebrow", () => {
    render(<ActiveRoutineCard routine={makeRoutine()} />);
    expect(screen.getByText(/active routine/i)).toBeVisible();
  });

  it("renders the routine name", () => {
    render(<ActiveRoutineCard routine={makeRoutine()} />);
    expect(screen.getByText("Full Body 3-Day Rotation")).toBeVisible();
  });

  it("renders a meta line with day count, day labels, and rest", () => {
    render(<ActiveRoutineCard routine={makeRoutine()} />);
    expect(screen.getByText(/3 days · A · B · C · rest 90s/)).toBeVisible();
  });

  it("singularises '1 day' when there's only one day", () => {
    render(<ActiveRoutineCard routine={makeRoutine({ dayOrder: ["A"] })} />);
    expect(screen.getByText(/1 day · A · rest 90s/)).toBeVisible();
  });

  it("renders null when routine is undefined (loading state)", () => {
    const { container } = render(<ActiveRoutineCard routine={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when routine is null (no active routine)", () => {
    const { container } = render(<ActiveRoutineCard routine={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render a delete button when onDelete is not provided", () => {
    render(<ActiveRoutineCard routine={makeRoutine()} />);
    expect(screen.queryByRole("button", { name: /delete routine/i })).toBeNull();
  });

  it("renders a delete button when onDelete is provided and calls it on click", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(<ActiveRoutineCard routine={makeRoutine()} onDelete={spy} />);
    const btn = screen.getByRole("button", { name: /delete routine/i });
    await user.click(btn);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("disables the delete button when deleteDisabled is true", async () => {
    const spy = vi.fn();
    const user = userEvent.setup();
    render(
      <ActiveRoutineCard
        routine={makeRoutine()}
        onDelete={spy}
        deleteDisabled={true}
      />,
    );
    const btn = screen.getByRole("button", { name: /delete routine/i });
    expect(btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true").toBe(true);
    await user.click(btn);
    expect(spy).not.toHaveBeenCalled();
  });
});
