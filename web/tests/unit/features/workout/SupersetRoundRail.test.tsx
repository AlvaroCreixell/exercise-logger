// web/tests/unit/features/workout/SupersetRoundRail.test.tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SupersetRoundRail } from "@/features/workout/SupersetRoundRail";
import type { SupersetRailItem } from "@/features/workout/lib/superset-rhythm";

afterEach(cleanup);

function makeItems(): SupersetRailItem[] {
  return [
    { key: "A-1", side: "A", ordinal: 1, label: "A1", status: "complete" },
    { key: "B-1", side: "B", ordinal: 1, label: "B1", status: "current" },
    { key: "A-2", side: "A", ordinal: 2, label: "A2", status: "upcoming" },
    { key: "B-2", side: "B", ordinal: 2, label: "B2", status: "upcoming" },
  ];
}

describe("SupersetRoundRail", () => {
  it("renders one chip per item in order", () => {
    render(<SupersetRoundRail items={makeItems()} />);
    const list = screen.getByRole("list", { name: "Superset rounds" });
    const chips = list.querySelectorAll("[data-status]");
    expect(Array.from(chips).map((c) => c.textContent)).toEqual(["A1", "B1", "A2", "B2"]);
  });

  it("marks the current chip with aria-current=step", () => {
    render(<SupersetRoundRail items={makeItems()} />);
    const current = screen.getByText("B1").closest("[data-status]");
    expect(current).toHaveAttribute("aria-current", "step");
    expect(current).toHaveAttribute("data-status", "current");
  });

  it("does not set aria-current on complete or upcoming chips", () => {
    render(<SupersetRoundRail items={makeItems()} />);
    for (const label of ["A1", "A2", "B2"]) {
      const chip = screen.getByText(label).closest("[data-status]");
      expect(chip).not.toHaveAttribute("aria-current");
    }
  });

  it("exposes complete status on completed chips", () => {
    render(<SupersetRoundRail items={makeItems()} />);
    const chip = screen.getByText("A1").closest("[data-status]");
    expect(chip).toHaveAttribute("data-status", "complete");
    expect(screen.getByText("A1").closest("[data-status]")).toHaveAccessibleName(
      "A1 complete",
    );
  });

  it("renders nothing for an empty rail", () => {
    const { container } = render(<SupersetRoundRail items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
