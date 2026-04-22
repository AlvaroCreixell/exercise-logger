import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CardioStep } from "@/features/onboarding/steps/CardioStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 10,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("CardioStep", () => {
  it("'No cardio' chip emits value 'No' and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<CardioStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("No cardio"));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "No" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
