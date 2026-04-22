import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionLengthStep } from "@/features/onboarding/steps/SessionLengthStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 4,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("SessionLengthStep", () => {
  it("tapping '60 min' emits numeric value '60' and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<SessionLengthStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("60 min"));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "60" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
