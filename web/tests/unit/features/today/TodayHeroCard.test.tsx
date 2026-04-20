import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodayHeroCard } from "@/features/today/TodayHeroCard";

const baseProps = {
  dayLabelEyebrow: "TODAY · DAY A",
  dayTitle: "Heavy Squat + Horizontal Push/Pull",
  muscleGroups: ["Quads", "Chest", "Back"],
  exerciseCount: 7,
  setCount: 18,
  firstExerciseName: "Barbell Back Squat",
  ctaLabel: "▶ Start workout",
  onCtaClick: vi.fn(),
  ctaDisabled: false,
};

describe("TodayHeroCard", () => {
  it("renders eyebrow, title, muscle chips, exercise line, CTA", () => {
    render(<TodayHeroCard {...baseProps} />);
    expect(screen.getByText("TODAY · DAY A")).not.toBeNull();
    expect(screen.getByText(/Heavy Squat/)).not.toBeNull();
    expect(screen.getByText("Quads")).not.toBeNull();
    expect(screen.getByText("Chest")).not.toBeNull();
    expect(screen.getByText(/7 exercises · 18 sets · first up: Barbell Back Squat/)).not.toBeNull();
    expect(screen.getByRole("button", { name: /Start workout/i })).not.toBeNull();
  });

  it("calls onCtaClick when the CTA is clicked", async () => {
    const user = userEvent.setup();
    const spy = vi.fn();
    render(<TodayHeroCard {...baseProps} onCtaClick={spy} />);
    await user.click(screen.getByRole("button", { name: /Start workout/i }));
    expect(spy).toHaveBeenCalledOnce();
  });

  it("renders no muscle-chip row when muscleGroups is empty", () => {
    render(<TodayHeroCard {...baseProps} muscleGroups={[]} />);
    expect(screen.queryByText("Quads")).toBeNull();
  });

  it("omits the `first up` segment when firstExerciseName is null", () => {
    render(<TodayHeroCard {...baseProps} firstExerciseName={null} />);
    expect(screen.getByText(/7 exercises · 18 sets/)).not.toBeNull();
    expect(screen.queryByText(/first up/)).toBeNull();
  });

  it("disables the CTA when ctaDisabled is true", () => {
    render(<TodayHeroCard {...baseProps} ctaDisabled={true} />);
    const btn = screen.getByRole("button", { name: /Start workout/i });
    expect(btn.hasAttribute("disabled") || btn.getAttribute("aria-disabled") === "true").toBe(true);
  });
});
