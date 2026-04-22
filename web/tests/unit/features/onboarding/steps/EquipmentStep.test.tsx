import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EquipmentStep } from "@/features/onboarding/steps/EquipmentStep";

function makeProps(overrides = {}) {
  return {
    stepIndex: 6,
    answer: undefined,
    onAnswer: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("EquipmentStep", () => {
  it("Next is disabled when nothing is selected", () => {
    render(<EquipmentStep {...makeProps()} />);
    expect(screen.getByRole("button", { name: /^next$/i })).toBeDisabled();
  });

  it("tapping Barbell emits chip-multi with values:['Barbell']", async () => {
    const user = userEvent.setup();
    const onAnswer = vi.fn();
    render(<EquipmentStep {...makeProps({ onAnswer })} />);
    await user.click(screen.getByRole("button", { name: /^barbell$/i }));
    expect(onAnswer).toHaveBeenCalledWith({
      kind: "chip-multi",
      values: ["Barbell"],
    });
  });
});
