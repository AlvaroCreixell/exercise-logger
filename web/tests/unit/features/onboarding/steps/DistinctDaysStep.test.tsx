import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DistinctDaysStep } from "@/features/onboarding/steps/DistinctDaysStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 5,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("DistinctDaysStep", () => {
  it("tapping '3' emits {kind:'chip', value:'3'} and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<DistinctDaysStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("3"));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "3" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("chip labels are numbers only — no parenthetical examples (D10)", () => {
    render(<DistinctDaysStep {...makeProps()} />);
    for (const n of ["1", "2", "3", "4", "5"]) {
      expect(screen.getByLabelText(n)).toBeInTheDocument();
    }
    const group = screen.getByRole("radiogroup", { name: /distinct days/i });
    expect(group.textContent ?? "").not.toMatch(/Push\/Pull\/Legs/);
    expect(group.textContent ?? "").not.toMatch(/Upper\/Lower/);
    expect(group.textContent ?? "").not.toMatch(/full-body/i);
    expect(screen.getByText(/full-body = 1/)).toBeInTheDocument();
  });
});
