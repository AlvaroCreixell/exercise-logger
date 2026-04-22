import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoalStep } from "@/features/onboarding/steps/GoalStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 0,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("GoalStep", () => {
  it("tapping a preset chip emits chip-with-other with that value and auto-advances", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<GoalStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText("Build muscle"));
    expect(onAnswer).toHaveBeenCalledWith({
      kind: "chip-with-other",
      value: "Build muscle",
    });
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("tapping 'Something else…' reveals a text input and does NOT advance or commit", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    const onNext = vi.fn();
    render(<GoalStep {...makeProps({ onAnswer, onNext })} />);
    await user.click(screen.getByLabelText(/Something else/i));
    expect(screen.getByPlaceholderText(/e\.g\./i)).toBeInTheDocument();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(onNext).not.toHaveBeenCalled();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("typing in the Other input emits chip-with-other with value='Other' and otherText", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(
      <GoalStep
        {...makeProps({
          answer: { kind: "chip-with-other", value: "Other", otherText: "" },
          onAnswer,
        })}
      />
    );
    const input = screen.getByPlaceholderText(/e\.g\./i);
    await user.type(input, "parkour");
    expect(onAnswer).toHaveBeenLastCalledWith({
      kind: "chip-with-other",
      value: "Other",
      otherText: "parkour",
    });
  });
});
