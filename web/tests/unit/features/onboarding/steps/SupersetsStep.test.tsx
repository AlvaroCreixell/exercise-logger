import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupersetsStep } from "@/features/onboarding/steps/SupersetsStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 9,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("SupersetsStep", () => {
  it("'No supersets' chip has visible label 'No supersets' but emits value 'No'", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<SupersetsStep {...makeProps({ onAnswer })} />);
    await user.click(screen.getByLabelText(/No supersets/));
    expect(onAnswer).toHaveBeenCalledWith({ kind: "chip", value: "No" });
  });
});
