import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DaysPerWeekStep } from "@/features/onboarding/steps/DaysPerWeekStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 3,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("DaysPerWeekStep", () => {
  it("tapping a chip emits {kind:'chip', value} as numeric string and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<DaysPerWeekStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("4"));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "4" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
