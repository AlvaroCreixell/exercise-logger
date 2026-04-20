import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
