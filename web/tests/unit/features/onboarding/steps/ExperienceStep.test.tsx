import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExperienceStep } from "@/features/onboarding/steps/ExperienceStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 1,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("ExperienceStep", () => {
  it("tapping a chip emits {kind:'chip', value} and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<ExperienceStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText(/Intermediate/));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "Intermediate" });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
